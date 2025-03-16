import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  createMint,
  createInitializeTransferFeeConfigInstruction,
  createInitializePermanentDelegateInstruction,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { createInitializeMetadataPointerInstruction } from '../utils/instructions';
import { createTokenMetadata, DEFAULT_TOKEN_METADATA } from '../utils/metadata';
import * as tokenMetadataConfig from '../config/metadata.json';

dotenv.config();

async function createToken() {
  // Initialize connection to Solana network
  const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  
  // Create wallet from private key
  const wallet = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
  );

  // Define token extensions
  const extensions = [
    ExtensionType.TransferFeeConfig,
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
  ];

  try {
    // Calculate space for the mint
    const mintLen = getMintLen(extensions);
    
    // Create mint account
    const mintKeypair = Keypair.generate();
    const decimals = process.env.TOKEN_DECIMALS ? parseInt(process.env.TOKEN_DECIMALS) : 6;

    // Create the mint with extensions
    const mint = await createMint(
      connection,
      wallet,
      wallet.publicKey,
      wallet.publicKey,
      decimals,
      mintKeypair,
      {
        commitment: 'confirmed',
      },
      TOKEN_2022_PROGRAM_ID
    );

    console.log('Token mint created:', mint.toBase58());

    // Initialize transfer fee config
    const feeBasisPoints = process.env.TRANSFER_FEE_BASIS_POINTS 
      ? parseInt(process.env.TRANSFER_FEE_BASIS_POINTS)
      : 500; // 5%
    
    // Create a transaction for initializing extensions
    const initExtensionsTransaction = new Transaction();

    // Add transfer fee extension
    initExtensionsTransaction.add(
      createInitializeTransferFeeConfigInstruction(
        mint,
        wallet.publicKey,
        wallet.publicKey,
        feeBasisPoints,
        BigInt(0), // Maximum fee
        TOKEN_2022_PROGRAM_ID
      )
    );

    // Add permanent delegate for burn mechanism
    initExtensionsTransaction.add(
      createInitializePermanentDelegateInstruction(
        mint,
        wallet.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );

    // Add metadata pointer
    initExtensionsTransaction.add(
      createInitializeMetadataPointerInstruction(
        mint,
        wallet.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );

    const extensionsSignature = await sendAndConfirmTransaction(
      connection,
      initExtensionsTransaction,
      [wallet]
    );

    console.log('Token extensions initialized. Transaction:', extensionsSignature);

    // Create token metadata
    const metadata = {
      ...DEFAULT_TOKEN_METADATA,
      ...tokenMetadataConfig,
      creators: [
        {
          address: wallet.publicKey.toString(),
          verified: true,
          share: 100,
        },
      ],
    };

    const metadataResult = await createTokenMetadata(
      connection,
      wallet,
      mint,
      metadata
    );

    console.log('Token metadata created:', metadataResult);
    
    // After initial mint, we'll revoke authorities
    // This will be handled in a separate function to ensure the initial mint is successful
    
    return {
      mint: mint.toBase58(),
      extensionsSignature,
      metadata: metadataResult,
    };

  } catch (error) {
    console.error('Error creating token:', error);
    throw error;
  }
}

createToken().then(() => {
  console.log('Token creation completed');
}).catch((error) => {
  console.error('Token creation failed:', error);
  process.exit(1);
}); 