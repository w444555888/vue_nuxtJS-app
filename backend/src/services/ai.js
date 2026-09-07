let geminiClient;
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

export const extractGeminiText = (response) => {
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
};

export const getGeminiClient = async () => {
  if (!geminiClient) {
    const { GoogleGenAI } = await import("@google/genai");
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }

  return geminiClient;
};

// 共用的 Gemini 文字生成入口；股票服務可透過 config 傳入 MCP tools。
export const generateAiText = async (contents, config = {}) => {
  const ai = await getGeminiClient();
  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config,
  });

  return extractGeminiText(result);
};
