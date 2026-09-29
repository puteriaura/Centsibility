import Anthropic from "npm:@anthropic-ai/sdk@0.129.0";

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com/anthropic";

export type DeepSeekModelId = "deepseek-flash" | "deepseek-v4-pro";

export interface DeepSeekModelConfig {
  id: DeepSeekModelId;
  label: string;
  contextTokens: number;
  maxOutputTokens: number;
  vision: boolean;
}

export const DEEPSEEK_MODELS: Record<DeepSeekModelId, DeepSeekModelConfig> = {
  "deepseek-flash": {
    id: "deepseek-flash",
    label: "DeepSeek-V4.1-Flash",
    contextTokens: 1_000_000,
    maxOutputTokens: 384_000,
    vision: true,
  },
  "deepseek-v4-pro": {
    id: "deepseek-v4-pro",
    label: "DeepSeek-V4-Pro-0813",
    contextTokens: 1_000_000,
    maxOutputTokens: 384_000,
    vision: false,
  },
};

export const DEFAULT_PENNY_MAX_TOKENS = 1024;
export const DEFAULT_PENNY_MAX_TOKENS_THINKING = 4096;
export const DEFAULT_PENNY_DAILY_LIMIT = 30;
export const MAX_HISTORY_TURNS = 10;
export const MAX_MESSAGE_CHARS = 1000;

export function resolveModel(requested?: string | null, allowPro = false): DeepSeekModelId {
  const model = requested || "deepseek-flash";
  if (model === "deepseek-flash") {
    return "deepseek-flash";
  }
  if (model === "deepseek-v4-pro") {
    if (!allowPro) {
      throw new Error("Model 'deepseek-v4-pro' is not enabled. DEEPSEEK_ALLOW_PRO must be true.");
    }
    return "deepseek-v4-pro";
  }
  throw new Error(`Unknown model: "${model}". Only "deepseek-flash" and "deepseek-v4-pro" are supported.`);
}

export function clampMaxTokens(
  tokens?: number,
  modelId: DeepSeekModelId = "deepseek-flash",
  thinking = true
): number {
  const max = DEEPSEEK_MODELS[modelId]?.maxOutputTokens ?? 384_000;
  const defaultTokens = thinking ? DEFAULT_PENNY_MAX_TOKENS_THINKING : DEFAULT_PENNY_MAX_TOKENS;
  const val = tokens && Number.isFinite(tokens) && tokens > 0 ? Math.floor(tokens) : defaultTokens;
  return Math.min(Math.max(val, 1), max);
}

export function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

/**
 * Generates thinking mode parameters for Anthropic-compatible endpoint.
 * DeepSeek thinks by default, so thinking enabled sends {} (no parameters needed).
 * Anthropic schema requires budget_tokens with type: "enabled", which DeepSeek ignores.
 * When thinking is disabled, sends { thinking: { type: "disabled" } }.
 * Note: Alternative for live check if needed: { output_config: { effort: "none" } }
 */
export function thinkingParams(enabled: boolean): Record<string, unknown> {
  if (enabled) {
    return {};
  }
  return {
    thinking: {
      type: "disabled",
    },
  };
}

export const PENNY_SYSTEM_PROMPT =
  "You are Penny, a friendly and wise Islamic financial literacy companion for children using the Centsibility app. " +
  "Speak in simple, engaging, encouraging language suitable for kids. Keep your answers concise (2-4 short paragraphs maximum). " +
  "Focus on Islamic money values: Shariah-compliant saving (Qard, Hibah, Amanah), Sadaqah (charity), budgeting, and avoiding wasteful spending (Israf). " +
  "Safety rules you must strictly follow: " +
  "1. Never ask for or record any personal identification data (real full names, addresses, phone numbers, passwords, PINs, card numbers). " +
  "2. Do not give official legal or professional investment advice. " +
  "3. Always remind the child to discuss real-world money choices with their parent or guardian. " +
  "4. Politely decline questions outside money, saving, Islamic finance principles, and learning.";

