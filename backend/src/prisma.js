const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");

// 驗證環境變數
if (!process.env.DATABASE_URL) {
  console.error("錯誤：DATABASE_URL 環境變數未設置");
  process.exit(1);
}

// 創建單一的 Prisma 客戶端實例
const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 處理連接錯誤
prisma.$connect()
  .then(() => console.log("數據庫連接成功"))
  .catch((err) => {
    console.error("數據庫連接失敗:", err);
    process.exit(1);
  });

// 優雅關閉
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = prisma;
