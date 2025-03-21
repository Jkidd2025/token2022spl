/* eslint-disable @typescript-eslint/no-unused-vars */
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
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function transferToTestWallet() {
  try {
    // Connect to network with higher timeout
    const connection = new Connection(process.env.SOLANA_RPC_URL!, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    });

    // Get the public sale wallet (source of tokens)
    const publicSaleWallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.PUBLIC_SALE_WALLET_PRIVATE_KEY!))
    );

    // Get the test wallet
    const testWallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.TEST_WALLET_PRIVATE_KEY!))
    );

    console.log('Public Sale wallet public key:', publicSaleWallet.publicKey.toString());
    console.log('Test wallet public key:', testWallet.publicKey.toString());

    // Get the mint address
    const mintPubkey = new PublicKey(process.env.TOKEN_MINT_ADDRESS!);

    console.log('Getting public sale wallet token account...');
    const publicSaleTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      publicSaleWallet,
      mintPubkey,
      publicSaleWallet.publicKey,
      false,
      'confirmed',
      { commitment: 'confirmed' }
    );

    const decimals = Number(process.env.TOKEN_DECIMALS!);
    const decimalMultiplier = Math.pow(10, decimals);
    const rawBalance = Number(publicSaleTokenAccount.amount);
    const actualBalance = rawBalance / decimalMultiplier;

    console.log('Public Sale token account:', publicSaleTokenAccount.address.toString());
    console.log('Public Sale token balance (raw):', rawBalance.toString());
    console.log('Public Sale token balance (actual):', actualBalance.toString());

    // Create a new transaction for token account creation and transfer
    const transaction = new Transaction();

    // Add token account creation instruction
    const testTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      publicSaleWallet,
      mintPubkey,
      testWallet.publicKey,
      true,
      'confirmed',
      { commitment: 'confirmed' }
    );

    console.log('Test wallet token account:', testTokenAccount.address.toString());

    // Check if public sale wallet has enough SOL for fees
    const balance = await connection.getBalance(publicSaleWallet.publicKey);
    console.log('Public Sale wallet SOL balance:', balance / LAMPORTS_PER_SOL);

    if (balance < LAMPORTS_PER_SOL * 0.05) {
      throw new Error('Public Sale wallet needs SOL for transaction fees');
    }

    // Calculate transfer amount with decimals (5000 tokens)
    const transferAmount = 5000 * decimalMultiplier;
    console.log(`Transferring 5000 tokens (${transferAmount} raw amount) to test wallet...`);

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        publicSaleTokenAccount.address,
        testTokenAccount.address,
        publicSaleWallet.publicKey,
        transferAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [publicSaleWallet], {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });

    console.log('Transfer successful!');
    console.log('Signature:', signature);
    return signature;
  } catch (error) {
    console.error('Error in transferToTestWallet:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  transferToTestWallet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { transferToTestWallet };
