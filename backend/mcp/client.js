import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import logger from "../src/utils/logger.js";

let mcpClient = null;

const redactFinMindToken = (value) => {
  const token = process.env.FINMIND_TOKEN || process.env.FINMIND_API_TOKEN;
  const text = String(value || "").trim();
  return token ? text.replaceAll(token, "[redacted]") : text;
};

const hasFinMindToken = Boolean(
    process.env.FINMIND_TOKEN || process.env.FINMIND_API_TOKEN,
);

export const getMCPClient = async () => {
  if (mcpClient) {
    return mcpClient;
  }

  const client = new Client(
    {
      name: "chat-backend-mcp-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  const command = process.env.FINMIND_MCP_COMMAND || "uvx";
  const transport = new StdioClientTransport({
    command,
    args: ["finmind-mcp"],
    stderr: "pipe",
    env: {
      ...process.env,
      // 舊設定名稱可無痛沿用；官方 MCP 使用 FINMIND_TOKEN。
      FINMIND_TOKEN: process.env.FINMIND_TOKEN || process.env.FINMIND_API_TOKEN || "",
      // Windows 企業憑證環境可能需要使用系統憑證下載 PyPI 套件。
      UV_SYSTEM_CERTS: process.env.UV_SYSTEM_CERTS || "1",
    },
  });

  transport.stderr?.on("data", (chunk) => {
    const message = redactFinMindToken(chunk);
    if (message) {
      logger.debug(`FinMind MCP 子程序輸出：${message}`);
    }
  });
  

  logger.info(
    `啟動 FinMind MCP：command=${command}，hasFinMindToken=${hasFinMindToken}`,
  );


  try {
    await client.connect(transport);
  } catch (error) {
    logger.error(
      `FinMind MCP 連線失敗：command=${command}，${redactFinMindToken(error?.message || error)}`,
    );
    throw error;
  }

  mcpClient = client;

  return mcpClient;
};

