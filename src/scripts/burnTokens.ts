/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
  ConfirmOptions,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  createBurnInstruction,
  getAssociatedTokenAddress,
  getAccount,
  getMint,
  ExtensionType,
  Mint,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { getConfirmationStrategy } from '../utils/transactionConfirmation';
import { retry } from '../utils/retry';

dotenv.config();

// Constants
const WBTC_DECIMALS = 8;
const MAX_RETRIES = 3;
const TRANSACTION_TIMEOUT = 90000; // 90 seconds
const MINIMUM_BURN_AMOUNT = BigInt(1);

interface BurnValidationConfig {
  maxBurnAmount: bigint;
  largeTransferThreshold: bigint;
  burnRateLimit: number;
  burnRateWindow: number; // in seconds
}

const DEFAULT_BURN_CONFIG: BurnValidationConfig = {
  maxBurnAmount: BigInt(1_000_000_000_000), // 1M tokens with 8 decimals
  largeTransferThreshold: BigInt(100_000_000_000), // 100k tokens with 8 decimals
  burnRateLimit: 5, // 5 burns per window
  burnRateWindow: 24 * 60 * 60, // 24 hours in seconds
};

interface BurnEvent {
  mint: string;
  amount: bigint;
  burnAddress: string;
  timestamp: number;
  signature: string;
  delegateAuthority: string;
  validations: {
    preValidation: boolean;
    simulation: boolean;
    postValidation: boolean;
  };
  error?: string;
  retryCount?: number;
}

interface BurnResult {
  burnAmount: string;
  actualBurnAmount: string;
  signature: string;
  tokenAccount: string;
  remainingBalance: string;
  retryCount?: number;
}

class BurnMonitor {
  private static readonly LARGE_BURN_THRESHOLD = DEFAULT_BURN_CONFIG.largeTransferThreshold;
  private static recentBurns: Map<string, BurnEvent[]> = new Map();

  static async logBurnEvent(event: BurnEvent): Promise<void> {
    // Store burn event in memory cache
    const mintBurns = this.recentBurns.get(event.mint) || [];
    const windowStart = Date.now() - DEFAULT_BURN_CONFIG.burnRateWindow * 1000;

    // Clean old events
    const recentBurns = mintBurns.filter((burn) => burn.timestamp >= windowStart);
    recentBurns.push(event);
    this.recentBurns.set(event.mint, recentBurns);

    // Log the burn event
    console.log('Burn Event:', {
      mint: event.mint,
      amount: event.amount.toString(),
      burnAddress: event.burnAddress,
      timestamp: new Date(event.timestamp).toISOString(),
      signature: event.signature,
      delegateAuthority: event.delegateAuthority,
      validations: event.validations,
      error: event.error,
      retryCount: event.retryCount,
    });

    // Alert on large burns
    if (event.amount > this.LARGE_BURN_THRESHOLD) {
      console.warn('Large burn detected:', {
        mint: event.mint,
        amount: event.amount.toString(),
        burnAddress: event.burnAddress,
      });
    }
  }

  static getRecentBurns(mint: string, windowInSeconds: number): BurnEvent[] {
    const mintBurns = this.recentBurns.get(mint) || [];
    const windowStart = Date.now() - windowInSeconds * 1000;
    return mintBurns.filter((burn) => burn.timestamp >= windowStart);
  }
}

async function getRecentBurnOperations(
  connection: Connection,
  mint: PublicKey,
  windowInSeconds: number
): Promise<BurnEvent[]> {
  // Use in-memory cache from BurnMonitor
  return BurnMonitor.getRecentBurns(mint.toBase58(), windowInSeconds);
}

