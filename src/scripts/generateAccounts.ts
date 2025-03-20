import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { Keypair } from '@solana/web3.js';
import { getConnection } from '../utils/rpcConnection';

dotenv.config();

async function generateAccounts(): Promise<void> {
  try {
    // Initialize connection and check network
    const connection = await getConnection();
    const version = await connection.getVersion();
    console.log('Connected to Solana network:', process.env.SOLANA_NETWORK);
    console.log('Node version:', version['solana-core']);
    console.log('\nGenerating new accounts...\n');

    // Generate Main Wallet Keypair
    const mainWallet = Keypair.generate();
    console.log('Main Wallet Generated:');
    console.log('Address:', mainWallet.publicKey.toString());
    console.log('Private Key:', JSON.stringify(Array.from(mainWallet.secretKey)));

    // Generate Fee Collector Keypair
    const feeCollector = Keypair.generate();
    console.log('\nFee Collector Account Generated:');
    console.log('Address:', feeCollector.publicKey.toString());
    console.log('Private Key:', JSON.stringify(Array.from(feeCollector.secretKey)));

    // Update .env file
    const envPath = '.env';
    let envContent = fs.readFileSync(envPath, 'utf-8');

    // Update WALLET_PRIVATE_KEY
    envContent = envContent.replace(
      /WALLET_PRIVATE_KEY=".*"/,
      `WALLET_PRIVATE_KEY="${JSON.stringify(Array.from(mainWallet.secretKey))}"  # Main wallet private key`
    );

    // Update FEE_COLLECTOR_PRIVATE_KEY
    envContent = envContent.replace(
      /FEE_COLLECTOR_PRIVATE_KEY=".*"/,
      `FEE_COLLECTOR_PRIVATE_KEY="${JSON.stringify(Array.from(feeCollector.secretKey))}"  # Fee collector private key`
    );

    // Update FEE_COLLECTOR_ADDRESS
    envContent = envContent.replace(
      /FEE_COLLECTOR_ADDRESS=".*"/,
      `FEE_COLLECTOR_ADDRESS="${feeCollector.publicKey.toString()}"  # Your fee collector address after deployment`
    );

    fs.writeFileSync(envPath, envContent);
    console.log('\nEnvironment file updated successfully!');

    // Create Associated Token Account for fee collector
    const tokenMint = process.env.TOKEN_MINT;
    if (tokenMint) {
      console.log('\nToken Mint:', tokenMint);
      console.log('Fee Collector Address:', feeCollector.publicKey.toString());
    }

    console.log('\nSetup Complete! Please save these keys securely.');
    console.log('\nIMPORTANT:');
    console.log('1. Fund the main wallet with at least 0.1 SOL before creating the token');
    console.log('2. Fund the fee collector account with SOL before using in production!');
    console.log('\nMain Wallet Address:', mainWallet.publicKey.toString());
    console.log('Fee Collector Address:', feeCollector.publicKey.toString());
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error generating accounts:', error.message);
      console.error('Stack trace:', error.stack);
    } else {
      console.error('Error generating accounts:', error);
    }
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