export interface PennyChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface KidContext {
  balance?: number;
  goalNames?: string[];
}

export interface BuildPennyRequestParams {
  model?: string | null;
  thinking?: boolean;
  history?: PennyChatMessage[];
  message: string;
  kidContext?: KidContext;
  maxTokens?: number;
  allowPro?: boolean;
}

export function buildPennyRequest(params: BuildPennyRequestParams) {
  const {
    model: requestedModel,
    thinking = true,
    history = [],
    message,
    kidContext,
    maxTokens,
    allowPro = false,
  } = params;

  if (!message || typeof message !== "string" || message.trim() === "") {
    throw new Error("Message cannot be empty");
  }

  if (message.length > MAX_MESSAGE_CHARS) {
    throw new Error(`Message exceeds maximum length of ${MAX_MESSAGE_CHARS} characters`);
  }

  const modelId = resolveModel(requestedModel, allowPro);
  const modelConfig = DEEPSEEK_MODELS[modelId];
  const clampedTokens = clampMaxTokens(maxTokens, modelId, thinking);

  // Keep only history entries whose role is "user" or "assistant" and whose content is a non-empty string
  const validHistory = (history || []).filter(
    (h) =>
      (h.role === "user" || h.role === "assistant") &&
      typeof h.content === "string" &&
      h.content.trim() !== ""
  );

  // Take at most the last MAX_HISTORY_TURNS
  const trimmedHistory = validHistory.slice(-MAX_HISTORY_TURNS);

  for (const h of trimmedHistory) {
    if (h.content.length > MAX_MESSAGE_CHARS) {
      throw new Error(`History message exceeds maximum length of ${MAX_MESSAGE_CHARS} characters`);
    }
  }

  let system = PENNY_SYSTEM_PROMPT;
  if (kidContext) {
    const parts: string[] = [];
    if (kidContext.balance !== undefined && Number.isFinite(kidContext.balance)) {
      parts.push(`Current wallet balance: RM${kidContext.balance.toFixed(2)}`);
    }
    if (kidContext.goalNames && kidContext.goalNames.length > 0) {
      parts.push(`Active savings goals: ${kidContext.goalNames.join(", ")}`);
    }
    if (parts.length > 0) {
      system += `\n\nChild's current context: ${parts.join("; ")}.`;
    }
  }

  const rawList: { role: "user" | "assistant"; content: string }[] = [
    ...trimmedHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    {
      role: "user" as const,
      content: message.trim(),
    },
  ];

  // Drop assistant turns from the front until the first user turn
  let firstUserIdx = 0;
  while (firstUserIdx < rawList.length && rawList[firstUserIdx].role !== "user") {
    firstUserIdx++;
  }
  const fromFirstUser = rawList.slice(firstUserIdx);

  // Merge consecutive turns with the same role into one turn, joining their text with "\n\n"
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const item of fromFirstUser) {
    if (messages.length > 0 && messages[messages.length - 1].role === item.role) {
      messages[messages.length - 1].content += `\n\n${item.content}`;
    } else {
      messages.push({ role: item.role, content: item.content });
    }
  }

  // Token budget estimation check
  const estimatedInputTokens =
    estimateTokens(system) +
    messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  if (estimatedInputTokens + clampedTokens > modelConfig.contextTokens) {
    throw new Error("Input context exceeds model token limit");
  }

  return {
    model: modelId,
    max_tokens: clampedTokens,
    system,
    messages,
    ...thinkingParams(thinking),
  };
}

export function extractReplyText(response: { content?: Array<{ type: string; text?: string }> }): string {
  if (!response?.content || !Array.isArray(response.content)) {
    return "";
  }
  return response.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
}

export function createClient(apiKey: string): Anthropic {
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("API key is required to create DeepSeek Anthropic client");
  }
  return new Anthropic({
    apiKey: apiKey.trim(),
    baseURL: DEEPSEEK_BASE_URL,
  });
}
