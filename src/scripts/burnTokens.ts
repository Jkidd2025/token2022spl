import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  createBurnInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';

dotenv.config();

async function burnTokens(
  mintAddress: string,
  amount: string,
  burnFromAddress?: string
) {
  const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  
  const wallet = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
  );

  const mint = new PublicKey(mintAddress);
  
  try {
    // If no burn address specified, use the wallet's token account
    const burnFrom = burnFromAddress 
      ? new PublicKey(burnFromAddress)
      : await getAssociatedTokenAddress(
          mint,
          wallet.publicKey,
          false,
          TOKEN_2022_PROGRAM_ID
        );

    const decimals = process.env.TOKEN_DECIMALS ? parseInt(process.env.TOKEN_DECIMALS) : 9;
    const burnAmount = BigInt(amount) * BigInt(10 ** decimals);

    const transaction = new Transaction().add(
      createBurnInstruction(
        burnFrom,
        mint,
        wallet.publicKey,
        burnAmount,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet]
    );

    console.log('Tokens burned successfully. Transaction:', signature);
    return signature;

  } catch (error) {
    console.error('Error burning tokens:', error);
    throw error;
  }
}

// If running directly
if (require.main === module) {
  if (!process.argv[2] || !process.argv[3]) {
    console.error('Please provide the mint address and amount to burn as arguments');
    process.exit(1);
  }

  burnTokens(process.argv[2], process.argv[3], process.argv[4])
    .then(() => {
      console.log('Token burn completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
} 