import {
  Connection,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createSetAuthorityInstruction,
  AuthorityType,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

async function disableMintAuthority() {
  try {
    const connection = new Connection(process.env.SOLANA_RPC_URL!, {
      commitment: 'confirmed',
    });

    // Get the wallet that created the token (mint authority)
    const wallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
    );

    // Get the mint address from environment
    if (!process.env.TOKEN_MINT_ADDRESS) {
      throw new Error('TOKEN_MINT_ADDRESS not found in environment');
    }
    const mintPubkey = new PublicKey(process.env.TOKEN_MINT_ADDRESS);

    console.log('Disabling mint authority...');
    const tx = new Transaction().add(
      createSetAuthorityInstruction(
        mintPubkey,
        wallet.publicKey,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = wallet.publicKey;

    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [wallet],
      { commitment: 'finalized' }
    );

    console.log('Mint authority disabled successfully');
    console.log('Transaction signature:', signature);
    return signature;
  } catch (error) {
    console.error('Failed to disable mint authority:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  disableMintAuthority()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { disableMintAuthority }; 