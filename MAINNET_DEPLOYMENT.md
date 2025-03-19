# Mainnet Deployment Guide

## Prerequisites

1. **Environment Setup**

   - Node.js v16 or higher
   - Solana CLI tools
   - Git
   - Access to a Solana RPC endpoint (preferably paid tier for reliability)

2. **Required Accounts**

   - Main wallet with sufficient SOL for deployment
   - Backup wallet for emergency access
   - Fee collector wallet
   - Burn account wallet
   - Public Sale & Community Distribution wallet
   - Liquidity Reserve wallet
   - Ecosystem Development & Partnerships wallet
   - Team & Advisors wallet
   - Reserve/Development Fund wallet

3. **Configuration Files**
   - `.env` file with all required variables
   - `metadata.json` with token information
   - Network configuration files

## Pre-Deployment Checklist

### 1. Environment Variables

```bash
# Required Environment Variables
SOLANA_RPC_URL=<mainnet-rpc-endpoint>
WALLET_PRIVATE_KEY=<main-wallet-private-key>
FEE_COLLECTOR_PRIVATE_KEY=<fee-collector-private-key>
BURN_ACCOUNT_PRIVATE_KEY=<burn-account-private-key>
WBTC_MINT_ADDRESS="3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh"
TOKEN_DECIMALS=6
INITIAL_SUPPLY=1000000000
TRANSFER_FEE_BASIS_POINTS=500
```

### 2. Token Configuration

- Verify token name and symbol
- Confirm initial supply amount
- Validate fee configuration
- Review metadata information

### 3. Security Verification

- [ ] Emergency pause functionality
- [ ] Backup wallet configuration
- [ ] Rate limiting parameters
- [ ] Access control settings

## Deployment Steps

### 1. Network Setup

```bash
# Switch to mainnet
solana config set --url https://api.mainnet-beta.solana.com

# Verify network connection
solana cluster-version
```

### 2. Account Generation

```bash
# Generate fee collector account
ts-node src/scripts/generateAccounts.ts

# Generate burn account
ts-node src/scripts/generateAccounts.ts --type burn

# Save account information securely
```

### 3. Token Creation

```bash
# Create token with extensions
ts-node src/scripts/createToken.ts

# Verify token creation
solana account <TOKEN_MINT_ADDRESS> --output json
```

### 4. Initial Setup

```bash
# Initialize accounts
ts-node src/scripts/initializeAccounts.ts

# Perform initial mint
ts-node src/scripts/initialMint.ts <TOKEN_MINT_ADDRESS>

# Verify initial supply
```

### 5. Authority Management

```bash
# Revoke unnecessary authorities
ts-node src/scripts/revokeAuthorities.ts <TOKEN_MINT_ADDRESS>

# Verify authority revocation
```

### 6. Fee Configuration

```bash
# Set up fee collector
ts-node src/scripts/setupFeeCollector.ts <TOKEN_MINT_ADDRESS>

# Verify fee configuration
```

### 7. Distribution Setup

```bash
# Configure WBTC distribution
ts-node src/scripts/setupDistribution.ts <TOKEN_MINT_ADDRESS>

# Test distribution mechanism
```

## Post-Deployment Verification

### 1. Token Verification

- [ ] Verify token metadata
- [ ] Confirm initial supply
- [ ] Check fee collection
- [ ] Validate distribution mechanism
- [ ] Test burn functionality

### 2. Security Checks

- [ ] Verify authority revocation
- [ ] Test emergency controls
- [ ] Validate access restrictions
- [ ] Check rate limiting
- [ ] Confirm backup procedures

### 3. Integration Testing

- [ ] Test token transfers
- [ ] Verify fee collection
- [ ] Check distribution system
- [ ] Validate burn mechanism
- [ ] Test emergency procedures

## Monitoring Setup

### 1. Logging Configuration

```bash
# Set up logging
pm2 start ecosystem.config.js

# Monitor logs
pm2 logs wbtc-distributor
```

### 2. Alert System

- Configure monitoring alerts
- Set up error notifications
- Establish performance metrics
- Monitor transaction success rates

## Emergency Procedures

### 1. Emergency Pause

```bash
# Pause operations
ts-node src/scripts/emergencyPause.ts <TOKEN_MINT_ADDRESS>

# Verify pause status
```

### 2. Recovery Procedures

- Backup wallet access
- Emergency authority restoration
- System recovery steps
- Data restoration process

## Maintenance Guidelines

### 1. Regular Checks

- Daily balance verification
- Weekly security audits
- Monthly performance review
- Quarterly system updates

### 2. Backup Procedures

- Regular wallet backups
- Configuration backups
- System state snapshots
- Recovery testing

## Support and Contact

### Technical Support

- Primary Contact: [Contact Information]
- Secondary Contact: [Contact Information]
- Emergency Contact: [Contact Information]

### Documentation

- Internal Wiki: [Link]
- API Documentation: [Link]
- Troubleshooting Guide: [Link]

## Post-Deployment Checklist

### 1. Documentation

- [ ] Update deployment records
- [ ] Document configuration
- [ ] Update monitoring setup
- [ ] Review security measures

### 2. Training

- [ ] Team training completed
- [ ] Emergency procedures reviewed
- [ ] Support team briefed
- [ ] Documentation reviewed

### 3. Monitoring

- [ ] Logging system active
- [ ] Alerts configured
- [ ] Performance monitoring
- [ ] Security monitoring

## Rollback Procedures

### 1. Emergency Rollback

```bash
# Stop services
pm2 stop all

# Restore previous state
git checkout <previous-commit>

# Restart services
pm2 start ecosystem.config.js
```

### 2. Data Recovery

- Backup restoration
- State recovery
- Configuration rollback
- Authority restoration

## Success Criteria

### 1. Technical Requirements

- [ ] Token successfully deployed
- [ ] All extensions active
- [ ] Fee collection working
- [ ] Distribution system operational
- [ ] Burn mechanism functional

### 2. Security Requirements

- [ ] Authorities properly configured
- [ ] Access controls active
- [ ] Emergency procedures tested
- [ ] Backup systems verified
- [ ] Monitoring active

### 3. Operational Requirements

- [ ] Team trained
- [ ] Documentation complete
- [ ] Support system ready
- [ ] Monitoring configured
- [ ] Maintenance schedule established
