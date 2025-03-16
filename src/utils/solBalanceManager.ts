import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

// Minimum SOL balance to maintain for transaction fees
const MIN_SOL_BALANCE = LAMPORTS_PER_SOL / 10; // 0.1 SOL
const TARGET_SOL_BALANCE = LAMPORTS_PER_SOL / 2; // 0.5 SOL

export async function checkAndTopUpSolBalance(
  connection: Connection,
  feeCollector: PublicKey,
  wallet: Keypair
): Promise<string | null> {
  try {
    // Get current SOL balance
    const balance = await connection.getBalance(feeCollector);

    // If balance is below minimum, top up to target balance
    if (balance < MIN_SOL_BALANCE) {
      const topUpAmount = TARGET_SOL_BALANCE - balance;
      
      // Check if wallet has enough SOL
      const walletBalance = await connection.getBalance(wallet.publicKey);
      if (walletBalance < topUpAmount + MIN_SOL_BALANCE) {
        throw new Error('Insufficient SOL in wallet for top-up');
      }

      // Create and send top-up transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: feeCollector,
          lamports: topUpAmount,
        })
      );

      const signature = await connection.sendTransaction(transaction, [wallet]);
      await connection.confirmTransaction(signature, 'confirmed');

      console.log(`Topped up fee collector with ${topUpAmount / LAMPORTS_PER_SOL} SOL`);
      return signature;
    }

    return null; // No top-up needed
  } catch (error) {
    console.error('Error managing SOL balance:', error);
    throw error;
  }
}

export async function withdrawExcessSol(
  connection: Connection,
  feeCollector: Keypair,
  wallet: PublicKey
): Promise<string | null> {
  try {
    // Get current SOL balance
    const balance = await connection.getBalance(feeCollector.publicKey);

    // If balance is above target, withdraw excess
    if (balance > TARGET_SOL_BALANCE) {
      const withdrawAmount = balance - TARGET_SOL_BALANCE;

      // Create and send withdrawal transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: feeCollector.publicKey,
          toPubkey: wallet,
          lamports: withdrawAmount,
        })
      );

      const signature = await connection.sendTransaction(transaction, [feeCollector]);
      await connection.confirmTransaction(signature, 'confirmed');

      console.log(`Withdrew ${withdrawAmount / LAMPORTS_PER_SOL} excess SOL from fee collector`);
      return signature;
    }

    return null; // No withdrawal needed
  } catch (error) {
    console.error('Error withdrawing excess SOL:', error);
    throw error;
  }
} 