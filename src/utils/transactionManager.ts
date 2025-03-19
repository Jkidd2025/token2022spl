import {
  Connection,
  Transaction,
  TransactionSignature,
  SendTransactionError,
  SimulatedTransactionResponse,
} from '@solana/web3.js';
import { getConfirmationStrategy } from './transactionConfirmation';

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
  simulation: SimulatedTransactionResponse;
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
  private async simulateTransaction(transaction: Transaction): Promise<SimulatedTransactionResponse> {
    console.log('Simulating transaction...');
    const simulation = await this.connection.simulateTransaction(transaction);

    if (simulation.value.err) {
      throw new Error(`Transaction simulation failed: ${simulation.value.err}`);
    }

    console.log('Transaction simulation successful');
    return simulation;
  }

  /**
   * Sends a transaction with retry logic
   */
  private async sendWithRetry(
    transaction: Transaction,
    signers: any[],
    confirmationStrategy: any
  ): Promise<TransactionSignature> {
    let lastError: Error | null = null;
    let retryCount = 0;
    let delay = this.retryConfig.retryDelay;

    while (retryCount < this.retryConfig.maxRetries) {
      try {
        console.log(`Attempting to send transaction (attempt ${retryCount + 1}/${this.retryConfig.maxRetries})...`);

        const signature = await this.connection.sendTransaction(transaction, signers);

        await this.connection.confirmTransaction(
          {
            signature,
            ...(await this.connection.getLatestBlockhash(confirmationStrategy)),
          },
          confirmationStrategy.commitment
        );

        console.log(`Transaction sent successfully with ${confirmationStrategy.commitment} commitment`);
        return signature;
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        if (retryCount < this.retryConfig.maxRetries) {
          console.log(`Transaction failed, retrying in ${delay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= this.retryConfig.backoffFactor;
        }
      }
    }

    throw new Error(`Transaction failed after ${retryCount} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Executes a transaction with simulation and retry logic
   */
  public async executeTransaction(
    transaction: Transaction,
    signers: any[],
    transactionType: keyof typeof TRANSACTION_TYPES
  ): Promise<TransactionResult> {
    try {
      // 1. Simulate transaction
      const simulation = await this.simulateTransaction(transaction);

      // 2. Get confirmation strategy based on transaction type
      const confirmationStrategy = getConfirmationStrategy(transactionType);

      // 3. Send transaction with retry logic
      const signature = await this.sendWithRetry(transaction, signers, confirmationStrategy);

      return {
        signature,
        simulation,
        retries: 0, // Will be updated if retries occurred
      };
    } catch (error) {
      console.error('Transaction execution failed:', error);
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
      if (size > 1232) { // Solana transaction size limit
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