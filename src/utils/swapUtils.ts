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
} from '@solana/spl-token';
import {
  Liquidity,
  LiquidityPoolKeys,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import fetch from 'cross-fetch';

// Raydium Pool ID for your token to SOL
const YOUR_TOKEN_SOL_POOL = new PublicKey('YOUR_POOL_ID_HERE');

// Constants
const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';
const WBTC_MINT = '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh';

export interface SwapResult {
  inputAmount: bigint;
  outputAmount: bigint;
  signature: string;
}

async function executeJupiterSwap(
  connection: Connection,
  wallet: Keypair,
  inputMint: string,
  outputMint: string,
  amount: bigint,
  slippageBps: number = 50
): Promise<SwapResult> {
  try {
    // Get quote from Jupiter API
    const quoteResponse = await (
      await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}\
&outputMint=${outputMint}\
&amount=${amount.toString()}\
&slippageBps=${slippageBps}`
      )
    ).json();

    if (!quoteResponse || quoteResponse.error) {
      throw new Error(`Failed to get quote: ${quoteResponse?.error || 'Unknown error'}`);
    }

    // Get serialized transactions for the swap
    const { swapTransaction } = await (
      await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: wallet.publicKey.toString(),
          wrapAndUnwrapSol: true,
          // Optional: Compute unit price for priority
          computeUnitPriceMicroLamports: 1000,
        }),
      })
    ).json();

    // Deserialize and sign the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    transaction.sign([wallet]);

    // Execute the transaction
    const signature = await connection.sendTransaction(transaction);
    await connection.confirmTransaction(signature, 'confirmed');

    return {
      inputAmount: amount,
      outputAmount: BigInt(quoteResponse.outAmount),
      signature,
    };
  } catch (error) {
    console.error('Error executing Jupiter swap:', error);
    throw error;
  }
}

export async function swapTokensToSol(
  connection: Connection,
  wallet: Keypair,
  tokenMint: PublicKey,
  amount: bigint
): Promise<SwapResult> {
  try {
    console.log(`Swapping ${amount.toString()} tokens to SOL...`);
    return await executeJupiterSwap(
      connection,
      wallet,
      tokenMint.toString(),
      NATIVE_SOL_MINT,
      amount
    );
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
    console.log(`Swapping ${amount.toString()} SOL to WBTC...`);
    return await executeJupiterSwap(
      connection,
      wallet,
      NATIVE_SOL_MINT,
      WBTC_MINT,
      amount
    );
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