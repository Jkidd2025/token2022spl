import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  createRevokeInstruction,
  getMint,
  createTransferInstruction,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { createRevokeAuthoritiesInstruction } from '../utils/instructions';

dotenv.config();

interface InitialMintResult {
  mintAddress: string;
  tokenAccount: string;
  rewardsPoolAccount: string;
  operationsWalletAccount: string;
  mintSignature: string;
  distributionSignature: string;
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
    const mintInfo = await getMint(connection, mint, 'confirmed', TOKEN_PROGRAM_ID);

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
  const rewardsPool = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.REWARDS_POOL_PRIVATE_KEY!))
  );
  const operationsWallet = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.OPERATIONS_WALLET_PRIVATE_KEY!))
  );

  // Validate mint account
  const mint = await validateMintAccount(connection, mintAddress, wallet);

  try {
    // Create token accounts
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      mint,
      wallet.publicKey,
      false,
      'confirmed',
      undefined,
      TOKEN_PROGRAM_ID
    );

    const rewardsPoolAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      mint,
      rewardsPool.publicKey,
      false,
      'confirmed',
      undefined,
      TOKEN_PROGRAM_ID
    );

    const operationsWalletAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      mint,
      operationsWallet.publicKey,
      false,
      'confirmed',
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Check if token account already has a balance
    const tokenAccountInfo = await getAccount(
      connection,
      tokenAccount.address,
      'confirmed',
      TOKEN_PROGRAM_ID
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
        TOKEN_PROGRAM_ID
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
      TOKEN_PROGRAM_ID
    );

    if (updatedTokenAccount.amount !== actualSupply) {
      throw new Error('Mint verification failed. Token balance does not match expected supply.');
    }

    // Distribute initial allocations to rewards pool and operations wallet
    const rewardsAmount = actualSupply / BigInt(20); // 5% to rewards pool
    const operationsAmount = actualSupply / BigInt(20); // 5% to operations wallet

    const distributionTx = new Transaction()
      .add(
        // Transfer to rewards pool
        createTransferInstruction(
          tokenAccount.address,
          rewardsPoolAccount.address,
          wallet.publicKey,
          rewardsAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      )
      .add(
        // Transfer to operations wallet
        createTransferInstruction(
          tokenAccount.address,
          operationsWalletAccount.address,
          wallet.publicKey,
          operationsAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

    const distributionSignature = await sendAndConfirmTransaction(
      connection,
      distributionTx,
      [wallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    console.log('Initial allocations distributed. Transaction:', distributionSignature);

    // Revoke authorities
    const revokeTx = new Transaction()
      .add(
        // Revoke mint authority
        createRevokeInstruction(mint, wallet.publicKey, [], TOKEN_PROGRAM_ID)
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
    const finalMintInfo = await getMint(connection, mint, 'confirmed', TOKEN_PROGRAM_ID);

    if (finalMintInfo.mintAuthority || finalMintInfo.freezeAuthority) {
      throw new Error('Authority revocation verification failed. Some authorities still remain.');
    }

    return {
      mintAddress: mint.toBase58(),
      tokenAccount: tokenAccount.address.toBase58(),
      rewardsPoolAccount: rewardsPoolAccount.address.toBase58(),
      operationsWalletAccount: operationsWalletAccount.address.toBase58(),
      mintSignature,
      distributionSignature,
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
        'Rewards Pool Account': result.rewardsPoolAccount,
        'Operations Wallet Account': result.operationsWalletAccount,
        'Initial Supply': result.initialSupply,
        'Actual Supply (with decimals)': result.actualSupply,
        'Mint Transaction': result.mintSignature,
        'Distribution Transaction': result.distributionSignature,
        'Revoke Transaction': result.revokeSignature,
      });
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
}

export { performInitialMintAndRevoke };
