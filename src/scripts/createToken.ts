/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  Connection,
  Keypair,
  Transaction,
  SystemProgram,
  PublicKey,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  createInitializeTransferFeeConfigInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { TransactionManager } from '../utils/transactionManager';
import { createTokenMetadata, TokenMetadata } from '../utils/metadata';

dotenv.config();

interface TokenBackup {
  publicKey: string;
  secretKey: number[];
  label: string;
  timestamp: string;
}

interface TokenMintInfo {
  address: string;
  decimals: number;
  extensions: string[];
  feeCollector: string;
}

function validateEnvironment(): void {
  const requiredEnvVars = [
    'SOLANA_RPC_URL',
    'WALLET_PRIVATE_KEY',
    'TOKEN_DECIMALS',
    'TRANSFER_FEE_BASIS_POINTS',
    'FEE_COLLECTOR_PRIVATE_KEY',
  ];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}

function validateFeeConfig(feeBasisPoints: number): void {
  if (feeBasisPoints < 0 || feeBasisPoints > 10000) {
    throw new Error('Fee basis points must be between 0 and 10000');
  }
}

async function backupAccount(keypair: Keypair, label: string): Promise<TokenBackup> {
  const backup: TokenBackup = {
    publicKey: keypair.publicKey.toString(),
    secretKey: Array.from(keypair.secretKey),
    label,
    timestamp: new Date().toISOString(),
  };
  console.log(`Backup ${label} account information securely`);
  return backup;
}

