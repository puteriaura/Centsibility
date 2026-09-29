const DEBIT_TYPES = new Set(["WITHDRAWAL", "SADAQAH", "INVEST_IN", "FEE", "QARD_REPAY", "GOAL_IN"]);

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
 * Checks whether a transaction represents spending (outflow) rather than
 * moving money into personal savings/investments or pot-only adjustments.
 */
export function isSpendingTransaction(type: string, label?: string | null): boolean {
  return isWalletTransaction(type) && isDebitTransaction(type, label) && !SAVINGS_MOVE_TYPES.has(type);
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  HIBAH: "Hibah",
  QARD: "Loan",
  SADAQAH: "Sadaqah",
  INVEST_IN: "Investment",
  INVEST_OUT: "Return",
  FEE: "Fee",
  QARD_REPAY: "Loan repayment",
  GOAL_IN: "Saved to goal",
  INVEST_GAIN: "Investment growth",
  INVEST_LOSS: "Investment loss",
  GOAL_OUT: "Moved back from goal",
};
