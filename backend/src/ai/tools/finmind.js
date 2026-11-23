import { mcpToTool } from "@google/genai";
import { getMCPClient } from "../../../mcp/client.js";

export const getFinMindGeminiTool = async () => {
  return mcpToTool(await getMCPClient());
};
