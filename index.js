const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs').promises;
const path = require('path');
const { HolderFilter } = require('./filters');
require('dotenv').config();

// Load configuration from environment variables
const TOKEN_MINT_ADDRESS = process.env.TOKEN_MINT_ADDRESS || 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump';
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const MAX_HOLDERS_TO_SAVE = process.env.MAX_HOLDERS_TO_SAVE ? parseInt(process.env.MAX_HOLDERS_TO_SAVE) : null;

// Filter configuration from environment
const FILTER_OPTIONS = {
  excludeServices: process.env.EXCLUDE_SERVICES !== 'false',
  excludeWhales: process.env.EXCLUDE_WHALES !== 'false',
  whaleThresholdPercent: parseFloat(process.env.WHALE_THRESHOLD_PERCENT || '1'),
  minBalanceToInclude: parseInt(process.env.MIN_BALANCE_TO_INCLUDE || '1000000'),
};

class PumpHolderTracker {
  constructor(filterOptions = FILTER_OPTIONS) {
    this.connection = new Connection(RPC_ENDPOINT, 'confirmed');
    this.holders = new Map();
    this.dataDir = path.join(__dirname, 'data');
    this.filterOptions = filterOptions;
    this.filter = new HolderFilter(filterOptions);
  }

  async initialize() {
    // Create data directory if it doesn't exist
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log('Data directory initialized');
    } catch (error) {
      console.error('Error creating data directory:', error.message);
    }
  }

  async fetchTokenHolders() {
    console.log('Fetching token holders...');
    console.log(`Token Mint: ${TOKEN_MINT_ADDRESS}`);
    
    try {
      const mintPubkey = new PublicKey(TOKEN_MINT_ADDRESS);
      
      // Get all token accounts for this mint
      const tokenAccounts = await this.connection.getProgramAccounts(
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), // SPL Token Program
        {
          filters: [
            {
              dataSize: 165, // Size of token account
            },
            {
              memcmp: {
                offset: 0, // Mint address offset in token account
                bytes: mintPubkey.toBase58(),
              },
            },
          ],
        }
      );

      console.log(`Found ${tokenAccounts.length} token accounts`);

      // Process token accounts
      for (const accountInfo of tokenAccounts) {
        const data = accountInfo.account.data;
        
        // Parse token account data
        // Owner is at offset 32 (32 bytes for mint + 32 bytes for owner)
        const ownerPubkey = new PublicKey(data.slice(32, 64));
        
        // Amount is at offset 64 (8 bytes, little-endian)
        const amount = this.parseU64(data.slice(64, 72));
        
        if (amount > 0) {
          const ownerAddress = ownerPubkey.toBase58();
          
          if (this.holders.has(ownerAddress)) {
            this.holders.set(ownerAddress, this.holders.get(ownerAddress) + amount);
          } else {
            this.holders.set(ownerAddress, amount);
          }
        }
      }

      console.log(`Total unique holders: ${this.holders.size}`);
      return this.holders;
    } catch (error) {
      console.error('Error fetching token holders:', error.message);
      throw error;
    }
  }

  parseU64(buffer) {
    // Parse little-endian u64
    let result = 0n;
    for (let i = 0; i < 8; i++) {
      result += BigInt(buffer[i]) << BigInt(8 * i);
    }
    return result;
  }

  async saveHolders(includeFiltered = true) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Apply filters
    const filterResult = this.filter.filterHolders(this.holders);
    const { filtered, excluded, stats } = filterResult;
    
    console.log('\n' + this.filter.getFilterSummary());
    
    // Convert filtered holders to array
    const holdersArray = Array.from(filtered.entries()).map(([address, balance]) => ({
      address,
      balance: balance.toString(),
      balanceFormatted: (Number(balance) / 1e6).toFixed(6)
    }));

    // Sort by balance descending
    holdersArray.sort((a, b) => {
      const balanceA = BigInt(a.balance);
      const balanceB = BigInt(b.balance);
      if (balanceA > balanceB) return -1;
      if (balanceA < balanceB) return 1;
      return 0;
    });

    // Limit to top holders if MAX_HOLDERS_TO_SAVE is set
    const topHolders = MAX_HOLDERS_TO_SAVE ? holdersArray.slice(0, MAX_HOLDERS_TO_SAVE) : holdersArray;

    const data = {
      tokenMint: TOKEN_MINT_ADDRESS,
      timestamp: new Date().toISOString(),
      filterSettings: this.filterOptions,
      totalHolders: this.holders.size,
      filteredHolders: filtered.size,
      savedHolders: topHolders.length,
      filterStats: stats,
      holders: topHolders
    };

    // Save filtered holders
    const filename = `holders_filtered_${timestamp}.json`;
    const filepath = path.join(this.dataDir, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    console.log(`\nFiltered holders saved to: ${filepath}`);
    
    // Save as latest filtered
    const latestPath = path.join(this.dataDir, 'latest_filtered.json');
    await fs.writeFile(latestPath, JSON.stringify(data, null, 2));
    console.log(`Latest filtered data saved to: ${latestPath}`);
    
    // Save excluded wallets for review
    if (includeFiltered && (excluded.services.length > 0 || excluded.whales.length > 0)) {
      const excludedData = {
        timestamp: new Date().toISOString(),
        services: excluded.services.map(s => ({
          ...s,
          balanceFormatted: (Number(s.balance) / 1e6).toFixed(6)
        })),
        whales: excluded.whales.map(w => ({
          ...w,
          balanceFormatted: (Number(w.balance) / 1e6).toFixed(6)
        })),
        dust: excluded.dust.slice(0, 100) // Save only first 100 dust accounts
      };
      
      const excludedPath = path.join(this.dataDir, `excluded_${timestamp}.json`);
      await fs.writeFile(excludedPath, JSON.stringify(excludedData, null, 2));
      console.log(`Excluded wallets saved to: ${excludedPath}`);
    }

    return filepath;
  }

  async getStatistics() {
    const balances = Array.from(this.holders.values());
    const total = balances.reduce((sum, balance) => sum + balance, 0n);
    const average = total / BigInt(this.holders.size);
    
    const sortedBalances = balances.sort((a, b) => {
      if (a > b) return -1;
      if (a < b) return 1;
      return 0;
    });

    const stats = {
      totalHolders: this.holders.size,
      totalSupplyHeld: total.toString(),
      totalSupplyHeldFormatted: (Number(total) / 1e6).toFixed(2),
      averageBalance: average.toString(),
      averageBalanceFormatted: (Number(average) / 1e6).toFixed(6),
      largestHolder: sortedBalances[0]?.toString() || '0',
      largestHolderFormatted: sortedBalances[0] ? (Number(sortedBalances[0]) / 1e6).toFixed(2) : '0',
      smallestHolder: sortedBalances[sortedBalances.length - 1]?.toString() || '0',
      smallestHolderFormatted: sortedBalances[sortedBalances.length - 1] ? (Number(sortedBalances[sortedBalances.length - 1]) / 1e6).toFixed(6) : '0',
    };

    return stats;
  }

  async run() {
    try {
      console.log('\n=== Solana Token Holder Tracker ===');
      console.log(`RPC Endpoint: ${RPC_ENDPOINT}`);
      console.log(`Token: ${TOKEN_MINT_ADDRESS}`);
      console.log(`Filters: Services=${FILTER_OPTIONS.excludeServices}, Whales=${FILTER_OPTIONS.excludeWhales} (>${FILTER_OPTIONS.whaleThresholdPercent}%)`);
      
      await this.initialize();
      await this.fetchTokenHolders();
      
      const stats = await this.getStatistics();
      console.log('\n=== Token Holder Statistics (Before Filtering) ===');
      console.log(`Total Holders: ${stats.totalHolders}`);
      console.log(`Total Supply Held: ${stats.totalSupplyHeldFormatted} PUMP`);
      console.log(`Average Balance: ${stats.averageBalanceFormatted} PUMP`);
      console.log(`Largest Holder: ${stats.largestHolderFormatted} PUMP`);
      console.log(`Smallest Holder: ${stats.smallestHolderFormatted} PUMP`);
      
      await this.saveHolders();
      console.log('\n✓ Process completed successfully!');
    } catch (error) {
      console.error('Error in run process:', error);
      throw error;
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const tracker = new PumpHolderTracker();
  tracker.run().catch(console.error);
}

module.exports = PumpHolderTracker;
