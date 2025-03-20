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
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  createInitializeTransferFeeConfigInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { TransactionManager } from '../utils/transactionManager';
import { createTokenMetadata, TokenMetadata } from '../utils/metadata';

dotenv.config();

interface TokenBackup {
  publicKey: string;
  secretKey: number[];
  label: string;
  timestamp: string;
}

interface TokenMintInfo {
  address: string;
  decimals: number;
  extensions: string[];
  feeCollector: string;
}

function validateEnvironment(): void {
  const requiredEnvVars = [
    'SOLANA_RPC_URL',
    'WALLET_PRIVATE_KEY',
    'TOKEN_DECIMALS',
    'TRANSFER_FEE_BASIS_POINTS',
    'FEE_COLLECTOR_PRIVATE_KEY',
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

async function createToken(): Promise<TokenMintInfo> {
  try {
    console.log('Starting token creation process...');
    validateEnvironment();
    console.log('Environment validation passed');

    const connection = new Connection(process.env.SOLANA_RPC_URL!, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
    console.log('Connected to Solana network');

    const wallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
    );
    console.log('Wallet:', wallet.publicKey.toBase58());
    console.log('Wallet secret key length:', wallet.secretKey.length);

    const feeCollectorKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.FEE_COLLECTOR_PRIVATE_KEY!))
    );
    console.log('Fee collector:', feeCollectorKeypair.publicKey.toBase58());
    const mint = Keypair.generate();
    const decimals = 9;
    const feeBasisPoints = parseInt(process.env.TRANSFER_FEE_BASIS_POINTS!, 10);
    validateFeeConfig(feeBasisPoints);
    const extensions = [ExtensionType.MetadataPointer, ExtensionType.TransferFeeConfig];
    const mintLen = getMintLen(extensions);
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

    console.log('Mint:', mint.publicKey.toBase58());
    console.log('Mint length with extensions:', mintLen);
    console.log('Decimals:', decimals);
    console.log('Balance:', (await connection.getBalance(wallet.publicKey)) / 1e9, 'SOL');

    if ((await connection.getBalance(wallet.publicKey)) < lamports + 0.02 * 1e9) {
      throw new Error('Insufficient funds');
    }

    const transactionManager = new TransactionManager(connection);
    const { blockhash: initialBlockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    // Step 1: Create token metadata
    const [metadataPDA, bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
    );
    console.log('Metadata PDA:', metadataPDA.toBase58());
    console.log('Bump seed:', bump);

    const metadata: TokenMetadata = {
      mint: mint.publicKey,
      name: 'BPay',
      symbol: 'BPAY',
      uri: 'https://raw.githubusercontent.com/Jkidd2025/token2022spl/main/src/config/metadata.json',
      additionalMetadata: [
        [
          'description',
          'The Next Generation WBTC Rewards on Solana - Token metadata is immutable after minting',
        ],
        [
          'image',
          'https://raw.githubusercontent.com/Jkidd2025/token2022spl/main/assets/token-logo.png',
        ],
        ['external_url', 'https://github.com/Jkidd2025/token2022spl'],
        ['sellerFeeBasisPoints', '500'],
      ],
    };
    console.log('Initializing token metadata...');
    const metadataSignature = await createTokenMetadata(
      connection,
      wallet,
      mint.publicKey,
      metadata
    );
    console.log('Token metadata initialized:', metadataSignature);

    // Step 2: Create and initialize mint with extensions
    const tx1 = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports,
        space: mintLen,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferFeeConfigInstruction(
        mint.publicKey,
        wallet.publicKey,
        wallet.publicKey,
        feeBasisPoints,
        BigInt(1000) * BigInt(10 ** decimals),
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMetadataPointerInstruction(
        mint.publicKey,
        wallet.publicKey,
        metadataPDA,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        wallet.publicKey,
        wallet.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    tx1.recentBlockhash = initialBlockhash;
    tx1.feePayer = wallet.publicKey;

    console.log('Simulating mint creation and initialization...');
    const sim1 = await connection.simulateTransaction(tx1, [wallet, mint]);
    if (sim1.value.err) {
      console.error('Simulation failed:', sim1.value.err);
      console.error('Simulation logs:', sim1.value.logs);
      throw new Error('Mint creation and initialization simulation failed');
    }
    console.log('Simulation succeeded:', sim1.value.logs);

    console.log('Creating and initializing mint...');
    const sig1 = await sendAndConfirmTransaction(connection, tx1, [wallet, mint], {
      commitment: 'finalized',
    });
    console.log('Mint created and initialized:', sig1);

    // Check mint account state
    const mintAccount = await connection.getAccountInfo(mint.publicKey);
    if (!mintAccount) throw new Error('Mint account not found after initialization');
    console.log('Mint account state:', {
      owner: mintAccount?.owner.toBase58(),
      lamports: mintAccount?.lamports,
      dataLength: mintAccount?.data.length,
    });

    // Step 3: Create fee collector ATA
    const feeCollectorAta = await getAssociatedTokenAddress(
      mint.publicKey,
      feeCollectorKeypair.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    const tx2 = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        feeCollectorAta,
        feeCollectorKeypair.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    tx2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx2.feePayer = wallet.publicKey;
    const sig2 = await transactionManager.executeTransaction(tx2, [wallet], 'CREATE_FEE_ATA');
    console.log('Fee collector ATA created:', sig2);
    // Step 4: Create wallet ATA
    const walletAta = await getAssociatedTokenAddress(
      mint.publicKey,
      wallet.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    // Return the token mint info
    return {
      address: mint.publicKey.toBase58(),
      decimals,
      extensions: extensions.map((ext) => ExtensionType[ext]),
      feeCollector: feeCollectorKeypair.publicKey.toBase58(),
    };
  } catch (error) {
    console.error('Error in createToken:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('Starting token creation process...');
    const tokenInfo = await createToken();
    console.log('Token creation completed successfully:', tokenInfo);
  } catch (error) {
    console.error('Failed to create token:', error);
    process.exit(1);
  }
}

// Call the main function
main();
