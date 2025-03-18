/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  createMint,
  createInitializeTransferFeeConfigInstruction,
  createInitializePermanentDelegateInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { createInitializeMetadataPointerInstruction } from '../utils/instructions';
import { createTokenMetadata, DEFAULT_TOKEN_METADATA } from '../utils/metadata';
import * as tokenMetadataConfig from '../config/metadata.json';
import { TransactionManager } from '../utils/transactionManager';

dotenv.config();

// Validate environment variables
function validateEnvironment() {
  const requiredEnvVars = [
    'SOLANA_RPC_URL',
    'WALLET_PRIVATE_KEY',
    'TOKEN_DECIMALS',
    'TRANSFER_FEE_BASIS_POINTS',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}

// Validate fee configuration
function validateFeeConfig(feeBasisPoints: number) {
  if (feeBasisPoints < 0 || feeBasisPoints > 10000) {
    throw new Error('Fee basis points must be between 0 and 10000');
  }
}

// Validate metadata
function validateMetadata(metadata: any) {
  if (!metadata.name || !metadata.symbol) {
    throw new Error('Token metadata must include name and symbol');
  }
}

// Backup account information
async function backupAccount(keypair: Keypair, label: string) {
  const backup = {
    publicKey: keypair.publicKey.toString(),
    secretKey: Array.from(keypair.secretKey),
    label,
    timestamp: new Date().toISOString(),
  };

  console.log(`Backup ${label} account information securely`);
  return backup;
}

async function createToken() {
  // Validate environment
  validateEnvironment();

  // Initialize connection to Solana network
  const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');

  // Create wallet from private key
  const wallet = Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!)));

  // Create a separate keypair for fee collection
  const feeCollectorKeypair = Keypair.generate();
  console.log('Fee Collector Address:', feeCollectorKeypair.publicKey.toString());

  // Define token extensions
  const extensions = [
    ExtensionType.TransferFeeConfig,
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
  ];

  try {
    // Calculate space for the mint
    const mintLen = getMintLen(extensions);
    console.log(`Required mint space: ${mintLen} bytes`);

    // Create mint account
    const mintKeypair = Keypair.generate();
    const decimals = process.env.TOKEN_DECIMALS ? parseInt(process.env.TOKEN_DECIMALS) : 6;

    // Create the mint with extensions
    const mint = await createMint(
      connection,
      wallet,
      wallet.publicKey,
      wallet.publicKey,
      decimals,
      mintKeypair,
      {
        commitment: 'confirmed',
      },
      TOKEN_2022_PROGRAM_ID
    );

    console.log('Token mint created:', mint.toBase58());

    // Get the fee collector's associated token account
    const feeCollectorTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(mint),
      feeCollectorKeypair.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Create a transaction for initializing extensions and fee collector
    const initExtensionsTransaction = new Transaction();

    // Create the fee collector's token account
    initExtensionsTransaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        feeCollectorTokenAccount,
        feeCollectorKeypair.publicKey,
        new PublicKey(mint),
        TOKEN_2022_PROGRAM_ID
      )
    );

    // Initialize transfer fee config
    const feeBasisPoints = process.env.TRANSFER_FEE_BASIS_POINTS
      ? parseInt(process.env.TRANSFER_FEE_BASIS_POINTS)
      : 500; // 5%

    // Validate fee configuration
    validateFeeConfig(feeBasisPoints);

    // Add transfer fee extension with fee collector as withdrawal destination
    initExtensionsTransaction.add(
      createInitializeTransferFeeConfigInstruction(
        new PublicKey(mint),
        wallet.publicKey, // fee authority (can change fee rate)
        feeCollectorKeypair.publicKey, // withdrawal destination (receives fees)
        feeBasisPoints,
        BigInt(0), // Maximum fee
        TOKEN_2022_PROGRAM_ID
      )
    );

    // Add permanent delegate for burn mechanism
    initExtensionsTransaction.add(
      createInitializePermanentDelegateInstruction(
        new PublicKey(mint),
        wallet.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );

    // Add metadata pointer
    initExtensionsTransaction.add(
      createInitializeMetadataPointerInstruction(
        new PublicKey(mint),
        wallet.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );

    // Initialize transaction manager
    const transactionManager = new TransactionManager(connection);

    // Execute transaction with simulation and retry logic
    const result = await transactionManager.executeTransaction(
      initExtensionsTransaction,
      [wallet, feeCollectorKeypair],
      'TOKEN_CREATION'
    );

    console.log('Token extensions and fee collector initialized. Transaction:', result.signature);

    // Create token metadata
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

    // Validate metadata
    validateMetadata(metadata);

    const metadataResult = await createTokenMetadata(
      connection,
      wallet,
      new PublicKey(mint),
      metadata
    );

    console.log('Token metadata created:', metadataResult);

    // Backup account information
    await backupAccount(feeCollectorKeypair, 'fee_collector');
    await backupAccount(mintKeypair, 'mint');

    // Save fee collector information
    console.log('Important: Save these addresses for future reference:');
    console.log('Fee Collector Address:', feeCollectorKeypair.publicKey.toString());
    console.log('Fee Collector Token Account:', feeCollectorTokenAccount.toString());

    return {
      mint: mint.toString(),
      feeCollector: feeCollectorKeypair.publicKey.toString(),
      feeCollectorTokenAccount: feeCollectorTokenAccount.toString(),
      extensionsSignature: result.signature,
      metadata: metadataResult,
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error creating token:', error.message);
      console.error('Stack trace:', error.stack);
    }
    throw error;
  }
}

// If running directly
if (require.main === module) {
  createToken()
    .then((result) => {
      console.log('Token creation completed');
      console.log('Results:', result);
    })
    .catch((error) => {
      console.error('Token creation failed:', error);
      process.exit(1);
    });
}
