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
  getAccount,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function testProtocolFee() {
  try {
    // Connect to network with higher timeout
    const connection = new Connection(process.env.SOLANA_RPC_URL!, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    });

    // Get the test wallet (source of tokens)
    const testWallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.TEST_WALLET_PRIVATE_KEY!))
    );

    // Get the reserve address
    const reserveAddress = new PublicKey(process.env.RESERVE_ADDRESS!);

    console.log('Test wallet public key:', testWallet.publicKey.toString());
    console.log('Reserve address:', reserveAddress.toString());

    // Get the mint address
    const mintPubkey = new PublicKey(process.env.TOKEN_MINT_ADDRESS!);

    // Get token accounts
    console.log('Getting test wallet token account...');
    const testTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      testWallet,
      mintPubkey,
      testWallet.publicKey,
      false,
      'confirmed',
      { commitment: 'confirmed' }
    );

    console.log('Getting reserve token account...');
    const reserveTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      testWallet,
      mintPubkey,
      reserveAddress,
      false,
      'confirmed',
      { commitment: 'confirmed' }
    );

    // Get initial balances
    const decimals = Number(process.env.TOKEN_DECIMALS!);
    const decimalMultiplier = Math.pow(10, decimals);

    const testBalance = Number(testTokenAccount.amount) / decimalMultiplier;
    const reserveBalance = Number(reserveTokenAccount.amount) / decimalMultiplier;

    console.log('Initial test wallet balance:', testBalance);
    console.log('Initial reserve balance:', reserveBalance);

    // Calculate test transfer amount (1000 tokens)
    const transferAmount = 1000 * decimalMultiplier;
    console.log(`Testing transfer of 1000 tokens (${transferAmount} raw amount)...`);

    // Create transfer transaction
    const transaction = new Transaction().add(
      createTransferInstruction(
        testTokenAccount.address,
        reserveTokenAccount.address,
        testWallet.publicKey,
        transferAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [testWallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    console.log('Transfer successful!');
    console.log('Signature:', signature);

    // Get final balances
    const finalTestBalance = Number((await getAccount(connection, testTokenAccount.address)).amount) / decimalMultiplier;
    const finalReserveBalance = Number((await getAccount(connection, reserveTokenAccount.address)).amount) / decimalMultiplier;

    console.log('Final test wallet balance:', finalTestBalance);
    console.log('Final reserve balance:', finalReserveBalance);

    // Calculate actual fee collected
    const feeCollected = finalReserveBalance - reserveBalance;
    console.log('Fee collected:', feeCollected);

    return {
      signature,
      initialTestBalance: testBalance,
      finalTestBalance,
      initialReserveBalance: reserveBalance,
      finalReserveBalance,
      feeCollected
    };
  } catch (error) {
    console.error('Error in testProtocolFee:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  testProtocolFee()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { testProtocolFee }; 