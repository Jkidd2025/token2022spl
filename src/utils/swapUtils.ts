import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createTransferInstruction,
} from '@solana/spl-token';
import {
  Liquidity,
  LiquidityPoolKeys,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import fetch from 'cross-fetch';
import { executeJupiterSwap, getJupiterQuote } from './jupiterApi';
import { getConfirmationStrategy, isLargeTransfer } from '../utils/transactionConfirmation';
import { getWBTCAddress, TOKEN_ADDRESSES } from '../config/tokens';

// Raydium Pool ID for your token to SOL
const YOUR_TOKEN_SOL_POOL = new PublicKey('YOUR_POOL_ID_HERE');

// Constants
const NATIVE_SOL_MINT = TOKEN_ADDRESSES.SOL;

export interface SwapResult {
  inputAmount: bigint;
  outputAmount: bigint;
  signature: string;
}

export async function swapTokensToSol(
  connection: Connection,
  wallet: Keypair,
  tokenMint: PublicKey,
  amount: bigint
): Promise<SwapResult> {
  try {
    // Get quote from Jupiter
    const quote = await getJupiterQuote(tokenMint.toString(), 'SOL', amount.toString());
    
    // Execute swap
    const swapTransaction = await executeJupiterSwap(quote, wallet.publicKey);
    
    // Determine confirmation strategy based on amount
    const confirmationStrategy = isLargeTransfer(amount)
      ? getConfirmationStrategy('LARGE_TRANSFER')
      : getConfirmationStrategy('REGULAR_TRANSFER');

    // Send transaction
    console.log(`Executing swap with ${confirmationStrategy.commitment} commitment...`);
    const signature = await connection.sendTransaction(swapTransaction, [wallet]);
    await connection.confirmTransaction(
      {
        signature,
        ...(await connection.getLatestBlockhash(confirmationStrategy)),
      },
      confirmationStrategy.commitment
    );

    return {
      inputAmount: amount,
      outputAmount: BigInt(quote.outAmount),
      signature
    };
  } catch (error) {
    console.error('Error swapping tokens to SOL:', error);
    throw error;
  }
}

export async function swapSolToWBTC(
  connection: Connection,
  wallet: Keypair,
  amount: bigint
): Promise<SwapResult> {
  try {
    // Get quote from Jupiter
    const quote = await getJupiterQuote('SOL', getWBTCAddress(), amount.toString());
    
    // Execute swap
    const swapTransaction = await executeJupiterSwap(quote, wallet.publicKey);
    
    // Always use secure confirmation for WBTC swaps
    const confirmationStrategy = getConfirmationStrategy('LARGE_TRANSFER');

    // Send transaction
    console.log(`Executing swap with ${confirmationStrategy.commitment} commitment...`);
    const signature = await connection.sendTransaction(swapTransaction, [wallet]);
    await connection.confirmTransaction(
      {
        signature,
        ...(await connection.getLatestBlockhash(confirmationStrategy)),
      },
      confirmationStrategy.commitment
    );

    return {
      inputAmount: amount,
      outputAmount: BigInt(quote.outAmount),
      signature
    };
  } catch (error) {
    console.error('Error swapping SOL to WBTC:', error);
    throw error;
  }
}

// Helper function to get pool info (implement as needed)
async function getPoolInfo(connection: Connection, poolId: PublicKey): Promise<LiquidityPoolKeys> {
  // Implement pool info fetching logic
  throw new Error('Pool info fetching not implemented');
} 