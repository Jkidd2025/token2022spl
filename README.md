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

### Burn Process Implementation

#### Interface Definition

```typescript
interface BurnResult {
  transferToBurnAmount: string; // Original amount to burn
  burnAmount: string; // Amount without decimals
  actualBurnAmount: string; // Amount with decimals
  transferSignature: string; // Transfer tx signature
  burnSignature: string; // Burn tx signature
  burnTokenAccount: string; // Burn account address
  remainingBalance: string; // Remaining balance after burn
}
```

#### Complete Burn Flow

1. **Initialization Phase**

   - Parse input parameters
   - Set up Solana connection and wallet
   - Get required account addresses
   - Calculate burn amount with decimals

2. **Pre-burn Validation**

   - Verify burn account exists
   - Check mint initialization
   - Validate permanent delegate authority
   - Log operation details

3. **Transfer Phase**

   ```typescript
   // Transfer tokens to burn account
   const transferTransaction = new Transaction().add(
     createTransferInstruction(
       sourceTokenAccount,
       burnTokenAccount,
       wallet.publicKey,
       actualBurnAmount,
       [],
       TOKEN_2022_PROGRAM_ID
     )
   );
   ```

   - Transfer tokens to dedicated burn account
   - Confirm transfer transaction
   - Log transfer details and signature

4. **Burn Phase**

   ```typescript
   // Execute burn transaction
   const burnTransaction = new Transaction().add(
     createBurnInstruction(
       burnTokenAccount,
       mint,
       wallet.publicKey,
       actualBurnAmount,
       [],
       TOKEN_2022_PROGRAM_ID
     )
   );
   ```

   - Validate burn parameters
   - Execute burn transaction
   - Verify burn success

5. **Verification Phase**
   - Check remaining balance
   - Verify burn account state
   - Return detailed results
   - Store transaction signatures

#### Security Features

- Two-phase burn process for enhanced security
- Transaction confirmation checks at each phase
- Balance verification before and after operations
- Permanent delegate authority validation
- Comprehensive logging for audit trail
- Robust error handling

#### CLI Usage

```bash
ts-node burnTokens.ts <mint-address> <amount> <burn-account-address> [source-address] [decimals]
```

#### Example Implementation

```typescript
// Burn 1000 tokens
await burnTokens(
  'mint_address', // Token mint
  '1000', // Amount to burn
  'burn_account_address', // Dedicated burn account
  'source_address', // Optional source
  { decimals: 9 } // Optional config
);
```

#### Return Value

```typescript
{
  transferToBurnAmount: "1000",
  burnAmount: "1000",
  actualBurnAmount: "1000000000000",  // With 9 decimals
  transferSignature: "tx_signature_1",
  burnSignature: "tx_signature_2",
  burnTokenAccount: "burn_account_address",
  remainingBalance: "0"
}
```

### Token Creation Implementation

#### Token Extensions

```typescript
const extensions = [
  ExtensionType.TransferFeeConfig, // Enable 5% transfer fee
  ExtensionType.MetadataPointer, // Token metadata support
  ExtensionType.PermanentDelegate, // For burn mechanism
];
```

#### Complete Creation Flow

1. **Initialization Phase**

   - Set up Solana connection
   - Initialize wallet from private key
   - Generate fee collector keypair
   - Generate burn account keypair
   - Calculate mint space for extensions

2. **Mint Creation**

   ```typescript
   const mint = await createMint(
     connection,
     wallet,
     wallet.publicKey, // Mint authority
     wallet.publicKey, // Freeze authority
     decimals,
     mintKeypair,
     {
       commitment: 'confirmed',
     },
     TOKEN_2022_PROGRAM_ID
   );
   ```

   - Create mint account with specified decimals
   - Set initial authorities
   - Configure with TOKEN_2022_PROGRAM_ID

3. **Account Setup**

   - Create fee collector's associated token account
   - Create burn account's associated token account
   - Initialize accounts in single transaction

