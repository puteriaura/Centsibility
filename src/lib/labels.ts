export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  HIBAH: "Hibah",
  QARD: "Qard loan",
  QARD_REPAY: "Loan repayment",
  FEE: "Loan fee",
  SADAQAH: "Sadaqah",
  GOAL_IN: "Tabung deposit",
  GOAL_OUT: "Back from Tabung",
  INVEST_IN: "Moved to Investment",
  INVEST_OUT: "Back from Investment",
  INVEST_GAIN: "Investment profit",
  INVEST_LOSS: "Investment loss",
  TRANSFER_IN: "Transfer received",
  TRANSFER_OUT: "Transfer sent",
  CHORE: "Chore reward",
};

export const APPROVAL_KIND_LABELS: Record<string, string> = {
  DEPOSIT: "Deposit request",
  WITHDRAWAL: "Withdrawal request",
  QARD: "Loan request",
  TRANSFER: "Transfer request",
  REWARD: "Reward request",
  CHORE: "Chore request",
};

export function humanizeCode(code: string): string {
  if (!code) return "";
  const text = code.replace(/[_-]+/g, " ").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const CODE_LIKE_UPPER = /^[A-Z0-9]{2,}(_[A-Z0-9]+)*$/;
const CODE_LIKE_LOWER = /^[a-z0-9]+(_[a-z0-9]+)+$/;

export function isCodeLike(text: string): boolean {
  if (!text) return false;
  return CODE_LIKE_UPPER.test(text) || CODE_LIKE_LOWER.test(text);
}

export function transactionTypeLabel(type: string, label?: string | null): string {
  if (type === "QARD" && label === "Loan repayment") {
    return "Loan repayment";
  }
  if (type in TRANSACTION_TYPE_LABELS) {
    return TRANSACTION_TYPE_LABELS[type];
  }
  return humanizeCode(type);
}

export function transactionTitle(t: { type: string; label?: string | null }): string {
  const label = t.label?.trim();
  if (!label) {
    return transactionTypeLabel(t.type, t.label);
  }
  if (isCodeLike(label)) {
    if (label in TRANSACTION_TYPE_LABELS) {
      return TRANSACTION_TYPE_LABELS[label];
    }
    return transactionTypeLabel(t.type, t.label);
  }
  return label;
}

export function approvalKindLabel(kind: string): string {
  return APPROVAL_KIND_LABELS[kind] ?? humanizeCode(kind);
}

// The parent's wording for a chore's status, shown once wherever a chore appears.
export function choreStatusLabel(status: string, kidName: string): string {
  switch (status) {
    case "OPEN":
      return `Waiting for ${kidName}`;
    case "DONE":
      return "Done, needs your OK";
    case "APPROVED":
      return "Paid";
    case "DECLINED":
      return "Not approved";
    default:
      return humanizeCode(status);
  }
}

// Replaces raw codes and underscores with human labels.
export function sanitizeDisplayText(text: string): string {
  if (!text) return "";

  // 1. First replace underscore-joined tokens: \b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b or \b[a-z]+(?:_[a-z]+)+\b
  let result = text.replace(
    /\b(?:[A-Z0-9]+(?:_[A-Z0-9]+)+|[a-z0-9]+(?:_[a-z0-9]+)+)\b/g,
    (match) => {
      if (match in TRANSACTION_TYPE_LABELS) return TRANSACTION_TYPE_LABELS[match];
      if (match in APPROVAL_KIND_LABELS) return APPROVAL_KIND_LABELS[match];
      return humanizeCode(match);
    }
  );

  // 2. Also replace standalone uppercase type/kind names like WITHDRAWAL, DEPOSIT, SADAQAH
  result = result.replace(/\b[A-Z]{3,}\b/g, (match) => {
    if (match in APPROVAL_KIND_LABELS && text.toLowerCase().includes("kind")) {
      return APPROVAL_KIND_LABELS[match];
    }
    if (match in TRANSACTION_TYPE_LABELS) {
      return TRANSACTION_TYPE_LABELS[match];
    }
    if (match in APPROVAL_KIND_LABELS) {
      return APPROVAL_KIND_LABELS[match];
    }
    return match;
  });

  return result;
}
