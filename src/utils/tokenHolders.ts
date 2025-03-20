/* eslint-disable @typescript-eslint/no-unused-vars */
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

export interface TokenHolder {
  address: string;
  balance: bigint;
  percentage: number;
}

export async function getTokenHolders(
  connection: Connection,
  mint: PublicKey,
  excludeAddresses: string[] = []
): Promise<TokenHolder[]> {
  try {
    // Get all token accounts for this mint
    const accounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
      filters: [
        {
          dataSize: 165, // Size of token account data
        },
        {
          memcmp: {
            offset: 0,
            bytes: mint.toBase58(),
          },
        },
      ],
    });

    // Filter out excluded addresses and zero balances
    const excludeSet = new Set(excludeAddresses);
    const holders: TokenHolder[] = [];
    let totalSupply = BigInt(0);

    for (const account of accounts) {
      const tokenAccount = await getAccount(
        connection,
        account.pubkey,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );

      if (tokenAccount.amount > BigInt(0) && !excludeSet.has(tokenAccount.owner.toBase58())) {
        holders.push({
          address: tokenAccount.owner.toBase58(),
          balance: tokenAccount.amount,
          percentage: 0, // Will be calculated after getting total supply
        });
        totalSupply += tokenAccount.amount;
      }
    }

    // Calculate percentages
    return holders.map((holder) => ({
      ...holder,
      percentage: Number((holder.balance * BigInt(10000)) / totalSupply / BigInt(100)),
    }));
  } catch (error) {
    console.error('Error fetching token holders:', error);
    throw error;
  }
}

export async function calculateDistributionAmounts(
  holders: TokenHolder[],
  totalWBTCAmount: bigint
): Promise<{ address: string; amount: bigint }[]> {
  return holders.map((holder) => ({
    address: holder.address,
    amount: (totalWBTCAmount * BigInt(Math.floor(holder.percentage * 100))) / BigInt(10000),
  }));
}
