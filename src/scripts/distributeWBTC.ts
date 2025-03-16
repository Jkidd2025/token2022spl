import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { getTokenHolders, calculateDistributionAmounts } from '../utils/tokenHolders';
import { swapTokensToSol, swapSolToWBTC } from '../utils/swapUtils';

dotenv.config();

interface DistributionResult {
  holder: string;
  amount: string;
  signature: string;
}

async function distributeWBTCToHolders(
  connection: Connection,
  wallet: Keypair,
  baseTokenMint: PublicKey,
  feeCollectorAddress: string,
  excludeAddresses: string[] = []
): Promise<DistributionResult[]> {
  try {
    // 1. Get fee collector's token account
    const feeCollector = new PublicKey(feeCollectorAddress);
    const feeCollectorTokenAccount = await getAssociatedTokenAddress(
      baseTokenMint,
      feeCollector,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Get total collected fees
    const feeAccountInfo = await getAccount(
      connection,
      feeCollectorTokenAccount,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );
    const totalFees = feeAccountInfo.amount;

    // 2. Calculate 50% of fees for WBTC distribution
    const amountForWBTC = totalFees / BigInt(2);

    // 3. Swap base token to SOL
    console.log(`Swapping ${amountForWBTC.toString()} base tokens to SOL...`);
    const solSwapResult = await swapTokensToSol(
      connection,
      wallet,
      baseTokenMint,
      amountForWBTC
    );

    // 4. Swap SOL to WBTC
    console.log(`Swapping ${solSwapResult.outputAmount.toString()} SOL to WBTC...`);
    const wbtcSwapResult = await swapSolToWBTC(
      connection,
      wallet,
      solSwapResult.outputAmount
    );

    // 5. Get all token holders and their percentages
    console.log('Fetching token holders...');
    const holders = await getTokenHolders(
      connection,
      baseTokenMint,
      [feeCollectorAddress, ...excludeAddresses]
    );

    // 6. Calculate WBTC distribution amounts
    const distributions = await calculateDistributionAmounts(
      holders,
      wbtcSwapResult.outputAmount
    );

    // 7. Distribute WBTC to holders
    console.log('Distributing WBTC to holders...');
    const results: DistributionResult[] = [];
    const wbtcMint = new PublicKey('3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh');
    const sourceWBTCAccount = await getAssociatedTokenAddress(
      wbtcMint,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Process distributions in batches
    const BATCH_SIZE = 5;
    for (let i = 0; i < distributions.length; i += BATCH_SIZE) {
      const batch = distributions.slice(i, i + BATCH_SIZE);
      const batchTransaction = new Transaction();

      for (const dist of batch) {
        const holderPublicKey = new PublicKey(dist.address);
        
        // Get or create holder's WBTC account
        const destinationAccount = await getOrCreateAssociatedTokenAccount(
          connection,
          wallet,
          wbtcMint,
          holderPublicKey,
          false,
          'confirmed',
          undefined,
          TOKEN_2022_PROGRAM_ID
        );

        batchTransaction.add(
          createTransferInstruction(
            sourceWBTCAccount,
            destinationAccount.address,
            wallet.publicKey,
            dist.amount,
            [],
            TOKEN_2022_PROGRAM_ID
          )
        );

        results.push({
          holder: dist.address,
          amount: dist.amount.toString(),
          signature: '', // Will be updated after transaction
        });
      }

      const signature = await connection.sendTransaction(batchTransaction, [wallet]);
      await connection.confirmTransaction(signature, 'confirmed');

      // Update signatures for this batch
      for (let j = i; j < i + batch.length; j++) {
        if (results[j]) {
          results[j].signature = signature;
        }
      }

      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} distributed. Transaction: ${signature}`);
    }

    return results;

  } catch (error) {
    console.error('Error in WBTC distribution:', error);
    throw error;
  }
}

// If running directly
if (require.main === module) {
  if (!process.argv[2] || !process.argv[3]) {
    console.error('Usage: ts-node distributeWBTC.ts <base-token-mint> <fee-collector-address> [excluded-addresses...]');
    process.exit(1);
  }

  const [mintAddress, feeCollectorAddress, ...excludeAddresses] = process.argv.slice(2);

  const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  const wallet = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
  );

  distributeWBTCToHolders(
    connection,
    wallet,
    new PublicKey(mintAddress),
    feeCollectorAddress,
    excludeAddresses
  )
    .then((results) => {
      console.log('WBTC distribution completed');
      console.log('Distribution results:');
      console.table(results);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Distribution failed:', error.message);
      process.exit(1);
    });
} 