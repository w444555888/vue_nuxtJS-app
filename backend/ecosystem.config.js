/**
 * PM2 生產環境配置
 * 用於監控和管理 Node.js 應用
 * 
 * 使用方式：
 * 開發環境：npm run dev
 * 生產環境：npm run prod
 * 查看監控：npm run monitor
 * 查看日誌：npm run logs
 */

export default {
  apps: [
    {
      name: "chat-backend",
      script: "./src/index.js",
      env: {
        NODE_ENV: "production",
        LOG_LEVEL: "info",
      },
      // CPU 和內存優化
      instances: "max", // 使用所有 CPU 核心
      exec_mode: "cluster", // 集群模式
      max_memory_restart: "500M", // 達到 500MB 時自動重啟
      
      // 監控和日誌
      merge_logs: true,
      output: "./logs/pm2/out.log",
      error: "./logs/pm2/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      
      // 自動重啟策略
      autorestart: true,
      watch: false, // 生產環境不需要 watch
      max_restarts: 10,
      min_uptime: "10s",
      listen_timeout: 10000,
      shutdown_with_message: true,
      
      // 監控指標
      instance_var: "INSTANCE_ID",
      
      // 定時任務：每天淩晨 2 點重啟（清理記憶體）
      cron_restart: "0 2 * * *",
    },
  ],
  
  // PM2+ 監控配置（可選，需要 PM2+ 帳號）
  // monitor: {
  //   enabled: true,
  // },
};
