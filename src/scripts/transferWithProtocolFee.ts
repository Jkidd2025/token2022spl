import { Connection, PublicKey, Transaction, sendAndConfirmTransaction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function transferWithProtocolFee() {
    try {
        // Connect to Solana network
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        
        // Get wallets from environment variables
        const testWalletPrivateKey = process.env.TEST_WALLET_PRIVATE_KEY;
        const publicSaleWalletAddress = process.env.PUBLIC_SALE_WALLET_ADDRESS;
        
        if (!testWalletPrivateKey || !publicSaleWalletAddress) {
            throw new Error('Missing wallet keys in environment variables');
        }

        // Create keypairs
        const testWallet = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(testWalletPrivateKey))
        );
        const publicSaleWallet = new PublicKey(publicSaleWalletAddress);

        // Token mint address
        const tokenMint = new PublicKey('Fq36ke1FqbySsFqLsiZHTVYR8KZvfa6ZD7wcRBo8eRe4');

        console.log('Test wallet public key:', testWallet.publicKey.toString());
        console.log('Public Sale wallet public key:', publicSaleWallet.toString());

        // Get token accounts
        const testWalletTokenAccount = await getAssociatedTokenAddress(
            tokenMint,
            testWallet.publicKey
        );

        const publicSaleTokenAccount = await getAssociatedTokenAddress(
            tokenMint,
            publicSaleWallet
        );

        console.log('Test wallet token account:', testWalletTokenAccount.toString());
        console.log('Public Sale token account:', publicSaleTokenAccount.toString());

        // Check test wallet SOL balance
        const testWalletBalance = await connection.getBalance(testWallet.publicKey);
        console.log('Test wallet SOL balance:', testWalletBalance / LAMPORTS_PER_SOL);

        if (testWalletBalance < LAMPORTS_PER_SOL * 0.05) {
            throw new Error('Test wallet needs SOL for transaction fees');
        }

        // Amount to transfer (1000 tokens)
        const transferAmount = 1000;
        const rawTransferAmount = transferAmount * Math.pow(10, 9); // 9 decimals

        // Create transaction
        const transaction = new Transaction();

        // Add transfer instruction with protocol fee
        const transferInstruction = createTransferInstruction(
            testWalletTokenAccount,
            publicSaleTokenAccount,
            testWallet.publicKey,
            rawTransferAmount,
            [],
            TOKEN_PROGRAM_ID
        );

        // Add Operations fee instruction (2.5%)
        const operationsFeeInstruction = createTransferInstruction(
            testWalletTokenAccount,
            new PublicKey('6KHPTpHHAGgc7W6r8ukS9tAjL7xhb8fAAqdYNwX3cy1Y'), // Operations token account
            testWallet.publicKey,
            Math.floor(rawTransferAmount * 0.025), // 2.5% protocol fee
            [],
            TOKEN_PROGRAM_ID
        );

        // Add Rewards Pool fee instruction (2.5%)
        const rewardsPoolFeeInstruction = createTransferInstruction(
            testWalletTokenAccount,
            new PublicKey('3tt9mrdwvCQkvi7FEjjfYvpPNJr7B8L9MDBjrKL1rvpx'), // Rewards Pool token account
            testWallet.publicKey,
            Math.floor(rawTransferAmount * 0.025), // 2.5% protocol fee
            [],
            TOKEN_PROGRAM_ID
        );

        transaction.add(transferInstruction, operationsFeeInstruction, rewardsPoolFeeInstruction);

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

        console.log('Transfer successful!');
        console.log('Signature:', signature);

    } catch (error) {
        console.error('Error in transferWithProtocolFee:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        throw error;
    }
}

transferWithProtocolFee(); 