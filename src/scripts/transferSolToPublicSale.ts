import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function transferSolToPublicSale() {
  try {
    // Connect to network with higher timeout
    const connection = new Connection(process.env.SOLANA_RPC_URL!, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    });

    // Get the operations wallet (source of SOL)
    const operationsWallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.OPERATIONS_WALLET_PRIVATE_KEY!))
    );

    // Get the public sale wallet
    const publicSaleWallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.PUBLIC_SALE_WALLET_PRIVATE_KEY!))
    );

    console.log('Operations wallet public key:', operationsWallet.publicKey.toString());
    console.log('Public Sale wallet public key:', publicSaleWallet.publicKey.toString());

    // Check operations wallet SOL balance
    const operationsBalance = await connection.getBalance(operationsWallet.publicKey);
    console.log('Operations wallet SOL balance:', operationsBalance / LAMPORTS_PER_SOL);

    if (operationsBalance < LAMPORTS_PER_SOL * 0.05) {
      throw new Error('Operations wallet needs more SOL for transfer');
    }

    // Transfer 0.05 SOL to public sale wallet
    const transferAmount = LAMPORTS_PER_SOL * 0.05;
    console.log(`Transferring ${transferAmount / LAMPORTS_PER_SOL} SOL to Public Sale wallet...`);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: operationsWallet.publicKey,
        toPubkey: publicSaleWallet.publicKey,
        lamports: transferAmount,
      })
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [operationsWallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    console.log('Transfer successful!');
    console.log('Signature:', signature);

    // Check final balance
    const finalBalance = await connection.getBalance(publicSaleWallet.publicKey);
    console.log('Public Sale wallet final SOL balance:', finalBalance / LAMPORTS_PER_SOL);

    return signature;
  } catch (error) {
    console.error('Error in transferSolToPublicSale:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  transferSolToPublicSale()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { transferSolToPublicSale }; 