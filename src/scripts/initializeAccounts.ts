import { PublicKey, Keypair, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { getConnection } from '../utils/rpcConnection';
import * as dotenv from 'dotenv';
import { TransactionManager } from '../utils/transactionManager';

dotenv.config();

async function initializeAccounts(): Promise<void> {
  console.log('\nInitializing accounts...\n');

  const connection = getConnection();
  console.log('Using Helius RPC connection');

  // Load accounts from environment variables
  const walletPrivateKey = new Uint8Array(JSON.parse(process.env.WALLET_PRIVATE_KEY!));
  const wallet = Keypair.fromSecretKey(walletPrivateKey);
  const feeCollectorPrivateKey = new Uint8Array(JSON.parse(process.env.FEE_COLLECTOR_PRIVATE_KEY!));
  const feeCollector = Keypair.fromSecretKey(feeCollectorPrivateKey);
  const tokenMint = new PublicKey(process.env.TOKEN_MINT!);

  try {
    // Check wallet balance
    const balance = await (await connection).getBalance(wallet.publicKey);
    console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.1 * LAMPORTS_PER_SOL) {
      console.warn('Warning: Wallet balance is below 0.1 SOL');
    }

    // Create fee collector token account
    console.log('Creating Fee Collector Token Account...');
    const feeCollectorATA = getAssociatedTokenAddressSync(
      tokenMint,
      feeCollector.publicKey,
      true, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID
    );

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        feeCollectorATA, // ata
        feeCollector.publicKey, // owner
        tokenMint, // mint
        TOKEN_2022_PROGRAM_ID // programId
      )
    );
    // Initialize transaction manager
    const transactionManager = new TransactionManager(await connection);

    // Execute transaction with simulation and retry logic
    const result = await transactionManager.executeTransaction(
      transaction,
      [wallet],
      'TOKEN_CREATION'
    );

    console.log(`Fee collector ATA created successfully. Signature: ${result.signature}`);
    console.log(`Fee collector ATA address: ${feeCollectorATA.toString()}`);
  } catch (error) {
    if (error instanceof Error && error.message?.includes('already in use')) {
      console.log('Fee collector ATA already exists');
    } else {
      console.error('Error initializing accounts:', error);
      throw error;
    }
  }
}

// Run initialization if this script is run directly
if (require.main === module) {
  initializeAccounts().catch(console.error);
}

export { initializeAccounts };