async function createToken(): Promise<TokenMintInfo> {
  try {
    validateEnvironment();
    const connection = new Connection(process.env.SOLANA_RPC_URL!, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });

    const wallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
    );
    const feeCollectorKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.FEE_COLLECTOR_PRIVATE_KEY!))
    );
    const mint = Keypair.generate();
    const decimals = 9;
    const feeBasisPoints = parseInt(process.env.TRANSFER_FEE_BASIS_POINTS!, 10);
    validateFeeConfig(feeBasisPoints);
    const extensions = [ExtensionType.MetadataPointer, ExtensionType.TransferFeeConfig];
    const mintLen = getMintLen(extensions);
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

    console.log('Wallet:', wallet.publicKey.toBase58());
    console.log('Mint:', mint.publicKey.toBase58());
    console.log('Mint length with extensions:', mintLen);
    console.log('Decimals:', decimals);
    console.log('Balance:', (await connection.getBalance(wallet.publicKey)) / 1e9, 'SOL');

    if ((await connection.getBalance(wallet.publicKey)) < lamports + 0.02 * 1e9) {
      throw new Error('Insufficient funds');
    }

    const transactionManager = new TransactionManager(connection);
    const { blockhash: initialBlockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    // Step 1: Create token metadata
    const metadataPDA = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
    )[0];
    const metadata: TokenMetadata = {
      mint: mint.publicKey,
      name: 'BPay',
      symbol: 'BPAY',
      uri: 'https://raw.githubusercontent.com/Jkidd2025/token2022spl/main/src/config/metadata.json',
      additionalMetadata: [
        [
          'description',
          'The Next Generation WBTC Rewards on Solana - Token metadata is immutable after minting',
        ],
        [
          'image',
          'https://raw.githubusercontent.com/Jkidd2025/token2022spl/main/assets/token-logo.png',
        ],
        ['external_url', 'https://github.com/Jkidd2025/token2022spl'],
        ['sellerFeeBasisPoints', '500'],
      ],
    };
    console.log('Initializing token metadata...');
    const metadataSignature = await createTokenMetadata(
      connection,
      wallet,
      mint.publicKey,
      metadata
    );
    console.log('Token metadata initialized:', metadataSignature);

    // Step 2: Create and initialize mint with extensions in one transaction
    const tx1 = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports,
        space: mintLen,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferFeeConfigInstruction(
        mint.publicKey,
        wallet.publicKey,
        wallet.publicKey,
        feeBasisPoints,
        BigInt(1000) * BigInt(10 ** decimals), // Reasonable max fee
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMetadataPointerInstruction(
        mint.publicKey,
        wallet.publicKey,
        metadataPDA,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        wallet.publicKey,
        wallet.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    tx1.recentBlockhash = initialBlockhash;
    tx1.feePayer = wallet.publicKey;

    console.log('Simulating mint creation and initialization...');
    const sim1 = await connection.simulateTransaction(tx1, [wallet, mint]);
    if (sim1.value.err) {
      console.error('Simulation failed:', sim1.value.err);
      console.error('Simulation logs:', sim1.value.logs);
      throw new Error('Mint creation and initialization simulation failed');
    }
    console.log('Simulation succeeded:', sim1.value.logs);

    console.log('Creating and initializing mint...');
    const sig1 = await sendAndConfirmTransaction(connection, tx1, [wallet, mint], {
      commitment: 'confirmed',
    });
    console.log('Mint created and initialized:', sig1);

    // Check mint account state
    const mintAccount = await connection.getAccountInfo(mint.publicKey);
    if (!mintAccount) throw new Error('Mint account not found after initialization');
    console.log('Mint account state:', {
      owner: mintAccount.owner.toBase58(),
      lamports: mintAccount.lamports,
      dataLength: mintAccount.data.length,
    });

    // Transaction 2: Create fee collector ATA
    const feeCollectorAta = await getAssociatedTokenAddress(
      mint.publicKey,
      feeCollectorKeypair.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    const tx2 = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        feeCollectorAta,
        feeCollectorKeypair.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    tx2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx2.feePayer = wallet.publicKey;
    const sig2 = await transactionManager.executeTransaction(tx2, [wallet], 'CREATE_FEE_ATA');
    console.log('Fee collector ATA created:', sig2);

    // Transaction 3: Create wallet ATA
    const walletAta = await getAssociatedTokenAddress(
      mint.publicKey,
      wallet.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    const tx3 = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        walletAta,
        wallet.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    tx3.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx3.feePayer = wallet.publicKey;
    const sig3 = await transactionManager.executeTransaction(tx3, [wallet], 'CREATE_WALLET_ATA');
    console.log('Wallet ATA created:', sig3);

    // Transaction 4: Mint initial supply
    const initialSupply = BigInt(process.env.INITIAL_SUPPLY || '1000');
    const actualSupply = initialSupply * BigInt(10 ** decimals);
    console.log('Initial supply:', initialSupply.toString());
    console.log('Actual supply with decimals:', actualSupply.toString());
    const tx4 = new Transaction().add(
      createMintToInstruction(
        mint.publicKey,
        walletAta,
        wallet.publicKey,
        actualSupply,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );
    tx4.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx4.feePayer = wallet.publicKey;

    console.log('Simulating minting initial supply...');
    const sim4 = await connection.simulateTransaction(tx4, [wallet]);
    if (sim4.value.err) {
      console.error('Simulation failed:', sim4.value.err);
      console.error('Simulation logs:', sim4.value.logs);
      throw new Error('Mint initial supply simulation failed');
    }
    console.log('Simulation succeeded:', sim4.value.logs);

    console.log('Minting initial supply...');
    const sig4 = await transactionManager.executeTransaction(tx4, [wallet], 'MINT_INITIAL');
    console.log('Initial supply minted:', sig4);

    // Transaction 5: Revoke minting authority
    const tx5 = new Transaction().add(
      createSetAuthorityInstruction(
        mint.publicKey,
        wallet.publicKey,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );
    tx5.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx5.feePayer = wallet.publicKey;

    console.log('Simulating revoking minting authority...');
    const sim5 = await connection.simulateTransaction(tx5, [wallet]);
    if (sim5.value.err) {
      console.error('Simulation failed:', sim5.value.err);
      console.error('Simulation logs:', sim5.value.logs);
      throw new Error('Revoke minting authority simulation failed');
    }
    console.log('Simulation succeeded:', sim5.value.logs);

    console.log('Revoking minting authority...');
    const sig5 = await transactionManager.executeTransaction(tx5, [wallet], 'REVOKE_MINT');
    console.log('Minting authority revoked:', sig5);

    const mintInfo: TokenMintInfo = {
      address: mint.publicKey.toString(),
      decimals,
      extensions: extensions.map((ext) => ExtensionType[ext]),
      feeCollector: feeCollectorAta.toString(),
    };

    await backupAccount(mint, 'mint');
    await backupAccount(feeCollectorKeypair, 'fee_collector');
    process.env.TOKEN_MINT = mint.publicKey.toBase58();

    console.log('Token created successfully:', mintInfo);
    return mintInfo;
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
    throw error;
  }
}

if (require.main === module) {
  createToken()
    .then((result) => console.log('Success:', result))
    .catch((error) => console.error('Failed:', error));
}

export { createToken, TokenMintInfo, TokenBackup };