4. **Extension Configuration**

   ```typescript
   // Transfer fee configuration
   createInitializeTransferFeeConfigInstruction(
     mint,
     wallet.publicKey, // Fee authority
     feeCollectorKeypair.publicKey, // Fee destination
     feeBasisPoints, // 5% fee
     BigInt(0), // Max fee
     TOKEN_2022_PROGRAM_ID
   );

   // Permanent delegate for burns
   createInitializePermanentDelegateInstruction(mint, wallet.publicKey, TOKEN_2022_PROGRAM_ID);
   ```

   - Set up transfer fee mechanism
   - Configure permanent delegate
   - Add metadata pointer

5. **Metadata Creation**
   ```typescript
   const metadata = {
     ...DEFAULT_TOKEN_METADATA,
     ...tokenMetadataConfig,
     creators: [
       {
         address: wallet.publicKey.toString(),
         verified: true,
         share: 100,
       },
     ],
   };
   ```
   - Create token metadata
   - Set creator information
   - Configure token properties

#### Security Features

- Separate keypairs for fee collection and burns
- Transaction confirmation checks
- Error handling and validation
- Secure key management
- Comprehensive logging

#### Return Value

```typescript
{
  mint: string,                    // Token mint address
  feeCollector: string,           // Fee collector address
  feeCollectorTokenAccount: string, // Fee collector token account
  burnAccount: string,            // Burn account address
  burnTokenAccount: string,       // Burn token account
  extensionsSignature: string,    // Extension setup transaction
  metadata: MetadataResult,       // Token metadata result
}
```

#### Important Addresses

The script saves critical addresses for future reference:

- Fee Collector Address and Secret Key
- Fee Collector Token Account
- Burn Account Address and Secret Key
- Burn Token Account
- Mint Address

#### Usage

```bash
ts-node createToken.ts
```

Environment variables required:

```env
SOLANA_RPC_URL=your_rpc_url
WALLET_PRIVATE_KEY=your_private_key
TOKEN_DECIMALS=9
TRANSFER_FEE_BASIS_POINTS=500  # 5%
```

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

### Fee Collector and Distribution System

#### Fee Collection Flow

1. **Fee Collection**

   - Automatic 5% fee collection on all transfers
   - Fees accumulate in dedicated fee collector account
   - Automated SOL balance management for transaction fees

2. **Fee Distribution**

   - 50% converted to SOL (returned to main wallet)
   - 50% converted to WBTC for holder distribution
   - Automated distribution schedule (configurable)

3. **Automated Management**
   - 6-hour SOL balance checks
   - Automatic top-ups when needed
   - Configurable retry mechanism
   - Error handling and logging

#### Distribution Configuration

```typescript
interface AutomationConfig {
  schedule: string; // Cron schedule expression
  minimumFeeAmount: bigint; // Minimum fees to trigger distribution
  retryDelay: number; // Delay in minutes before retry
  maxRetries: number; // Maximum retry attempts
}
```

#### Default Settings

```typescript
{
  schedule: '0 0 * * *',     // Daily at midnight
  minimumFeeAmount: 1000000000, // Adjust based on decimals
  retryDelay: 15,           // 15 minutes
  maxRetries: 3             // 3 retries
}
```

#### Swap Process

1. **Reserve Portion (50%)**

   - Base tokens → SOL
   - Automatically retained in main wallet
   - Used for operational costs

2. **Distribution Portion (50%)**
   - Base tokens → SOL → WBTC
   - Distributed to token holders
   - Proportional to holdings

#### Security Features

- Automated balance monitoring
- Configurable retry mechanism
- Transaction confirmation checks
- Comprehensive error handling
- Batch processing for distributions

#### CLI Usage

```bash
ts-node automatedDistribution.ts <base-token-mint> <fee-collector-address> [excluded-addresses...]
```
