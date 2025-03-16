import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

interface RewardDistribution {
  address: string;
  percentage: number;
}

interface DistributionResult {
  address: string;
  percentage: number;
  amount: string;
  signature: string;
}

async function validateDistributions(distributions: RewardDistribution[]): Promise<void> {
  // Check if distributions array is empty
  if (!distributions.length) {
    throw new Error('Distribution list cannot be empty');
  }

  // Validate total percentage equals 100
  const totalPercentage = distributions.reduce((sum, dist) => sum + dist.percentage, 0);
  if (totalPercentage !== 100) {
    throw new Error(`Total distribution percentage must equal 100. Current total: ${totalPercentage}`);
  }

  // Validate individual distributions
  for (const dist of distributions) {
    if (dist.percentage <= 0 || dist.percentage > 100) {
      throw new Error(`Invalid percentage for address ${dist.address}: ${dist.percentage}`);
    }

    try {
      new PublicKey(dist.address);
    } catch (error) {
      throw new Error(`Invalid Solana address: ${dist.address}`);
    }
  }
}

async function distributeRewards(
  mintAddress: string,
  feeCollectorAddress: string,
  rewardAmount: string,
  distributions: RewardDistribution[]
): Promise<DistributionResult[]> {
  // Validate distributions first
  await validateDistributions(distributions);

  const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  
  const wallet = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
  );

  const mint = new PublicKey(mintAddress);
  const feeCollector = new PublicKey(feeCollectorAddress);
  
  try {
    // Get the fee collector's token account
    const sourceAccount = await getAssociatedTokenAddress(
      mint,
      feeCollector,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Verify source account has enough tokens
    const sourceAccountInfo = await getAccount(
      connection,
      sourceAccount,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    const decimals = process.env.TOKEN_DECIMALS ? parseInt(process.env.TOKEN_DECIMALS) : 6;
    const totalRewardAmount = BigInt(rewardAmount) * BigInt(10 ** decimals);

    if (sourceAccountInfo.amount < totalRewardAmount) {
      throw new Error(`Insufficient tokens for reward distribution. Required: ${totalRewardAmount}, Available: ${sourceAccountInfo.amount}`);
    }

    const results: DistributionResult[] = [];

    // Process distributions in batches to avoid transaction size limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < distributions.length; i += BATCH_SIZE) {
      const batch = distributions.slice(i, i + BATCH_SIZE);
      const batchTransaction = new Transaction();

      for (const distribution of batch) {
        const destinationPublicKey = new PublicKey(distribution.address);
        
        // Get or create destination token account
        const destinationAccount = await getOrCreateAssociatedTokenAccount(
          connection,
          wallet,
          mint,
          destinationPublicKey,
          false,
          'confirmed',
          undefined,
          TOKEN_2022_PROGRAM_ID
        );

        const distributionAmount = BigInt(
          Math.floor(Number(totalRewardAmount) * (distribution.percentage / 100))
        );

        const transferInstruction = createTransferInstruction(
          sourceAccount,
          destinationAccount.address,
          feeCollector,
          distributionAmount,
          [],
          TOKEN_2022_PROGRAM_ID
        );

        batchTransaction.add(transferInstruction);

        results.push({
          address: distribution.address,
          percentage: distribution.percentage,
          amount: (distributionAmount / BigInt(10 ** decimals)).toString(),
          signature: '', // Will be updated after transaction
        });
      }

      const signature = await sendAndConfirmTransaction(
        connection,
        batchTransaction,
        [wallet]
      );

      // Update signatures for this batch
      for (let j = i; j < i + batch.length; j++) {
        if (results[j]) {
          results[j].signature = signature;
        }
      }

      console.log(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1} distributed. Transaction: ${signature}`
      );
    }

    return results;

  } catch (error) {
    console.error('Error distributing rewards:', error);
    throw error;
  }
}

// Load distributions from JSON file
function loadDistributionsFromFile(filePath: string): RewardDistribution[] {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error loading distributions file:', error);
    throw error;
  }
}

// If running directly
if (require.main === module) {
  if (!process.argv[2] || !process.argv[3] || !process.argv[4]) {
    console.error('Usage: ts-node distributeRewards.ts <mint-address> <fee-collector-address> <reward-amount> [distributions-file]');
    process.exit(1);
  }

  const [mintAddress, feeCollectorAddress, rewardAmount] = process.argv.slice(2);
  
  let distributions: RewardDistribution[];
  
  if (process.argv[5]) {
    // Load distributions from file
    distributions = loadDistributionsFromFile(process.argv[5]);
  } else {
    // Use example distributions
    distributions = [
      { address: "EXAMPLE_ADDRESS_1", percentage: 50 },
      { address: "EXAMPLE_ADDRESS_2", percentage: 30 },
      { address: "EXAMPLE_ADDRESS_3", percentage: 20 },
    ];
    console.warn('Using example distribution list. In production, provide a JSON file with actual distributions.');
  }

  distributeRewards(mintAddress, feeCollectorAddress, rewardAmount, distributions)
    .then((results) => {
      console.log('Reward distribution completed');
      console.log('Distribution results:');
      console.table(results);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Distribution failed:', error.message);
      process.exit(1);
    });
} 