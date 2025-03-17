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
  if (!metadata.name || metadata.name.length === 0) {
    throw new Error('Token name is required');
  }
  if (!metadata.symbol || metadata.symbol.length === 0) {
    throw new Error('Token symbol is required');
  }
  if (!metadata.uri || metadata.uri.length === 0) {
    throw new Error('Metadata URI is required');
  }
  
  // Validate GitHub URL format
  if (!metadata.uri.startsWith('https://raw.githubusercontent.com/')) {
    throw new Error('Metadata URI must be a raw GitHub URL');
  }

  // Validate creator shares
  if (metadata.creators) {
    const totalShares = metadata.creators.reduce((sum, creator) => sum + creator.share, 0);
    if (totalShares !== 100) {
      throw new Error('Creator shares must total 100');
    }
  }
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
        isMutable: true, // Set to true to allow future updates
      })
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer]
    );

    return {
      metadataAddress: metadataAccount[0].toString(),
      signature,
    };

  } catch (error) {
    console.error('Error creating token metadata:', error);
    throw error;
  }
} 