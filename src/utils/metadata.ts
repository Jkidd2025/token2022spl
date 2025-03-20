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

// Token Metadata Program ID on mainnet
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export type TokenMetadata = {
  name: string;
  symbol: string;
  uri: string;
  mint: PublicKey;
  additionalMetadata: (readonly [string, string])[];
};

export function validateMetadata(metadata: TokenMetadata): void {
  if (!metadata.name || metadata.name.length === 0) {
    throw new Error('Metadata name is required');
  }
  if (!metadata.symbol || metadata.symbol.length === 0) {
    throw new Error('Metadata symbol is required');
  }
  if (!metadata.uri || metadata.uri.length === 0) {
    throw new Error('Metadata uri is required');
  }
  if (!metadata.mint) {
    throw new Error('Metadata mint is required');
  }
  try {
    new PublicKey(metadata.mint);
  } catch (error) {
    throw new Error('Invalid mint public key');
  }
  metadata.additionalMetadata.forEach(([key, value]) => {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('Additional metadata key must be a non-empty string');
    }
    if (typeof value !== 'string') {
      throw new Error('Additional metadata value must be a string');
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

    const transaction = new Transaction();
    const [metadataAddress, bump] = getMetadataAddress(mint);
    console.log('Metadata account address:', metadataAddress.toString());
    console.log('Bump seed:', bump);

    // Calculate size and lamports for metadata account
    const splMetadata: SPLTokenMetadata = {
      mint,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      additionalMetadata: metadata.additionalMetadata,
    };
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(splMetadata).length;
    const lamports = await connection.getMinimumBalanceForRentExemption(metadataLen);
    console.log('Metadata size:', metadataLen);
    console.log('Lamports required:', lamports);

    // Check if metadata account already exists
    const existingAccount = await connection.getAccountInfo(metadataAddress);
    if (existingAccount) {
      throw new Error(`Metadata account already exists at ${metadataAddress.toString()}`);
    }

    // Create metadata account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: metadataAddress,
        lamports,
        space: metadataLen,
        programId: TOKEN_METADATA_PROGRAM_ID,
      })
    );

    // Initialize metadata
    const initMetadataInstruction = createInitializeInstruction({
      programId: TOKEN_METADATA_PROGRAM_ID,
      mint,
      metadata: metadataAddress,
      mintAuthority: payer.publicKey,
      updateAuthority: payer.publicKey,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
    });
    transaction.add(initMetadataInstruction);

    // Add additional metadata fields
    for (const [key, value] of metadata.additionalMetadata) {
      const updateFieldInstruction = createUpdateFieldInstruction({
        programId: TOKEN_METADATA_PROGRAM_ID,
        metadata: metadataAddress,
        updateAuthority: payer.publicKey,
        field: key,
        value,
      });
      transaction.add(updateFieldInstruction);
    }

    // Set recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;

    // Simulate transaction
    console.log('Simulating metadata transaction...');
    const simulation = await connection.simulateTransaction(transaction, [payer]);
    if (simulation.value.err) {
      console.error('Metadata simulation failed:', simulation.value.err);
      console.error('Simulation logs:', simulation.value.logs);
      throw new Error(
        `Metadata creation simulation failed: ${JSON.stringify(simulation.value.err)}`
      );
    }
    console.log('Metadata simulation succeeded:', simulation.value.logs);

    // Send and confirm transaction
    console.log('Sending metadata transaction...');
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer], {
      commitment: 'confirmed',
    });

    // Verify transaction confirmation
    try {
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed'
      );
      console.log('Metadata transaction confirmed:', signature);
    } catch (error) {
      console.error('Transaction confirmation error:', error);
      throw error;
    }

    return signature;
  } catch (error) {
    console.error('Error in createTokenMetadata:', error);
    throw error;
  }
}
