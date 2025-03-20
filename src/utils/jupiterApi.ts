/* eslint-disable @typescript-eslint/no-explicit-any */
import { PublicKey, VersionedTransaction } from '@solana/web3.js';

interface JupiterQuote {
  outAmount: string;
  routePlan: any[];
}

export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string
): Promise<JupiterQuote> {
  const response = await fetch(
    `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`
  );

  if (!response.ok) {
    throw new Error(`Failed to get Jupiter quote: ${response.statusText}`);
  }

  return response.json();
}

export async function executeJupiterSwap(
  quote: JupiterQuote,
  userPublicKey: PublicKey
): Promise<VersionedTransaction> {
  const response = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: userPublicKey.toString(),
      wrapUnwrapSOL: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get swap transaction: ${response.statusText}`);
  }

  const { swapTransaction } = await response.json();
  return VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
}
