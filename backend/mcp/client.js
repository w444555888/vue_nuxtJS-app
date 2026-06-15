import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mcpClient = null;
let mcpTransport = null;

const getServerScriptPath = () => path.join(__dirname, "stock-server.js");

const initializeMCPClient = async () => {
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
    command: process.execPath,
    args: [getServerScriptPath()],
    env: process.env,
  });

  await client.connect(transport);

  mcpClient = client;
  mcpTransport = transport;

  return mcpClient;
};

export const listMCPTools = async () => {
  const client = await initializeMCPClient();
  const response = await client.listTools();
  return response?.tools || [];
};

export const callMCPTool = async (toolName, args = {}) => {
  const client = await initializeMCPClient();
  const response = await client.callTool({
    name: toolName,
    arguments: args,
  });

  if (response?.isError) {
    const firstText = response?.content?.find((item) => item?.type === "text")?.text;
    throw new Error(firstText || "MCP 工具呼叫失敗");
  }

  const firstText = response?.content?.find((item) => item?.type === "text")?.text;
  if (!firstText) {
    throw new Error("MCP 工具未返回內容");
  }

  try {
    return JSON.parse(firstText);
  } catch {
    return firstText;
  }
};

export const stopMCPServer = async () => {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
  }
  if (mcpTransport) {
    await mcpTransport.close();
    mcpTransport = null;
  }
};
