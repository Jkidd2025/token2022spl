module.exports = {
  apps: [{
    name: 'wbtc-distributor',
    script: 'dist/scripts/automatedDistribution.js',
    args: '<base-token-mint> <fee-collector-address>',
    env: {
      NODE_ENV: 'production',
      DISTRIBUTION_SCHEDULE: '0 0 * * *', // Daily at midnight
      MINIMUM_FEE_AMOUNT: '1000000',      // Minimum fees to trigger distribution
      RETRY_DELAY: '15',                  // Minutes between retries
      MAX_RETRIES: '3'                    // Maximum retry attempts
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}; 