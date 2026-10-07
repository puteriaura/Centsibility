import { filterPennyInput } from "./penny-safety.ts";
import { categoryKey, formatPageContext, getMytDateInfo, isSpendingTransaction } from "./deepseek.ts";
import { formatInvestmentList } from "./investments.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type PennyAccount = { id?: string; name?: string; comfort_name?: string; balance?: number | string; streak?: number; card_frozen?: boolean; card_controls_locked?: boolean };
type ContextQuery = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

import { PENNY_ALLOWLIST, type PennyIntent } from "./penny-intents.ts";
export { PENNY_ALLOWLIST, type PennyIntent } from "./penny-intents.ts";
export function routePennyQuestion(message: string): PennyIntent {
  if (filterPennyInput(message)) return "sensitive";
  const q = message.normalize("NFKC").toLowerCase();
  const personal = /\b(my|mine|i|me|saya|aku|anak saya|my child)\b/.test(q);
  if (/\b(how much|what is|what's|berapa|show|check)\b/.test(q) && /\b(balance|baki|owe|outstanding|progress)\b/.test(q) && personal) return "numeric";
  if (/\b(where|which screen|where do|how do i (open|find|tap|freeze)|di mana|cara buka)\b/.test(q)) return "navigation";
  if (!personal) return "education";
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
  education: "", navigation: "", numeric: "", sensitive: "",
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
function publicQuestion(message: string, navigation: boolean) {
  // No free-form question text crosses the provider boundary: unknown names/amounts
  // cannot be reliably anonymized with regex. Preserve only recognized public topics.
  const topics: Array<[RegExp, string]> = [
    [/freeze|frozen|beku/i, "how to freeze or unfreeze a practice card"],
    [/moon|shariah|halal/i, "the moon screening icon and dated Shariah evidence"],
    [/compound/i, "compound growth with a small fictional example"],
    [/balance|baki/i, "what a spending balance means"],
    [/sadaqah|zakat/i, "general giving concepts, without religious rulings"],
    [/loan|repay|pinjaman|hutang/i, "loans and repayment"],
    [/budget|bajet/i, "budgeting and needs versus wants"],
    [/transfer|pindah/i, "family transfers and parent approval"],
    [/goal|tabung|saving|save|simpan/i, "saving and Tabung"],
    [/investment|fund|market|pelaburan/i, "practice Funds and Market Tracker, without investment advice"],
    [/quest|mission|misi/i, "money learning missions and hints"],
    [/card|kad/i, "practice card controls"],
    [/RM|ringgit|currency/i, "Malaysian ringgit and money amounts"],
  ];
  const topic = topics.find(([rule]) => rule.test(message))?.[1];
  return topic ? `${navigation ? "Explain the verified app steps for" : "Explain"} ${topic}.` : "Offer general money help and ask which money topic or app screen the user needs.";
}
const cents = (v: unknown) => Math.round((Number(v) || 0) * 100);
const daysLeft = (value: unknown, now: Date) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Math.ceil((Date.parse(value) - now.getTime()) / 86400000) : null;
const moneyInput = (q: string, label: string) => {
  const match = q.match(new RegExp(`(?:${label})\\s*(?:of|is|:)?\\s*RM\\s*(\\d+(?:\\.\\d{1,2})?)`, "i"));
  return match ? Number(match[1]) : null;
};

export async function minimizePennyQuestion(admin: SupabaseClient, kid: PennyAccount, message: string, selection: Record<string, unknown> = {}, now = new Date()) {
  const intent = routePennyQuestion(message);
  let fields: Record<string, unknown> = {};
  let localReply: string | undefined;
  if (/\b(my name is|my email|my address|nama saya|alamat saya)\b/i.test(message) || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(message)) return { intent, fields, question: "", localReply: "Please leave out names, email addresses and other private details. Ask your money question without them.", audit: { intent, fields: [] } };
  if (["spending", "comparison", "frequency", "budget"].includes(intent) && /\b(last month|yesterday|year|bulan lepas|semalam)\b/i.test(message)) return { intent, fields, question: "", localReply: "I can use this week, last week or this month. For a comparison, ask for this week versus last week.", audit: { intent, fields: [] } };
  const read = async (table: string, columns: string, extra?: (query: ContextQuery) => ContextQuery) => {
    let query = admin.from(table).select(columns).eq("kid_id", kid.id);
    if (extra) query = extra(query);
    const { data, error } = await query;
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
  else if (intent === "numeric") {
    if (/\b(balance|baki)\b/i.test(message)) localReply = `Your spending balance is RM${(cents(kid.balance) / 100).toFixed(2)}.`;
    else if (/\b(goal|tabung|progress)\b/i.test(message)) {
      const goal = await selected("goals", "id, target, saved", "goalId");
      if (goal) localReply = `Your selected Tabung has RM${(cents(goal.saved) / 100).toFixed(2)} saved toward RM${(cents(goal.target) / 100).toFixed(2)}.`;
    } else {
      const loans = await read("loans", "amount, repaid", q => q.eq("status", "active"));
      localReply = `Your outstanding loans total RM${(loans.reduce((s: number, l: Record<string, unknown>) => s + Math.max(0, cents(l.amount) - cents(l.repaid)), 0) / 100).toFixed(2)}.`;
    }
  } else if (["spending", "comparison", "frequency"].includes(intent)) {
    const periods = intent === "comparison" ? ["last week", "this week"] : [period];
    const ranges = periods.map(periodRange);
    const transactions = await read("transactions", "type, amount, label, created_at", q => q.gte("created_at", new Date(Math.min(...ranges.map(r => r[0]))).toISOString()).lt("created_at", now.toISOString()));
    const aggregate = (label: string) => {
      const [start, end] = periodRange(label);
      const totals: Record<string, number> = {}, counts: Record<string, number> = {};
      for (const t of transactions) {
        const time = Date.parse(t.created_at);
        if (time < start || time >= end || !isSpendingTransaction(t.type, t.label)) continue;
        // Merchant text is used locally to classify, never sent to the model.
        const label = String(t.label || "");
        const key = t.type === "WITHDRAWAL" && /food|snack/i.test(label) ? "FOOD" : t.type === "WITHDRAWAL" && /transport|grab/i.test(label) ? "TRANSPORT" : categoryKey(t.type, label);
        const category = ["FOOD", "TRANSPORT", "WITHDRAWAL", "SADAQAH", "FEE", "QARD_REPAY", "TRANSFER_OUT"].includes(key) ? key : "OTHER";
        totals[category] = (totals[category] ?? 0) + cents(t.amount);
        counts[category] = (counts[category] ?? 0) + 1;
      }
      const requestedCategory = /\b(food|snack|makanan)\b/i.test(message) ? "FOOD" : /\b(transport|pengangkutan)\b/i.test(message) ? "TRANSPORT" : null;
      return intent === "frequency" ? { period: label, categoryCounts: requestedCategory ? { [requestedCategory]: counts[requestedCategory] ?? 0 } : counts } : { period: label, totalSpent: Object.values(totals).reduce((a, b) => a + b, 0) / 100, categoryTotals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / 100])) };
    };
    fields = intent === "comparison" ? { periods: periods.map(aggregate) } : aggregate(periods[0]);
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
  let question = QUESTIONS[intent] || publicQuestion(message, intent === "navigation");
  if (/\b(saya|aku|bagaimana|berapa|mana|simpan|belanja|bajet|pinjaman|kad|minggu|bulan)\b/i.test(message)) question += " Reply in Malay.";
  return { intent, fields, question, localReply, audit: { intent, fields: Object.keys(fields) } };
}
