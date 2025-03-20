import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
} from '@solana/spl-token';

// Fee configuration
const REWARDS_FEE_PERCENTAGE = 2.5; // 2.5%
const OPERATIONS_FEE_PERCENTAGE = 2.5; // 2.5%
const TOTAL_FEE_PERCENTAGE = REWARDS_FEE_PERCENTAGE + OPERATIONS_FEE_PERCENTAGE;

interface FeeAccounts {
  rewardsPool: PublicKey;
  operationsWallet: PublicKey;
}

export interface TransferWithFeesParams {
  connection: Connection;
  amount: bigint;
  sender: PublicKey;
  recipient: PublicKey;
  mint: PublicKey;
  feeAccounts: FeeAccounts;
  signers: Keypair[];
}

export async function calculateFees(amount: bigint): Promise<{
  rewardsFee: bigint;
  operationsFee: bigint;
  remainingAmount: bigint;
}> {
  const rewardsFee = (amount * BigInt(REWARDS_FEE_PERCENTAGE * 100)) / BigInt(10000);
  const operationsFee = (amount * BigInt(OPERATIONS_FEE_PERCENTAGE * 100)) / BigInt(10000);
  const remainingAmount = amount - rewardsFee - operationsFee;

  return {
    rewardsFee,
    operationsFee,
    remainingAmount,
  };
}

export async function createTransferWithFeesTransaction(
  params: TransferWithFeesParams
): Promise<Transaction> {
  const { connection, amount, sender, recipient, mint, feeAccounts, signers } = params;

  // Calculate fee amounts
  const { rewardsFee, operationsFee, remainingAmount } = await calculateFees(amount);

  // Get token accounts
  const senderATA = await getAssociatedTokenAddress(mint, sender, false, TOKEN_PROGRAM_ID);
  const recipientATA = await getAssociatedTokenAddress(mint, recipient, false, TOKEN_PROGRAM_ID);
  const rewardsATA = await getAssociatedTokenAddress(
    mint,
    feeAccounts.rewardsPool,
    false,
    TOKEN_PROGRAM_ID
  );
  const operationsATA = await getAssociatedTokenAddress(
    mint,
    feeAccounts.operationsWallet,
    false,
    TOKEN_PROGRAM_ID
  );

  // Create transaction
  const transaction = new Transaction();

  // Add transfer instructions
  transaction.add(
    // Transfer main amount to recipient
    createTransferInstruction(
      senderATA,
      recipientATA,
      sender,
      remainingAmount,
      [],
      TOKEN_PROGRAM_ID
    ),
    // Transfer rewards fee
    createTransferInstruction(senderATA, rewardsATA, sender, rewardsFee, [], TOKEN_PROGRAM_ID),
    // Transfer operations fee
    createTransferInstruction(senderATA, operationsATA, sender, operationsFee, [], TOKEN_PROGRAM_ID)
  );

  // Set recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = sender;

  // Partially sign transaction if signers are provided
  if (signers.length > 0) {
    transaction.sign(...signers);
  }

  return transaction;
}

export function validateFeeAccounts(feeAccounts: FeeAccounts): void {
  if (!feeAccounts.rewardsPool || !feeAccounts.operationsWallet) {
    throw new Error('Invalid fee accounts configuration');
  }
}

export function getFeePercentages(): {
  rewardsPercentage: number;
  operationsPercentage: number;
  totalPercentage: number;
} {
  return {
    rewardsPercentage: REWARDS_FEE_PERCENTAGE,
    operationsPercentage: OPERATIONS_FEE_PERCENTAGE,
    totalPercentage: TOTAL_FEE_PERCENTAGE,
  };
}
