import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getTwStockQuote } from "../src/services/market/twStock.js";

// 定義工具列表
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

  if (name !== "get_stock_quote") {
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

    const quote = await getTwStockQuote(symbol);
    return {
      content: [{ type: "text", text: JSON.stringify(quote) }],
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
