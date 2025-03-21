/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function transferToSpecificWallet() {
  try {
    // Connect to network with higher timeout
    const connection = new Connection(process.env.SOLANA_RPC_URL!, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    });

    // Get the operations wallet (source of tokens)
    const operationsWallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.OPERATIONS_WALLET_PRIVATE_KEY!))
    );

    console.log('Operations wallet public key:', operationsWallet.publicKey.toString());

    // Get the mint and destination wallet addresses
    const mintPubkey = new PublicKey(process.env.TOKEN_MINT_ADDRESS!);
    const destinationWalletPubkey = new PublicKey('TzJqhk71SvMCA6Jp9XAPfSX6zasooWCZvT6N1YxVQyZ');

    console.log('Creating/getting operations wallet token account...');
    const operationsTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      operationsWallet,
      mintPubkey,
      operationsWallet.publicKey,
      false,
      'confirmed',
      { commitment: 'confirmed' }
    );

    const decimals = Number(process.env.TOKEN_DECIMALS!);
    const decimalMultiplier = Math.pow(10, decimals);
    const rawBalance = Number(operationsTokenAccount.amount);
    const actualBalance = rawBalance / decimalMultiplier;

    console.log('Operations token account:', operationsTokenAccount.address.toString());
    console.log('Operations token balance (raw):', rawBalance.toString());
    console.log('Operations token balance (actual):', actualBalance.toString());

    console.log('Creating/getting destination wallet token account...');
    const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      operationsWallet,
      mintPubkey,
      destinationWalletPubkey,
      false,
      'confirmed',
      { commitment: 'confirmed' }
    );

    console.log('Destination token account:', destinationTokenAccount.address.toString());

    // Check if operations wallet has enough SOL for fees
    const balance = await connection.getBalance(operationsWallet.publicKey);
    console.log('Operations wallet SOL balance:', balance / LAMPORTS_PER_SOL);

    if (balance < LAMPORTS_PER_SOL * 0.05) {
      throw new Error('Operations wallet needs SOL for transaction fees');
    }

    // Calculate transfer amount with decimals
    const transferAmount = 100000000 * decimalMultiplier;
    console.log(
      `Transferring 100,000,000 tokens (${transferAmount} raw amount) to destination wallet...`
    );

    const transaction = new Transaction().add(
      createTransferInstruction(
        operationsTokenAccount.address,
        destinationTokenAccount.address,
        operationsWallet.publicKey,
        transferAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [operationsWallet], {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });

    console.log('Transfer successful!');
    console.log('Signature:', signature);
    return signature;
  } catch (error) {
    console.error('Error in transferToSpecificWallet:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  transferToSpecificWallet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { transferToSpecificWallet };
