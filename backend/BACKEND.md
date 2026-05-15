# Node.js + Socket.io + Prisma 聊天服务器技术说明

## 项目概览

這是一個基於 **Express + Socket.io + Prisma** 的實時聊天後端系統，支持：
- 使用者認證（JWT）
- 實時聊天（WebSocket）
- PostgreSQL 数据库
- 密碼加密（bcryptjs）

---

## 项目结构

```
backend/
├─ src/
│  ├─ index.js              # 主入口（Express + Socket.io）
│  ├─ socket.js             # WebSocket 事件处理
│  ├─ middleware/
│  │   └─ auth.js           # JWT 认证中间件
│  ├─ routes/
│  │   ├─ auth.js           # 注册/登入路由
│  │   └─ chat.js           # 聊天室/消息路由
│  ├─ controllers/          # 控制器（可选扩展）
│  └─ services/             # 业务逻辑（可选扩展）
│
├─ prisma/
│  └─ schema.prisma         # 数据库模型定义
│
├─ .env                     # 环境变量
├─ package.json             # 依赖管理
└─ node_modules/            # 已安裝套件
```

---

## 核心依赖说明

### 生產依賴

| 包名 | 版本 | 用途 |
|------|------|------|
| **express** | ^5.2.1 | Web 框架 |
| **socket.io** | ^4.8.3 | 實時通信 |
| **@prisma/client** | ^7.8.0 | ORM 資料庫驅動 |
| **prisma** | ^7.8.0 | 資料庫 CLI 工具 |
| **cors** | ^2.8.6 | 跨域資源共享 |
| **dotenv** | ^17.4.2 | 環境變數載入 |
| **jsonwebtoken** | 最新 | JWT 認證 |
| **bcryptjs** | 最新 | 密碼加密 |

### 開發依賴

| 包名 | 用途 |
|------|------|
| **nodemon** | 自動重啓開發伺勑器 |

---

## 快速開始

### 1️⃣ 安裝資料庫（PostgreSQL）

```bash
# Windows 使用者
# 安裝 PostgreSQL（https://www.postgresql.org/download/windows/）

# 建立資料庫
createdb chat_db

# 或使用 pgAdmin 圖形化工具建立
```

### 2️⃣ 設定環境變數

編輯 `.env` 檔案：
```env
DATABASE_URL="postgresql://使用者:密碼@localhost:5432/chat_db"
JWT_SECRET="你的-super-secret-密鑰"
PORT=3001
NODE_ENV=development
CORS_ORIGIN="http://localhost:3000"
```

### 3️⃣ 初始化資料庫

```bash
# 執行 Prisma 遷移（建立表格）
npm run prisma:migrate

# 或生成客户端（如果 schema 已建立）
npm run prisma:generate
```

### 4️⃣ 啟動開發伺勑器

```bash
# 開發模式（支持熱重啟）
npm run dev

# 或生产模式
npm start
```

**輸出範例：**
```
聊天服务器已启动
地址: http://localhost:3001
WebSocket: ws://localhost:3001
```

---

## Prisma 數據模型更新流程

### 修改模型後需要執行的步驟

**每次修改 `schema.prisma` 文件後，按順序執行：**

#### 1️⃣ **執行遷移（必需）**
```bash
cd backend
npx prisma migrate dev --name <描述名稱>
```

**示例：**
```bash
npx prisma migrate dev --name add_creator_to_chatroom
npx prisma migrate dev --name add_room_status
```

**此命令會：**
- 生成遷移文件（SQL）
- 執行 SQL 更新數據庫
- 自動重新生成 Prisma Client

#### 2️⃣ **重新生成 Client（通常自動）**
如果遷移沒有自動生成，手動執行：
```bash
npx prisma generate
```

#### 3️⃣ **重啓後端服務器**
```bash
# 停止當前進程（Ctrl + C）
# 重新啓動
npm run dev
```

### 完整流程速記

```bash
# 1. 修改 schema.prisma
# 2. 執行遷移
cd backend
npx prisma migrate dev --name <描述>

# 3. 重啓後端
npm run dev
```

### 生産環境部署

```bash
# 生產環境：只部署已有的遷移（不建立新遷移）
npx prisma migrate deploy
```

### 常見問題

**問題：更新 schema 後 API 返回 "Unknown field" 錯誤**
- 原因：Prisma Client 未重新生成
- 解決：執行 `npx prisma generate` 或重啓服務器

**問題：遷移失敗，存在數據無法轉換**
- 解決：編輯遷移文件手動修改 SQL，或使用 `--create-only` 創建遷移文件後再手動修改

```bash
npx prisma migrate dev --create-only --name fix_issue
```

---
