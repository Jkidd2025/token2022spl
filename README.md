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
TOKEN_DECIMALS=6
TRANSFER_FEE_BASIS_POINTS=500
DISTRIBUTION_SCHEDULE="0 0 * * *"  # Daily at midnight
MINIMUM_FEE_AMOUNT=1000000
RETRY_DELAY=15
MAX_RETRIES=3
```
