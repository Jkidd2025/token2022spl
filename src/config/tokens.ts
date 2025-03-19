import { PublicKey } from '@solana/web3.js';

// Token mint addresses
export const TOKEN_ADDRESSES = {
  WBTC: process.env.WBTC_MINT_ADDRESS || '', // Will be set via environment variable
  SOL: 'So11111111111111111111111111111111111111112', // Wrapped SOL
} as const;

// Helper function to get WBTC mint address
export function getWBTCAddress(): PublicKey {
  if (!TOKEN_ADDRESSES.WBTC) {
    throw new Error(
      'WBTC mint address not configured. Please set WBTC_MINT_ADDRESS environment variable.'
    );
  }
  return new PublicKey(TOKEN_ADDRESSES.WBTC);
}

// Validate token addresses
export function validateTokenAddresses(): void {
  if (!TOKEN_ADDRESSES.WBTC) {
    throw new Error('WBTC mint address is required but not configured');
  }
  try {
    new PublicKey(TOKEN_ADDRESSES.WBTC);
  } catch (error) {
    throw new Error('Invalid WBTC mint address format');
  }
}
