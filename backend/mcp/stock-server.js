import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getTwStockQuote, selectAndFetchAPIsForContext } from "../src/services/market/twStock.js";

/**
 * 這個 MCP Server 主要負責處理台股相關的工具請求，目前定義了兩個工具：
 * 1. get_stock_quote：取得指定台股代號的最新行情資料。
 * 2. get_stock_context：根據使用者的問題，提供更完整的台股相關資訊，包括基礎行情和擴充資料。
 *
 * Server 使用標準輸入輸出（stdio）作為通訊方式，並且嚴格驗證工具名稱和參數，確保只處理預定義的工具請求。
 * 工具的輸入參數也有明確的結構定義，缺少必要參數或提供不支援的工具名稱都會返回錯誤訊息。
 * 查詢過程中如果發生任何錯誤，都會捕捉並返回適當的錯誤訊息給呼叫方。
 * 這樣的設計確保了 MCP Server 的穩定性和安全性，同時也提供了清晰的接口供其他服務調用。
 */
const tools = [
  {
    name: "get_stock_quote",
    description: "取得台股（TWSE/TPEx）最新行情。僅支援 4 碼台股代號，例如 2330、0050、6462。",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "台股代號（4 碼數字），例如 2330",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_stock_context",
    description:
      "依據使用者問題取得台股查詢上下文，回傳基礎行情與對應的擴充資料（如法人、融資融券、指數等）。",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "台股代號（4 碼數字），例如 2330",
        },
        userQuery: {
          type: "string",
          description: "使用者原始提問，用於選擇要查哪些資料",
        },
      },
      required: ["symbol", "userQuery"],
    },
  },
];

const server = new Server(
  {
    name: "tw-stock-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== "get_stock_quote" && name !== "get_stock_context") {
    return {
      content: [{ type: "text", text: `不支援的工具：${name || "unknown"}` }],
      isError: true,
    };
  }

  try {
    const symbol = args?.symbol;
    if (!symbol) {
      return {
        content: [{ type: "text", text: "缺少必要參數：symbol" }],
        isError: true,
      };
    }

    if (name === "get_stock_quote") {
      const quote = await getTwStockQuote(symbol);
      return {
        content: [{ type: "text", text: JSON.stringify(quote) }],
      };
    }

    const userQuery = String(args?.userQuery || "").trim();
    if (!userQuery) {
      return {
        content: [{ type: "text", text: "缺少必要參數：userQuery" }],
        isError: true,
      };
    }

    const contextData = await selectAndFetchAPIsForContext(symbol, userQuery);
    return {
      content: [{ type: "text", text: JSON.stringify(contextData) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `股票查詢失敗：${error?.message || "未知錯誤"}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
