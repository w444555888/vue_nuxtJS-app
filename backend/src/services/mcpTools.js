import { callMCPTool } from "../../mcp/client.js";

export const mcpTools = {
  // Gemini function-calling 需要 declarations，這裡維持既有定義格式。
  definitions: [
    {
      name: "get_stock_quote",
      description: "取得台股（TWSE/TPEx）最新行情。僅支援 4 碼台股代號，例如 2330、0050、6462。",
      parameters: {
        type: "OBJECT",
        properties: {
          symbol: {
            type: "STRING",
            description: "台股代號（4 碼數字），例如 2330",
          },
        },
        required: ["symbol"],
      },
    },
  ],

  execute: async (toolName, args) => {
    return callMCPTool(toolName, args || {});
  },
};

export default mcpTools;
