import { Connection, Commitment, ConfirmOptions, TransactionSignature } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

export interface RPCConfig {
  endpoint: string;
  commitment: Commitment;
  confirmTransactionInitialTimeout?: number;
}

interface RPCEndpoint {
  url: string;
  name: string;
  priority: number;
}

interface ConfirmStrategy extends ConfirmOptions {
  timeout?: number;
}

interface TransactionResult {
  value: {
    err: unknown;
  };
}

// Default confirmation options for different security levels
export const CONFIRMATION_STRATEGY = {
  FAST: {
    commitment: 'processed' as Commitment,
    timeout: 30000, // 30 seconds
    preflightCommitment: 'processed' as Commitment,
  },
  STANDARD: {
    commitment: 'confirmed' as Commitment,
    timeout: 60000, // 60 seconds
    preflightCommitment: 'confirmed' as Commitment,
  },
  SECURE: {
    commitment: 'finalized' as Commitment,
    timeout: 90000, // 90 seconds
    preflightCommitment: 'finalized' as Commitment,
  },
};

const RPC_ENDPOINTS: RPCEndpoint[] = [
  {
    name: 'Helius',
    url: process.env.HELIUS_API_KEY
      ? `${process.env.HELIUS_RPC_URL}${process.env.HELIUS_API_KEY}`
      : '',
    priority: 1,
  },
  {
    name: 'GenesysGo',
    url: 'https://ssc-dao.genesysgo.net',
    priority: 2,
  },
  {
    name: 'Serum',
    url: 'https://solana-api.projectserum.com',
    priority: 3,
  },
  {
    name: 'Solana',
    url: 'https://api.mainnet-beta.solana.com',
    priority: 4,
  },
];

/**
 * Creates a connection with the specified endpoint and confirmation strategy
 * @param endpoint - RPC endpoint configuration
 * @param confirmStrategy - Confirmation strategy options
 * @returns Connection instance
 */
function createConnection(
  endpoint: RPCEndpoint,
  confirmStrategy: ConfirmStrategy = CONFIRMATION_STRATEGY.STANDARD
): Connection {
  return new Connection(endpoint.url, {
    commitment: confirmStrategy.commitment,
    confirmTransactionInitialTimeout: confirmStrategy.timeout,
  });
}

/**
 * Validates RPC connection health with specified commitment
 * @param connection - Connection to validate
 * @param commitment - Commitment level to validate against
 * @returns true if connection is healthy
 */
export async function validateConnection(
  connection: Connection,
  commitment: Commitment = 'confirmed'
): Promise<boolean> {
  try {
    const version = await connection.getVersion();
    const slot = await connection.getSlot({ commitment });
    const latestBlockhash = await connection.getLatestBlockhash({ commitment });

    return version !== null && slot > 0 && latestBlockhash.blockhash !== null;
  } catch (error) {
    console.error('RPC connection validation failed:', error);
    return false;
  }
}

/**
 * Wait for transaction confirmation with timeout
 * @param connection - Solana connection instance
 * @param signature - Transaction signature
 * @param confirmStrategy - Confirmation strategy options
 * @returns Confirmation status
 */
export async function confirmTransaction(
  connection: Connection,
  signature: TransactionSignature,
  confirmStrategy: ConfirmStrategy = CONFIRMATION_STRATEGY.STANDARD
): Promise<boolean> {
  try {
    const { commitment, timeout } = confirmStrategy;

    const startTime = Date.now();
    const result = await Promise.race([
      connection.confirmTransaction(
        { signature, ...(await connection.getLatestBlockhash({ commitment })) },
        commitment
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), timeout)
      ),
    ]);

    const duration = Date.now() - startTime;
    console.log(
      `Transaction ${signature} confirmed in ${duration}ms with ${commitment} commitment`
    );

    if (typeof result === 'object' && result !== null && 'value' in result) {
      const txResult = result as TransactionResult;
      return txResult.value.err === null;
    }
    return false;
  } catch (error) {
    console.error(`Transaction confirmation failed:`, error);
    return false;
  }
}

/**
 * Get RPC connection with fallback support
 * @param config - RPC configuration
 * @param confirmStrategy - Confirmation strategy options
 * @returns Connection instance
 */
export async function getConnection(
  config?: Partial<RPCConfig>,
  confirmStrategy: ConfirmOptions = CONFIRMATION_STRATEGY.STANDARD
): Promise<Connection> {
  const availableEndpoints = RPC_ENDPOINTS.filter((endpoint) => endpoint.url).sort(
    (a, b) => a.priority - b.priority
  );

  if (availableEndpoints.length === 0) {
    throw new Error('No RPC endpoints available');
  }

  // Try endpoints in order of priority
  for (const endpoint of availableEndpoints) {
    try {
      console.log(`Attempting to connect to ${endpoint.name} RPC...`);
      const connection = createConnection(endpoint, confirmStrategy);

      // Validate connection health with specified commitment
      const isHealthy = await validateConnection(connection, confirmStrategy.commitment);
      if (isHealthy) {
        console.log(
          `Successfully connected to ${endpoint.name} RPC with ${confirmStrategy.commitment} commitment`
        );
        return connection;
      }

      console.log(`${endpoint.name} RPC health check failed, trying next endpoint...`);
    } catch (error) {
      console.error(`Error connecting to ${endpoint.name} RPC:`, error);
      continue;
    }
  }

  throw new Error('All RPC endpoints failed');
}

/**
 * Get multiple RPC connections for redundancy
 * @param count - Number of connections to return (default: 2)
 * @param confirmStrategy - Confirmation strategy options
 * @returns Array of healthy Connection instances
 */
export async function getRedundantConnections(
  count: number = 2,
  confirmStrategy: ConfirmOptions = CONFIRMATION_STRATEGY.STANDARD
): Promise<Connection[]> {
  const availableEndpoints = RPC_ENDPOINTS.filter((endpoint) => endpoint.url).sort(
    (a, b) => a.priority - b.priority
  );

  if (availableEndpoints.length === 0) {
    throw new Error('No RPC endpoints available');
  }

  const connections: Connection[] = [];

  for (const endpoint of availableEndpoints) {
    if (connections.length >= count) break;

    try {
      const connection = createConnection(endpoint, confirmStrategy);
      const isHealthy = await validateConnection(connection, confirmStrategy.commitment);

      if (isHealthy) {
        connections.push(connection);
        console.log(
          `Added ${endpoint.name} RPC to redundant connections with ${confirmStrategy.commitment} commitment`
        );
      }
    } catch (error) {
      console.error(`Error connecting to ${endpoint.name} RPC:`, error);
      continue;
    }
  }

  if (connections.length === 0) {
    throw new Error('No healthy RPC connections available');
  }

  return connections;
}

export function getConfirmationStrategy(strategy: string): ConfirmStrategy {
  switch (strategy) {
    case 'LARGE_TRANSFER':
      return {
        commitment: 'confirmed',
        timeout: 60000, // 60 seconds
      };
    case 'SMALL_TRANSFER':
      return {
        commitment: 'confirmed',
        timeout: 30000, // 30 seconds
      };
    default:
      return {
        commitment: 'confirmed',
        timeout: 30000, // 30 seconds
      };
  }
}

export function isTransactionSuccessful(result: unknown): boolean {
  const txResult = result as TransactionResult;
  return 'value' in txResult && txResult.value.err === null;
}
