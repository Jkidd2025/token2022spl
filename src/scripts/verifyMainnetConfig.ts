import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { validateConnection } from '../utils/rpcConnection';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { validateTokenAddresses } from '../config/tokens';

dotenv.config();

interface ConfigurationError {
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

async function verifyMainnetConfiguration(): Promise<ConfigurationError[]> {
  const errors: ConfigurationError[] = [];

  // 1. Network Configuration
  if (process.env.SOLANA_NETWORK !== 'mainnet-beta') {
    errors.push({
      field: 'SOLANA_NETWORK',
      message: 'Network must be set to mainnet-beta',
      severity: 'ERROR',
    });
  }

  // 2. RPC Configuration
  if (!process.env.HELIUS_API_KEY) {
    errors.push({
      field: 'HELIUS_API_KEY',
      message: 'Helius API key is required for mainnet',
      severity: 'ERROR',
    });
  }

  // 3. Connection Test
  try {
    if (!process.env.HELIUS_RPC_URL) {
      throw new Error('HELIUS_RPC_URL is not defined');
    }
    if (!process.env.HELIUS_API_KEY) {
      throw new Error('HELIUS_API_KEY is not defined');
    }
    const connection = new Connection(`${process.env.HELIUS_RPC_URL}/?api-key=${process.env.HELIUS_API_KEY}`);
    const isHealthy = await validateConnection(connection, 'finalized');
    if (!isHealthy) {
      errors.push({
        field: 'RPC_CONNECTION',
        message: 'Failed to establish healthy RPC connection',
        severity: 'ERROR',
      });
    }
  } catch (error) {
    errors.push({
      field: 'RPC_CONNECTION',
      message: `RPC connection error: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'ERROR',
    });
  }

  // 4. WBTC Configuration
  if (!process.env.WBTC_MINT_ADDRESS) {
    errors.push({
      field: 'WBTC_MINT_ADDRESS',
      message: 'WBTC mint address is required',
      severity: 'ERROR',
    });
  } else {
    try {
      new PublicKey(process.env.WBTC_MINT_ADDRESS);
    } catch {
      errors.push({
        field: 'WBTC_MINT_ADDRESS',
        message: 'Invalid WBTC mint address format',
        severity: 'ERROR',
      });
    }
  }

  // 5. Token Parameters
  if (!process.env.TOKEN_DECIMALS || isNaN(Number(process.env.TOKEN_DECIMALS))) {
    errors.push({
      field: 'TOKEN_DECIMALS',
      message: 'Token decimals must be a valid number',
      severity: 'ERROR',
    });
  }

  if (!process.env.INITIAL_SUPPLY || isNaN(Number(process.env.INITIAL_SUPPLY))) {
    errors.push({
      field: 'INITIAL_SUPPLY',
      message: 'Initial supply must be a valid number',
      severity: 'ERROR',
    });
  }

  // 6. Security Configuration
  if (!process.env.EMERGENCY_WALLET) {
    errors.push({
      field: 'EMERGENCY_WALLET',
      message: 'Emergency wallet is required for security purposes',
      severity: 'ERROR',
    });
  }

  // 7. Distribution Configuration
  const distributionAmount = Number(process.env.MINIMUM_DISTRIBUTION_AMOUNT);
  if (isNaN(distributionAmount) || distributionAmount <= 0) {
    errors.push({
      field: 'MINIMUM_DISTRIBUTION_AMOUNT',
      message: 'Invalid minimum distribution amount',
      severity: 'ERROR',
    });
  }

  // 8. Transaction Configuration
  if (process.env.CONFIRMATION_LEVEL !== 'finalized') {
    errors.push({
      field: 'CONFIRMATION_LEVEL',
      message: 'Confirmation level should be "finalized" for mainnet',
      severity: 'WARNING',
    });
  }

  // 9. Monitoring Configuration
  if (!process.env.ALERT_EMAIL && !process.env.DISCORD_WEBHOOK) {
    errors.push({
      field: 'MONITORING',
      message: 'At least one alert mechanism (email or Discord) should be configured',
      severity: 'WARNING',
    });
  }

  // 10. Reserve Configuration
  if (!process.env.RESERVE_ADDRESS) {
    errors.push({
      field: 'RESERVE_ADDRESS',
      message: 'Reserve address is required for fee collection',
      severity: 'ERROR',
    });
  } else {
    try {
      new PublicKey(process.env.RESERVE_ADDRESS);
    } catch {
      errors.push({
        field: 'RESERVE_ADDRESS',
        message: 'Invalid reserve address format',
        severity: 'ERROR',
      });
    }
  }

  return errors;
}

// If running directly
if (require.main === module) {
  verifyMainnetConfiguration()
    .then((errors) => {
      console.log('\n=== Mainnet Configuration Verification ===\n');

      const criticalErrors = errors.filter((e) => e.severity === 'ERROR');
      const warnings = errors.filter((e) => e.severity === 'WARNING');

      if (criticalErrors.length > 0) {
        console.log('❌ Critical Errors:');
        criticalErrors.forEach((error) => {
          console.log(`- ${error.field}: ${error.message}`);
        });
      }

      if (warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        warnings.forEach((warning) => {
          console.log(`- ${warning.field}: ${warning.message}`);
        });
      }

      if (errors.length === 0) {
        console.log('✅ All configurations verified successfully!');
      } else {
        console.log(
          `\nFound ${criticalErrors.length} critical errors and ${warnings.length} warnings.`
        );
        if (criticalErrors.length > 0) {
          process.exit(1);
        }
      }
    })
    .catch((error) => {
      console.error('Verification failed:', error);
      process.exit(1);
    });
}
