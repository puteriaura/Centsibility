import { isWalletTransaction } from "@/lib/finance";

export interface HistoryTx {
  id: string;
  type: string;
  amount: number | string;
  label?: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface DayGroup<T extends HistoryTx = HistoryTx> {
  key: string; // "YYYY-MM-DD"
  heading: string; // "Sunday, 27 September 2026"
  rows: T[];
}

function getDayKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function getDayHeading(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Group transactions by calendar day in the given timezone (defaults to Asia/Kuala_Lumpur).
 * Leaves out pot-only transactions (INVEST_GAIN, INVEST_LOSS) using isWalletTransaction.
 * Sorts days newest first, and rows newest first within each day.
 */
export function groupByDay<T extends HistoryTx>(
  txs: T[],
  timeZone = "Asia/Kuala_Lumpur",
): DayGroup<T>[] {
  const walletTxs = txs.filter((t) => isWalletTransaction(t.type));
  const groupsMap = new Map<string, { heading: string; rows: T[] }>();

  for (const tx of walletTxs) {
    const d = new Date(tx.created_at);
    const key = getDayKey(d, timeZone);
    const existing = groupsMap.get(key);
    if (existing) {
      existing.rows.push(tx);
    } else {
      const heading = getDayHeading(d, timeZone);
      groupsMap.set(key, { heading, rows: [tx] });
    }
  }

  // Sort rows within each group newest first
  for (const group of groupsMap.values()) {
    group.rows.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  // Sort groups newest day first (lexicographical comparison of YYYY-MM-DD works)
  return [...groupsMap.entries()]
    .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
    .map(([key, { heading, rows }]) => ({
      key,
      heading,
      rows,
    }));
}
