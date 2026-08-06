/**
 * PM2 生產環境配置（CJS 版本，供 PM2 載入）
 */
module.exports = {
  apps: [
    {
      name: "chat-backend",
      script: "./src/index.js",
      env: {
        NODE_ENV: "production",
        LOG_LEVEL: "perf",
      },
      instances: "max",
      exec_mode: "cluster",
      max_memory_restart: "500M",
      merge_logs: true,
      output: "./logs/pm2/out.log",
      error: "./logs/pm2/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "10s",
      listen_timeout: 10000,
      shutdown_with_message: true,
      instance_var: "INSTANCE_ID",
      cron_restart: "0 2 * * *",
    },
  ],
};
