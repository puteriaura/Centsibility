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

export class PennyError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PennyError";
    this.status = status;
  }
}

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

// ---------------------------------------------------------------------------
// Prompts (T27)
// ---------------------------------------------------------------------------

export function kidSystemPrompt(ageGroup?: string | null): string {
  const base =
`You are Penny, the money buddy inside Centsibility, a Malaysian family money app (currency RM). You coach a child.
Jobs:
- TEACH: explain money ideas (saving, budgeting, needs and wants, interest, loans and fees, sadaqah and zakat) in simple words for the child's age group, with one small everyday example in RM.
- IMPROVE: give one or two specific, doable tips based only on the child's data. Say the real numbers. Never shame or scold.
- PRAISE: when the data shows a real win (Tabung progress, a saving streak, spending less than last week, a finished quest), name that exact win.
- SUMMARISE: when asked, summarise the week or month (spending, saving, giving, progress), then give one takeaway and one next step.

Grounding: use only numbers and names from "Child's data". If something isn't there, say you don't have it yet. Never invent amounts, dates, Tabung or quests.

Limits: no investment, legal or religious rulings. For religious questions, give the simple general idea and suggest asking a parent or an ustaz. Encourage talking to a parent before big money decisions. Never ask for passwords, PINs, codes, addresses or emails. If the child is in the middle of a quest question they have not answered yet, give a hint, never the answer.

Words: say "Tabung" for savings pots. Never write internal codes or words joined with underscores.

Rules: Centsibility Funds move up and down at random each update, like a real market; nobody can predict them. Explain results simply. Never present them as real investing advice. Market Tracker follows real prices. Explain price moves in simple words. Never give buy or sell advice, never predict prices, never say an investment is a good or bad choice.

Style: no em dashes or en dashes. Never open with "Got it", "Sure", "Certainly", "Absolutely", "Great question" or similar; start with the answer. Markdown: short paragraphs, bullet points allowed, bold for key numbers, no tables or headings. Under 120 words, or under 180 for a summary.`;

  let tone = "";
  if (ageGroup === "6-9") {
    tone = "Tone: very simple words, short sentences, cheerful and gentle, at most one emoji.";
  } else if (ageGroup === "13-17") {
    tone = "Tone: light brainrot-flavoured teen slang (\"no cap\", \"W\", \"lowkey OP\", \"aura points\"), still respectful, accurate and never mean.";
  } else {
    tone = "Tone: playful and upbeat with light slang (\"W move\", \"lowkey smart\"), clear steps.";
  }

  return `${base}\n\n${tone}`;
}

export function parentSystemPrompt(): string {
  return `You are Penny, the family money coach inside Centsibility (Malaysia, RM), talking to a parent.
Jobs:
- explain each child's habits using only the data below;
- suggest practical guidance: allowance structure, Tabung targets, giving habits, loan limits;
- offer 2 or 3 short conversation starters when useful;
- summarise the week or month on request, with one takeaway and one next step.

Grounding: use only the data below and say when something is missing. Refer to children only by the names given.

Limits: no investment, legal or religious rulings; general educational guidance only; suggest a qualified professional or an ustaz where needed. Never shame the child.

Style: calm, clear and warm. No em or en dashes, no filler openers, markdown with short paragraphs and bullets, no tables, under 180 words unless asked for more. Never write internal codes or underscores.`;
}

// Backwards compatibility export
export const PENNY_SYSTEM_PROMPT = kidSystemPrompt();

// ---------------------------------------------------------------------------
// Reply Sanitizer (T27)
// ---------------------------------------------------------------------------

