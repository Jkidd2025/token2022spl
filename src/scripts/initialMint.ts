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
  getAccount,
  getMint,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { createRevokeAuthoritiesInstruction } from '../utils/instructions';

dotenv.config();

interface InitialMintResult {
  mintAddress: string;
  tokenAccount: string;
  mintSignature: string;
  revokeSignature: string;
  initialSupply: string;
  actualSupply: string;
}

async function validateMintAccount(
  connection: Connection,
  mintAddress: string,
  wallet: Keypair
): Promise<PublicKey> {
  try {
    const mint = new PublicKey(mintAddress);
    const mintInfo = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);

    // Verify mint authority
    if (!mintInfo.mintAuthority?.equals(wallet.publicKey)) {
      throw new Error('Wallet is not the mint authority');
    }

    // Verify freeze authority
    if (!mintInfo.freezeAuthority?.equals(wallet.publicKey)) {
      throw new Error('Wallet is not the freeze authority');
    }

    return mint;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid mint account: ${error.message}`);
    }
    throw error;
  }
}

async function performInitialMintAndRevoke(
  mintAddress: string,
  options?: {
    initialSupply?: string;
    decimals?: number;
  }
): Promise<InitialMintResult> {
  const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');

  const wallet = Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!)));

  // Validate mint account
  const mint = await validateMintAccount(connection, mintAddress, wallet);

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

    // Check if token account already has a balance
    const tokenAccountInfo = await getAccount(
      connection,
      tokenAccount.address,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    if (tokenAccountInfo.amount > BigInt(0)) {
      throw new Error(
        'Token account already has a balance. Initial mint can only be performed once.'
      );
    }

    // Prepare initial mint transaction
    const initialSupply = BigInt(
      options?.initialSupply ?? process.env.INITIAL_SUPPLY ?? '1000000000'
    );
    const decimals =
      options?.decimals || process.env.TOKEN_DECIMALS ? parseInt(process.env.TOKEN_DECIMALS!) : 9;
    const actualSupply = initialSupply * BigInt(10 ** decimals);

    console.log(
      `Preparing to mint ${initialSupply.toString()} tokens (${actualSupply.toString()} with decimals)`
    );

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

    const mintSignature = await sendAndConfirmTransaction(connection, mintTx, [wallet], {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });

    console.log('Initial supply minted. Transaction:', mintSignature);

    // Verify the mint was successful
    const updatedTokenAccount = await getAccount(
      connection,
      tokenAccount.address,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    if (updatedTokenAccount.amount !== actualSupply) {
      throw new Error('Mint verification failed. Token balance does not match expected supply.');
    }

    // Revoke authorities
    const revokeTx = new Transaction()
      .add(
        // Revoke mint authority
        createRevokeInstruction(mint, wallet.publicKey, [], TOKEN_2022_PROGRAM_ID)
      )
      .add(
        // Revoke freeze authority and other authorities
        createRevokeAuthoritiesInstruction(mint, wallet.publicKey)
      );

    const revokeSignature = await sendAndConfirmTransaction(connection, revokeTx, [wallet], {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });

    console.log('Authorities revoked. Transaction:', revokeSignature);

    // Verify authorities were revoked
    const finalMintInfo = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);

    if (finalMintInfo.mintAuthority || finalMintInfo.freezeAuthority) {
      throw new Error('Authority revocation verification failed. Some authorities still remain.');
    }

    return {
      mintAddress: mint.toBase58(),
      tokenAccount: tokenAccount.address.toBase58(),
      mintSignature,
      revokeSignature,
      initialSupply: initialSupply.toString(),
      actualSupply: actualSupply.toString(),
    };
  } catch (error) {
    console.error('Error in initial mint and revoke:', error);
    throw error;
  }
}

// If running directly
if (require.main === module) {
  if (!process.argv[2]) {
    console.error('Usage: ts-node initialMint.ts <mint-address> [initial-supply] [decimals]');
    process.exit(1);
  }

  const options = {
    initialSupply: process.argv[3],
    decimals: process.argv[4] ? parseInt(process.argv[4]) : undefined,
  };

  performInitialMintAndRevoke(process.argv[2], options)
    .then((result) => {
      console.log('Initial mint and authority revocation completed');
      console.log('Results:');
      console.table({
        'Mint Address': result.mintAddress,
        'Token Account': result.tokenAccount,
        'Initial Supply': result.initialSupply,
        'Actual Supply (with decimals)': result.actualSupply,
        'Mint Transaction': result.mintSignature,
        'Revoke Transaction': result.revokeSignature,
      });
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
}
