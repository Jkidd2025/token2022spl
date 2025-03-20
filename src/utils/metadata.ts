/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  SystemProgram,
} from '@solana/web3.js';
import { TYPE_SIZE, LENGTH_SIZE } from '@solana/spl-token';
import {
  createInitializeInstruction,
  pack,
  TokenMetadata as SPLTokenMetadata,
  createUpdateFieldInstruction,
} from '@solana/spl-token-metadata';
import { Buffer } from 'buffer';

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export type TokenMetadata = {
  name: string;
  symbol: string;
  uri: string;
  mint: PublicKey;
  additionalMetadata: (readonly [string, string])[];
};

export function validateMetadata(metadata: TokenMetadata): void {
  if (!metadata.name || metadata.name.length === 0) throw new Error('Metadata name is required');
  if (!metadata.symbol || metadata.symbol.length === 0)
    throw new Error('Metadata symbol is required');
  if (!metadata.uri || metadata.uri.length === 0) throw new Error('Metadata uri is required');
  if (!metadata.mint) throw new Error('Metadata mint is required');
  try {
    new PublicKey(metadata.mint);
  } catch (error) {
    throw new Error('Invalid mint public key');
  }
  metadata.additionalMetadata.forEach(([key, value]) => {
    if (typeof key !== 'string' || key.length === 0)
      throw new Error('Additional metadata key must be a non-empty string');
    if (typeof value !== 'string') throw new Error('Additional metadata value must be a string');
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
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  );
}

export async function createTokenMetadata(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  metadata: TokenMetadata
): Promise<string> {
  try {
    validateMetadata(metadata);

    // Get the metadata PDA
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    );
    console.log('Using metadata PDA:', metadataPDA.toString());

    // Create transaction
    const transaction = new Transaction();

    // Add initialize metadata instruction
    transaction.add(
      createInitializeInstruction({
        programId: TOKEN_METADATA_PROGRAM_ID,
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
          programId: TOKEN_METADATA_PROGRAM_ID,
          metadata: metadataPDA,
          updateAuthority: payer.publicKey,
          field: key,
          value,
        })
      );
    }

    // Set recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;

    // Sign transaction
    transaction.sign(payer);

    // Send and confirm transaction
    console.log('Sending metadata transaction...');
    const signature = await connection.sendTransaction(transaction, [payer], {
      skipPreflight: false,
      preflightCommitment: 'finalized',
      maxRetries: 3,
    });
    console.log('Metadata transaction sent:', signature);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      'finalized'
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return signature;
  } catch (error) {
    console.error('Error in createTokenMetadata:', error);
    throw error;
  }
}
