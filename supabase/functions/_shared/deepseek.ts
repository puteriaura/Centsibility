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
  "You are Penny, an energetic, fun, and wise Islamic financial literacy mascot for kids using the Centsibility app (RM currency). " +
  "Writing style rules you must strictly follow: " +
  "1. NEVER use em dashes (—) or en dashes (–). Use plain commas, periods, or parentheses instead. " +
  "2. NEVER begin replies with AI clichés like 'Got it', 'Certainly', 'Sure thing', or 'As an AI'. Dive straight into your thoughts. " +
  "3. Tone: For kid users, be playful, witty, and fun, with tasteful youth slang and light brainrot humor (such as 'W move', 'saving is lowkey OP', 'gigachad saver', 'rizz up your savings', 'no cap') while staying wholesome, age-appropriate, and financially sound. For parents, be clear, warm, and helpful. " +
  "4. Keep explanations punchy and concise (2 to 3 short paragraphs maximum). " +
  "5. Ground your answers in Islamic money values: Shariah-compliant saving (Qard, Hibah, Amanah), Sadaqah (charity and giving back), budgeting, and avoiding wasteful spending (Israf). " +
  "6. Safety rules: " +
  "- Never ask for or store private credentials (passwords, PINs, card numbers, addresses, emails). " +
  "- Do not give formal legal or investment advice. " +
  "- Remind children to discuss big money decisions with their parents.";

export interface PennyChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface KidGoalSummary {
  name: string;
  target: number;
  saved: number;
}

export interface KidLoanSummary {
  amount: number;
  repaid: number;
  status: string;
}

export interface KidRewardSummary {
  name: string;
  cost: number;
  status: string;
}

export interface KidTxSummary {
  label: string;
  amount: number;
  type: string;
  category?: string;
  date: string;
}

export function categoryKey(type: string, label: string): string {
  if (type === "FEE") return "FEE";
  if (type === "QARD_REPAY" || (type === "QARD" && label === "Loan repayment")) {
    return "QARD_REPAY";
  }
  if (type === "GOAL_IN") return "GOAL_IN";
  if (type === "WITHDRAWAL" || type === "SADAQAH" || type === "INVEST_IN") {
    return type;
  }
  const lower = (label || "").toLowerCase();
  if (lower.includes("food") || lower.includes("snack")) {
    return "FOOD";
  }
  if (lower.includes("transport") || lower.includes("grab")) {
    return "TRANSPORT";
  }
  return type || "OTHER";
}

export function categoryLabel(key: string): string {
  if (key === "FOOD") return "Food & beverage";
  if (key === "TRANSPORT") return "Transportation";
  if (key === "WITHDRAWAL") return "Withdrawals";
  if (key === "SADAQAH") return "Sadaqah";
  if (key === "INVEST_IN") return "Investments";
  if (key === "FEE") return "Fees";
  if (key === "QARD_REPAY" || key === "QARD") return "Loan repayments";
  if (key === "GOAL_IN") return "Savings goals";
  if (key === "DEPOSIT") return "Deposits";
  return key;
}

const DEBIT_TYPES = new Set(["WITHDRAWAL", "SADAQAH", "INVEST_IN", "FEE", "QARD_REPAY", "GOAL_IN"]);
const POT_ONLY_TYPES = new Set(["INVEST_GAIN", "INVEST_LOSS"]);
const SAVINGS_MOVE_TYPES = new Set(["INVEST_IN", "GOAL_IN"]);

export function isSpendingTransaction(type: string, label?: string | null): boolean {
  if (POT_ONLY_TYPES.has(type)) return false;
  const isDebit = DEBIT_TYPES.has(type) || (type === "QARD" && label === "Loan repayment");
  if (!isDebit) return false;
  if (SAVINGS_MOVE_TYPES.has(type)) return false;
  return true;
}

export interface KidContext {
  name?: string;
  balance?: number;
  coins?: number;
  investBalance?: number;
  streakDays?: number;
  goals?: KidGoalSummary[];
  loans?: KidLoanSummary[];
  rewards?: KidRewardSummary[];
  recentTransactions?: KidTxSummary[];
  topSpendingCategories?: { category: string; amount: number }[];
  /** Legacy support */
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
    if (kidContext.name) {
      parts.push(`Child name: ${kidContext.name}`);
    }
    if (kidContext.balance !== undefined && Number.isFinite(kidContext.balance)) {
      parts.push(`Current wallet balance: RM${kidContext.balance.toFixed(2)}`);
    }
    if (kidContext.investBalance !== undefined && Number.isFinite(kidContext.investBalance)) {
      parts.push(`Growth pot balance: RM${kidContext.investBalance.toFixed(2)}`);
    }
    if (kidContext.coins !== undefined && Number.isFinite(kidContext.coins)) {
      parts.push(`Reward points: ${Math.round(kidContext.coins)}`);
    }
    if (kidContext.streakDays !== undefined && kidContext.streakDays > 0) {
      parts.push(`Daily streak: ${kidContext.streakDays} days`);
    }
    if (kidContext.goals && kidContext.goals.length > 0) {
      const gList = kidContext.goals.map((g) => `${g.name} (saved RM${g.saved.toFixed(2)} of RM${g.target.toFixed(2)})`).join(", ");
      parts.push(`Active goals: ${gList}`);
    } else if (kidContext.goalNames && kidContext.goalNames.length > 0) {
      parts.push(`Active savings goals: ${kidContext.goalNames.join(", ")}`);
    }
    if (kidContext.loans && kidContext.loans.length > 0) {
      const lList = kidContext.loans.map((l) => `RM${l.amount.toFixed(2)} loan (${l.status}, repaid RM${l.repaid.toFixed(2)})`).join(", ");
      parts.push(`Loans (Qard): ${lList}`);
    }
    if (kidContext.rewards && kidContext.rewards.length > 0) {
      const rList = kidContext.rewards.map((r) => `${r.name} (${r.cost} pts, ${r.status})`).join(", ");
      parts.push(`Rewards: ${rList}`);
    }
    if (kidContext.topSpendingCategories && kidContext.topSpendingCategories.length > 0) {
      const catList = kidContext.topSpendingCategories.map((c) => `${c.category}: RM${c.amount.toFixed(2)}`).join(", ");
      parts.push(`Top spending categories: ${catList}`);
    }
    if (kidContext.recentTransactions && kidContext.recentTransactions.length > 0) {
      const txList = kidContext.recentTransactions.slice(0, 5).map((t) => `${t.label} (RM${t.amount.toFixed(2)} ${t.type})`).join(", ");
      parts.push(`Recent transactions: ${txList}`);
    }
    if (parts.length > 0) {
      system += `\n\nChild's live financial status (non-private): ${parts.join("; ")}.`;
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
