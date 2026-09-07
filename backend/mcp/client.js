import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let mcpClient = null;

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

  const transport = new StdioClientTransport({
    command: process.env.FINMIND_MCP_COMMAND || "uvx",
    args: ["finmind-mcp"],
    env: {
      ...process.env,
      // 舊設定名稱可無痛沿用；官方 MCP 使用 FINMIND_TOKEN。
      FINMIND_TOKEN: process.env.FINMIND_TOKEN || process.env.FINMIND_API_TOKEN || "",
      // Windows 企業憑證環境可能需要使用系統憑證下載 PyPI 套件。
      UV_SYSTEM_CERTS: process.env.UV_SYSTEM_CERTS || "1",
    },
  });

  await client.connect(transport);

  mcpClient = client;

  return mcpClient;
};

