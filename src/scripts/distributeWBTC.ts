import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
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
import { checkAndTopUpSolBalance } from '../utils/solBalanceManager';
import { getConfirmationStrategy, isLargeTransfer } from '../utils/transactionConfirmation';
import { getWBTCAddress, validateTokenAddresses } from '../config/tokens';

dotenv.config();

// Validate token addresses on startup
validateTokenAddresses();

export interface DistributionResult {
  holder: string;
  amount: string;
  signature: string;
}

export async function distributeWBTCToHolders(
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
    // Check and top up fee collector's SOL balance if needed
    const topUpSignature = await checkAndTopUpSolBalance(connection, feeCollector, wallet);
    if (topUpSignature) {
      console.log('Topped up fee collector SOL balance. Transaction:', topUpSignature);
    }

    // Get total collected fees
    const feeAccountInfo = await getAccount(
      connection,
      feeCollectorTokenAccount,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );
    const totalFees = feeAccountInfo.amount;

    // 2. Calculate 50% of fees for WBTC distribution and reserve
    const amountForWBTC = totalFees / BigInt(2);
    const amountForReserve = totalFees - amountForWBTC;

    // 3. Swap reserve portion to SOL for main wallet
    console.log(`Swapping ${amountForReserve.toString()} base tokens to SOL for reserve...`);
    const reserveSwapResult = await swapTokensToSol(
      connection,
      wallet,
      baseTokenMint,
      amountForReserve
    );

    console.log(
      `Swapped reserve tokens to ${reserveSwapResult.outputAmount.toString()} SOL (received in main wallet)`
    );

    // 4. Swap remaining 50% to SOL for WBTC distribution
    console.log(`Swapping ${amountForWBTC.toString()} base tokens to SOL...`);
    const solSwapResult = await swapTokensToSol(connection, wallet, baseTokenMint, amountForWBTC);

    // 5. Swap SOL to WBTC
    console.log(`Swapping ${solSwapResult.outputAmount.toString()} SOL to WBTC...`);
    const wbtcSwapResult = await swapSolToWBTC(connection, wallet, solSwapResult.outputAmount);

    // 6. Get all token holders and their percentages
    console.log('Fetching token holders...');
    const holders = await getTokenHolders(connection, baseTokenMint, [
      feeCollectorAddress,
      ...excludeAddresses,
    ]);

    // 7. Calculate WBTC distribution amounts
    const distributions = await calculateDistributionAmounts(holders, wbtcSwapResult.outputAmount);

    // 8. Distribute WBTC to holders
    console.log('Distributing WBTC to holders...');
    const results: DistributionResult[] = [];
    const wbtcMint = getWBTCAddress();
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
      let totalBatchAmount = BigInt(0);

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

        totalBatchAmount += dist.amount;
        results.push({
          holder: dist.address,
          amount: dist.amount.toString(),
          signature: '',
        });
      }

      // Determine confirmation strategy based on total batch amount
      const confirmationStrategy = isLargeTransfer(totalBatchAmount)
        ? getConfirmationStrategy('LARGE_TRANSFER')
        : getConfirmationStrategy('REGULAR_TRANSFER');

      // Execute the batch
      console.log(`Executing batch with ${confirmationStrategy.commitment} commitment...`);
      const batchSignature = await connection.sendTransaction(batchTransaction, [wallet]);
      await connection.confirmTransaction(
        {
          signature: batchSignature,
          ...(await connection.getLatestBlockhash(confirmationStrategy)),
        },
        confirmationStrategy.commitment
      );

      // Update signatures for this batch
      for (let j = i; j < i + batch.length; j++) {
        if (results[j]) {
          results[j].signature = batchSignature;
        }
      }

      console.log(
        `Completed batch distribution with ${confirmationStrategy.commitment} commitment. Transaction: ${batchSignature}`
      );
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
    console.error(
      'Usage: ts-node distributeWBTC.ts <base-token-mint> <fee-collector-address> [excluded-addresses...]'
    );
    process.exit(1);
  }

  const [mintAddress, feeCollectorAddress, ...excludeAddresses] = process.argv.slice(2);
  const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  const wallet = Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!)));

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
