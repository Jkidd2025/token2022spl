import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js';
import {
  createInitializeMetadataPointerInstruction,
  METADATA_POINTER_PROGRAM_ID,
} from '@solana/spl-token-metadata';
import { Buffer } from 'buffer';

export interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  decimals?: number;
  sellerFeeBasisPoints?: number;
  creators?: {
    address: string;
    verified: boolean;
    share: number;
  }[];
  collection?: {
    verified: boolean;
    key: string;
  };
  uses?: {
    useMethod: 'burn' | 'multiple' | 'single';
    remaining: number;
    total: number;
  };
}

// Validate metadata URI and required fields
function validateMetadata(metadata: TokenMetadata): void {
  // Basic field validation
  if (!metadata.name || metadata.name.length === 0) {
    throw new Error('Token name is required');
  }
  if (metadata.name.length > 32) {
    throw new Error('Token name must not exceed 32 characters');
  }
  
  if (!metadata.symbol || metadata.symbol.length === 0) {
    throw new Error('Token symbol is required');
  }
  if (metadata.symbol.length > 10) {
    throw new Error('Token symbol must not exceed 10 characters');
  }
  
  if (!metadata.uri || metadata.uri.length === 0) {
    throw new Error('Metadata URI is required');
  }
  
  // URI validation
  if (!metadata.uri.startsWith('https://raw.githubusercontent.com/')) {
    throw new Error('Metadata URI must be a raw GitHub URL');
  }

  // Fee validation
  if (metadata.sellerFeeBasisPoints !== undefined) {
    if (metadata.sellerFeeBasisPoints < 0 || metadata.sellerFeeBasisPoints > 10000) {
      throw new Error('Seller fee basis points must be between 0 and 10000');
    }
  }

  // Creator validation
  if (metadata.creators) {
    const totalShares = metadata.creators.reduce((sum, creator) => sum + creator.share, 0);
    if (totalShares !== 100) {
      throw new Error('Creator shares must total 100');
    }
    
    // Validate each creator
    metadata.creators.forEach((creator, index) => {
      try {
        if (creator.address) {
          new PublicKey(creator.address);
        }
      } catch (error) {
        throw new Error(`Invalid creator address at index ${index}`);
      }
      if (creator.share < 0 || creator.share > 100) {
        throw new Error(`Invalid creator share at index ${index}`);
      }
    });
  }

  // Collection validation
  if (metadata.collection) {
    try {
      new PublicKey(metadata.collection.key);
    } catch (error) {
      throw new Error('Invalid collection key');
    }
  }

  console.log('Metadata validation passed:', {
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
    sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
    creators: metadata.creators?.length || 0
  });
}

export const DEFAULT_TOKEN_METADATA: TokenMetadata = {
  name: "BPay",
  symbol: "BPAY",
  uri: "https://raw.githubusercontent.com/Jkidd2025/token2022spl/main/src/config/metadata.json",
  sellerFeeBasisPoints: 500, // 5%
  creators: [
    {
      address: "", // Will be set during token creation
      verified: true,
      share: 100,
    },
  ],
  uses: {
    useMethod: "burn",
    remaining: 0,
    total: 0,
  },
};

export async function createTokenMetadata(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  metadata: TokenMetadata
) {
  try {
    // Set the creator address to the payer's public key
    if (metadata.creators && metadata.creators.length > 0) {
      metadata.creators[0].address = payer.publicKey.toString();
    }

    // Validate metadata before proceeding
    validateMetadata(metadata);

    const metadataAccount = await PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        METADATA_POINTER_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      METADATA_POINTER_PROGRAM_ID
    );

    const transaction = new Transaction().add(
      createInitializeMetadataPointerInstruction({
        metadata: metadataAccount[0],
        mint,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey,
        data: {
          name: metadata.name,
          symbol: metadata.symbol,
          uri: metadata.uri,
          sellerFeeBasisPoints: metadata.sellerFeeBasisPoints || 0,
          creators: metadata.creators || null,
          collection: metadata.collection || null,
          uses: metadata.uses || null,
        },
        isMutable: false, // Set to false to make metadata immutable after minting
      })
    );

    // Simulate transaction before sending
    console.log('Simulating metadata transaction...');
    const simulation = await connection.simulateTransaction(transaction);
    if (simulation.value.err) {
      throw new Error(`Metadata transaction simulation failed: ${simulation.value.err}`);
    }
    console.log('Metadata transaction simulation successful');

    // Send and confirm transaction
    console.log('Sending metadata transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed'
      }
    );

    console.log('Created immutable token metadata:', {
      metadataAddress: metadataAccount[0].toString(),
      signature,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri
    });

    return {
      metadataAddress: metadataAccount[0].toString(),
      signature,
    };

  } catch (error) {
    console.error('Error creating token metadata:', error);
    throw error;
  }
} 