import { Keypair } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as fs from 'fs';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function createPublicSaleWallet() {
  try {
    // Generate new keypair
    const publicSaleWallet = Keypair.generate();
    
    // Get private key as array
    const privateKeyArray = Array.from(publicSaleWallet.secretKey);
    
    // Update .env file
    const envPath = resolve(__dirname, '../../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Add or update PUBLIC_SALE_WALLET_PRIVATE_KEY
    if (envContent.includes('PUBLIC_SALE_WALLET_PRIVATE_KEY=')) {
      envContent = envContent.replace(
        /PUBLIC_SALE_WALLET_PRIVATE_KEY=.*/,
        `PUBLIC_SALE_WALLET_PRIVATE_KEY=[${privateKeyArray.join(',')}]`
      );
    } else {
      envContent += `\nPUBLIC_SALE_WALLET_PRIVATE_KEY=[${privateKeyArray.join(',')}]`;
    }
    
    // Add or update PUBLIC_SALE_WALLET_ADDRESS
    if (envContent.includes('PUBLIC_SALE_WALLET_ADDRESS=')) {
      envContent = envContent.replace(
        /PUBLIC_SALE_WALLET_ADDRESS=.*/,
        `PUBLIC_SALE_WALLET_ADDRESS=${publicSaleWallet.publicKey.toString()}`
      );
    } else {
      envContent += `\nPUBLIC_SALE_WALLET_ADDRESS=${publicSaleWallet.publicKey.toString()}`;
    }
    
    // Add or update PUBLIC_SALE_WALLET_AMOUNT
    if (envContent.includes('PUBLIC_SALE_WALLET_AMOUNT=')) {
      envContent = envContent.replace(
        /PUBLIC_SALE_WALLET_AMOUNT=.*/,
        'PUBLIC_SALE_WALLET_AMOUNT=100000000  # 10% of total supply for public sale and community distribution'
      );
    } else {
      envContent += '\nPUBLIC_SALE_WALLET_AMOUNT=100000000  # 10% of total supply for public sale and community distribution';
    }
    
    // Write back to .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('Public Sale & Community Distribution Wallet created successfully!');
    console.log('Public Key:', publicSaleWallet.publicKey.toString());
    console.log('Private Key has been saved to .env file');
    
    return {
      publicKey: publicSaleWallet.publicKey.toString(),
      privateKey: privateKeyArray
    };
  } catch (error) {
    console.error('Error creating public sale wallet:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createPublicSaleWallet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createPublicSaleWallet }; 