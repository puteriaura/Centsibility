import {
  isDebitTransaction,
  isSpendingTransaction,
  isWalletTransaction,
} from "./finance";
import { transactionTypeLabel } from "./labels";

export type InsightMetric = "spending" | "income";
type PeriodTransaction = {
  type: string;
  label?: string | null;
  description?: string | null;
  category?: string | null;
  amount: number | string;
  created_at: string;
};
const monthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
});
export function insightMonth(date: Date): string {
  const parts = monthFormatter.formatToParts(date);
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
}

/** Ledger cashflow classifications, with personal savings moves excluded from spending. */
export function insightPeriod(
  txs: PeriodTransaction[],
  month: string,
  metric: InsightMetric,
) {
  const period = txs.filter((t) => {
    const date = new Date(t.created_at);
    return Number.isFinite(date.getTime()) && insightMonth(date) === month;
  });
  const included = period.filter((t) =>
    metric === "spending"
      ? isSpendingTransaction(t.type, t.label || t.description)
      : isWalletTransaction(t.type) &&
        !isDebitTransaction(t.type, t.label || t.description),
  );
  const buckets = new Map<
    string,
    { label: string; amount: number; count: number }
  >();
  let totalCents = 0;
  for (const tx of included) {
    const amount = Math.round(Math.abs(Number(tx.amount) || 0) * 100);
    if (!amount) continue;
    totalCents += amount;
    const label =
      tx.category || transactionTypeLabel(tx.type, tx.label || tx.description);
    const previous = buckets.get(label) || { label, amount: 0, count: 0 };
    buckets.set(label, {
      label,
      amount: previous.amount + amount,
      count: previous.count + 1,
    });
  }
  return {
    totalOut: totalCents / 100,
    hasData: period.length > 0,
    topCategories: [...buckets.values()]
      .sort((a, b) => b.amount - a.amount)
      .map((c) => ({
        ...c,
        key: c.label,
        amount: c.amount / 100,
        pct: totalCents ? (c.amount / totalCents) * 100 : 0,
      })),
  };
}
