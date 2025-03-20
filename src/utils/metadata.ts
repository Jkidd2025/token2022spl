/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  TransactionSignature,
  TransactionError as SolanaTransactionError,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  createInitializeInstruction,
  pack,
  TokenMetadata as SPLTokenMetadata,
  createUpdateFieldInstruction,
} from '@solana/spl-token-metadata';
import { Buffer } from 'buffer';
import { TOKEN_CONSTANTS } from '../config/tokens';

// Constants
const METADATA_SEED = 'metadata';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const TRANSACTION_TIMEOUT = 60000;

export interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  mint: PublicKey;
  additionalMetadata: ReadonlyArray<readonly [string, string]>;
}

interface MetadataError extends Error {
  code?: string;
  logs?: string[];
}

export function validateMetadata(metadata: TokenMetadata): void {
  if (!metadata.name?.trim()) {
    throw new Error('Metadata name is required and cannot be empty');
  }
  if (!metadata.symbol?.trim()) {
    throw new Error('Metadata symbol is required and cannot be empty');
  }
  if (!metadata.uri?.trim()) {
    throw new Error('Metadata URI is required and cannot be empty');
  }
  if (!metadata.mint) {
    throw new Error('Metadata mint is required');
  }
  try {
    new PublicKey(metadata.mint);
  } catch (error) {
    throw new Error('Invalid mint public key format');
  }

  metadata.additionalMetadata.forEach(([key, value], index) => {
    if (!key?.trim()) {
      throw new Error(`Additional metadata key at index ${index} must be a non-empty string`);
    }
    if (typeof value !== 'string') {
      throw new Error(`Additional metadata value at index ${index} must be a string`);
    }
  });
}

export const DEFAULT_TOKEN_METADATA: TokenMetadata = {
  name: '',
  symbol: '',
  uri: '',
  mint: PublicKey.default,
  additionalMetadata: [],
};

function getMetadataAddress(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(METADATA_SEED), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_PROGRAM_ID
  );
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        console.log(`Retrying operation (attempt ${i + 2}/${retries})`);
      }
    }
  }
  throw lastError;
}

export async function createTokenMetadata(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  metadata: TokenMetadata
): Promise<TransactionSignature> {
  try {
    validateMetadata(metadata);

    const [metadataPDA] = getMetadataAddress(mint);
    console.log('Using metadata PDA:', metadataPDA.toString());

    // Create transaction
    const transaction = new Transaction();

    // Add initialize metadata instruction
    transaction.add(
      createInitializeInstruction({
        programId: TOKEN_PROGRAM_ID,
        metadata: metadataPDA,
        updateAuthority: payer.publicKey,
        mint,
        mintAuthority: payer.publicKey,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
      })
    );

    // Add additional metadata fields
    for (const [key, value] of metadata.additionalMetadata) {
      transaction.add(
        createUpdateFieldInstruction({
          programId: TOKEN_PROGRAM_ID,
          metadata: metadataPDA,
          updateAuthority: payer.publicKey,
          field: key,
          value,
        })
      );
    }

    // Set recent blockhash and sign transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;
    transaction.sign(payer);

    // Send and confirm transaction with retry logic
    return await executeWithRetry(async () => {
      console.log('Sending metadata transaction...');
      const signature = await connection.sendTransaction(transaction, [payer], {
        skipPreflight: false,
        preflightCommitment: 'finalized',
        maxRetries: MAX_RETRIES,
      });
      console.log('Metadata transaction sent:', signature);

      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'finalized'
      );

      if (confirmation.value.err) {
        const error = new Error('Transaction failed') as MetadataError;
        error.code = 'METADATA_TRANSACTION_FAILED';
        error.logs = confirmation.value.err as unknown as string[];
        throw error;
      }

      return signature;
    });
  } catch (error) {
    console.error('Error in createTokenMetadata:', error);
    const metadataError = error as MetadataError;
    if (metadataError.logs) {
      console.error('Transaction logs:', metadataError.logs);
    }
    throw error;
  }
}
