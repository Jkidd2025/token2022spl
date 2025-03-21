/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  Connection,
  Keypair,
  Transaction,
  SystemProgram,
  PublicKey,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getMintLen,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  MINT_SIZE,
} from '@solana/spl-token';
import {
  ExtensionType,
  getAssociatedTokenAddress,
  createInitializeMetadataPointerInstruction,
  LENGTH_SIZE,
  TYPE_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeTransferFeeConfigInstruction,
  createUpdateFieldInstruction,
} from '@solana/spl-token';
import {
  createInitializeInstruction,
  pack,
  TokenMetadata,
} from '@solana/spl-token-metadata';
import * as dotenv from 'dotenv';
import { TransactionManager } from '../utils/transactionManager';
import { TOKEN_CONSTANTS } from '../config/tokens';
import { metadata as tokenMetadata, validateTokenAddresses } from '../config/tokens';
import { createTokenMetadata, validateMetadata } from '../utils/metadata';
import { resolve } from 'path';

// Load environment variables from .env file
dotenv.config({ path: resolve(__dirname, '../../.env') });

// Constants
const METADATA_SEED = 'metadata';
const MIN_SOL_BALANCE = 0.02;
const TRANSACTION_TIMEOUT = 60000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

interface TokenBackup {
  publicKey: string;
  secretKey: number[];
  label: string;
  timestamp: string;
}

interface TokenMintInfo {
  address: string;
  decimals: number;
  rewardsPool: string;
  operationsWallet: string;
  metadata: string;
}

interface TransactionError extends Error {
  logs?: string[];
}

function validateEnvironment(): void {
  const requiredEnvVars = [
    'SOLANA_RPC_URL',
    'WALLET_PRIVATE_KEY',
    'TOKEN_DECIMALS',
    'REWARDS_POOL_PRIVATE_KEY',
    'OPERATIONS_WALLET_PRIVATE_KEY',
  ];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}

function validateFeeConfig(feeBasisPoints: number): void {
  if (feeBasisPoints < 0 || feeBasisPoints > 10000) {
    throw new Error('Fee basis points must be between 0 and 10000');
  }
}

async function backupAccount(keypair: Keypair, label: string): Promise<TokenBackup> {
  const backup: TokenBackup = {
    publicKey: keypair.publicKey.toString(),
    secretKey: Array.from(keypair.secretKey),
    label,
    timestamp: new Date().toISOString(),
  };
  console.log(`Backup ${label} account information securely`);
  return backup;
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        console.log(`Retrying operation (attempt ${i + 2}/${retries})`);
      }
    }
  }

  throw lastError;
}

async function createToken(): Promise<TokenMintInfo> {
  try {
    console.log('Starting token creation process...');
    validateEnvironment();
    validateTokenAddresses();
    console.log('Environment validation passed');

    const connection = new Connection(process.env.SOLANA_RPC_URL!, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: TRANSACTION_TIMEOUT,
    });
    console.log('Connected to Solana network');

    const wallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
    );
    console.log('Wallet:', wallet.publicKey.toBase58());

    const rewardsPoolKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.REWARDS_POOL_PRIVATE_KEY!))
    );
    console.log('Rewards Pool:', rewardsPoolKeypair.publicKey.toBase58());

    const operationsWalletKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.OPERATIONS_WALLET_PRIVATE_KEY!))
    );
    console.log('Operations Wallet:', operationsWalletKeypair.publicKey.toBase58());

    const mint = Keypair.generate();
    const decimals = TOKEN_CONSTANTS.DECIMALS;

    const mintLen = MINT_SIZE;
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

    console.log('Mint:', mint.publicKey.toBase58());
    const balance = await connection.getBalance(wallet.publicKey);
    console.log('Balance:', balance / 1e9, 'SOL');

    if (balance < lamports + MIN_SOL_BALANCE * 1e9) {
      const requiredBalance = (lamports + MIN_SOL_BALANCE * 1e9) / 1e9;
      throw new Error(`Insufficient funds. Need at least ${requiredBalance} SOL`);
    }

    const transactionManager = new TransactionManager(connection);
    const { blockhash: initialBlockhash } = await connection.getLatestBlockhash();

    // Step 1: Create and initialize mint
    const tx1 = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports,
        space: mintLen,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        wallet.publicKey,
        wallet.publicKey,
        TOKEN_PROGRAM_ID
      )
    );

    tx1.recentBlockhash = initialBlockhash;
    tx1.feePayer = wallet.publicKey;

    console.log('Creating and initializing mint...');
    const sig1 = await executeWithRetry(() =>
      sendAndConfirmTransaction(connection, tx1, [wallet, mint], {
        commitment: 'finalized',
      })
    );
    console.log('Mint created and initialized:', sig1);

    // Step 2: Create token accounts for rewards pool and operations wallet
    const rewardsPoolATA = await getAssociatedTokenAddress(
      mint.publicKey,
      rewardsPoolKeypair.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );

    const operationsWalletATA = await getAssociatedTokenAddress(
      mint.publicKey,
      operationsWalletKeypair.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );

    const tx2 = new Transaction()
      .add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          rewardsPoolATA,
          rewardsPoolKeypair.publicKey,
          mint.publicKey,
          TOKEN_PROGRAM_ID
        )
      )
      .add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          operationsWalletATA,
          operationsWalletKeypair.publicKey,
          mint.publicKey,
          TOKEN_PROGRAM_ID
        )
      );

    tx2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx2.feePayer = wallet.publicKey;

    console.log('Creating token accounts for rewards pool and operations wallet...');
    const sig2 = await executeWithRetry(() =>
      sendAndConfirmTransaction(connection, tx2, [wallet], {
        commitment: 'finalized',
      })
    );
    console.log('Token accounts created:', sig2);

    // Step 3: Create token metadata
    console.log('Creating token metadata...');
    const metadataSignature = await createTokenMetadata(
      connection,
      wallet,
      mint.publicKey,
      {
        name: tokenMetadata.name,
        symbol: tokenMetadata.symbol,
        uri: tokenMetadata.uri,
        mint: mint.publicKey,
        additionalMetadata: [],
      },
      false  // Set isMutable to false
    );
    console.log('Token metadata created:', metadataSignature);

    // Step 4: Mint initial supply to operations wallet
    const initialSupply = BigInt(TOKEN_CONSTANTS.INITIAL_SUPPLY * (10 ** TOKEN_CONSTANTS.DECIMALS));
    const tx4 = new Transaction().add(
      createMintToInstruction(
        mint.publicKey,
        operationsWalletATA,
        wallet.publicKey,
        Number(initialSupply),
        [],
        TOKEN_PROGRAM_ID
      )
    );

    tx4.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx4.feePayer = wallet.publicKey;

    console.log('Minting initial supply to operations wallet...');
    const sig4 = await executeWithRetry(() =>
      sendAndConfirmTransaction(connection, tx4, [wallet], {
        commitment: 'finalized',
      })
    );
    console.log('Initial supply minted:', sig4);

    // Backup mint account
    await backupAccount(mint, 'mint');

    return {
      address: mint.publicKey.toBase58(),
      decimals,
      rewardsPool: rewardsPoolATA.toBase58(),
      operationsWallet: operationsWalletATA.toBase58(),
      metadata: metadataSignature,
    };
  } catch (error) {
    console.error('Failed to create token:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('Starting token creation process...');
    const tokenInfo = await createToken();
    console.log('Token created successfully:', tokenInfo);
  } catch (error) {
    console.error('Failed to create token:', error);
    process.exit(1);
  }
}

// Call the main function
main();

export { createToken };
