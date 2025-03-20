import { Keypair } from '@solana/web3.js';
import * as bs58 from 'bs58';

export function getKeypairFromEnvironment(envKey: string): Keypair {
  const privateKey = process.env[envKey];
  if (!privateKey) {
    throw new Error(`Missing ${envKey} environment variable`);
  }
  
  try {
    const decodedKey = bs58.decode(privateKey);
    return Keypair.fromSecretKey(decodedKey);
  } catch (error) {
    throw new Error(`Invalid ${envKey} environment variable: ${error.message}`);
  }
} 