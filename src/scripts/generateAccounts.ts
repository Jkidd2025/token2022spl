import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getConnection } from '../utils/rpcConnection';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function generateAccounts(): Promise<void> {
  try {
    console.log('Generating new accounts...\n');

    // Generate Fee Collector Keypair
    const feeCollector = Keypair.generate();
    console.log('Fee Collector Account Generated:');
    console.log('Address:', feeCollector.publicKey.toString());
    console.log('Private Key:', JSON.stringify(Array.from(feeCollector.secretKey)));

    // Update .env file
    const envPath = '.env';
    let envContent = fs.readFileSync(envPath, 'utf-8');

    // Update FEE_COLLECTOR_PRIVATE_KEY
    envContent = envContent.replace(
      /FEE_COLLECTOR_PRIVATE_KEY=".*"/,
      `FEE_COLLECTOR_PRIVATE_KEY="${JSON.stringify(Array.from(feeCollector.secretKey))}"`
    );

    fs.writeFileSync(envPath, envContent);
    console.log('\nEnvironment file updated successfully!');

    // Initialize accounts
    console.log('\nInitializing accounts...');
    const connection = getConnection();

    // Create Associated Token Account for fee collector
    const tokenMint = process.env.TOKEN_MINT;
    if (tokenMint) {
      console.log('\nToken Mint:', tokenMint);
      console.log('Fee Collector Address:', feeCollector.publicKey.toString());
    }

    console.log('\nSetup Complete! Please save these keys securely.');
    console.log('\nIMPORTANT: Fund the fee collector account with SOL before using in production!');
  } catch (error) {
    console.error('Error generating accounts:', error);
    throw error;
  }
}

// Run if this script is executed directly
if (require.main === module) {
  generateAccounts()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed to generate accounts:', error);
      process.exit(1);
    });
}

export { generateAccounts };
