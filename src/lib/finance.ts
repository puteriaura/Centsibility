/**
 * Checks whether a transaction represents an outflow (debit) from the kid's wallet balance.
 */
export function isDebitTransaction(type: string, label?: string): boolean {
  if (["WITHDRAWAL", "SADAQAH", "INVEST_IN"].includes(type)) {
    return true;
  }
  if (type === "QARD") {
    if (!label) return true;
    return label === "Loan repayment" || label.toLowerCase().includes("repayment");
  }
  return false;
}

/**
 * Returns "+" or "-" sign according to the transaction direction.
 */
export function formatTransactionSign(type: string, label?: string): "+" | "-" {
  return isDebitTransaction(type, label) ? "-" : "+";
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  HIBAH: "Hibah",
  QARD: "Loan",
  SADAQAH: "Sadaqah",
  INVEST_IN: "Investment",
  INVEST_OUT: "Return",
};
