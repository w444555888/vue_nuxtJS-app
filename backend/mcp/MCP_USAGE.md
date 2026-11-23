# FinMind MCP 使用說明

## 架構

本專案使用 FinMind 官方 `finmind-mcp`，由 Gemini SDK 透過 MCP stdio 連線自動呼叫工具。

聊天室訊息
-> `src/socket.js`
-> `src/services/groupStockAi.js`（應用層協調、Bot帳號、資料庫、Socket推送）
-> `src/ai/stock/trigger.js`（觸發股票 Agent）
-> `src/ai/stock/session.js`（房間 Session與追問脈絡）
-> `src/ai/stock/agent.js`（組合 Prompt、護欄、工具與模型）
-> `src/ai/tools/finmind.js`
-> `mcp/client.js`
-> FinMind 官方 `uvx finmind-mcp`
-> FinMind API
-> `src/ai/core/gemini.js`
-> 回到 `groupStockAi.js` 存檔並透過 Socket推送

`groupStockAi.js` 是應用層協調器，不放置模型實作。它負責股票 Bot帳號、聊天室會員與訊息資料庫，以及 `receive_message`／`stock_ai_status` 即時推送。

`src/ai/stock/intent.js` 集中管理股票意圖與 4 碼代號；`trigger.js` 管理觸發與結束／重置指令；`session.js` 管理 15 分鐘 Session與最近 4 輪問答摘要；`prompt.js` 管理查詢規則與Prompt；`agent.js`負責實際 Agent編排。

`mcp/client.js` 以 `uvx finmind-mcp` 啟動官方 MCP，保留既有 FinMind Token映射與 stdio連線生命週期。

`src/ai/tools/finmind.js` 透過 `mcpToTool()` 將既有 MCP Client轉成 Gemini可用工具；資料集選擇與實際工具呼叫仍由 Gemini SDK處理。

AI能力統一實作於 `src/ai/`。`src/services/groupStockAi.js` 是 Socket呼叫的應用層橋接，負責聊天室 Bot、資料庫訊息與事件推送；它不是 MCP或 Gemini實作的副本。客服 API則直接呼叫 `src/ai/agents/customerService.js`。

## 環境變數

在後端環境設定下列其中一個 Token：

- `FINMIND_TOKEN`：官方 MCP 建議名稱。
- `FINMIND_API_TOKEN`：相容既有設定，啟動時自動映射。

選用設定：

- `FINMIND_MCP_COMMAND`：覆寫 `uvx` 指令完整路徑。
- `UV_SYSTEM_CERTS=1`：Windows 公司憑證／自簽憑證網路環境下載套件時使用系統憑證。

## 安裝與驗證

請先安裝 `uv`，並確保重新啟動後端服務的終端機能執行 `uvx`。首次查詢會由 `uvx` 下載並快取 `finmind-mcp`。

### 提供其他開發者的首次設定

`uvx` 是電腦層級的工具，不應提交個人電腦的執行檔路徑到 Git。每位開發者在 clone 專案後，依作業系統安裝一次即可：

**Windows PowerShell**

```powershell
winget install --id astral-sh.uv -e --accept-package-agreements --accept-source-agreements
```

**macOS／Linux**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

安裝後關閉並重新開啟終端機，確認：

```bash
uvx --version
```

接著設定自己的 `FINMIND_TOKEN` 與 Gemini API Key，並執行 `npm install`、`npm run dev`。第一次使用股票 AI 時，`uvx finmind-mcp` 會自動下載並快取官方 MCP 套件。

除非電腦的 PATH 確實無法辨識 `uvx`，否則不要設定 `FINMIND_MCP_COMMAND`。如果必須設定，該值只能寫在個人未提交的 `.env`，不可使用或提交其他人的 Windows 路徑。

官方文件：

- https://finmind.github.io/tutor/ai/Mcp/
- https://ai.google.dev/gemini-api/docs/function-calling
