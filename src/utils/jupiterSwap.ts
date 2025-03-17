import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import { getWBTCAddress, TOKEN_ADDRESSES } from '../config/tokens';

export interface SwapResult {
  inputAmount: bigint;
  outputAmount: bigint;
  signature: string;
}

// Constants
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
const NATIVE_SOL = 'So11111111111111111111111111111111111111112'; // Wrapped SOL mint
const WBTC_MINT = '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh';

/**
 * Get the best swap route using Jupiter Quote API
 */
async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50 // 0.5% default slippage
) {
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: slippageBps.toString(),
      feeBps: "4" // 0.04% fee for Jupiter
    });

    const response = await fetch(`${JUPITER_QUOTE_API}/quote?${params}`);
    if (!response.ok) {
      throw new Error(`Quote failed: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting Jupiter quote:', error);
    throw error;
  }
}

/**
 * Get swap transaction from Jupiter Swap API
 */
async function getSwapTransaction(
  route: any,
  userPublicKey: string
) {
  try {
    const response = await fetch(`${JUPITER_QUOTE_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        route,
        userPublicKey,
        wrapUnwrapSOL: true // Automatically wrap/unwrap SOL
      })
    });

    if (!response.ok) {
      throw new Error(`Swap transaction failed: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting swap transaction:', error);
    throw error;
  }
}

/**
 * Get detailed information about the swap route
 */
export async function getDetailedRouteInfo(
  inputMint: string,
  outputMint: string,
  amount: string
): Promise<{
  routes: any[],
  bestRoute: any,
  priceImpact: number,
  estimatedOutput: string
}> {
  try {
    const quote = await getQuote(inputMint, outputMint, amount);
    
    // Extract market information
    const marketInfos = quote.routesInfos?.[0]?.marketInfos || [];
    const routeDetails = marketInfos.map((market: any) => ({
      label: market.label,
      inputMint: market.inputMint,
      outputMint: market.outputMint,
      liquidityFee: market.liquidityFee,
      platformFee: market.platformFee
    }));

    return {
      routes: routeDetails,
      bestRoute: quote.routesInfos?.[0],
      priceImpact: quote.priceImpactPct,
      estimatedOutput: quote.outputAmount
    };
  } catch (error) {
    console.error('Error getting detailed route info:', error);
    throw error;
  }
}

/**
 * Swap tokens to SOL using Jupiter
 */
export async function swapTokensToSol(
  connection: Connection,
  wallet: Keypair,
  tokenMint: PublicKey,
  amount: bigint
): Promise<SwapResult> {
  try {
    // Get and log detailed route information
    const routeInfo = await getDetailedRouteInfo(
      tokenMint.toString(),
      NATIVE_SOL,
      amount.toString()
    );
    
    console.log('Detailed swap route:');
    console.log('Markets used:', routeInfo.routes);
    console.log('Price impact:', routeInfo.priceImpact + '%');
    console.log('Estimated output:', routeInfo.estimatedOutput);

    console.log(`Getting quote for ${amount} tokens to SOL...`);
    
    // 1. Get quote for the swap
    const quote = await getQuote(
      tokenMint.toString(),
      NATIVE_SOL,
      amount.toString()
    );

    console.log('Route found:', {
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
      priceImpactPct: quote.priceImpactPct
    });

    // 2. Get the swap transaction
    const swapResult = await getSwapTransaction(
      quote,
      wallet.publicKey.toString()
    );

    // 3. Deserialize and sign the transaction
    const swapTransaction = VersionedTransaction.deserialize(
      Buffer.from(swapResult.swapTransaction, 'base64')
    );

    // 4. Sign the transaction
    swapTransaction.sign([wallet]);

    // 5. Execute the swap
    console.log('Executing swap transaction...');
    const signature = await connection.sendTransaction(swapTransaction);
    await connection.confirmTransaction(signature, 'confirmed');

    return {
      inputAmount: amount,
      outputAmount: BigInt(quote.outputAmount),
      signature
    };
  } catch (error) {
    console.error('Error in swapTokensToSol:', error);
    throw error;
  }
}

/**
 * Swap SOL to WBTC using Jupiter
 */
export async function swapSolToWBTC(
  connection: Connection,
  wallet: Keypair,
  amount: bigint
): Promise<SwapResult> {
  try {
    console.log(`Getting quote for ${amount} SOL to WBTC...`);
    
    // 1. Get quote for the swap
    const quote = await getQuote(
      NATIVE_SOL,
      WBTC_MINT,
      amount.toString()
    );

    console.log('Route found:', {
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
      priceImpactPct: quote.priceImpactPct
    });

    // 2. Get the swap transaction
    const swapResult = await getSwapTransaction(
      quote,
      wallet.publicKey.toString()
    );

    // 3. Deserialize and sign the transaction
    const swapTransaction = VersionedTransaction.deserialize(
      Buffer.from(swapResult.swapTransaction, 'base64')
    );

    // 4. Sign the transaction
    swapTransaction.sign([wallet]);

    // 5. Execute the swap
    console.log('Executing swap transaction...');
    const signature = await connection.sendTransaction(swapTransaction);
    await connection.confirmTransaction(signature, 'confirmed');

    return {
      inputAmount: amount,
      outputAmount: BigInt(quote.outputAmount),
      signature
    };
  } catch (error) {
    console.error('Error in swapSolToWBTC:', error);
    throw error;
  }
}

/**
 * Utility function to check price impact and output amount before swapping
 */
export async function checkSwapRoute(
  inputMint: string,
  outputMint: string,
  amount: string
) {
  const quote = await getQuote(inputMint, outputMint, amount);
  return {
    inputAmount: quote.inputAmount,
    outputAmount: quote.outputAmount,
    priceImpactPct: quote.priceImpactPct,
    routes: quote.routesInfos
  };
} 