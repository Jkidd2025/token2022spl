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

- **Token Burning**

  - Dedicated burn account with initial allocation
  - Controlled token burning mechanism
  - Two-phase burn process (transfer then burn)
  - Burn amount validation
  - Balance verification
  - Initial 10% supply allocation (configurable)

- **WBTC Distribution**

  - Automated distribution of WBTC to token holders
  - Jupiter API integration for optimal swaps
  - Configurable distribution schedule
  - Proportional distribution based on holdings

- **Reward System**

  - Base token reward distribution
  - Configurable reward percentages
  - Batch processing for efficiency

## Technical Specifications

- **Network**: Solana Mainnet
- **RPC Provider**: Helius
- **Token Standard**: SPL Token 2022
- **DEX Integration**: Jupiter API
- **Automation**: Node-cron scheduling

## Account Structure

The implementation uses several types of accounts to manage different aspects of the token ecosystem:

### Core Accounts

1. **Mint Account**

   - Primary token account representing the SPL Token 2022
   - Manages token supply and metadata
   - Contains transfer fee configuration
   - Includes permanent delegate authority
   - Has metadata pointer extension

2. **Fee Collector Account**

   - Collects 5% transfer fee from all token transactions
   - Acts as withdrawal destination for collected fees
   - Used for reward distribution
   - Associated Token Account (ATA) holds actual token balances

3. **Burn Account**

   - Dedicated account for token burning operations
   - Receives initial allocation of 10% total supply (configurable)
   - Acts as intermediate holder before burns
   - Provides transparent burn tracking
   - Controlled by permanent delegate authority

4. **Metadata Account**
   - Stores token name, symbol, and URI
   - Contains creator information
   - Manages collection data
   - Handles token usage parameters

### User Accounts

5. **User Token Accounts (ATAs)**

   - Automatically created for each token holder
   - Manages individual token balances
   - Used for transfers and receiving rewards
   - Created on-demand during first transfer

6. **WBTC Token Accounts**
   - Holds WBTC balances for distributions
   - Created during swap operations
   - Used for receiving WBTC rewards
   - Automatically managed during distribution

### Administrative Accounts

7. **Initial Holder Account**

   - Receives 90% of initial supply during mint (configurable)
   - Serves as starting point for token distribution
   - Verified for balance after initial mint

8. **Permanent Delegate Account**
   - Manages burn operations through burn account
   - Has non-revocable permanent authority
   - Controls token burning mechanism

### Security Features

- All authority accounts (mint, freeze) are revoked after initial setup
- Token accounts are verified before operations
- Batch processing implemented for distributions
- Balance checks performed before operations
- Automatic ATA creation for seamless user experience
- Two-phase burn process for enhanced security

### Account Creation Flow

1. Mint account creation with extensions
2. Fee collector and burn account setup
3. Metadata account creation and linking
4. Initial supply distribution (90/10 split between holder/burn)
5. On-demand user token account creation
6. WBTC account creation during distribution

### Burn Process Flow

1. Tokens are transferred to dedicated burn account
2. Validation of burn account balance
3. Execution of burn operation
4. Verification of successful burn
5. Transaction signatures stored for audit

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
