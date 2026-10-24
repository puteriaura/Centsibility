import { isDebitTransaction, isWalletTransaction } from "@/lib/finance";
import { TRANSACTION_TYPE_LABELS, humanizeCode } from "@/lib/labels";
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
  topCategories: Array<{
    key: string;
    label: string;
    amount: number;
    pct: number;
    count: number;
  }>;
  highlight: string;
  rangeLabel: string;
  rangeStart: Date;
  rangeEnd: Date;
};

function categoryKey(type: string, label: string) {
  if (type === "FEE") return "FEE";
  if (
    type === "QARD_REPAY" ||
    (type === "QARD" && label === "Loan repayment")
  ) {
    return "QARD_REPAY";
  }
  if (type === "GOAL_IN") return "GOAL_IN";
  if (
    type === "WITHDRAWAL" ||
    type === "SADAQAH" ||
    type === "INVEST_IN" ||
    type === "TRANSFER_OUT"
  ) {
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
  if (key === "GOAL_IN") return "Tabung";
  if (key === "DEPOSIT") return "Deposits";
  if (key === "TRANSFER_OUT") return "Transfers";
  return TRANSACTION_TYPE_LABELS[key] ?? humanizeCode(key);
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
  const biggest = [...outflows].sort(
    (a, b) => Number(b.amount) - Number(a.amount),
  )[0];

  let highlight =
    txCount === 0
      ? "Quiet stretch so far. When you move money, I’ll spot patterns for you."
      : top
        ? `Big week for ${top.label.toLowerCase()}! You made ${top.count} related move${top.count === 1 ? "" : "s"} totaling RM${top.amount.toFixed(2)}.`
        : `You completed ${txCount} transactions recently. Keep tracking to level up your savings game.`;

  if (biggest) {
    const day = new Date(biggest.created_at).toLocaleDateString("en-MY", {
      weekday: "long",
    });
    highlight = `Big week for transfers! You made 1 outgoing move of ${formatRM(Number(biggest.amount))} on ${day}, showing standout engagement this week.`;
  }

  const fmt = (d: Date) => formatDate(d);

  return {
    moneyIn,
    moneyOut,
    txCount,
    avgTx,
    dailyAvg,
    topCategories,
    highlight,
    rangeLabel: `${fmt(rangeStart)} to ${fmt(rangeEnd)}`,
    rangeStart,
    rangeEnd,
  };
}

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

/** Rule-based Penny replies grounded in the kid’s own numbers. */
export function pennyReply(
  userText: string,
  summary: SpendingSummary | null,
  kidName: string,
): string {
  // Build a zero-value fallback if no data is available yet
  const _now = new Date();
  const s: SpendingSummary = summary ?? {
    moneyIn: 0,
    moneyOut: 0,
    txCount: 0,
    avgTx: 0,
    dailyAvg: 0,
    topCategories: [],
    highlight: "",
    rangeLabel: "",
    rangeStart: _now,
    rangeEnd: _now,
  };
  const q = userText.toLowerCase();
  const topLine =
    s.topCategories.length > 0
      ? s.topCategories
          .slice(0, 2)
          .map((c) => `${c.label} (${c.pct.toFixed(1)}%)`)
          .join(" and ")
      : "no major spending categories yet";

  if (/spend|spending|expense|out/.test(q)) {
    return `Over the past period you spent ${formatRM(s.moneyOut)} across ${s.txCount} transactions, averaging ${formatRM(s.avgTx)} each. Your daily average outflow is ${formatRM(s.dailyAvg)}, with most going to ${topLine}.\n\nTracking categories is lowkey a superpower because it shows where the cash leaks are. Want tips on cutting back on ${s.topCategories[0]?.label || "spending"}?`;
  }
  if (/save|saving|goal|pot|tabung/.test(q)) {
    return `Pro saver move from Penny: move a little from your wallet into a Tabung right when money comes in. You received ${formatRM(s.moneyIn)} recently. Even putting ${formatRM(Math.max(2, s.moneyIn * 0.1))} into a Tabung builds massive discipline! Open Tabung to tuck it away.`;
  }
  if (/sadaqah|charity|give|zakat/.test(q)) {
    return `Sadaqah cleanses wealth like water extinguishes fire. Even RM1 makes a huge difference. Your recent outflow is ${formatRM(s.moneyOut)}. Giving with pure intention brings barakah into everything you save!`;
  }
  if (/invest|growth|halal/.test(q)) {
    return `Halal growth means risk you truly understand. Check Investment to practice with Centsibility Funds and learn how growth works. Always check in with your parent first. That is wise, not weak.`;
  }
  if (/hello|hi |salam|hey/.test(q)) {
    return `Salam and hi there ${kidName}! I'm Penny, your money buddy. Ask me about spending breakdowns, Tabung, sadaqah, or rewards. I'll ground everything in your real transactions.`;
  }

  return `Here is your current money breakdown: money in ${formatRM(s.moneyIn)}, money out ${formatRM(s.moneyOut)}, across ${s.txCount} transactions. Top areas: ${topLine}.\n\nAsk me about spending habits, Tabung, or sadaqah for a deeper dive. (Educational guidance only, not formal financial advice.)`;
}

export function buildStorySlides(summary: SpendingSummary, coins: number) {
  const netSavings = summary.moneyIn - summary.moneyOut;
  const topCat = summary.topCategories[0];

  const slides = [
    {
      title: "Daily wrap",
      body:
        summary.highlight ||
        `You made ${summary.txCount} transactions totaling ${formatRM(summary.moneyOut)} during this period.`,
      tone: "primary" as const,
    },
    {
      title: "Money in",
      body: `You received ${formatRM(summary.moneyIn)} in total inflows this period. Tucking away just 20% (${formatRM(summary.moneyIn * 0.2)}) into a Tabung locks in solid progress.`,
      tone: "lilac" as const,
    },
    {
      title: "Money out",
      body: `Total spend was ${formatRM(summary.moneyOut)} across ${summary.txCount} transactions. That is an average of ${formatRM(summary.avgTx)} per purchase (${formatRM(summary.dailyAvg)} per day).`,
      tone: "navy" as const,
    },
    {
      title: "Top category",
      body: topCat
        ? `${topCat.label} took the largest share at ${topCat.pct.toFixed(0)}% of your expenses (${formatRM(topCat.amount)}). Keeping an eye on this category is key.`
        : "No expense categories recorded yet. Your breakdown will automatically populate as you spend.",
      tone: "primary" as const,
    },
    {
      title: "Reward Points",
      body: `You have earned ${Math.round(coins)} reward points from daily quizzes and smart habits! Use them to claim treats in the Rewards shop.`,
      tone: "lilac" as const,
    },
    {
      title: "Key Takeaway",
      body:
        netSavings >= 0
          ? `You kept ${formatRM(netSavings)} in net savings this period! W saving discipline. Chat with Penny to allocate it toward your Tabung.`
          : `Outflows were ${formatRM(Math.abs(netSavings))} higher than inflows this period. Chat with Penny to spot easy cuts and rebalance.`,
      tone: "navy" as const,
    },
  ];
  return slides;
}
