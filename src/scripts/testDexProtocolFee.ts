import { Connection, PublicKey, Transaction, sendAndConfirmTransaction, Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createBurnInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function testDexProtocolFee() {
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

        console.log('Test wallet public key:', testWallet.publicKey.toString());

        // Get token account
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

        // Simulate DEX swap rate (1 token = 0.001 SOL)
        const solReceived = swapAmount * 0.001;
        const solReceivedLamports = Math.floor(solReceived * LAMPORTS_PER_SOL);

        console.log(`Simulating swap of ${swapAmount} tokens for ${solReceived} SOL...`);

        // Calculate protocol fees (5% total)
        const protocolFeeAmount = solReceivedLamports * 0.05;
        const operationsFeeAmount = Math.floor(protocolFeeAmount / 2); // 2.5%
        const rewardsFeeAmount = Math.floor(protocolFeeAmount / 2); // 2.5%

        console.log('Protocol fee amount:', protocolFeeAmount / LAMPORTS_PER_SOL, 'SOL');
        console.log('Operations fee (2.5%):', operationsFeeAmount / LAMPORTS_PER_SOL, 'SOL');
        console.log('Rewards fee (2.5%):', rewardsFeeAmount / LAMPORTS_PER_SOL, 'SOL');

        // Create transaction for token burn and fee distribution
        const transaction = new Transaction();

        // Add burn instruction
        const burnInstruction = createBurnInstruction(
            testWalletTokenAccount,
            tokenMint,
            testWallet.publicKey,
            BigInt(rawSwapAmount)
        );

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

        transaction.add(burnInstruction, operationsFeeInstruction, rewardsPoolFeeInstruction);

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
        console.error('Error in testDexProtocolFee:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        throw error;
    }
}

testDexProtocolFee(); 