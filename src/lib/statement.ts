import { isWalletTransaction, walletDeltaCents } from "./finance";
import { transactionTypeLabel } from "./labels";
import type { StatementResult } from "@/types/domain";

export function summarizeStatement(statement: StatementResult) {
  const transactions = (statement?.transactions ?? []).filter(tx => isWalletTransaction(tx.type));
  const opening = statement?.openingBalance;
  const closing = statement?.closingBalance;
  const balances = typeof opening === "number" && Number.isFinite(opening) &&
    typeof closing === "number" && Number.isFinite(closing) ? { opening, closing } : null;
  let running = balances ? Math.round(balances.closing * 100) : 0;
  let inCents = 0;
  let outCents = 0;
  const balanceMap = new Map<string, number>();
  const byCategory = new Map<string, number>();
  for (const tx of transactions) {
    const delta = walletDeltaCents(tx);
    if (balances) {
      balanceMap.set(tx.id, running / 100);
      running -= delta;
    }
    if (delta < 0) {
      outCents -= delta;
      const name = transactionTypeLabel(tx.type, tx.label);
      byCategory.set(name, (byCategory.get(name) ?? 0) - delta);
    } else {
      inCents += delta;
    }
  }
  const categories = [...byCategory].map(([name, cents]) => ({ name, value: cents / 100 }));
  return { transactions, balances, balanceMap, categories, totalIn: inCents / 100, totalOut: outCents / 100, net: (inCents - outCents) / 100 };
}

export function statementPdfCategories(categories: { name: string; value: number }[]) {
  const sorted = [...categories].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, category) => sum + category.value, 0);
  const top = sorted.slice(0, 6);
  const other = sorted.slice(6).reduce((sum, category) => sum + category.value, 0);
  if (other > 0) top.push({ name: "Other", value: other });
  const largest = Math.max(...top.map(category => category.value));
  return top.map(category => ({
    ...category,
    percent: Math.round(category.value / total * 100),
    fraction: category.value / largest,
  }));
}
