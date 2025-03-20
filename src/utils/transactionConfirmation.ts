import { ConfirmOptions } from '@solana/web3.js';

// Transaction types and their recommended confirmation strategies
export const TRANSACTION_TYPES = {
  // High-value transactions that need maximum security
  SECURE: {
    INITIAL_MINT: 'SECURE',
    TOKEN_CREATION: 'SECURE',
    LARGE_TRANSFER: 'SECURE',
    AUTHORITY_CHANGE: 'SECURE',
  },

  // Regular transactions that need standard confirmation
  STANDARD: {
    DISTRIBUTION: 'STANDARD',
    FEE_COLLECTION: 'STANDARD',
    REGULAR_TRANSFER: 'STANDARD',
  },

  // Low-value or time-sensitive transactions
  FAST: {
    BALANCE_CHECK: 'FAST',
    SMALL_TRANSFER: 'FAST',
    METADATA_UPDATE: 'FAST',
  },
} as const;

// Confirmation options for different security levels
export const CONFIRMATION_STRATEGY = {
  FAST: {
    commitment: 'processed' as const,
    timeout: 30000, // 30 seconds
    preflightCommitment: 'processed' as const,
  },
  STANDARD: {
    commitment: 'confirmed' as const,
    timeout: 60000, // 60 seconds
    preflightCommitment: 'confirmed' as const,
  },
  SECURE: {
    commitment: 'finalized' as const,
    timeout: 90000, // 90 seconds
    preflightCommitment: 'finalized' as const,
  },
};

// Helper function to get confirmation options based on transaction type
export function getConfirmationStrategy(
  transactionType:
    | keyof typeof TRANSACTION_TYPES.SECURE
    | keyof typeof TRANSACTION_TYPES.STANDARD
    | keyof typeof TRANSACTION_TYPES.FAST
): ConfirmOptions {
  // Find the security level for the transaction type
  let securityLevel: keyof typeof CONFIRMATION_STRATEGY = 'STANDARD';

  if (transactionType in TRANSACTION_TYPES.SECURE) {
    securityLevel = 'SECURE';
  } else if (transactionType in TRANSACTION_TYPES.FAST) {
    securityLevel = 'FAST';
  }

  return CONFIRMATION_STRATEGY[securityLevel];
}

// Helper function to determine if a transfer amount should use secure confirmation
export function isLargeTransfer(amount: bigint, decimals: number = 9): boolean {
  const threshold = BigInt(1000) * BigInt(10 ** decimals); // 1000 tokens
  return amount >= threshold;
}