async function validateBurnParameters(
  connection: Connection,
  mint: PublicKey,
  burnFromAddress: PublicKey,
  amount: bigint,
  wallet: Keypair,
  config: BurnValidationConfig
): Promise<void> {
  try {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Burn amount must be positive');
    }
    if (amount < MINIMUM_BURN_AMOUNT) {
      throw new Error(`Burn amount must be at least ${MINIMUM_BURN_AMOUNT}`);
    }

    // Validate connection and wallet
    if (!process.env.SOLANA_RPC_URL) {
      throw new Error('SOLANA_RPC_URL environment variable is not set');
    }
    if (!process.env.WALLET_PRIVATE_KEY) {
      throw new Error('WALLET_PRIVATE_KEY environment variable is not set');
    }

    // Get token account info
    const tokenAccount = await getAccount(
      connection,
      burnFromAddress,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    // Verify sufficient balance
    if (tokenAccount.amount < amount) {
      throw new Error(
        `Insufficient balance for burn. Required: ${amount}, Available: ${tokenAccount.amount}`
      );
    }

    // Get mint info
    const mintInfo = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);

    // Verify mint is initialized
    if (!mintInfo.isInitialized) {
      throw new Error('Token mint is not initialized');
    }

    // Verify decimals
    if (mintInfo.decimals !== WBTC_DECIMALS) {
      throw new Error(
        `Invalid token decimals. Expected ${WBTC_DECIMALS}, got ${mintInfo.decimals}`
      );
    }

    // Verify mint authority is revoked (as per our token design)
    if (mintInfo.mintAuthority) {
      throw new Error('Token mint authority should be revoked');
    }

    // Check for permanent delegate extension
    const mintExtensions = (mintInfo as any).extensions || [];
    const delegateInfo = mintExtensions.find(
      (ext: { extensionType: ExtensionType; delegate?: PublicKey }) =>
        ext.extensionType === ExtensionType.PermanentDelegate
    );

    if (!delegateInfo || !delegateInfo.delegate?.equals(wallet.publicKey)) {
      throw new Error('Invalid delegate authority');
    }

    // Check burn limits
    if (amount > config.maxBurnAmount) {
      throw new Error(`Burn amount exceeds maximum allowed: ${config.maxBurnAmount.toString()}`);
    }

    // Check rate limiting
    const recentBurns = await getRecentBurnOperations(connection, mint, config.burnRateWindow);
    if (recentBurns.length >= config.burnRateLimit) {
      throw new Error(
        `Burn rate limit exceeded. Maximum ${config.burnRateLimit} burns per ${config.burnRateWindow} seconds`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Burn validation failed: ${error.message}`);
    }
    throw error;
  }
}

async function burnTokens(
  mintAddress: string,
  amount: string,
  burnFromAddress?: string,
  options?: {
    decimals?: number;
    skipValidation?: boolean;
    validationConfig?: Partial<BurnValidationConfig>;
  }
): Promise<BurnResult> {
  // Validate RPC URL and wallet key upfront
  if (!process.env.SOLANA_RPC_URL) {
    throw new Error('SOLANA_RPC_URL environment variable is not set');
  }
  if (!process.env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY environment variable is not set');
  }

  const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  const wallet = Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!)));

  const mint = new PublicKey(mintAddress);

  // Merge validation config with defaults
  const burnConfig: BurnValidationConfig = {
    ...DEFAULT_BURN_CONFIG,
    ...options?.validationConfig,
  };

  // Initialize burn event
  const burnEvent: BurnEvent = {
    mint: mintAddress,
    amount: BigInt(amount),
    burnAddress: burnFromAddress || wallet.publicKey.toBase58(),
    timestamp: Date.now(),
    signature: '',
    delegateAuthority: wallet.publicKey.toBase58(),
    validations: {
      preValidation: false,
      simulation: false,
      postValidation: false,
    },
    retryCount: 0,
  };

  try {
    // If no burn address specified, use the wallet's token account
    const burnFrom = burnFromAddress
      ? new PublicKey(burnFromAddress)
      : await getAssociatedTokenAddress(mint, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);

    // Always use WBTC decimals
    const decimals = WBTC_DECIMALS;

    const burnAmount = BigInt(amount);
    const actualBurnAmount = burnAmount * BigInt(10 ** decimals);

    // Validate burn parameters
    if (!options?.skipValidation) {
      await validateBurnParameters(
        connection,
        mint,
        burnFrom,
        actualBurnAmount,
        wallet,
        burnConfig
      );
      burnEvent.validations.preValidation = true;
    }

    console.log(
      `Preparing to burn ${amount} tokens (${actualBurnAmount.toString()} with decimals)`
    );

    // Create burn transaction
    const transaction = new Transaction().add(
      createBurnInstruction(
        burnFrom,
        mint,
        wallet.publicKey,
        actualBurnAmount,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    // Simulate transaction
    const simulation = await connection.simulateTransaction(transaction);
    if (simulation.value.err) {
      throw new Error(`Transaction simulation failed: ${simulation.value.err}`);
    }
    burnEvent.validations.simulation = true;

    // Always use secure confirmation for burns
    const confirmationStrategy = getConfirmationStrategy('LARGE_TRANSFER');

    // Add retry mechanism with timeout
    const { result: signature, retryCount } = await retry(
      async () => {
        return await sendAndConfirmTransaction(connection, transaction, [wallet], {
          ...confirmationStrategy,
          skipPreflight: false,
        });
      },
      {
        maxRetries: MAX_RETRIES,
        timeout: TRANSACTION_TIMEOUT,
      }
    );

    burnEvent.signature = signature;
    burnEvent.retryCount = retryCount;

    // Verify the burn was successful
    const updatedTokenAccount = await getAccount(
      connection,
      burnFrom,
      confirmationStrategy.commitment,
      TOKEN_2022_PROGRAM_ID
    );
    burnEvent.validations.postValidation = true;

    console.log(
      `Tokens burned successfully with ${confirmationStrategy.commitment} commitment. Transaction: ${signature}`
    );
    console.log(`Remaining balance: ${updatedTokenAccount.amount.toString()}`);

    // Log successful burn event
    await BurnMonitor.logBurnEvent(burnEvent);

    return {
      burnAmount: burnAmount.toString(),
      actualBurnAmount: actualBurnAmount.toString(),
      signature,
      tokenAccount: burnFrom.toBase58(),
      remainingBalance: updatedTokenAccount.amount.toString(),
      retryCount,
    };
  } catch (error) {
    // Log failed burn event
    if (error instanceof Error) {
      burnEvent.error = error.message;
      await BurnMonitor.logBurnEvent(burnEvent);
      throw error;
    }
    throw error;
  }
}

// If running directly
if (require.main === module) {
  if (!process.argv[2] || !process.argv[3]) {
    console.error(
      'Usage: ts-node burnTokens.ts <mint-address> <amount> [burn-from-address] [decimals]'
    );
    process.exit(1);
  }

  const options = {
    decimals: process.argv[5] ? parseInt(process.argv[5]) : undefined,
  };

  burnTokens(process.argv[2], process.argv[3], process.argv[4], options)
    .then((result) => {
      console.log('Token burn completed');
      console.log('Results:');
      console.table({
        'Burn Amount': result.burnAmount,
        'Actual Burn Amount (with decimals)': result.actualBurnAmount,
        'Token Account': result.tokenAccount,
        'Remaining Balance': result.remainingBalance,
        Transaction: result.signature,
      });
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
}
