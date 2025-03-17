/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
// @ts-expect-error missing type definitions for node-cron
import * as cron from 'node-cron';
import * as dotenv from 'dotenv';
import { distributeWBTCToHolders } from './distributeWBTC';
import { checkAndTopUpSolBalance } from '../utils/solBalanceManager';

dotenv.config();

interface AutomationConfig {
  schedule: string; // Cron schedule expression
  minimumFeeAmount: bigint; // Minimum amount of fees to trigger distribution
  retryDelay: number; // Delay in minutes before retrying after failure
  maxRetries: number; // Maximum number of retries per attempt
}

const DEFAULT_CONFIG: AutomationConfig = {
  schedule: '*/30 * * * *', // Every 30 minutes
  minimumFeeAmount: BigInt(20000), // Minimum amount to trigger distribution
  retryDelay: 15, // 15 minutes
  maxRetries: 3, // 3 retries
};

class AutomatedDistributor {
  private connection: Connection;
  private wallet: Keypair;
  private baseTokenMint: PublicKey;
  private feeCollectorAddress: string;
  private config: AutomationConfig;
  private isProcessing: boolean = false;
  private lastRunTime?: Date;
  private runCount: number = 0;

  constructor(
    connection: Connection,
    wallet: Keypair,
    baseTokenMint: string,
    feeCollectorAddress: string,
    config: Partial<AutomationConfig> = {}
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.baseTokenMint = new PublicKey(baseTokenMint);
    this.feeCollectorAddress = feeCollectorAddress;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public start(): void {
    console.log('Starting automated WBTC distribution...');
    console.log('Schedule:', this.config.schedule);

    // Schedule SOL balance check every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      try {
        const feeCollector = new PublicKey(this.feeCollectorAddress);
        const topUpSignature = await checkAndTopUpSolBalance(
          this.connection,
          feeCollector,
          this.wallet
        );

        if (topUpSignature) {
          console.log('Topped up fee collector SOL balance. Transaction:', topUpSignature);
        }
      } catch (error) {
        console.error('Error checking SOL balance:', error);
      }
    });

    // Schedule the distribution task
    cron.schedule(this.config.schedule, async () => {
      if (this.isProcessing) {
        console.log('Previous distribution still in progress. Skipping...');
        return;
      }

      try {
        this.isProcessing = true;
        await this.executeDistribution();
      } catch (error) {
        console.error('Distribution failed:', error);
        await this.handleFailure();
      } finally {
        this.isProcessing = false;
      }
    });

    // Optional: Run immediately on start
    // this.executeDistribution().catch(console.error);
  }

  private async executeDistribution(): Promise<void> {
    console.log('Starting distribution cycle:', new Date().toISOString());
    try {
      const result = await distributeWBTCToHolders(
        this.connection,
        this.wallet,
        this.baseTokenMint,
        this.feeCollectorAddress
      );

      this.lastRunTime = new Date();
      this.runCount++;

      console.log('Distribution completed successfully:', {
        runCount: this.runCount,
        lastRun: this.lastRunTime,
        results: result,
      });
    } catch (error) {
      console.error('Error in distribution:', error);
      throw error;
    }
  }

  private async handleFailure(): Promise<void> {
    if (this.runCount < this.config.maxRetries) {
      console.log(`Scheduling retry in ${this.config.retryDelay} minutes...`);
      setTimeout(
        async () => {
          this.runCount++;
          try {
            await this.executeDistribution();
          } catch (error) {
            console.error(`Retry ${this.runCount} failed:`, error);
            await this.handleFailure();
          }
        },
        this.config.retryDelay * 60 * 1000
      );
    } else {
      console.error('Max retries reached. Manual intervention required.');
      // Here you could add notification logic (email, Discord, etc.)
    }
  }

  public getStatus(): unknown {
    return {
      isProcessing: this.isProcessing,
      lastRunTime: this.lastRunTime,
      runCount: this.runCount,
      schedule: this.config.schedule,
      config: this.config,
    };
  }
}

// If running directly
if (require.main === module) {
  if (!process.env.SOLANA_RPC_URL || !process.env.WALLET_PRIVATE_KEY) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  if (!process.argv[2] || !process.argv[3]) {
    console.error(
      'Usage: ts-node automatedDistribution.ts <base-token-mint> <fee-collector-address>'
    );
    process.exit(1);
  }

  const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  const wallet = Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!)));

  const [baseTokenMint, feeCollectorAddress] = process.argv.slice(2);

  // Optional: Custom configuration
  const config: Partial<AutomationConfig> = {
    schedule: process.env.DISTRIBUTION_SCHEDULE || '0 0 * * *', // Daily at midnight
    minimumFeeAmount: BigInt(process.env.MINIMUM_FEE_AMOUNT || '1000000'),
    retryDelay: parseInt(process.env.RETRY_DELAY || '15'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  };

  const distributor = new AutomatedDistributor(
    connection,
    wallet,
    baseTokenMint,
    feeCollectorAddress,
    config
  );

  distributor.start();

  // Keep the process running
  process.stdin.resume();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down automated distribution...');
    process.exit(0);
  });
}
