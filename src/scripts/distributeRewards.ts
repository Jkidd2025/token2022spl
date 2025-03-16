import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';

dotenv.config();

interface RewardDistribution {
  address: string;
  percentage: number;
}

async function distributeRewards(
  mintAddress: string,
  rewardAmount: string,
  distributions: RewardDistribution[]
) {
  const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  
  const wallet = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
  );

  const mint = new PublicKey(mintAddress);
  
  try {
    // Get the source token account (fee collector account)
    const sourceAccount = await getAssociatedTokenAddress(
      mint,
      wallet.publicKey,
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

    const decimals = process.env.TOKEN_DECIMALS ? parseInt(process.env.TOKEN_DECIMALS) : 9;
    const totalRewardAmount = BigInt(rewardAmount) * BigInt(10 ** decimals);

    if (sourceAccountInfo.amount < totalRewardAmount) {
      throw new Error('Insufficient tokens for reward distribution');
    }

    // Create and send transactions for each distribution
    for (const distribution of distributions) {
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
        Math.floor(Number(rewardAmount) * (distribution.percentage / 100))
      ) * BigInt(10 ** decimals);

      const transaction = new Transaction().add(
        createTransferInstruction(
          sourceAccount,
          destinationAccount.address,
          wallet.publicKey,
          distributionAmount,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet]
      );

      console.log(
        `Distributed ${distribution.percentage}% to ${distribution.address}`,
        `Transaction: ${signature}`
      );
    }

    return true;

  } catch (error) {
    console.error('Error distributing rewards:', error);
    throw error;
  }
}

// Example distribution if running directly
if (require.main === module) {
  if (!process.argv[2] || !process.argv[3]) {
    console.error('Please provide the mint address and reward amount as arguments');
    process.exit(1);
  }

  // Example distribution list - should be provided as a JSON file in practice
  const exampleDistributions: RewardDistribution[] = [
    { address: "EXAMPLE_ADDRESS_1", percentage: 50 },
    { address: "EXAMPLE_ADDRESS_2", percentage: 30 },
    { address: "EXAMPLE_ADDRESS_3", percentage: 20 },
  ];

  distributeRewards(process.argv[2], process.argv[3], exampleDistributions)
    .then(() => {
      console.log('Reward distribution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
} 