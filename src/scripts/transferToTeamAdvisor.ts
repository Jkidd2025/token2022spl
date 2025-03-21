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

async function transferToTeamAdvisor() {
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

    // Get the mint and team advisor addresses
    const mintPubkey = new PublicKey(process.env.TOKEN_MINT_ADDRESS!);
    const teamAdvisorPubkey = new PublicKey(process.env.TEAM_ADVISOR_ADDRESS!);

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

    console.log('Creating/getting team advisor token account...');
    const teamAdvisorTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      operationsWallet,
      mintPubkey,
      teamAdvisorPubkey,
      false,
      'confirmed',
      { commitment: 'confirmed' }
    );

    console.log('Team advisor token account:', teamAdvisorTokenAccount.address.toString());

    // Check if operations wallet has enough SOL for fees
    const balance = await connection.getBalance(operationsWallet.publicKey);
    console.log('Operations wallet SOL balance:', balance / LAMPORTS_PER_SOL);
    
    if (balance < LAMPORTS_PER_SOL * 0.05) {
      throw new Error('Operations wallet needs SOL for transaction fees');
    }

    // Calculate transfer amount with decimals
    const transferAmount = Number(process.env.TEAM_ADVISOR_AMOUNT!) * decimalMultiplier;
    console.log(`Transferring ${process.env.TEAM_ADVISOR_AMOUNT} tokens (${transferAmount} raw amount) to Team and Advisor wallet...`);

    const transaction = new Transaction().add(
      createTransferInstruction(
        operationsTokenAccount.address,
        teamAdvisorTokenAccount.address,
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
    console.error('Error in transferToTeamAdvisor:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  transferToTeamAdvisor()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { transferToTeamAdvisor }; 