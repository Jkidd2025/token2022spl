import { Connection, PublicKey, Transaction, sendAndConfirmTransaction, Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { Liquidity, Token, TokenAmount, Percent, Currency } from '@raydium-io/raydium-sdk';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function testRaydiumProtocolFee() {
    try {
        // Connect to Solana network
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        
        // Get wallets from environment variables
        const testWalletPrivateKey = process.env.TEST_WALLET_PRIVATE_KEY;
        
        if (!testWalletPrivateKey) {
            throw new Error('Missing wallet keys in environment variables');
        }

        // Create keypair
        const testWallet = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(testWalletPrivateKey))
        );

        // Token mint address
        const tokenMint = new PublicKey('Fq36ke1FqbySsFqLsiZHTVYR8KZvfa6ZD7wcRBo8eRe4');
        const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

        console.log('Test wallet public key:', testWallet.publicKey.toString());

        // Get token accounts
        const testWalletTokenAccount = await getAssociatedTokenAddress(
            tokenMint,
            testWallet.publicKey
        );

        console.log('Test wallet token account:', testWalletTokenAccount.toString());

        // Check test wallet SOL balance
        const testWalletBalance = await connection.getBalance(testWallet.publicKey);
        console.log('Test wallet SOL balance:', testWalletBalance / LAMPORTS_PER_SOL);

        if (testWalletBalance < LAMPORTS_PER_SOL * 0.05) {
            throw new Error('Test wallet needs SOL for transaction fees');
        }

        // Amount to swap (1000 tokens)
        const swapAmount = 1000;
        const rawSwapAmount = swapAmount * Math.pow(10, 9); // 9 decimals

        // Get Raydium pool info
        const poolInfo = await Liquidity.fetchInfo({
            connection,
            poolKeys: {
                id: new PublicKey('YOUR_RAYDIUM_POOL_ID'), // Replace with actual pool ID
                baseMint: tokenMint,
                quoteMint: SOL_MINT,
                lpMint: new PublicKey('YOUR_LP_MINT'), // Replace with actual LP mint
                baseDecimals: 9,
                quoteDecimals: 9,
                lpDecimals: 9,
                version: 4,
                programId: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
                authority: new PublicKey('YOUR_POOL_AUTHORITY'), // Replace with actual authority
                openOrders: new PublicKey('YOUR_OPEN_ORDERS'), // Replace with actual open orders
                targetOrders: new PublicKey('YOUR_TARGET_ORDERS'), // Replace with actual target orders
                baseVault: new PublicKey('YOUR_BASE_VAULT'), // Replace with actual base vault
                quoteVault: new PublicKey('YOUR_QUOTE_VAULT'), // Replace with actual quote vault
                withdrawQueue: new PublicKey('YOUR_WITHDRAW_QUEUE'), // Replace with actual withdraw queue
                lpVault: new PublicKey('YOUR_LP_VAULT'), // Replace with actual LP vault
                marketVersion: 3,
                marketProgramId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
                marketId: new PublicKey('YOUR_MARKET_ID'), // Replace with actual market ID
                marketAuthority: new PublicKey('YOUR_MARKET_AUTHORITY'), // Replace with actual market authority
                marketBaseVault: new PublicKey('YOUR_MARKET_BASE_VAULT'), // Replace with actual market base vault
                marketQuoteVault: new PublicKey('YOUR_MARKET_QUOTE_VAULT'), // Replace with actual market quote vault
                marketBids: new PublicKey('YOUR_MARKET_BIDS'), // Replace with actual market bids
                marketAsks: new PublicKey('YOUR_MARKET_ASKS'), // Replace with actual market asks
                marketEventQueue: new PublicKey('YOUR_MARKET_EVENT_QUEUE'), // Replace with actual market event queue
            }
        });

        // Calculate expected output amount
        const expectedOutput = await Liquidity.computeAmountOut({
            poolKeys: poolInfo,
            amountIn: new TokenAmount(new Token(tokenMint, 9), BigInt(rawSwapAmount)),
            currencyOut: new Currency(SOL_MINT, 9),
            slippage: new Percent(50, 10000) // 0.5% slippage
        });

        console.log(`Expected SOL output: ${expectedOutput.toFixed(9)} SOL`);

        // Calculate protocol fees (5% total)
        const protocolFeeAmount = Number(expectedOutput.raw) * 0.05;
        const operationsFeeAmount = Math.floor(protocolFeeAmount / 2); // 2.5%
        const rewardsFeeAmount = Math.floor(protocolFeeAmount / 2); // 2.5%

        console.log('Protocol fee amount:', protocolFeeAmount / LAMPORTS_PER_SOL, 'SOL');
        console.log('Operations fee (2.5%):', operationsFeeAmount / LAMPORTS_PER_SOL, 'SOL');
        console.log('Rewards fee (2.5%):', rewardsFeeAmount / LAMPORTS_PER_SOL, 'SOL');

        // Create transaction for swap and fee distribution
        const transaction = new Transaction();

        // Add swap instruction (placeholder - needs actual Raydium swap instruction)
        // const swapInstruction = await Liquidity.makeSwapInstruction({
        //     connection,
        //     poolKeys: poolInfo,
        //     userKeys: {
        //         tokenAccountsIn: [testWalletTokenAccount],
        //         tokenAccountsOut: [testWallet.publicKey],
        //         owner: testWallet.publicKey,
        //         ownerTokenAccount: testWalletTokenAccount,
        //         ownerWrappedSolAccount: testWallet.publicKey,
        //         payer: testWallet.publicKey,
        //     },
        //     amountIn: new TokenAmount(new Token(tokenMint, 9), BigInt(rawSwapAmount)),
        //     amountOut: expectedOutput,
        //     fixedSide: 'in',
        // });

        // Add Operations fee instruction (2.5%)
        const operationsFeeInstruction = SystemProgram.transfer({
            fromPubkey: testWallet.publicKey,
            toPubkey: new PublicKey('AxYz7cNVAj4atpHZhcNJefjqzFQAYUuL1P3oGH5Qoy2t'), // Operations wallet
            lamports: operationsFeeAmount
        });

        // Add Rewards Pool fee instruction (2.5%)
        const rewardsPoolFeeInstruction = SystemProgram.transfer({
            fromPubkey: testWallet.publicKey,
            toPubkey: new PublicKey('ErK6QKCatew1PnAb8BdyAHcCAzWQj5qRU7fbMgsTPBCh'), // Rewards Pool wallet
            lamports: rewardsFeeAmount
        });

        // transaction.add(swapInstruction, operationsFeeInstruction, rewardsPoolFeeInstruction);
        transaction.add(operationsFeeInstruction, rewardsPoolFeeInstruction);

        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = testWallet.publicKey;

        // Sign and send transaction
        console.log('Sending transaction...');
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [testWallet],
            { commitment: 'confirmed' }
        );

        console.log('Transaction successful!');
        console.log('Transaction signature:', signature);

        // Check final balances
        const finalSolBalance = await connection.getBalance(testWallet.publicKey);
        console.log('Final SOL balance:', finalSolBalance / LAMPORTS_PER_SOL);

    } catch (error) {
        console.error('Error in testRaydiumProtocolFee:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        throw error;
    }
}

testRaydiumProtocolFee(); 