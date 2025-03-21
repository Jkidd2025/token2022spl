import { Keypair } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as fs from 'fs';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function createTestWallet() {
  try {
    // Generate a new keypair
    const testWallet = Keypair.generate();
    
    console.log('Test wallet created successfully!');
    console.log('Public Key:', testWallet.publicKey.toString());
    console.log('Private Key:', JSON.stringify(Array.from(testWallet.secretKey)));
    
    // Read the current .env file
    const envPath = resolve(__dirname, '../../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Check if TEST_WALLET keys already exist
    if (envContent.includes('TEST_WALLET_PRIVATE_KEY=')) {
      // Update existing keys
      envContent = envContent.replace(
        /TEST_WALLET_PRIVATE_KEY=.*/,
        `TEST_WALLET_PRIVATE_KEY=${JSON.stringify(Array.from(testWallet.secretKey))}`
      );
      envContent = envContent.replace(
        /TEST_WALLET_ADDRESS=.*/,
        `TEST_WALLET_ADDRESS=${testWallet.publicKey.toString()}`
      );
    } else {
      // Add new keys
      envContent += `\n\n# Test Wallet for Protocol Fee Testing\n`;
      envContent += `TEST_WALLET_PRIVATE_KEY=${JSON.stringify(Array.from(testWallet.secretKey))}\n`;
      envContent += `TEST_WALLET_ADDRESS=${testWallet.publicKey.toString()}\n`;
      envContent += `TEST_WALLET_AMOUNT=10000000  # 1% of total supply for testing\n`;
    }
    
    // Write back to .env file
    fs.writeFileSync(envPath, envContent);
    console.log('Test wallet details have been saved to .env file');
    
    return {
      publicKey: testWallet.publicKey.toString(),
      privateKey: Array.from(testWallet.secretKey)
    };
  } catch (error) {
    console.error('Error creating test wallet:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createTestWallet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createTestWallet }; 