import { formatRM } from "./format";

export const DEBIT_TYPES = new Set([
  "WITHDRAWAL",
  "SADAQAH",
  "INVEST_IN",
  "FEE",
  "QARD_REPAY",
  "GOAL_IN",
  "TRANSFER_OUT",
]);

export const POT_ONLY_TYPES = new Set(["INVEST_GAIN", "INVEST_LOSS"]);

export const SAVINGS_MOVE_TYPES = new Set(["INVEST_IN", "GOAL_IN"]);

/**
 * Checks whether a transaction belongs to the kid's wallet ledger (balance movement).
 * Pot-only transactions (INVEST_GAIN, INVEST_LOSS) are excluded.
 */
export function isWalletTransaction(type: string): boolean {
  return !POT_ONLY_TYPES.has(type);
}

/**
 * Checks whether a transaction represents an outflow (debit) from the kid's wallet balance.
 */
export function isDebitTransaction(type: string, label?: string | null): boolean {
  if (DEBIT_TYPES.has(type)) return true;
  // Rows written before QARD_REPAY existed; the ledger migration backfills them.
  return type === "QARD" && label === "Loan repayment";
}

/**
 * Returns "+" or "-" sign according to the transaction direction.
 */
export function formatTransactionSign(type: string, label?: string | null): "+" | "-" {
  return isDebitTransaction(type, label) ? "-" : "+";
}

/**
 * Formats a transaction amount with proper sign and tone for display.
 * Returns text like "+RM2.00" or "−RM2.00" (using Unicode minus \u2212)
 * and tone: "out" (black ink) or "in" (success green).
 */
export function transactionAmount(
  type?: string | null,
  label?: string | null,
  amount?: number | string | null,
): { text: string; tone: "in" | "out" } {
  const debit = isDebitTransaction(type ?? "", label);
  const val = Math.abs(Number(amount) || 0);
  const text = debit ? `−${formatRM(val)}` : `+${formatRM(val)}`;
  return {
    text,
    tone: debit ? "out" : "in",
  };
}

/**
 * Checks whether a transaction represents spending (outflow) rather than
 * moving money into personal savings/investments or pot-only adjustments.
 */
export function isSpendingTransaction(type: string, label?: string | null): boolean {
  return isWalletTransaction(type) && isDebitTransaction(type, label) && !SAVINGS_MOVE_TYPES.has(type);
}

export { TRANSACTION_TYPE_LABELS } from "./labels";

export interface BalanceSummary {
  spending: number; // kids.balance: cash they can spend now
  tabung: number;   // sum of goals.saved
  growth: number;   // kids.invest_balance (Growth Tabung)
  total: number;    // spending + tabung + growth
  owed: number;     // what active loans still owe; never subtracted from total
}

export function getBalanceSummary(
  kid: { balance: number | string; invest_balance?: number | string | null },
  goals: { saved: number | string }[] = [],
  loans: { amount: number | string; repaid: number | string; status: string }[] = [],
): BalanceSummary {
  const spendingCents = Math.round((Number(kid.balance) || 0) * 100);
  const growthCents = Math.round((Number(kid.invest_balance) || 0) * 100);
  const tabungCents = goals.reduce((acc, g) => acc + Math.round((Number(g.saved) || 0) * 100), 0);
  const totalCents = spendingCents + tabungCents + growthCents;

  const owedCents = loans
    .filter((l) => l.status === "active")
    .reduce((acc, l) => {
      const amt = Math.round((Number(l.amount) || 0) * 100);
      const rep = Math.round((Number(l.repaid) || 0) * 100);
      return acc + Math.max(0, amt - rep);
    }, 0);

  return {
    spending: spendingCents / 100,
    tabung: tabungCents / 100,
    growth: growthCents / 100,
    total: totalCents / 100,
    owed: owedCents / 100,
  };
}
