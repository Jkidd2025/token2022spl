/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkBalance() {
  const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');

  // Check main wallet balance
  const mainWallet = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
  );
  const mainBalance = await connection.getBalance(mainWallet.publicKey);
  console.log('\nMain Wallet:');
  console.log('  Address:', mainWallet.publicKey.toString());
  console.log('  Balance:', mainBalance / LAMPORTS_PER_SOL, 'SOL');

  // Check fee collector balance if available
  if (process.env.FEE_COLLECTOR_PRIVATE_KEY) {
    try {
      const feeCollector = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(process.env.FEE_COLLECTOR_PRIVATE_KEY))
      );
      const feeBalance = await connection.getBalance(feeCollector.publicKey);
      console.log('\nFee Collector:');
      console.log('  Address:', feeCollector.publicKey.toString());
      console.log('  Balance:', feeBalance / LAMPORTS_PER_SOL, 'SOL');
    } catch (error) {
      console.log('\nFee Collector: Not configured or invalid private key');
    }
  }
}

// Run if this script is executed directly
if (require.main === module) {
  checkBalance()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error checking balances:', error);
      process.exit(1);
    });
}

export { checkBalance };
