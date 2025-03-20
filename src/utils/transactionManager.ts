/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Connection,
  Transaction,
  TransactionSignature,
  SimulatedTransactionResponse,
  RpcResponseAndContext,
  Keypair,
} from '@solana/web3.js';
import { getConfirmationStrategy } from './transactionConfirmation';

export const TRANSACTION_TYPES = {
  TOKEN_CREATION: 'TOKEN_CREATION',
  INITIAL_MINT: 'INITIAL_MINT',
  LARGE_TRANSFER: 'LARGE_TRANSFER',
  AUTHORITY_CHANGE: 'AUTHORITY_CHANGE',
  DISTRIBUTION: 'DISTRIBUTION',
  FEE_COLLECTION: 'FEE_COLLECTION',
  REGULAR_TRANSFER: 'REGULAR_TRANSFER',
  BALANCE_CHECK: 'BALANCE_CHECK',
  SMALL_TRANSFER: 'SMALL_TRANSFER',
  METADATA_UPDATE: 'METADATA_UPDATE',
} as const;

export type TransactionType = keyof typeof TRANSACTION_TYPES;

interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  backoffFactor: 2,
};

interface TransactionResult {
  signature: TransactionSignature;
  simulation: RpcResponseAndContext<SimulatedTransactionResponse>;
  retries: number;
}

export class TransactionManager {
  private connection: Connection;
  private retryConfig: RetryConfig;

  constructor(connection: Connection, config: Partial<RetryConfig> = {}) {
    this.connection = connection;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Simulates a transaction before sending
   */
  private async simulateTransaction(
    transaction: Transaction
  ): Promise<RpcResponseAndContext<SimulatedTransactionResponse>> {
    console.log('Simulating transaction...');
    const simulation = await this.connection.simulateTransaction(transaction);

    if (simulation.value.err) {
      console.error(
        'Transaction simulation failed:',
        JSON.stringify(simulation.value.err, null, 2)
      );
      throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    console.log('Transaction simulation successful');
    return simulation;
  }

  /**
   * Sends a transaction with retry logic
   */
  private async sendWithRetry(
    transaction: Transaction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signers: any[],
    confirmationStrategy: any
  ): Promise<TransactionSignature> {
    let lastError: Error | null = null;
    let retryCount = 0;
    let delay = this.retryConfig.retryDelay;

    while (retryCount < this.retryConfig.maxRetries) {
      try {
        console.log(
          `Attempting to send transaction (attempt ${retryCount + 1}/${this.retryConfig.maxRetries})...`
        );

        const signature = await this.connection.sendTransaction(transaction, signers);

        await this.connection.confirmTransaction(
          {
            signature,
            ...(await this.connection.getLatestBlockhash(confirmationStrategy)),
          },
          confirmationStrategy.commitment
        );

        console.log(
          `Transaction sent successfully with ${confirmationStrategy.commitment} commitment`
        );
        return signature;
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        if (retryCount < this.retryConfig.maxRetries) {
          console.log(`Transaction failed, retrying in ${delay / 1000} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= this.retryConfig.backoffFactor;
        }
      }
    }

    throw new Error(
      `Transaction failed after ${retryCount} attempts. Last error: ${lastError?.message}`
    );
  }

  /**
   * Executes a transaction with proper signing and sending logic
   */
  public async executeTransaction(
    tx: Transaction,
    signers: Keypair[],
    label: string
  ): Promise<{ signature: TransactionSignature }> {
    try {
      const signature = await this.connection.sendTransaction(tx, signers, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      return { signature };
    } catch (error) {
      console.error(`Error executing ${label} transaction:`, error);
      throw error;
    }
  }

  /**
   * Validates a transaction before execution
   */
  public async validateTransaction(transaction: Transaction): Promise<boolean> {
    try {
      // Check if transaction is empty
      if (!transaction.instructions.length) {
        throw new Error('Transaction has no instructions');
      }

      // Check if transaction is too large
      const size = transaction.serialize().length;
      if (size > 1232) {
        // Solana transaction size limit
        throw new Error(`Transaction too large: ${size} bytes`);
      }

      // Simulate transaction
      await this.simulateTransaction(transaction);

      return true;
    } catch (error) {
      console.error('Transaction validation failed:', error);
      return false;
    }
  }
}
