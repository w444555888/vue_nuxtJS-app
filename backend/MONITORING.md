# 後端效能監控和調試指南

## 📊 三大監控方案

### 1️⃣ **Logging（日誌記錄）** - 快速查看
**用途**：追蹤每個 API 和查詢的耗時

#### 啟動方式
```bash
# 開發環境
npm run dev

# 生產環境
npm run prod
```

#### 日誌位置
```
logs/
├── all.log           # 所有日誌
├── error.log         # 錯誤日誌（紅色）
├── performance.log   # 性能日誌（超過100ms的查詢）
└── pm2/              # PM2 進程日誌
```

#### 實時查看日誌
```bash
# 查看全部日誌
npm run logs:all

# 只看錯誤
npm run logs:error

# 只看性能指標
npm run logs:performance
```

#### 日誌格式示例
```
2026-08-05 10:30:45:123 info: 聊天服務器已啟動
2026-08-05 10:30:46:456 http: GET /api/profile HTTP/1.1
2026-08-05 10:30:46:789 perf: Prisma 查詢耗時 250ms model=message action=findMany duration=250
2026-08-05 10:30:47:012 perf: API GET /api/chat/rooms duration=300 status=200
2026-08-05 10:30:48:345 error: API 錯誤
```

---

### 2️⃣ **Monitoring（實時監控）** - 生產環境告警
**用途**：監控記憶體洩漏、CPU 異常

#### 生產環境啟動
```bash
# 啟動 PM2 進程管理
npm run prod:pm2

# 查看即時監控（CPU、記憶體、事件迴圈延遲）
npm run monitor

# 查看日誌
npm run logs

# 重啟服務
npm run prod:restart

# 停止服務
npm run prod:stop

# 刪除服務
npm run prod:delete
```

#### PM2 監控指標
```
┌─────────────────────────────────┬───────┬─────────┬─────┬───────┐
│ App name        │ CPU  │ Memory │ Time  │ Restart │
├─────────────────────────────────┼───────┼─────────┼─────┼───────┤
│ chat-backend    │ 2.5% │ 180MB  │ 10s   │ 0       │
└─────────────────────────────────┴───────┴─────────┴─────┴───────┘
```

**告警規則**（自動觸發）：
- 記憶體超過 500MB → 自動重啟
- 每天凌晨 2 點 → 自動重啟清理記憶體

---

## 🔍 實際操作流程

### 場景 1：「用戶反映聊天很卡」

#### 步驟
1. **開啟性能日誌並重現問題操作**
   ```bash
   npm run dev
   ```

2. **讓用戶執行操作**
   - 發送消息
   - 發送圖片
   - 查詢舊消息

3. **分析性能日誌**
   - 找出高耗時 API/查詢
   - 例：Prisma 查詢 findMany 耗時 5 秒 → 需要加索引

4. **查看日誌確認**
   ```bash
   npm run logs:performance
   # 找出所有 > 1000ms 的查詢
   ```

---

### 場景 2：「記憶體持續上升」

#### 步驟
1. **生產環境啟動 PM2**
   ```bash
   npm run prod:pm2
   ```

2. **實時監控記憶體**
   ```bash
   npm run monitor
   ```

3. **查看詳細日誌**
   ```bash
   npm run logs:all
   # 搜索 "memory leak" 或異常消息
   ```

4. **對比日誌找出問題**
   - 例：WebSocket 連線沒有正確 disconnect
   - 例：Prisma 查詢結果沒有釋放

---

### 場景 3：「特定 API 响應慢」

#### 步驟
1. **查看性能日誌**
   ```bash
   npm run logs:performance
   ```

2. **找到對應的 API**
   ```
   API GET /api/chat/messages duration=2500 status=200
   ```

3. **查看該 API 的代碼**
   - [src/routes/chat.js](../src/routes/chat.js)
   - [src/services/chat.js](../src/services/chat.js)

4. **逐項檢查**
   - Prisma 查詢數量（N+1 問題？）
   - 查詢結果大小（是否需要分頁？）
   - 計算邏輯複雜度

---

## 📈 性能優化建議

### 常見瓶頸和解決方案

| 問題 | 症狀 | 解決方案 |
|------|------|--------|
| **N+1 查詢** | 100 條消息需要 100 次查詢用戶 | 使用 `include()` 或 `select()` 一次查詢 |
| **無索引查詢** | 大表查詢很慢 | 在 Prisma schema 添加 `@@index` |
| **WebSocket 洩漏** | 記憶體不斷上升 | 確保 `disconnect` 事件清理連線 |
| **圖片上傳慢** | 上傳 5MB 圖片要 30s | 使用分塊上傳或壓縮圖片 |
| **AI 調用卡頓** | 調用 Google Generative AI 時阻塞 | 改為異步調用 (Promise) |

---

## 🛠 開發者工具

### 查看數據庫狀態
```bash
npm run prisma:studio
# 打開 Prisma Studio，查看所有數據
```

### 檢查 TypeScript 錯誤
```bash
# 在 client 文件夾
npm run type-check
```

### 查看全部可用命令
```bash
npm run
```

---

## 📝 日誌級別説明

```javascript
logger.info()    // 信息日誌（綠色）- 重要事件
logger.warn()    // 警告日誌（黃色） - 可能問題
logger.error()   // 錯誤日誌（紅色）  - 嚴重問題
logger.perf()    // 性能日誌（藍色）  - 耗時操作
logger.debug()   // 調試日誌（白色）  - 開發除蟲
```

---

## 🚀 快速開始

### 本地開發（帶日誌）
```bash
npm run dev
# 打開另一個終端查看日誌
npm run logs:all
```

### 性能分析
```bash
```

### 生產部署
```bash
npm run prod:pm2
npm run monitor
```

---

## ⚠️ 常見錯誤

### ❌ 錯誤 1: 日誌文件夾不存在
```
Error: ENOENT: no such file or directory, open './logs/all.log'
```
**解決**：手動創建 logs 文件夾
```bash
mkdir logs logs/pm2
```

### ❌ 錯誤 2: PM2 衝突
```
Error: Process already exists
```
**解決**：先刪除再創建
```bash
npm run prod:delete
npm run prod:pm2
```

## 📚 延伸閱讀

- [Winston Logger 文檔](https://github.com/winstonjs/winston)
- [Morgan HTTP Logger](https://github.com/expressjs/morgan)
- [PM2 文檔](https://pm2.keymetrics.io/)
- [Prisma 性能優化](https://www.prisma.io/docs/orm/prisma-client/queries/performance)

---

**最後更新**：2026-08-05
