import { filterPennyInput } from "./penny-safety.ts";
import { categoryKey, formatPageContext, getMytDateInfo, isSpendingTransaction } from "./penny-ai.ts";
import { formatInvestmentList } from "./investments.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.105.3";

type PennyAccount = { id?: string; name?: string; username?: string; comfort_name?: string; balance?: number | string; streak?: number; card_frozen?: boolean; card_controls_locked?: boolean };
const contextQuery = (admin: SupabaseClient, table: string, columns: string, kidId: string | undefined) =>
  admin.from(table).select(columns).eq("kid_id", kidId);
type ContextQuery = ReturnType<typeof contextQuery>;

import { PENNY_ALLOWLIST, type PennyIntent } from "./penny-intents.ts";
export { PENNY_ALLOWLIST, type PennyIntent } from "./penny-intents.ts";
export function routePennyQuestion(message: string): PennyIntent {
  if (filterPennyInput(message)) return "sensitive";
  const q = message.normalize("NFKC").toLowerCase();
  const personal = /\b(my|mine|i|me|saya|aku|anak saya|my child)\b/.test(q);
  if (/\b(?:what do you (?:know|remember) about me|apa yang awak tahu tentang saya)\b/.test(q)) return "memory";
  if (/\bhow my (?:kids|children) are doing\b|\bhow are my (?:kids|children) doing\b/.test(q)) return "family";
  if (personal && /\b(?:goal|goals|tabung)\b/.test(q) &&
    /\b(?:progress|doing|how much (?:have i|i have) saved|kemajuan)\b/.test(q)) return "numeric";
  if (/\b(how much|what is|what's|berapa|show|check)\b/.test(q) && /\b(balance|baki|owe|outstanding|progress)\b/.test(q) && personal) return "numeric";
  if (/\b(where|which screen|where do|how do i (open|find|tap|freeze)|di mana|cara buka)\b/.test(q)) return "navigation";
  if (!personal) return "education";
  if (/\b(?:my (?:spending |wallet )?balance|baki saya)\b/.test(q) &&
    !/\b(?:budget|bajet|transfer|move|add|withdraw|hide|top up)\b/.test(q)) return "numeric";
  if (/\b(card|kad|payment|bayaran)\b/.test(q) && /\b(frozen|declined|blocked|not working|trouble|ditolak|beku)\b/.test(q)) return "card";
  if (/\b(streak|quest|mission|misi)\b/.test(q)) return "quest";
  if (/\b(investment|fund|position|pelaburan)\b/.test(q) && /\b(perform|performance|return|profit|loss|doing|prestasi|untung|rugi)\b/.test(q)) return "investment";
  if (/\b(loan|repayment|repay|pinjaman|hutang)\b/.test(q)) return "loan";
  if (/\b(goal|tabung)\b/.test(q) && /\b(plan|reach|save|target|capai|simpan)\b/.test(q)) return "goal";
  if (/\b(budget|bajet)\b/.test(q)) return "budget";
  if (/\b(compare|comparison|compared|banding)\b/.test(q) && /\b(spend|spending|spent|belanja)\b/.test(q)) return "comparison";
  if (/\b(how often|how many|frequency|berapa kali)\b/.test(q) && /\b(spend|spending|spent|transaction|belanja|transaksi)\b/.test(q)) return "frequency";
  if (/\b(spend|spending|spent|belanja)\b/.test(q) && /\b(summary|summarise|summarize|week|month|ringkas|minggu|bulan)\b/.test(q)) return "spending";
  return "education";
}

const QUESTIONS: Record<PennyIntent, string> = {
  education: "", navigation: "", numeric: "", sensitive: "", memory: "", family: "",
  spending: "Explain my spending in the requested period using only these aggregates.",
  comparison: "Compare spending in these two periods using only these aggregates.",
  frequency: "Explain my transaction frequency in the requested period.",
  budget: "Help me plan a budget using these figures; ask for missing inputs, never assume them.",
  goal: "Help me plan for the selected Tabung using these figures; ask for missing inputs.",
  loan: "Explain repayment of the selected loan using these figures, without adding fees.",
  investment: "Explain performance of the selected position; no buy or sell advice.",
  card: "Explain the relevant card restrictions and how to ask a parent for help.",
  quest: "Give coaching or a hint about the selected public quest or saving streak, never an answer key.",
};
export function cleanPennyQuestion(message: string, knownNames: string[]): { text: string; removed: number } {
  let text = message.normalize("NFKC").replace(/\s+/gu, " ").trim();
  let removed = 0;
  const names = new Set<string>();
  for (const value of knownNames) {
    const name = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
    if (!name) continue;
    names.add(name);
    for (const word of name.match(/[\p{L}]{3,}/gu) ?? []) {
      if (!["bin", "binti", "bte", "bt"].includes(word.toLowerCase())) names.add(word);
    }
  }
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (names.size) {
    const alternatives = [...names].sort((a, b) => b.length - a.length).map(escape).join("|");
    text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, "giu"), () => { removed++;return "[name]"; });
  }
  for (const rule of [
    /[\w.+-]+@[\w-]+\.[\w.-]+/gi,
    /\b(?:https?:\/\/|www\.)\S+/gi,
    /\+?\d(?:[\s-]?\d){7,}/g,
    /\d{6,}/g,
    /(?<![\p{L}\p{N}])(?!rm)(?=[a-hj-np-z2-9]*[2-9])(?=[a-hj-np-z2-9]*[a-hj-np-z])[a-hj-np-z2-9]{6}(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])(?:jalan|jln|lorong|lrg|taman|tmn|persiaran|lebuh|blok|block|apartment|pangsapuri|kondo|condo)\s+(?:[^\s,.]+\s+){0,2}(?!rm\d)[^\s,.]*\d[^,.]*/giu,
    /(?<![\p{L}\p{N}])(?:[Jj]alan|[Jj]ln|[Ll]orong|[Ll]rg|[Tt]aman|[Tt]mn|[Pp]ersiaran|[Ll]ebuh)\s+\p{Lu}[^,.]*/gu,
    /(?:\p{Lu}\p{L}*\s+){1,3}(?:Street|Road|Avenue|Lane|Drive)\b[^,.]*/gu,
    /(?<![\p{L}\p{N}])[Nn]o\.\s*\d+[^,.]*/gu,
    /\b(?:poskod|postcode|postal code)\s*:?\s*\d{5}\b/gi,
    /\b\d{5}(?=\s+\p{Lu})(?!\s+(?:Ringgit|RM|Sen)\b)/gu,
  ]) text = text.replace(rule, () => { removed++;return "[removed]"; });
  return { text: text.replace(/"/g, "'").slice(0, 280), removed };
}

// Both chat handlers fail closed on the same minimal family-name lookup.
export async function getPennyKnownNames(admin: SupabaseClient, parentId: string, parentUser?: { user_metadata?: Record<string, unknown> }): Promise<string[]> {
  try {
    if (!parentId) throw new Error("Penny context unavailable");
    const [family, parent] = await Promise.all([
      admin.from("kids").select("name, username, comfort_name").eq("parent_id", parentId),
      parentUser ? { data: { user: parentUser }, error: null } : admin.auth.admin.getUserById(parentId),
    ]);
    if (family.error || !family.data || parent.error || !parent.data?.user?.user_metadata) throw new Error("Penny context unavailable");
    const metadata = parent.data.user.user_metadata;
    return [...family.data.flatMap(row => [row.name, row.username, row.comfort_name]), metadata.full_name, metadata.name, metadata.comfort_name]
      .filter((name): name is string => typeof name === "string");
  } catch {
    throw new Error("Penny context unavailable");
  }
}

const cents = (v: unknown) => Math.round((Number(v) || 0) * 100);
const ringgit = (amountInCents: number) => `RM${(amountInCents / 100).toFixed(2)}`;

async function readTransactions(admin: SupabaseClient, kidId: string | undefined, start: number, end: number) {
  if (!kidId) throw new Error("Penny context unavailable");
  const transactions: { type: string; amount: number | string; label: string | null; created_at: string }[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await contextQuery(admin, "transactions", "type, amount, label, created_at", kidId)
      .gte("created_at", new Date(start).toISOString()).lt("created_at", new Date(end).toISOString())
      .order("id").range(offset, offset + pageSize - 1);
    if (error || !data) throw new Error("Penny context unavailable");
    transactions.push(...data as typeof transactions);
    if (data.length < pageSize) return transactions;
  }
}

export async function familyPennyReply(admin: SupabaseClient, parentId: string, now = new Date()) {
  const { data: kids, error } = await admin.from("kids").select("id, name, balance")
    .eq("parent_id", parentId).order("name").order("id");
  if (error || !kids) throw new Error("Penny context unavailable");
  if (!kids.length) return "There are no child accounts to review yet.";
  const { thisWeekStartMs, nowMs } = getMytDateInfo(now);
  const lines = await Promise.all(kids.map(async kid => {
    const transactions = await readTransactions(admin, kid.id, thisWeekStartMs, nowMs);
    const spent = transactions.filter(t => isSpendingTransaction(t.type, t.label))
      .reduce((total, t) => total + cents(t.amount), 0);
    return `${kid.name}: ${ringgit(cents(kid.balance))} to spend, ${ringgit(spent)} spent this week.`;
  }));
  return ["Here’s how your kids are doing this week:", ...lines].join("\n");
}
const daysLeft = (value: unknown, now: Date) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Math.ceil((Date.parse(value) - now.getTime()) / 86400000) : null;
const moneyInput = (q: string, label: string) => {
  const match = q.match(new RegExp(`(?:${label})\\s*(?:of|is|:)?\\s*RM\\s*(\\d+(?:\\.\\d{1,2})?)`, "i"));
  return match ? Number(match[1]) : null;
};

export async function minimizePennyQuestion(admin: SupabaseClient, kid: PennyAccount, message: string, selection: Record<string, unknown> = {}, now = new Date(), options: { asker: "child" | "parent"; knownNames: string[] | (() => Promise<string[]>) } = { asker: "child", knownNames: [] }) {
  const intent = routePennyQuestion(message);
  let fields: Record<string, unknown> = {};
  let localReply: string | undefined;
  if (/\b(my name is|my email|my address|nama saya|alamat saya)\b/i.test(message) || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(message)) return { intent, fields, question: "", localReply: "Please leave out names, email addresses and other private details. Ask your money question without them.", audit: { intent, fields: [] } };
  if (["spending", "comparison", "frequency", "budget"].includes(intent) && /\b(last month|yesterday|year|bulan lepas|semalam)\b/i.test(message)) return { intent, fields, question: "", localReply: "I can use this week, last week or this month. For a comparison, ask for this week versus last week.", audit: { intent, fields: [] } };
  const read = async (table: string, columns: string, extra?: (query: ContextQuery) => ContextQuery) => {
    let query = contextQuery(admin, table, columns, kid.id);
    if (extra) query = extra(query);
    const { data, error } = await query.returns<Record<string, unknown>[]>();
    if (error) throw new Error("Penny context unavailable");
    return data ?? [];
  };
  const selected = async (table: string, columns: string, idKey: string, active = false) => {
    const rows = await read(table, columns, q => {
      if (typeof selection[idKey] === "string") q = q.eq("id", selection[idKey]);
      if (active) q = q.eq("status", "active");
      return q.limit(2);
    });
    if (rows.length !== 1) localReply = "Please choose one item on its page first. I won't share your other items.";
    return rows.length === 1 ? rows[0] : null;
  };
  const info = getMytDateInfo(now);
  const period = /\b(month|bulan)\b/i.test(message) ? "this month" : /\b(last week|minggu lepas)\b/i.test(message) ? "last week" : "this week";
  const periodRange = (label: string) => label === "this month" ? [info.thisMonthStartMs, now.getTime()] : label === "last week" ? [info.lastWeekStartMs, info.thisWeekStartMs] : [info.thisWeekStartMs, now.getTime()];
  if (intent === "navigation") { const screen = formatPageContext(selection); if (screen) fields = { screen }; }
  else if (intent === "sensitive") localReply = filterPennyInput(message)!.reply;
  else if (intent === "memory") {
    localReply = "I can use the account you’re viewing to answer questions about its spending balance, transactions and Tabung. I don’t need private details like a PIN or login code.";
    if (kid.id && kid.balance != null) localReply += ` Your spending balance is ${ringgit(cents(kid.balance))}.`;
  } else if (intent === "family") {
    localReply = "A parent can ask about their children from the parent view.";
  } else if (intent === "numeric") {
    if (/\b(balance|baki)\b/i.test(message)) localReply = `Your spending balance is ${ringgit(cents(kid.balance))}.`;
    else if (/\b(goal|goals|tabung|progress)\b/i.test(message)) {
      const goals = await read("goals", "target, saved", q =>
        typeof selection.goalId === "string" ? q.eq("id", selection.goalId) : q);
      const saved = goals.reduce((sum, goal) => sum + cents(goal.saved), 0);
      const target = goals.reduce((sum, goal) => sum + cents(goal.target), 0);
      localReply = goals.length === 0
        ? typeof selection.goalId === "string" ? "I couldn’t find that Tabung in this account." : "You haven’t started a Tabung yet."
        : `${goals.length === 1 ? "Your Tabung has" : `Across ${goals.length} Tabung, you have`} ${ringgit(saved)} saved toward ${ringgit(target)}.`;
    } else {
      const loans = await read("loans", "amount, repaid", q => q.eq("status", "active"));
      localReply = `Your outstanding loans total RM${(loans.reduce((s: number, l: Record<string, unknown>) => s + Math.max(0, cents(l.amount) - cents(l.repaid)), 0) / 100).toFixed(2)}.`;
    }
  } else if (["spending", "comparison", "frequency"].includes(intent)) {
    const periods = intent === "comparison" ? ["last week", "this week"] : [period];
    const ranges = periods.map(periodRange);
    const transactions = await readTransactions(admin, kid.id, Math.min(...ranges.map(r => r[0])), now.getTime());
    const aggregate = (label: string) => {
      const [start, end] = periodRange(label);
      const totals: Record<string, number> = {}, counts: Record<string, number> = {};
      for (const t of transactions) {
        const time = Date.parse(String(t.created_at ?? ""));
        const type = String(t.type ?? "");
        const label = String(t.label ?? "");
        if (!Number.isFinite(time) || time < start || time >= end || !isSpendingTransaction(type, label)) continue;
        // Merchant text is used locally to classify, never sent to the model.
        const key = type === "WITHDRAWAL" && /food|snack/i.test(label) ? "FOOD" : type === "WITHDRAWAL" && /transport|grab/i.test(label) ? "TRANSPORT" : categoryKey(type, label);
        const category = ["FOOD", "TRANSPORT", "WITHDRAWAL", "SADAQAH", "FEE", "QARD_REPAY", "TRANSFER_OUT"].includes(key) ? key : "OTHER";
        totals[category] = (totals[category] ?? 0) + cents(t.amount);
        counts[category] = (counts[category] ?? 0) + 1;
      }
      const requestedCategory = /\b(food|snack|makanan)\b/i.test(message) ? "FOOD" : /\b(transport|pengangkutan)\b/i.test(message) ? "TRANSPORT" : null;
      return intent === "frequency" ? { period: label, categoryCounts: requestedCategory ? { [requestedCategory]: counts[requestedCategory] ?? 0 } : counts } : { period: label, totalSpent: Object.values(totals).reduce((a, b) => a + b, 0) / 100, categoryTotals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / 100])) };
    };
    fields = intent === "comparison" ? { periods: periods.map(aggregate) } : aggregate(periods[0]);
    if (intent === "spending") localReply = `You spent ${ringgit(cents(fields.totalSpent))} ${period}.`;
  } else if (intent === "budget") {
    fields = { period, availableSpending: cents(kid.balance) / 100, expectedIncome: moneyInput(message, "income|pendapatan"), selectedObligations: moneyInput(message, "obligations|commitments|komitmen") };
  } else if (intent === "goal") {
    const goal = await selected("goals", "id, target, saved", "goalId");
    if (goal) fields = { remainingAmount: Math.max(0, cents(goal.target) - cents(goal.saved)) / 100, timeRemainingDays: null, plannedContribution: moneyInput(message, "contribution|sumbangan") };
  } else if (intent === "loan") {
    const loan = await selected("loans", "id, amount, repaid, due_date", "loanId", true);
    if (loan) fields = { outstanding: Math.max(0, cents(loan.amount) - cents(loan.repaid)) / 100, dueInDays: daysLeft(loan.due_date, now), requiredRepayment: null };
    // The schema has no required installment or fee schedule. Never invent one.
  } else if (intent === "investment") {
    const position = await selected("investments", "*", "investmentId", true);
    if (position) {
      const [value] = await formatInvestmentList(admin, [position]);
      fields = { positionType: position.mode, returnPct: value.profitPct, timeLeftDays: daysLeft(value.endsAt, now), quoteAvailable: position.mode === "fund" || value.currentPrice !== null };
    }
  } else if (intent === "card") fields = { frozen: Boolean(kid.card_frozen), parentManaged: Boolean(kid.card_controls_locked) };
  else if (intent === "quest") {
    if (/\b(streak)\b/i.test(message)) fields = { streakDays: Number(kid.streak) || 0 };
    else if (typeof selection.questId === "string") {
      const { data: quest, error } = await admin.from("quests").select("summary").eq("id", selection.questId).eq("active", true).maybeSingle();
      if (error) throw new Error("Penny context unavailable");
      const completions = await read("quest_completions", "quest_id", q => q.eq("quest_id", selection.questId));
      if (quest && !filterPennyInput(quest.summary)) fields = { publicDescription: quest.summary, completed: completions.length > 0 };
      else localReply = "Please choose an available quest on the Missions page.";
    } else localReply = "Choose a quest on the Missions page first, then ask for a hint.";
  }
  // Fail closed if a future change tries to send an unapproved field.
  for (const field of Object.keys(fields)) if (!(PENNY_ALLOWLIST[intent] as readonly string[]).includes(field)) throw new Error("Unapproved Penny field");
  let question = "";
  if (!localReply) {
    const names = typeof options.knownNames === "function" ? await options.knownNames() : options.knownNames;
    const knownNames = [...names, kid.name, kid.comfort_name, kid.username].filter((name): name is string => typeof name === "string");
    const { text } = cleanPennyQuestion(message, knownNames);
    const words = text.replace(/\[(?:name|removed)\]/g, " ").match(/[\p{L}\p{N}]+/gu) ?? [];
    if (words.length < 2) localReply = "Ask again without names or numbers.";
    else {
      question = (QUESTIONS[intent] ? QUESTIONS[intent] + " " : "") + `${options.asker === "parent" ? "Parent" : "Child"} asks: "${text}"`;
      if (/\b(saya|aku|bagaimana|berapa|mana|simpan|belanja|bajet|pinjaman|kad|minggu|bulan)\b/i.test(message)) question += " Reply in Malay.";
    }
  }
  return { intent, fields, question, localReply, audit: { intent, fields: Object.keys(fields) } };
}
