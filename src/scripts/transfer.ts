import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { createTransferWithFeesTransaction, validateFeeAccounts } from '../utils/protocolFees';

dotenv.config();

interface TransferResult {
  signature: string;
  amount: string;
  recipient: string;
  rewardsFee: string;
  operationsFee: string;
  actualTransferred: string;
}

async function transfer(
  recipientAddress: string,
  amount: string,
  mintAddress: string
): Promise<TransferResult> {
  try {
    // Validate environment variables
    if (!process.env.SOLANA_RPC_URL || !process.env.WALLET_PRIVATE_KEY) {
      throw new Error('Missing required environment variables');
    }

    // Initialize connection and wallet
    const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
    const wallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
    );

    // Initialize fee accounts
    const rewardsPool = new PublicKey(process.env.REWARDS_POOL_PRIVATE_KEY!);
    const operationsWallet = new PublicKey(process.env.OPERATIONS_WALLET_PRIVATE_KEY!);

    const feeAccounts = {
      rewardsPool,
      operationsWallet,
    };

    // Validate fee accounts
    validateFeeAccounts(feeAccounts);

    // Convert amount to bigint with decimals
    const decimals = parseInt(process.env.TOKEN_DECIMALS!, 10);
    const transferAmount = BigInt(amount) * BigInt(10 ** decimals);

    // Create and send transaction
    const transaction = await createTransferWithFeesTransaction({
      connection,
      amount: transferAmount,
      sender: wallet.publicKey,
      recipient: new PublicKey(recipientAddress),
      mint: new PublicKey(mintAddress),
      feeAccounts,
      signers: [wallet],
    });

    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], {
      commitment: 'confirmed',
    });

    // Get fee amounts for return value
    const { rewardsFee, operationsFee, remainingAmount } = await calculateFees(transferAmount);

    return {
      signature,
      amount: amount,
      recipient: recipientAddress,
      rewardsFee: (rewardsFee / BigInt(10 ** decimals)).toString(),
      operationsFee: (operationsFee / BigInt(10 ** decimals)).toString(),
      actualTransferred: (remainingAmount / BigInt(10 ** decimals)).toString(),
    };
  } catch (error) {
    console.error('Transfer failed:', error);
    throw error;
  }
}

// Command-line interface
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    console.error('Usage: ts-node transfer.ts <recipient> <amount> <mint>');
    process.exit(1);
  }

  const [recipient, amount, mint] = args;

  try {
    const result = await transfer(recipient, amount, mint);
    console.log('Transfer successful:', result);
  } catch (error) {
    console.error('Transfer failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { transfer };
