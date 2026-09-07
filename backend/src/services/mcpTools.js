import { mcpToTool } from "@google/genai";
import { getMCPClient } from "../../mcp/client.js";

export const mcpTools = {
  getGeminiTool: async () => mcpToTool(await getMCPClient()),
};

export default mcpTools;
