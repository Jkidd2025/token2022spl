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
const mainWalletPrivateKey = [
  48, 22, 113, 62, 241, 55, 96, 181, 111, 192, 34, 202, 2, 15, 33, 197, 60, 116, 145, 206, 91, 76,
  54, 218, 53, 146, 150, 99, 199, 69, 198, 148, 197, 126, 137, 11, 15, 65, 106, 239, 174, 23, 12,
  136, 145, 52, 236, 26, 220, 214, 147, 162, 250, 90, 45, 57, 243, 138, 203, 89, 245, 251, 67, 71,
];

// Backup wallet private key from .env
const backupWalletPrivateKey = [
  36, 171, 92, 26, 80, 17, 223, 21, 246, 136, 238, 18, 239, 172, 6, 75, 206, 117, 116, 222, 230,
  152, 132, 75, 236, 17, 134, 41, 226, 248, 102, 238, 86, 85, 102, 122, 196, 101, 58, 181, 53, 141,
  100, 93, 8, 188, 151, 94, 17, 193, 20, 43, 131, 162, 13, 166, 118, 75, 80, 52, 84, 0,
];

console.log('Main Wallet Public Key:', getAddress(mainWalletPrivateKey));
console.log('Backup Wallet Public Key:', getAddress(backupWalletPrivateKey));
