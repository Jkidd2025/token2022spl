import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';

export function createInitializeMetadataPointerInstruction(
  mint: PublicKey,
  authority: PublicKey,
  programId: PublicKey = TOKEN_2022_PROGRAM_ID
): TransactionInstruction {
  const keys = [
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: true, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const data = Buffer.from([28]); // Initialize Metadata Pointer instruction

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
}

export function createRevokeAuthoritiesInstruction(
  mint: PublicKey,
  authority: PublicKey,
  programId: PublicKey = TOKEN_2022_PROGRAM_ID
): TransactionInstruction {
  const keys = [
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: true, isWritable: false },
  ];

  const data = Buffer.from([29]); // Revoke authorities instruction

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
} 