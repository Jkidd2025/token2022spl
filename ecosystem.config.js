module.exports = {
  apps: [
    {
      name: 'wbtc-distributor',
      script: 'dist/scripts/automatedDistribution.js',
      args: '<base-token-mint> <fee-collector-address>',
      env: {
        NODE_ENV: 'production',
        TZ: 'America/Chicago', // Central Standard Time
        DISTRIBUTION_SCHEDULE: '*/30 * * * *', // Runs every 30 minutes
        MINIMUM_FEE_AMOUNT: '20000', // Minimum fees to trigger distribution
        RETRY_DELAY: '15', // Minutes between retries
        MAX_RETRIES: '3', // Maximum retry attempts
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: 'logs/wbtc-distributor-error.log',
      out_file: 'logs/wbtc-distributor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
