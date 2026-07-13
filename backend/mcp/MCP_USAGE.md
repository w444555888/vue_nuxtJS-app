# MCP 使用說明（本專案）

## 1. 先講結論

在這個專案中：

1. MCP client 的目的：發送工具需求（我要查什麼）
2. MCP server 的目的：提供工具能力（怎麼查、回什麼）

這裡使用的是同機通訊（stdio），不是 HTTP MCP。

---

## 2. 角色對照表（你現在的檔案）

1. MCP client（協定層）
- `backend/mcp/client.js`

2. MCP server（協定層）
- `backend/mcp/stock-server.js`

3. client-side（業務側，負責發起需求）
- `backend/src/services/groupStockAi.js`
- `backend/src/services/mcpTools.js`

4. server-side（能力側，負責實作工具）
- `backend/src/services/market/twStock.js`

---

## 3. 各檔案負責什麼

## 3.1 `backend/src/services/groupStockAi.js`（client-side 業務協調器）

1. 判斷聊天室訊息是否需要股票 AI（關鍵字、股票代號、會話狀態）
2. 整理需求參數（symbol、userQuery）
3. 呼叫 `mcpTools.execute(...)` 發出工具請求
4. 拿到工具資料後組 AI prompt，最後回覆聊天室
5. AI 失敗時走 fallback 回覆

重點：它「決定何時查、查什麼」，但不做底層股票查詢。

## 3.2 `backend/src/services/mcpTools.js`（client-side 工具橋接）

1. 提供工具宣告（給 function-calling 使用）
2. 提供統一入口 `execute(toolName, args)`
3. 內部轉呼叫 `callMCPTool(...)`

重點：它是業務流程與 MCP client 之間的薄封裝。

## 3.3 `backend/mcp/client.js`（MCP client）

1. 建立 MCP Client 實例（單例）
2. 透過 `StdioClientTransport` 啟動 `stock-server.js`
3. 呼叫 `client.callTool({ name, arguments })`
4. 接收 server 回傳並做 JSON 解析

重點：它只負責「傳需求、收結果」，不負責股票規則。

## 3.4 `backend/mcp/stock-server.js`（MCP server）

1. 註冊可用工具（ListTools）
2. 處理工具呼叫（CallTool）
3. 驗證工具名稱與必要參數
4. 呼叫 `twStock.js` 的能力函式
5. 把執行結果包成 MCP 回應格式

重點：它是能力入口與協定邊界。

## 3.5 `backend/src/services/market/twStock.js`（server-side 能力核心）

1. 查 TWSE/TPEx MIS 行情
2. 查 TWSE OpenAPI 補充欄位（PE、殖利率、PB、日 K 資訊等）
3. 依 `userQuery` 關鍵字做 API 選擇
4. 整合成 `get_stock_quote` 或 `get_stock_context` 回傳資料
5. 內建 timeout、快取、容錯

重點：真正的股票資料能力在這裡。

---

## 4. 你現在實作的 MCP 工具

在 `backend/mcp/stock-server.js` 目前有兩個工具：

1. `get_stock_quote`
- 需求：`symbol`
- 功能：回傳單檔台股報價與基礎增強欄位

2. `get_stock_context`
- 需求：`symbol`, `userQuery`
- 功能：依提問內容，回傳基礎行情 + 擴充上下文資料（例如法人、融資融券、指數）

---

## 5. 文字流程圖（端到端）

聊天室使用者輸入股票問題
-> `groupStockAi.js` 判斷要查股票
-> `mcpTools.js` 組工具呼叫
-> `mcp/client.js` 呼叫 MCP tool（stdio）
-> `mcp/stock-server.js` 接收請求
-> `twStock.js` 執行查詢與整合
-> `stock-server.js` 回傳 MCP 結果
-> `mcp/client.js` 收到結果
-> `groupStockAi.js` 產生 AI 回覆
-> Socket.IO 發回聊天室

---

## 6. 發需求 vs 提供能力（用你專案語言）

1. 發需求（client-side）
- 「幫我查 2330 現價」
- 「幫我查 2330 外資買賣超與盤勢」

2. 提供能力（server-side）
- 能把 symbol 正規化、抓行情、補 OpenAPI、依語意挑資料、回傳結構化結果

可記成一句：

1. client-side 問題導向（What to ask）
2. server-side 能力導向（How to answer）

---

## 7. client / client-side / server / server-side 差異

1. client（MCP 協定客戶端）
- 指 `backend/mcp/client.js`
- 專注在通訊與工具呼叫

2. client-side（業務發起端）
- 指 `groupStockAi.js`、`mcpTools.js`
- 專注在何時發需求、需求內容是什麼

3. server（MCP 協定伺服器）
- 指 `backend/mcp/stock-server.js`
- 專注在工具暴露、參數驗證、統一回應格式

4. server-side（能力提供端）
- 指 `twStock.js`
- 專注在資料來源整合、商業規則、容錯與效能

---
