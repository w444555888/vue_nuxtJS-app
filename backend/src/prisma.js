import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import logger from "./utils/logger.js";

// 驗證環境變數
if (!process.env.DATABASE_URL) {
  logger.error("DATABASE_URL 環境變數未設置");
  process.exit(1);
}

// 創建單一的 Prisma 客戶端實例
const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ 
  adapter,
  // 可選：在開發環境顯示查詢日誌
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// 處理連接錯誤
prisma.$connect()
  .then(() => logger.info("數據庫連接成功"))
  .catch((err) => {
    logger.error("數據庫連接失敗", { error: err.message });
    process.exit(1);
  });

  
// 優雅關閉(在程式結束前，把該清理的資源先清理完，再離開)
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;
