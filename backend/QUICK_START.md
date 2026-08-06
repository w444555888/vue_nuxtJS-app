# 🚀 效能監控快速開始

## 三種運行模式

### 1️⃣ **開發模式**（帶熱重載和日誌）
```bash
npm run dev
```
✅ 看得到日誌 | ✅ 自動重啟 | ✅ 適合開發調試

---

### 2️⃣ **生產模式**（監控和自動重啟）
```bash
npm run prod:pm2
```
✅ 多進程集群 | ✅ 記憶體超 500MB 自動重啟 | ✅ 每天凌晨 2 點自動重啟

**管理命令**：
```bash
npm run monitor        # 查看即時 CPU、記憶體
npm run logs           # 查看日誌
npm run prod:restart   # 重啟服務
npm run prod:stop      # 停止服務
```

---

## 📊 實時查看日誌

```bash
npm run logs:all            # 全部日誌
npm run logs:error          # 錯誤日誌（紅色）
npm run logs:performance    # 性能日誌（藍色）
```

**日誌格式**：
```
2026-08-05 16:32:00:320 info: 聊天服務器已啟動
2026-08-05 16:32:01:456 perf: Prisma findMany duration=250 
2026-08-05 16:32:02:789 perf: API GET /api/chat duration=300 status=200
2026-08-05 16:32:03:012 error: 數據庫連接失敗
```

---

## 🔍 快速診斷

### 「用戶說聊天很卡」
```bash
npm run dev
npm run logs:performance
# 重現操作後，從性能日誌找最慢的 API/查詢
```

### 「記憶體持續上升」
```bash
npm run prod:pm2
npm run monitor
# 看記憶體百分比和上升速度
```

### 「特定 API 響應慢」
```bash
npm run logs:performance
# 找出 duration > 1000ms 的 API
```

---

## 📝 配置文件

| 文件 | 說明 |
|------|------|
| [ecosystem.config.cjs](ecosystem.config.cjs) | PM2 生產配置 |
| [src/utils/logger.js](src/utils/logger.js) | Winston 日誌系統 |
| [src/middleware/performance.js](src/middleware/performance.js) | 性能監控中間件 |
| [MONITORING.md](MONITORING.md) | 完整文檔 |

---

## ⚠️ 常見問題

❌ **「Port 3001 already in use」**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3001
kill -9 <PID>
```

❌ **「Logs folder not found」**
```bash
mkdir logs logs/pm2
```

❌ **「'tail' 不是內部或外部命令」(Windows)**
```bash
# 直接用 npm scripts（已改為 PowerShell 版本）
npm run logs:all
npm run logs:error
npm run logs:performance
```

---

詳細文檔請見 [MONITORING.md](MONITORING.md)
