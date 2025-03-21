import { Keypair } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as fs from 'fs';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function createBurnWallet() {
  try {
    // Generate new keypair
    const burnWallet = Keypair.generate();
    
    // Get private key as array
    const privateKeyArray = Array.from(burnWallet.secretKey);
    
    // Update .env file
    const envPath = resolve(__dirname, '../../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Add or update BURN_WALLET_PRIVATE_KEY
    if (envContent.includes('BURN_WALLET_PRIVATE_KEY=')) {
      envContent = envContent.replace(
        /BURN_WALLET_PRIVATE_KEY=.*/,
        `BURN_WALLET_PRIVATE_KEY=[${privateKeyArray.join(',')}]`
      );
    } else {
      envContent += `\nBURN_WALLET_PRIVATE_KEY=[${privateKeyArray.join(',')}]`;
    }
    
    // Add or update BURN_WALLET_ADDRESS
    if (envContent.includes('BURN_WALLET_ADDRESS=')) {
      envContent = envContent.replace(
        /BURN_WALLET_ADDRESS=.*/,
        `BURN_WALLET_ADDRESS=${burnWallet.publicKey.toString()}`
      );
    } else {
      envContent += `\nBURN_WALLET_ADDRESS=${burnWallet.publicKey.toString()}`;
    }
    
    // Add or update BURN_WALLET_AMOUNT
    if (envContent.includes('BURN_WALLET_AMOUNT=')) {
      envContent = envContent.replace(
        /BURN_WALLET_AMOUNT=.*/,
        'BURN_WALLET_AMOUNT=100000000  # 10% of total supply for burn wallet'
      );
    } else {
      envContent += '\nBURN_WALLET_AMOUNT=100000000  # 10% of total supply for burn wallet';
    }
    
    // Write back to .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('Burn Wallet created successfully!');
    console.log('Public Key:', burnWallet.publicKey.toString());
    console.log('Private Key has been saved to .env file');
    
    return {
      publicKey: burnWallet.publicKey.toString(),
      privateKey: privateKeyArray
    };
  } catch (error) {
    console.error('Error creating burn wallet:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createBurnWallet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createBurnWallet }; 