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
    const mint = await createMint(
      connection,
      wallet,
      wallet.publicKey,
      wallet.publicKey,
      process.env.TOKEN_DECIMALS ? parseInt(process.env.TOKEN_DECIMALS) : 9,
      mintKeypair,
      {
        extensionTypes: extensions,
      },
      TOKEN_2022_PROGRAM_ID
    );

    console.log('Token mint created:', mint.toBase58());

    // Initialize transfer fee config
    const feeBasisPoints = process.env.TRANSFER_FEE_BASIS_POINTS 
      ? parseInt(process.env.TRANSFER_FEE_BASIS_POINTS)
      : 500; // 5%
    
    const transaction = new Transaction().add(
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
    transaction.add(
      createInitializePermanentDelegateInstruction(
        mint,
        wallet.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );

    // Add metadata pointer
    transaction.add(
      createInitializeMetadataPointerInstruction(
        mint,
        wallet.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet]
    );

    console.log('Token initialized with extensions. Transaction:', signature);
    
    // After initial mint, we'll revoke authorities
    // This will be handled in a separate function to ensure the initial mint is successful
    
    return {
      mint: mint.toBase58(),
      signature,
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