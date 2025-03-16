# SPL Token 2022 Implementation

A comprehensive implementation of an SPL Token 2022 with advanced features including fee extensions, rewards, WBTC distribution, and burns.

## Features

- **Core Token Functionality**

  - Standard SPL Token 2022 implementation
  - Initial supply minting
  - Transfer capabilities

- **Fee System**

  - 5% Transfer Fee
  - Automatic fee collection
  - Fee collector account management

- **WBTC Distribution**

  - Automated distribution of WBTC to token holders
  - Jupiter API integration for optimal swaps
  - Configurable distribution schedule
  - Proportional distribution based on holdings

- **Reward System**

  - Base token reward distribution
  - Configurable reward percentages
  - Batch processing for efficiency

- **Token Burning**

  - Controlled token burning mechanism
  - Burn amount validation
  - Balance verification

- **Security Features**
  - Immutable settings (revoked after initial mint)
  - Freeze Authority (revoked after initial mint)
  - Mint Authority (revoked after initial mint)

## Technical Specifications

- **Network**: Solana Mainnet
- **RPC Provider**: Helius
- **Token Standard**: SPL Token 2022
- **DEX Integration**: Jupiter API
- **Automation**: Node-cron scheduling

## Prerequisites

- Node.js v16.0.0 or higher
- Solana CLI Tools
- PM2 (for production deployment)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/Jkidd2025/token2022spl.git
cd token2022spl
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:

```bash
# Create .env file
SOLANA_RPC_URL=your_rpc_url
WALLET_PRIVATE_KEY=your_private_key
TOKEN_DECIMALS=9
TRANSFER_FEE_BASIS_POINTS=500
DISTRIBUTION_SCHEDULE="0 0 * * *"  # Daily at midnight
MINIMUM_FEE_AMOUNT=1000000
RETRY_DELAY=15
MAX_RETRIES=3
```

## Usage

### Token Management

```bash
# Create new token
npm run create-token

# Perform initial mint
npm run initial-mint <mint-address> [initial-supply] [decimals]

# Burn tokens
npm run burn <mint-address> <amount> [burn-from-address] [decimals]
```

### Distribution Features

```bash
# Distribute base token rewards
npm run distribute-rewards <mint-address> <fee-collector-address> <reward-amount>

# Manual WBTC distribution
npm run distribute-wbtc <base-token-mint> <fee-collector-address>

# Start automated WBTC distribution
npm run auto-distribute <base-token-mint> <fee-collector-address>
```

### Production Deployment

1. Build the project:

```bash
npm run build
```

2. Start with PM2:

```bash
pm2 start ecosystem.config.js
```

3. Monitor the process:

```bash
pm2 logs wbtc-distributor
pm2 status
```

## WBTC Distribution Flow

The WBTC distribution process follows these steps:

1. **Fee Collection**

   - 5% fee collected on all transfers
   - Fees accumulate in fee collector account

2. **Distribution Trigger**

   - Automated check at scheduled intervals
   - Manual trigger option available
   - Minimum fee threshold verification

3. **Swap Process**

   - Base Token → SOL (via Jupiter API)
   - SOL → WBTC (via Jupiter API)
   - Best route calculation
   - Slippage protection

4. **Distribution**
   - Proportional distribution to token holders
   - Batch processing for gas efficiency
   - Automatic retry on failure
   - Transaction verification

## Architecture

The project follows a modular architecture with the following components:

1. Core Token Implementation
2. Fee Extension Module
3. Jupiter API Integration
4. Automated Distribution System
5. Security Controls

## Configuration

### Distribution Schedule (Cron Syntax)

- Daily: `0 0 * * *`
- Hourly: `0 * * * *`
- Every 12 hours: `0 */12 * * *`
- Custom: Modify `DISTRIBUTION_SCHEDULE` in .env

### Automation Settings

- `MINIMUM_FEE_AMOUNT`: Minimum fees to trigger distribution
- `RETRY_DELAY`: Minutes between retry attempts
- `MAX_RETRIES`: Maximum number of retry attempts

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security Considerations

- All fee calculations are handled on-chain
- Jupiter API integration for secure swaps
- Automated retry mechanism with limits
- Transaction confirmation verification
- Slippage protection in swaps

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

Project Link: [https://github.com/Jkidd2025/token2022spl](https://github.com/Jkidd2025/token2022spl)
