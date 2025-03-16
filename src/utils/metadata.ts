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

export async function createTokenMetadata(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  metadata: TokenMetadata
) {
  try {
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
        isMutable: false, // Set to false since we want immutable metadata
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

export const DEFAULT_TOKEN_METADATA: TokenMetadata = {
  name: "SPL Token 2022",
  symbol: "SPL22",
  uri: "", // Add your metadata URI here
  sellerFeeBasisPoints: 500, // 5%
  creators: [
    {
      address: "", // Add creator address
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