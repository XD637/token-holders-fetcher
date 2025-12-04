# Solana Token Holder Tracker

Track and analyze holders of any Solana SPL token with advanced filtering capabilities. Originally built for pump.fun PUMP token, but works with **any Solana token**.

## Features

- ✅ Fetch all token holders from Solana blockchain
- ✅ **Works with ANY Solana SPL token** (PUMP, USDC, SOL, BONK, etc.)
- ✅ Store holder data with timestamps
- ✅ Calculate holder statistics (total, average, largest, smallest)
- ✅ **Filter out known service wallets** (DEXes, CEXes, program accounts)
- ✅ **Exclude whale wallets** (configurable threshold, default >1% of supply)
- ✅ **Remove dust wallets** (configurable minimum balance)
- ✅ Export data in JSON format with filter statistics
- ✅ Environment-based configuration for easy deployment

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/solana-token-holder-tracker.git
cd solana-token-holder-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Configure your environment:
```bash
cp .env.example .env
```

4. Edit `.env` file with your settings:
```env
# Set your RPC endpoint (use free public RPC or get a premium one from QuickNode/Alchemy/Helius)
RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# Set the token you want to track
TOKEN_MINT_ADDRESS=CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump

# Configure filters
EXCLUDE_SERVICES=true
EXCLUDE_WHALES=true
WHALE_THRESHOLD_PERCENT=1
MIN_BALANCE_TO_INCLUDE=1000000
```

## Usage

Run the tracker:

```bash
npm start
# or
node index.js
```

This will:
1. Connect to Solana RPC
2. Fetch all current token holders
3. Apply filters (services, whales, dust)
4. Calculate statistics
5. Save filtered data to `data/` directory with timestamp
6. Save latest data to `data/latest_filtered.json`
7. Save excluded wallets to `data/excluded_*.json` for review

## Tracking Different Tokens

To track a different Solana token, simply change the `TOKEN_MINT_ADDRESS` in your `.env` file:

### Examples:

**PUMP Token (pump.fun):**
```env
TOKEN_MINT_ADDRESS=CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump
```

**USDC:**
```env
TOKEN_MINT_ADDRESS=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

**Wrapped SOL:**
```env
TOKEN_MINT_ADDRESS=So11111111111111111111111111111111111111112
```

**Bonk:**
```env
TOKEN_MINT_ADDRESS=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
```

You can find token mint addresses on [Solscan](https://solscan.io) or [SolanaFM](https://solana.fm).

## Output

The script generates JSON files in the `data/` directory:

### Filtered Holders (`holders_filtered_TIMESTAMP.json`)
Contains only retail/regular holders after filtering:
```json
{
  "tokenMint": "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump",
  "timestamp": "2025-12-04T10:30:00.000Z",
  "filterSettings": {
    "excludeServices": true,
    "excludeWhales": true,
    "whaleThresholdPercent": 1,
    "minBalanceToInclude": 1000000
  },
  "totalHolders": 77045,
  "filteredHolders": 75234,
  "savedHolders": 75234,
  "filterStats": {
    "servicesFiltered": 8,
    "whalesFiltered": 15,
    "dustFiltered": 1788
  },
  "holders": [...]
}
```

### Excluded Wallets (`excluded_TIMESTAMP.json`)
Lists all filtered-out wallets for review:
- **Services**: DEXes, CEXes, program accounts
- **Whales**: Holders with >1% of supply (configurable)
- **Dust**: Small balance holders

## Configuration

All configuration is done via the `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `RPC_ENDPOINT` | Solana RPC URL (use QuickNode/Alchemy for better performance) | `https://api.mainnet-beta.solana.com` |
| `TOKEN_MINT_ADDRESS` | The Solana token mint address to track | PUMP token address |
| `EXCLUDE_SERVICES` | Filter out DEXes, CEXes, burn addresses | `true` |
| `EXCLUDE_WHALES` | Filter out large holders | `true` |
| `WHALE_THRESHOLD_PERCENT` | Percentage of supply to be considered a whale | `1` (1%) |
| `MIN_BALANCE_TO_INCLUDE` | Minimum token balance (in smallest units) | `1000000` (1 token with 6 decimals) |
| `MAX_HOLDERS_TO_SAVE` | Limit number of holders saved (leave empty for all) | `` (unlimited) |

### Recommended RPC Providers

For better reliability and performance, use a premium RPC:
- **[QuickNode](https://www.quicknode.com/)** - Free tier available
- **[Alchemy](https://www.alchemy.com/)** - Free tier available
- **[Helius](https://www.helius.dev/)** - Free tier available

### Adding Custom Service Wallets

To add more known service wallets to the filter, edit `filters.js`:

```javascript
const KNOWN_SERVICES = [
  // Add new wallet addresses here
  'YourServiceWalletAddress...',
];
```

## Common Use Cases

### 1. Track Retail Holders Only
```env
EXCLUDE_SERVICES=true
EXCLUDE_WHALES=true
WHALE_THRESHOLD_PERCENT=0.5  # More aggressive whale filter
MIN_BALANCE_TO_INCLUDE=1000000
```

### 2. Get All Holders (No Filtering)
```env
EXCLUDE_SERVICES=false
EXCLUDE_WHALES=false
MIN_BALANCE_TO_INCLUDE=0
```

### 3. Find Top 1000 Holders
```env
EXCLUDE_SERVICES=true
EXCLUDE_WHALES=false
MAX_HOLDERS_TO_SAVE=1000
```

### 4. Analyze Large Holders Only
```env
EXCLUDE_SERVICES=true
EXCLUDE_WHALES=false
MIN_BALANCE_TO_INCLUDE=1000000000  # Minimum 1000 tokens (with 6 decimals)
```

## Token Decimal Reference

Different tokens have different decimal places. Adjust `MIN_BALANCE_TO_INCLUDE` accordingly:

| Decimals | 1 Token = | Example Tokens |
|----------|-----------|----------------|
| 6 | 1,000,000 | USDC, USDT, PUMP |
| 9 | 1,000,000,000 | SOL, BONK, most SPL tokens |

## Troubleshooting

**Rate Limiting / Slow Performance:**
- Use a premium RPC provider (QuickNode, Alchemy, Helius)
- Public RPCs have strict rate limits

**Out of Memory:**
- Set `MAX_HOLDERS_TO_SAVE` to limit output size
- Increase `MIN_BALANCE_TO_INCLUDE` to filter more dust wallets

**Wrong Token Data:**
- Verify `TOKEN_MINT_ADDRESS` is correct on [Solscan](https://solscan.io)
- Ensure you're using the actual mint address, not a token account

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Future Enhancements

- Automatic detection of new service wallets
- Historical tracking and comparison
- Real-time monitoring with websockets
- Export to CSV format
- Web dashboard for visualization
- Multi-token tracking in single run

## License

MIT

## Support

If you find this tool useful, consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs via Issues
- 💡 Suggesting new features
- 🤝 Contributing code improvements

---

**Disclaimer:** This tool is for educational and analytical purposes only. Always verify data independently before making any decisions.
