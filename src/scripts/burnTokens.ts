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
  getAccount,
  getMint,
  burn,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';

dotenv.config();

interface BurnResult {
  burnAmount: string;
  actualBurnAmount: string;
  signature: string;
  tokenAccount: string;
  remainingBalance: string;
}

async function validateBurnParameters(
  connection: Connection,
  mint: PublicKey,
  burnFromAddress: PublicKey,
  amount: bigint
): Promise<void> {
  try {
    // Get token account info
    const tokenAccount = await getAccount(
      connection,
      burnFromAddress,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    // Verify sufficient balance
    if (tokenAccount.amount < amount) {
      throw new Error(
        `Insufficient balance for burn. Required: ${amount}, Available: ${tokenAccount.amount}`
      );
    }

    // Get mint info to verify decimals
    const mintInfo = await getMint(
      connection,
      mint,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    // Verify mint is not frozen
    if (mintInfo.isInitialized && mintInfo.freezeAuthority) {
      throw new Error('Token mint has freeze authority. Cannot burn tokens.');
    }

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Burn validation failed: ${error.message}`);
    }
    throw error;
  }
}

async function burnTokens(
  mintAddress: string,
  amount: string,
  burnFromAddress?: string,
  options?: {
    decimals?: number;
  }
): Promise<BurnResult> {
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

    const decimals = options?.decimals || process.env.TOKEN_DECIMALS 
      ? parseInt(process.env.TOKEN_DECIMALS!)
      : 6;

    const burnAmount = BigInt(amount);
    const actualBurnAmount = burnAmount * BigInt(10 ** decimals);

    // Validate burn parameters
    await validateBurnParameters(
      connection,
      mint,
      burnFrom,
      actualBurnAmount
    );

    console.log(`Preparing to burn ${amount} tokens (${actualBurnAmount.toString()} with decimals)`);

    // Create and send burn transaction
    const transaction = new Transaction().add(
      createBurnInstruction(
        burnFrom,
        mint,
        wallet.publicKey,
        actualBurnAmount,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    // Verify the burn was successful
    const updatedTokenAccount = await getAccount(
      connection,
      burnFrom,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    console.log(`Tokens burned successfully. Transaction: ${signature}`);
    console.log(`Remaining balance: ${updatedTokenAccount.amount.toString()}`);

    return {
      burnAmount: burnAmount.toString(),
      actualBurnAmount: actualBurnAmount.toString(),
      signature,
      tokenAccount: burnFrom.toBase58(),
      remainingBalance: updatedTokenAccount.amount.toString(),
    };

  } catch (error) {
    console.error('Error burning tokens:', error);
    throw error;
  }
}

// If running directly
if (require.main === module) {
  if (!process.argv[2] || !process.argv[3]) {
    console.error('Usage: ts-node burnTokens.ts <mint-address> <amount> [burn-from-address] [decimals]');
    process.exit(1);
  }

  const options = {
    decimals: process.argv[5] ? parseInt(process.argv[5]) : undefined,
  };

  burnTokens(process.argv[2], process.argv[3], process.argv[4], options)
    .then((result) => {
      console.log('Token burn completed');
      console.log('Results:');
      console.table({
        'Burn Amount': result.burnAmount,
        'Actual Burn Amount (with decimals)': result.actualBurnAmount,
        'Token Account': result.tokenAccount,
        'Remaining Balance': result.remainingBalance,
        'Transaction': result.signature,
      });
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
} 