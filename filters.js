// Known service wallets to exclude
const KNOWN_SERVICES = [
  // Pump.fun program and related
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',  // Pump.fun program
  'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1', // Pump.fun bonding curve
  'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM', // Pump.fun fee receiver
  
  // Major DEXes
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',  // Raydium Authority V4
  'EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q',  // Raydium LP
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',  // Raydium AMM
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',   // Jupiter Aggregator
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',   // Jupiter V6
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',   // Orca Whirlpool
  
  // Major CEXes (if they have identifiable wallets)
  // Add more as you discover them
];

// Wallet name patterns to detect services
const SERVICE_PATTERNS = {
  isProgramAccount: (address) => {
    // Program accounts often end in specific patterns
    return address.endsWith('1111111111111111111111111111');
  },
  
  // You can add more pattern detection here
};

class HolderFilter {
  constructor(options = {}) {
    this.whaleThresholdPercent = options.whaleThresholdPercent || 1; // 1% by default
    this.minBalanceToInclude = options.minBalanceToInclude || 0; // Minimum balance in tokens
    this.excludeServices = options.excludeServices !== false; // true by default
    this.excludeWhales = options.excludeWhales !== false; // true by default
    this.customServiceWallets = options.customServiceWallets || [];
    
    this.allServiceWallets = [...KNOWN_SERVICES, ...this.customServiceWallets];
    this.stats = {
      totalHolders: 0,
      servicesFiltered: 0,
      whalesFiltered: 0,
      dustFiltered: 0,
      remainingHolders: 0
    };
  }

  isServiceWallet(address) {
    if (!this.excludeServices) return false;
    
    // Check known service wallets
    if (this.allServiceWallets.includes(address)) {
      return true;
    }
    
    // Check patterns
    for (const [name, checkFn] of Object.entries(SERVICE_PATTERNS)) {
      if (checkFn(address)) {
        return true;
      }
    }
    
    return false;
  }

  isWhale(balance, totalSupply) {
    if (!this.excludeWhales) return false;
    
    const percentageOfSupply = (Number(balance) / Number(totalSupply)) * 100;
    return percentageOfSupply > this.whaleThresholdPercent;
  }

  isDust(balance) {
    return Number(balance) < this.minBalanceToInclude;
  }

  filterHolders(holdersMap) {
    this.stats.totalHolders = holdersMap.size;
    
    // Calculate total supply
    const totalSupply = Array.from(holdersMap.values()).reduce((sum, bal) => sum + bal, 0n);
    
    const filtered = new Map();
    const excluded = {
      services: [],
      whales: [],
      dust: []
    };
    
    for (const [address, balance] of holdersMap.entries()) {
      // Check if it's a service wallet
      if (this.isServiceWallet(address)) {
        this.stats.servicesFiltered++;
        excluded.services.push({ address, balance: balance.toString() });
        continue;
      }
      
      // Check if it's a whale
      if (this.isWhale(balance, totalSupply)) {
        this.stats.whalesFiltered++;
        excluded.whales.push({ 
          address, 
          balance: balance.toString(),
          percentage: ((Number(balance) / Number(totalSupply)) * 100).toFixed(2)
        });
        continue;
      }
      
      // Check if it's dust
      if (this.isDust(balance)) {
        this.stats.dustFiltered++;
        excluded.dust.push({ address, balance: balance.toString() });
        continue;
      }
      
      // Keep this holder
      filtered.set(address, balance);
    }
    
    this.stats.remainingHolders = filtered.size;
    
    return {
      filtered,
      excluded,
      stats: this.stats,
      totalSupply: totalSupply.toString()
    };
  }

  getFilterSummary() {
    return `
=== Filter Summary ===
Total Holders: ${this.stats.totalHolders}
Services Filtered: ${this.stats.servicesFiltered}
Whales Filtered: ${this.stats.whalesFiltered} (>${this.whaleThresholdPercent}% of supply)
Dust Filtered: ${this.stats.dustFiltered}
Remaining Holders: ${this.stats.remainingHolders}
    `.trim();
  }
}

module.exports = { HolderFilter, KNOWN_SERVICES };
