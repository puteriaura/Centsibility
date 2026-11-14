export const DEBIT_TYPES = new Set([
  "WITHDRAWAL", "SADAQAH", "INVEST_IN", "FEE", "QARD_REPAY", "GOAL_IN", "TRANSFER_OUT",
]);

export const KNOWN_CREDIT_TYPES = new Set([
  "DEPOSIT", "HIBAH", "GOAL_OUT", "INVEST_OUT", "TRANSFER_IN", "QARD", "CHORE",
]);

export const POT_ONLY_TYPES = new Set(["INVEST_GAIN", "INVEST_LOSS"]);

export function isWalletTransaction(type: string): boolean {
  return !POT_ONLY_TYPES.has(type);
}

export function isDebitTransaction(type: string, label?: string | null): boolean {
  return DEBIT_TYPES.has(type) || (type === "QARD" && label === "Loan repayment");
}

export function walletDeltaCents(tx: { type: string; label?: string | null; amount: number | string }): number {
  if (!isWalletTransaction(tx.type)) return 0;
  return (isDebitTransaction(tx.type, tx.label) ? -1 : 1) * Math.round(Number(tx.amount) * 100);
}
