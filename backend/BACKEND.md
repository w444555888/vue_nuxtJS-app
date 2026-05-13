# Node.js + Socket.io + Prisma 聊天服务器技术说明

## 项目概览

这是一个基于 **Express + Socket.io + Prisma** 的实时聊天后端系统，支持：
- 用户认证（JWT）
- 实时聊天（WebSocket）
- PostgreSQL 数据库
- 密码加密（bcryptjs）

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
└─ node_modules/            # 已安装包
```

---

## 核心依赖说明

### 生产依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| **express** | ^5.2.1 | Web 框架 |
| **socket.io** | ^4.8.3 | 实时通信 |
| **@prisma/client** | ^7.8.0 | ORM 数据库驱动 |
| **prisma** | ^7.8.0 | 数据库 CLI 工具 |
| **cors** | ^2.8.6 | 跨域资源共享 |
| **dotenv** | ^17.4.2 | 环境变量加载 |
| **jsonwebtoken** | 最新 | JWT 认证 |
| **bcryptjs** | 最新 | 密码加密 |

### 开发依赖

| 包名 | 用途 |
|------|------|
| **nodemon** | 自动重启开发服务器 |

---

## 快速开始

### 1️⃣ 安装数据库（PostgreSQL）

```bash
# Windows 用户
# 安装 PostgreSQL（https://www.postgresql.org/download/windows/）

# 创建数据库
createdb chat_db

# 或使用 pgAdmin 图形化工具创建
```

### 2️⃣ 配置环境变量

编辑 `.env` 文件：
```env
DATABASE_URL="postgresql://用户:密码@localhost:5432/chat_db"
JWT_SECRET="你的-super-secret-密钥"
PORT=3001
NODE_ENV=development
CORS_ORIGIN="http://localhost:3000"
```

### 3️⃣ 初始化数据库

```bash
# 运行 Prisma 迁移（创建表）
npm run prisma:migrate

# 或生成客户端（如果 schema 已创建）
npm run prisma:generate
```

### 4️⃣ 启动开发服务器

```bash
# 开发模式（支持热重启）
npm run dev

# 或生产模式
npm start
```

**输出示例：**
```
聊天服务器已启动
地址: http://localhost:3001
WebSocket: ws://localhost:3001
```

