import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
 
dotenv.config({ path: resolve(__dirname, '../../.env') });
 
async function transferToPublicSaleWallet() {
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
 
    // Get the mint and public sale wallet addresses
    const mintPubkey = new PublicKey(process.env.TOKEN_MINT_ADDRESS!);
    const publicSaleWalletPubkey = new PublicKey(process.env.PUBLIC_SALE_WALLET_ADDRESS!);
 
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
 
    console.log('Creating/getting public sale wallet token account...');
    const publicSaleWalletTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      operationsWallet,
      mintPubkey,
      publicSaleWalletPubkey,
      false,
      'confirmed',
      { commitment: 'confirmed' }
    );
 
    console.log('Public sale wallet token account:', publicSaleWalletTokenAccount.address.toString());
 
    // Check if operations wallet has enough SOL for fees
    const balance = await connection.getBalance(operationsWallet.publicKey);
    console.log('Operations wallet SOL balance:', balance / LAMPORTS_PER_SOL);
    
    if (balance < LAMPORTS_PER_SOL * 0.05) {
      throw new Error('Operations wallet needs SOL for transaction fees');
    }
 
    // Calculate transfer amount with decimals
    const transferAmount = Number(process.env.PUBLIC_SALE_WALLET_AMOUNT!) * decimalMultiplier;
    console.log(`Transferring ${process.env.PUBLIC_SALE_WALLET_AMOUNT} tokens (${transferAmount} raw amount) to Public Sale & Community Distribution Wallet...`);
 
    const transaction = new Transaction().add(
      createTransferInstruction(
        operationsTokenAccount.address,
        publicSaleWalletTokenAccount.address,
        operationsWallet.publicKey,
        transferAmount,
        [],
        TOKEN_PROGRAM_ID
      )
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
    return signature;
  } catch (error) {
    console.error('Error in transferToPublicSaleWallet:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}
 
// Run if called directly
if (require.main === module) {
  transferToPublicSaleWallet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
 
export { transferToPublicSaleWallet }; 