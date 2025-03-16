import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  createMintToInstruction,
  getOrCreateAssociatedTokenAccount,
  createRevokeInstruction,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { createRevokeAuthoritiesInstruction } from '../utils/instructions';

dotenv.config();

async function performInitialMintAndRevoke(mintAddress: string) {
  const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  
  const wallet = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
  );

  const mint = new PublicKey(mintAddress);

  try {
    // Create token account for the wallet
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      mint,
      wallet.publicKey,
      false,
      'confirmed',
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    // Prepare initial mint transaction
    const initialSupply = BigInt(process.env.INITIAL_SUPPLY || '1000000000');
    const decimals = process.env.TOKEN_DECIMALS ? parseInt(process.env.TOKEN_DECIMALS) : 9;
    const actualSupply = initialSupply * BigInt(10 ** decimals);

    const mintTx = new Transaction().add(
      createMintToInstruction(
        mint,
        tokenAccount.address,
        wallet.publicKey,
        actualSupply,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const mintSignature = await sendAndConfirmTransaction(
      connection,
      mintTx,
      [wallet]
    );

    console.log('Initial supply minted. Transaction:', mintSignature);

    // Revoke authorities
    const revokeTx = new Transaction()
      .add(
        // Revoke mint authority
        createRevokeInstruction(
          mint,
          wallet.publicKey,
          wallet.publicKey,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      )
      .add(
        // Revoke freeze authority and other authorities
        createRevokeAuthoritiesInstruction(
          mint,
          wallet.publicKey
        )
      );

    const revokeSignature = await sendAndConfirmTransaction(
      connection,
      revokeTx,
      [wallet]
    );

    console.log('Authorities revoked. Transaction:', revokeSignature);

    return {
      mintSignature,
      revokeSignature,
      tokenAccount: tokenAccount.address.toBase58(),
    };

  } catch (error) {
    console.error('Error in initial mint and revoke:', error);
    throw error;
  }
}

// If running directly
if (require.main === module) {
  if (!process.argv[2]) {
    console.error('Please provide the mint address as an argument');
    process.exit(1);
  }

  performInitialMintAndRevoke(process.argv[2])
    .then(() => {
      console.log('Initial mint and authority revocation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
} 