export function sanitizePennyReply(text: string): string {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;

  // 1. Replace em/en dashes with comma space
  cleaned = cleaned.replace(/ — /g, ", ")
                   .replace(/—/g, ", ")
                   .replace(/ – /g, ", ")
                   .replace(/–/g, ", ");

  // Tidy double spaces and doubled commas
  cleaned = cleaned.replace(/ +/g, " ");
  cleaned = cleaned.replace(/,\s*,/g, ",");
  cleaned = cleaned.replace(/,\s+/g, ", ");

  // 2. Drop leading filler opener and capitalise what is left
  const fillerRegex = /^\s*(got it|sure thing|sure|certainly|absolutely|of course|great question|as an ai)\b[\s,.!:;-]*/i;
  cleaned = cleaned.replace(fillerRegex, "").trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // 3. Replace code tokens (UPPER_SNAKE or lower_snake) with human labels
  cleaned = cleaned.replace(/\b[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+\b/g, (token) => {
    const upper = token.toUpperCase();
    const mapped = typeLabel(upper);
    if (mapped && !mapped.includes("_")) {
      return mapped;
    }
    return token.replace(/_/g, " ");
  });

  // Tidy any remaining underscores
  cleaned = cleaned.replace(/_/g, " ");

  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// Helpers and Types
// ---------------------------------------------------------------------------

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
  dueDate?: string | null;
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
  if (type === "WITHDRAWAL" || type === "SADAQAH" || type === "INVEST_IN" || type === "TRANSFER_OUT") {
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

// keep in sync with src/lib/labels.ts
export function typeLabel(type: string): string {
  const map: Record<string, string> = {
    DEPOSIT: "Deposit",
    WITHDRAWAL: "Withdrawal",
    HIBAH: "Hibah",
    QARD: "Qard loan",
    QARD_REPAY: "Loan repayment",
    FEE: "Loan fee",
    SADAQAH: "Sadaqah",
    GOAL_IN: "Tabung deposit",
    GOAL_OUT: "Back from Tabung",
    INVEST_IN: "Moved to Investment",
    INVEST_OUT: "Back from Investment",
    INVEST_GAIN: "Investment profit",
    INVEST_LOSS: "Investment loss",
    TRANSFER_IN: "Transfer received",
    TRANSFER_OUT: "Transfer sent",
  };
  if (type in map) return map[type];
  const human = type.replace(/[_-]+/g, " ").trim().toLowerCase();
  return human ? human.charAt(0).toUpperCase() + human.slice(1) : type;
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
  if (key === "TRANSFER_OUT") return "Transfers";
  const human = key.replace(/[_-]+/g, " ").trim().toLowerCase();
  return human ? human.charAt(0).toUpperCase() + human.slice(1) : key;
}

const DEBIT_TYPES = new Set(["WITHDRAWAL", "SADAQAH", "INVEST_IN", "FEE", "QARD_REPAY", "GOAL_IN", "TRANSFER_OUT"]);
const POT_ONLY_TYPES = new Set(["INVEST_GAIN", "INVEST_LOSS"]);
const SAVINGS_MOVE_TYPES = new Set(["INVEST_IN", "GOAL_IN"]);

export function isSpendingTransaction(type: string, label?: string | null): boolean {
  if (POT_ONLY_TYPES.has(type)) return false;
  const isDebit = DEBIT_TYPES.has(type) || (type === "QARD" && label === "Loan repayment");
  if (!isDebit) return false;
  if (SAVINGS_MOVE_TYPES.has(type)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Week boundaries in Malaysia Time (UTC+8)
// ---------------------------------------------------------------------------

export function getMytDateInfo(d: Date = new Date()) {
  const mytMs = d.getTime() + 8 * 3600 * 1000;
  const myt = new Date(mytMs);
  const year = myt.getUTCFullYear();
  const month = myt.getUTCMonth();
  const date = myt.getUTCDate();
  const dow = myt.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const daysSinceMon = (dow + 6) % 7;

  // Monday 00:00:00 MYT of this week in UTC ms
  const thisWeekStartMs = Date.UTC(year, month, date - daysSinceMon, 0, 0, 0, 0) - 8 * 3600 * 1000;
  const lastWeekStartMs = thisWeekStartMs - 7 * 86400 * 1000;
  const lastWeekEndMs = thisWeekStartMs;
  const thisMonthStartMs = Date.UTC(year, month, 1, 0, 0, 0, 0) - 8 * 3600 * 1000;

  return {
    nowMs: d.getTime(),
    thisWeekStartMs,
    lastWeekStartMs,
    lastWeekEndMs,
    thisMonthStartMs,
  };
}

// ---------------------------------------------------------------------------
// Kid Coach Context Builder (T27 Section 3)
// ---------------------------------------------------------------------------

export interface OpenInvestmentContext {
  mode: string;
  tier?: string;
  symbol?: string;
  principal: number;
  currentValue: number | null;
  profitPct: number | null;
  endsAt?: string;
}

export interface BuildKidCoachContextInput {
  ageGroup?: string | null;
  name?: string | null; // comfort_name only
  balance?: number;
  investBalance?: number;
  investmentsValue?: number | null;
  investments?: OpenInvestmentContext[];
  coins?: number;
  streakDays?: number;
  goals?: Array<{ name: string; target: number; saved: number }>;
  loans?: Array<{ amount: number; repaid: number; status: string }>;
  transactions?: Array<{ type: string; amount: number; label: string; created_at: string }>;
  questCompletions?: Array<{ title: string; completedAt: string }>;
  questsCompletedCount?: number;
  nextQuestTitle?: string | null;
  now?: Date;
}

export interface BirthdayCheckResult {
  allowed: boolean;
  error?: string;
  updates?: { birth_date?: string; birth_year?: number };
}

export function validateBirthdayUpdate(
  existing: { birth_date?: string | null; birth_year?: number | null },
  params: { birth_date?: unknown; birth_year?: unknown },
  now: Date = new Date()
): BirthdayCheckResult {
  const updates: { birth_date?: string; birth_year?: number } = {};

  if (params.birth_date !== undefined || params.birth_year !== undefined) {
    if (existing.birth_date || existing.birth_year) {
      const newDate = typeof params.birth_date === "string" ? params.birth_date.trim() : "";
      const newYear = params.birth_year !== undefined && params.birth_year !== null && params.birth_year !== "" ? Number(params.birth_year) : undefined;
      const sameDate = !newDate || newDate === (existing.birth_date ?? "");
      const sameYear = newYear === undefined || isNaN(newYear) || newYear === Number(existing.birth_year);
      if (!sameDate || !sameYear) {
        return { allowed: false, error: "Your birthday is already set. Ask your parent to change it." };
      }
    } else {
      const bDate = typeof params.birth_date === "string" ? params.birth_date.trim() : "";
      if (bDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bDate)) {
          return { allowed: false, error: "Birth date must be in YYYY-MM-DD format." };
        }
        const parsed = new Date(bDate + "T00:00:00Z");
        if (isNaN(parsed.getTime())) return { allowed: false, error: "Invalid birth date." };
        let age = now.getUTCFullYear() - parsed.getUTCFullYear();
        const m = now.getUTCMonth() - parsed.getUTCMonth();
        if (m < 0 || (m === 0 && now.getUTCDate() < parsed.getUTCDate())) age--;
        if (age < 4 || age > 18) return { allowed: false, error: "Age must be between 4 and 18." };
        updates.birth_date = bDate;
        updates.birth_year = parsed.getUTCFullYear();
      } else if (params.birth_year !== undefined) {
        const by = Number(params.birth_year);
        if (isNaN(by)) return { allowed: false, error: "Invalid birth year." };
        updates.birth_year = by;
      }
    }
  }

  return { allowed: true, updates };
}

export function buildKidCoachContext(data: BuildKidCoachContextInput): string[] {
  const lines: string[] = [];

  if (data.name) {
    lines.push(`Name: ${data.name}`);
  }

  // 1. Age group
  lines.push(`Age group: ${data.ageGroup || "not available yet"}`);

  // 2. Balances
  // keep in sync with src/lib/finance.ts getBalanceSummary
  const spendingCents = Math.round((Number(data.balance) || 0) * 100);
  const investmentCents = Math.round((Number(data.investmentsValue ?? data.investBalance) || 0) * 100);
  const tabungCents = (data.goals || []).reduce((acc, g) => acc + Math.round((Number(g.saved) || 0) * 100), 0);
  const totalCents = spendingCents + tabungCents + investmentCents;
  const owedCents = (data.loans || [])
    .filter((l) => l.status === "active")
    .reduce((acc, l) => {
      const amt = Math.round((Number(l.amount) || 0) * 100);
      const rep = Math.round((Number(l.repaid) || 0) * 100);
      return acc + Math.max(0, amt - rep);
    }, 0);

  const spending = spendingCents / 100;
  const tabung = tabungCents / 100;
  const investment = investmentCents / 100;
  const total = totalCents / 100;
  const owed = owedCents / 100;

  if (data.investmentsValue === null) lines.push("Investment and total value unavailable: a market quote is missing. Do not infer the entry price as today’s value.");
  else lines.push(`Spending balance: RM${spending.toFixed(2)}, Tabung: RM${tabung.toFixed(2)}, Investment: RM${investment.toFixed(2)}, Total: RM${total.toFixed(2)}`);

  // 3. What is owed on loans
  lines.push(`Owed on loans: RM${owed.toFixed(2)}`);

  // Open investments
  if (data.investments && data.investments.length > 0) {
    for (const inv of data.investments) {
      const modeStr = inv.mode === "fund" ? `Centsibility Fund (${inv.tier || "Standard"})` : `Market Tracker (${inv.symbol || ""})`;
      lines.push(`Investment ${modeStr}: put in RM${inv.principal.toFixed(2)}, value now RM${(inv.currentValue === null ? "unavailable" : inv.currentValue.toFixed(2))} (${(inv.profitPct ?? 0) >= 0 ? "+" : ""}${(inv.profitPct === null ? "unavailable" : inv.profitPct.toFixed(2))}%), ends ${inv.endsAt || "unknown"}`);
    }
  }

  // 4. Each Tabung as "name: RM saved of RM target (NN%)"
  if (data.goals && data.goals.length > 0) {
    for (const g of data.goals) {
      const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 100;
      const cleanName = (g.name || "Goal").replace(/_/g, " ");
      lines.push(`Tabung ${cleanName}: RM${g.saved.toFixed(2)} saved of RM${g.target.toFixed(2)} target (${pct}%)`);
    }
  } else {
    lines.push("Tabung: not available yet");
  }

  // 5. This week and last week calculations (Malaysia time)
  const txs = data.transactions || [];
  const { nowMs, thisWeekStartMs, lastWeekStartMs, lastWeekEndMs, thisMonthStartMs } = getMytDateInfo(data.now);

  let spentThisWeek = 0;
  let spentLastWeek = 0;
  let moneyInThisWeek = 0;
  let moneyInLastWeek = 0;
  let savedToTabungThisWeek = 0;
  let savedToTabungLastWeek = 0;
  let sadaqahThisMonth = 0;

  const thisWeekCatTotals: Record<string, number> = {};

  for (const t of txs) {
    const tMs = new Date(t.created_at).getTime();
    const typeStr = String(t.type || "");
    const labelStr = String(t.label || "");
    const amt = Number(t.amount) || 0;

    const inThisWeek = tMs >= thisWeekStartMs && tMs <= nowMs;
    const inLastWeek = tMs >= lastWeekStartMs && tMs < lastWeekEndMs;
    const inThisMonth = tMs >= thisMonthStartMs && tMs <= nowMs;

    // Spending
    if (isSpendingTransaction(typeStr, labelStr)) {
      if (inThisWeek) {
        spentThisWeek += amt;
        const cKey = categoryKey(typeStr, labelStr);
        const cLabel = categoryLabel(cKey).replace(/_/g, " ");
        thisWeekCatTotals[cLabel] = (thisWeekCatTotals[cLabel] || 0) + amt;
      }
      if (inLastWeek) {
        spentLastWeek += amt;
      }
    }

    // Money In
    const isMoneyIn = ["DEPOSIT", "HIBAH", "GOAL_OUT", "INVEST_OUT", "TRANSFER_IN"].includes(typeStr) ||
                      (typeStr === "QARD" && labelStr !== "Loan repayment");
    if (isMoneyIn) {
      if (inThisWeek) moneyInThisWeek += amt;
      if (inLastWeek) moneyInLastWeek += amt;
    }

    // Saved to Tabung (GOAL_IN)
    if (typeStr === "GOAL_IN") {
      if (inThisWeek) savedToTabungThisWeek += amt;
      if (inLastWeek) savedToTabungLastWeek += amt;
    }

    // Sadaqah this month
    if (typeStr === "SADAQAH" && inThisMonth) {
      sadaqahThisMonth += amt;
    }
  }

  lines.push(`This week: spent RM${spentThisWeek.toFixed(2)}, money in RM${moneyInThisWeek.toFixed(2)}, saved to Tabung RM${savedToTabungThisWeek.toFixed(2)}`);
  lines.push(`Last week: spent RM${spentLastWeek.toFixed(2)}, money in RM${moneyInLastWeek.toFixed(2)}, saved to Tabung RM${savedToTabungLastWeek.toFixed(2)}`);

  const topCats = Object.entries(thisWeekCatTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amount]) => `${cat} (RM${amount.toFixed(2)})`);

  lines.push(`Top spending categories this week: ${topCats.length > 0 ? topCats.join(", ") : "none yet"}`);
  lines.push(`Sadaqah this month: RM${sadaqahThisMonth.toFixed(2)}`);

  // 6. Streaks
  lines.push(`Daily streak: ${data.streakDays || 0} days`);

  // Saving streak: consecutive weeks with any Tabung deposit, ending this week or last week
  const hasDepositInWeek = (startMs: number, endMs: number) => {
    return txs.some((t) => {
      if (t.type !== "GOAL_IN") return false;
      const ms = new Date(t.created_at).getTime();
      return ms >= startMs && ms < endMs;
    });
  };

  const hasThisWeek = txs.some((t) => {
    if (t.type !== "GOAL_IN") return false;
    const ms = new Date(t.created_at).getTime();
    return ms >= thisWeekStartMs && ms <= nowMs;
  });

  let savingStreak = 0;
  let nextCheckWeek = 0;
  if (hasThisWeek) {
    savingStreak = 1;
    nextCheckWeek = 1;
  } else if (hasDepositInWeek(lastWeekStartMs, lastWeekEndMs)) {
    savingStreak = 1;
    nextCheckWeek = 2;
  }

  if (savingStreak > 0) {
    while (nextCheckWeek <= 5) {
      const wStart = thisWeekStartMs - nextCheckWeek * 7 * 86400 * 1000;
      const wEnd = wStart + 7 * 86400 * 1000;
      if (hasDepositInWeek(wStart, wEnd)) {
        savingStreak++;
        nextCheckWeek++;
      } else {
        break;
      }
    }
  }

  lines.push(`Saving streak: ${savingStreak} week${savingStreak === 1 ? "" : "s"}`);
  lines.push(`Reward points: ${data.coins !== undefined ? Math.round(data.coins) : "not available yet"}`);

  // 7. Quests
  const questsCount = data.questsCompletedCount !== undefined ? data.questsCompletedCount : "not available yet";
  lines.push(`Quests completed: ${questsCount}`);

  if (data.questCompletions && data.questCompletions.length > 0) {
    const recentQuests = data.questCompletions.slice(0, 3).map((q) => {
      const titleClean = (q.title || "Quest").replace(/_/g, " ");
      return `${titleClean} (${q.completedAt})`;
    });
    lines.push(`Recent completed quests: ${recentQuests.join(", ")}`);
  }

  lines.push(`Next quest: ${data.nextQuestTitle ? data.nextQuestTitle.replace(/_/g, " ") : "not available yet"}`);

  // Privacy: transfer rows described by type only, comfort_name only, no _ anywhere
  return lines.map((l) => l.replace(/_/g, " "));
}

// ---------------------------------------------------------------------------
// Parent Coach Context Builder (T27 Section 4)
// ---------------------------------------------------------------------------

export interface ParentCoachKidData {
  comfortName?: string | null;
  ageGroup?: string | null;
  spending: number;
  tabung: number;
  growth?: number;
  investments?: number;
  investmentsList?: OpenInvestmentContext[];
  spentThisWeek: number;
  spentLastWeek: number;
  topCategoryThisWeek?: string | null;
  savedThisWeek: number;
  sadaqahThisMonth: number;
  questsCompleted: number;
  activeLoanCount: number;
  overdueLoanCount: number;
  pendingRequestsCount: number;
}

export interface BuildParentCoachContextInput {
  parentComfortName?: string | null;
  kids: ParentCoachKidData[];
}

export function buildParentCoachContext(data: BuildParentCoachContextInput): string[] {
  const lines: string[] = [];

  if (data.parentComfortName && data.parentComfortName.trim()) {
    lines.push(`Parent: ${data.parentComfortName.trim().replace(/_/g, " ")}`);
  }

  const kidsList = (data.kids || []).slice(0, 6);
  if (kidsList.length === 0) {
    lines.push("Children: none registered yet");
  }

  kidsList.forEach((k, idx) => {
    const identifier = (k.comfortName && k.comfortName.trim())
      ? k.comfortName.trim().replace(/_/g, " ")
      : `Child ${idx + 1}`;

    lines.push(`--- ${identifier} ---`);
    lines.push(`Age group: ${k.ageGroup || "not available yet"}`);
    lines.push(`Spending: RM${(Number(k.spending) || 0).toFixed(2)}, Tabung: RM${(Number(k.tabung) || 0).toFixed(2)}, Investment: RM${(Number(k.investments ?? k.growth) || 0).toFixed(2)}`);
    if (k.investmentsList && k.investmentsList.length > 0) {
      for (const inv of k.investmentsList) {
        const modeStr = inv.mode === "fund" ? `Centsibility Fund (${inv.tier || "Standard"})` : `Market Tracker (${inv.symbol || ""})`;
        lines.push(`Investment ${modeStr}: put in RM${inv.principal.toFixed(2)}, value now RM${(inv.currentValue === null ? "unavailable" : inv.currentValue.toFixed(2))} (${(inv.profitPct ?? 0) >= 0 ? "+" : ""}${(inv.profitPct === null ? "unavailable" : inv.profitPct.toFixed(2))}%), ends ${inv.endsAt || "unknown"}`);
      }
    }
    lines.push(`Spent this week: RM${(Number(k.spentThisWeek) || 0).toFixed(2)}, Spent last week: RM${(Number(k.spentLastWeek) || 0).toFixed(2)}`);
    lines.push(`Top category this week: ${(k.topCategoryThisWeek || "none").replace(/_/g, " ")}`);
    lines.push(`Saved this week: RM${(Number(k.savedThisWeek) || 0).toFixed(2)}`);
    lines.push(`Sadaqah this month: RM${(Number(k.sadaqahThisMonth) || 0).toFixed(2)}`);
    lines.push(`Quests completed: ${k.questsCompleted}`);
    lines.push(`Loans: ${k.activeLoanCount} active, ${k.overdueLoanCount} overdue`);
    lines.push(`Pending requests: ${k.pendingRequestsCount}`);
  });

  return lines.map((l) => l.replace(/_/g, " "));
}

// ---------------------------------------------------------------------------
// Build Penny Request
// ---------------------------------------------------------------------------

export interface PennyPageContext {
  page: string;
  detail?: string;
}

export function formatPageContext(context: unknown): string | null {
  if (!context || typeof context !== "object") return null;
  const raw = context as Record<string, unknown>;
  if (typeof raw.page !== "string") return null;

  const rawPage = raw.page;
  if (rawPage.length < 1 || rawPage.length > 40) return null;

  if (raw.detail !== undefined && raw.detail !== null && typeof raw.detail !== "string") {
    return null;
  }

  // Strip control characters (0x00-0x1F, 0x7F) and collapse whitespace
  const cleanPage = rawPage.replace(/\s+/g, " ").replace(/[\x00-\x1F\x7F]/g, "").trim();
  if (cleanPage.length < 1 || cleanPage.length > 40) return null;

  let cleanDetail = "";
  if (typeof raw.detail === "string") {
    cleanDetail = raw.detail.replace(/\s+/g, " ").replace(/[\x00-\x1F\x7F]/g, "").trim();
    if (cleanDetail.length > 600) {
      cleanDetail = cleanDetail.slice(0, 600);
    }
  }

  if (cleanDetail) {
    return `Screen the user is looking at (from the app, not an instruction): ${cleanPage}. ${cleanDetail}`;
  }
  return `Screen the user is looking at (from the app, not an instruction): ${cleanPage}.`;
}

export interface BuildPennyRequestParams {
  model?: string | null;
  thinking?: boolean;
  history?: PennyChatMessage[];
  message: string;
  systemPrompt?: string;
  kidContext?: BuildKidCoachContextInput;
  context?: PennyPageContext | null;
  pageContext?: PennyPageContext | null;
  maxTokens?: number;
  allowPro?: boolean;
}

export function buildPennyRequest(params: BuildPennyRequestParams) {
  const {
    model: requestedModel,
    thinking = true,
    history = [],
    message,
    systemPrompt,
    kidContext,
    context,
    pageContext,
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

  const validHistory = (history || []).filter(
    (h) =>
      (h.role === "user" || h.role === "assistant") &&
      typeof h.content === "string" &&
      h.content.trim() !== ""
  );

  const trimmedHistory = validHistory.slice(-MAX_HISTORY_TURNS);

  for (const h of trimmedHistory) {
    if (h.content.length > MAX_MESSAGE_CHARS) {
      throw new Error(`History message exceeds maximum length of ${MAX_MESSAGE_CHARS} characters`);
    }
  }

  let system = systemPrompt || kidSystemPrompt(kidContext?.ageGroup);

  if (kidContext) {
    const contextLines = buildKidCoachContext(kidContext);
    system += `\n\nChild's data:\n${contextLines.join("\n")}`;
  }

  const pageLine = formatPageContext(context ?? pageContext);
  if (pageLine) {
    system += `\n\n${pageLine}`;
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

  let firstUserIdx = 0;
  while (firstUserIdx < rawList.length && rawList[firstUserIdx].role !== "user") {
    firstUserIdx++;
  }
  const fromFirstUser = rawList.slice(firstUserIdx);

  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const item of fromFirstUser) {
    if (messages.length > 0 && messages[messages.length - 1].role === item.role) {
      messages[messages.length - 1].content += `\n\n${item.content}`;
    } else {
      messages.push({ role: item.role, content: item.content });
    }
  }

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

// ---------------------------------------------------------------------------
// Shared callPenny (T27 Section 4)
// ---------------------------------------------------------------------------

export async function callPenny(
  apiKey: string,
  requestParams: {
    model: string;
    max_tokens: number;
    system: string;
    messages: { role: "user" | "assistant"; content: string }[];
    thinking?: Record<string, unknown>;
    [key: string]: unknown;
  }
): Promise<{ reply: string; model: string; thinking: boolean }> {
  let response;
  try {
    const client = createClient(apiKey);
    response = await client.messages.create(
      requestParams as unknown as Parameters<typeof client.messages.create>[0],
      { timeout: 30000 }
    );
  } catch (err: unknown) {
    const errObj = err as { status?: number; name?: string; message?: string };
    if (errObj?.status === 401) {
      console.error("Penny AI is misconfigured (401 from provider)");
      throw new PennyError("Penny AI is misconfigured", 502);
    }
    if (errObj?.status === 429) {
      console.warn("Penny AI rate limited (429 from provider)");
      throw new PennyError("Penny is busy, try again soon", 503);
    }
    if (
      errObj?.name === "AbortError" ||
      errObj?.name === "APIConnectionTimeoutError" ||
      errObj?.message?.toLowerCase().includes("timeout")
    ) {
      console.warn("Penny AI request timed out");
      throw new PennyError("Penny timed out, try again soon", 504);
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("DeepSeek call failed:", msg);
    throw new PennyError("Penny AI service error", 500);
  }

  const rawReply = extractReplyText(response as { content?: Array<{ type: string; text?: string }> });
  if (!rawReply || rawReply.trim() === "") {
    throw new PennyError("Penny couldn't finish that answer", 502);
  }

  const reply = sanitizePennyReply(rawReply);
  if (!reply || reply.trim() === "") {
    throw new PennyError("Penny couldn't finish that answer", 502);
  }

  const isThinking = requestParams.thinking === undefined ||
    (typeof requestParams.thinking === "object" && Object.keys(requestParams.thinking as object).length === 0);

  return {
    reply,
    model: requestParams.model,
    thinking: isThinking,
  };
}
