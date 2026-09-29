import { isDebitTransaction, isWalletTransaction, TRANSACTION_TYPE_LABELS } from "@/lib/finance";
import { formatDate, formatRM } from "@/lib/format";

export type InsightTx = {
  id: string;
  type: string;
  label: string;
  amount: number | string;
  created_at: string;
};

export type SpendingSummary = {
  moneyIn: number;
  moneyOut: number;
  txCount: number;
  avgTx: number;
  dailyAvg: number;
  topCategories: Array<{ key: string; label: string; amount: number; pct: number; count: number }>;
  highlight: string;
  rangeLabel: string;
  rangeStart: Date;
  rangeEnd: Date;
};

function categoryKey(type: string, label: string) {
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

function categoryLabel(key: string) {
  if (key === "FOOD") return "Food & beverage";
  if (key === "TRANSPORT") return "Transportation";
  if (key === "WITHDRAWAL") return "Withdrawals";
  if (key === "SADAQAH") return "Sadaqah";
  if (key === "INVEST_IN") return "Investments";
  if (key === "FEE") return "Fees";
  if (key === "QARD_REPAY" || key === "QARD") return "Loan repayments";
  if (key === "GOAL_IN") return "Savings goals";
  if (key === "DEPOSIT") return "Deposits";
  return TRANSACTION_TYPE_LABELS[key] ?? key;
}

/** Summarise kid transactions for Insights + Penny chat (local, no LLM). */
export function buildSpendingSummary(
  txs: InsightTx[],
  days = 90,
): SpendingSummary {
  const rangeEnd = new Date();
  const rangeStart = new Date();
  rangeStart.setDate(rangeEnd.getDate() - days);

  const inRange = txs.filter((t) => {
    if (!isWalletTransaction(t.type)) return false;
    const d = new Date(t.created_at);
    return d >= rangeStart && d <= rangeEnd;
  });

  let moneyIn = 0;
  let moneyOut = 0;
  const buckets = new Map<string, { amount: number; count: number }>();

  for (const t of inRange) {
    const amt = Number(t.amount);
    const debit = isDebitTransaction(t.type, t.label);
    if (debit) {
      moneyOut += amt;
      const key = categoryKey(t.type, t.label);
      const prev = buckets.get(key) ?? { amount: 0, count: 0 };
      buckets.set(key, { amount: prev.amount + amt, count: prev.count + 1 });
    } else {
      moneyIn += amt;
    }
  }

  const topCategories = [...buckets.entries()]
    .map(([key, v]) => ({
      key,
      label: categoryLabel(key),
      amount: v.amount,
      count: v.count,
      pct: moneyOut > 0 ? (v.amount / moneyOut) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const txCount = inRange.length;
  const avgTx = txCount > 0 ? (moneyIn + moneyOut) / txCount : 0;
  const dailyAvg = moneyOut / Math.max(days, 1);

  const top = topCategories[0];
  const outflows = inRange.filter((t) => isDebitTransaction(t.type, t.label));
  const biggest = [...outflows].sort((a, b) => Number(b.amount) - Number(a.amount))[0];

  let highlight =
    txCount === 0
      ? "Quiet stretch so far — when you move money, I’ll spot patterns for you."
      : top
        ? `Big week for ${top.label.toLowerCase()}! You made ${top.count} related move${top.count === 1 ? "" : "s"} totaling RM${top.amount.toFixed(2)}.`
        : `You completed ${txCount} transactions recently. Keep tracking to level up your savings game.`;

  if (biggest) {
    const day = new Date(biggest.created_at).toLocaleDateString("en-MY", { weekday: "long" });
    highlight = `Big week for transfers! You made 1 outgoing move of ${formatRM(Number(biggest.amount))} on ${day}, showing standout engagement this week.`;
  }

  const fmt = (d: Date) =>
    formatDate(d);

  return {
    moneyIn,
    moneyOut,
    txCount,
    avgTx,
    dailyAvg,
    topCategories,
    highlight,
    rangeLabel: `${fmt(rangeStart)} – ${fmt(rangeEnd)}`,
    rangeStart,
    rangeEnd,
  };
}

export type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

/** Rule-based Penny replies grounded in the kid’s own numbers. */
export function pennyReply(userText: string, summary: SpendingSummary, kidName: string): string {
  const q = userText.toLowerCase();
  const topLine =
    summary.topCategories.length > 0
      ? summary.topCategories
          .slice(0, 2)
          .map((c) => `${c.label} (${c.pct.toFixed(1)}%)`)
          .join(" and ")
      : "no major spending categories yet";

  if (/spend|spending|expense|out/.test(q)) {
    return `Hi ${kidName}! Over the past months you spent ${formatRM(summary.moneyOut)} across ${summary.txCount} transactions, averaging ${formatRM(summary.avgTx)} each. Your daily average outflow is ${formatRM(summary.dailyAvg)}, with most going to ${topLine}.\n\nHere's a thought: Tracking by category helps you spot where to save. Want tips on cutting one category?`;
  }
  if (/save|saving|goal|pot/.test(q)) {
    return `Saving tip from Penny: move a little from your wallet into a savings goal right after you get money in. You've taken in ${formatRM(summary.moneyIn)} recently — even RM5 toward a goal builds the habit. Open Goals to start a pot!`;
  }
  if (/sadaqah|charity|give|zakat/.test(q)) {
    return `Sadaqah extinguishes sin as water extinguishes fire. Even RM1 counts. Your recent outflow is ${formatRM(summary.moneyOut)}. If you can spare a little, visit Sadaqah and give with intention.`;
  }
  if (/invest|growth|halal/.test(q)) {
    return `Halal growth means risk you understand. Check Invest to set a low risk appetite first, then move small amounts from your wallet. Ask your parent if you're unsure — that's wise, not weak.`;
  }
  if (/hello|hi |salam|hey/.test(q)) {
    return `Hi there! I'm Penny, your money buddy. Ask me about spending, savings, sadaqah, or investments — I'll ground answers in your own activity.`;
  }

  return `Got it! Here's your snapshot: money in ${formatRM(summary.moneyIn)}, money out ${formatRM(summary.moneyOut)}, ${summary.txCount} transactions. Top areas: ${topLine}.\n\nAsk me about spending, saving, sadaqah, or investments for a deeper dive. (This is educational guidance — not formal financial advice.)`;
}

export function buildStorySlides(summary: SpendingSummary, coins: number) {
  const slides = [
    {
      title: "Daily wrap",
      body: summary.highlight,
      tone: "primary" as const,
    },
    {
      title: "Money in",
      body: `You received RM${summary.moneyIn.toFixed(2)} in this period. Celebrate the inflow — then protect some of it in a Savings Pot.`,
      tone: "lilac" as const,
    },
    {
      title: "Money out",
      body: `You spent RM${summary.moneyOut.toFixed(2)}. Daily average: RM${summary.dailyAvg.toFixed(2)}. Awareness is the first step to control.`,
      tone: "navy" as const,
    },
    {
      title: "Top category",
      body:
        summary.topCategories[0]
          ? `${summary.topCategories[0].label} led the way at ${summary.topCategories[0].pct.toFixed(0)}% of outflows (RM${summary.topCategories[0].amount.toFixed(2)}).`
          : "No outflow categories yet — your wrap will fill in as you transact.",
      tone: "primary" as const,
    },
    {
      title: "Stardust",
      body: `You’ve earned ${Math.round(coins)} stardust. Keep questing with Penny to unlock rewards — and ask me in chat anytime.`,
      tone: "lilac" as const,
    },
    {
      title: "Next step",
      body: "Chat with Penny for personalised tips, or open Goals to lock in progress. You’ve got this!",
      tone: "navy" as const,
    },
  ];
  return slides;
}
