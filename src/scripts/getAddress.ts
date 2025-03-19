import { Keypair } from '@solana/web3.js';

function getAddress(privateKeyArray: number[]): string {
  try {
    const keypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
    return keypair.publicKey.toString();
  } catch (error) {
    console.error('Error deriving address:', error);
    throw error;
  }
}

// Main wallet private key from .env
const mainWalletPrivateKey = [48,22,113,62,241,55,96,181,111,192,34,202,2,15,33,197,60,116,145,206,91,76,54,218,53,146,150,99,199,69,198,148,197,126,137,11,15,65,106,239,174,23,12,136,145,52,236,26,220,214,147,162,250,90,45,57,243,138,203,89,245,251,67,71];

console.log('Main Wallet Public Key:', getAddress(mainWalletPrivateKey)); 