import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function createTempKeypair() {
  try {
    // Get the public sale wallet private key
    const privateKey = new Uint8Array(JSON.parse(process.env.PUBLIC_SALE_WALLET_PRIVATE_KEY!));
    
    // Create a keypair from the private key
    const keypair = Keypair.fromSecretKey(privateKey);
    
    // Write the keypair to a temporary file
    fs.writeFileSync('temp.json', JSON.stringify(Array.from(keypair.secretKey)));
    
    console.log('Temporary keypair file created successfully!');
    console.log('Public key:', keypair.publicKey.toString());
    
    return keypair;
  } catch (error) {
    console.error('Error creating temporary keypair:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createTempKeypair()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createTempKeypair }; 