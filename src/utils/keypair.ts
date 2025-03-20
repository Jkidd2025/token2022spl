import { Keypair } from '@solana/web3.js';

export function loadKeypairFromEnv(envKey: string): Keypair {
  const privateKeyString = process.env[envKey];
  if (!privateKeyString) {
    throw new Error(`${envKey} environment variable is not set`);
  }

  try {
    const privateKeyArray = JSON.parse(privateKeyString);
    return Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Invalid ${envKey} environment variable: ${errorMessage}`);
  }
}
