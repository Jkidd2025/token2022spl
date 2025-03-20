import { PublicKey } from '@solana/web3.js';
import { TokenMetadata } from '../utils/metadata';

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

export const metadata: TokenMetadata = {
  name: 'BPay',
  symbol: 'BPAY',
  mint: new PublicKey('11111111111111111111111111111111'), // This will be set during token creation
  uri: 'https://ipfs.io/ipns/k51qzi5uqu5dm8e8ha6oxwhekeqz8iemc8xk2mok4u73borphn81u5bbzvb66s',
  additionalMetadata: [
    [
      'image',
      'https://ipfs.io/ipns/k51qzi5uqu5dm8e8ha6oxwhekeqz8iemc8xk2mok4u73borphn81u5bbzvb66s',
    ],
  ],
};

// Token constants
export const TOKEN_CONSTANTS = {
  DECIMALS: 9,
  DEFAULT_TRANSFER_FEE_BASIS_POINTS: 500,
  MIN_SOL_BALANCE: 0.02,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  METADATA_PROGRAM_ID: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
} as const;
