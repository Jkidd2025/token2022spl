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
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  DataV2,
} from '@metaplex-foundation/mpl-token-metadata';
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

function getMetadataAddress(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
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
  metadata: TokenMetadata,
  isMutable: boolean = false  // Default to immutable
): Promise<TransactionSignature> {
  try {
    validateMetadata(metadata);
    
    const metadataPDA = getMetadataAddress(mint);
    console.log('Using metadata PDA:', metadataPDA.toBase58());

    const data: DataV2 = {
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    };

    const instruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data,
          isMutable,  // Use the passed isMutable parameter
          collectionDetails: null,
        },
      }
    );

    console.log('Sending metadata transaction...');
    const transaction = new Transaction().add(instruction);

    return await executeWithRetry(async () => {
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = payer.publicKey;

      return await sendAndConfirmTransaction(connection, transaction, [payer], {
        commitment: 'confirmed',
        skipPreflight: false,
      });
    });
  } catch (error) {
    console.error('Error in createTokenMetadata:', error);
    throw error;
  }
}
