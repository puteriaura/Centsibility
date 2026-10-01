// src/features/transfer/validate.ts
// Validation rules for family transfers (kid and parent)

export interface TransferValidationLimits {
  min?: number;
  balance?: number;
  dailyLeft?: number;
  max?: number;
}

export interface TransferValidationResult {
  valid: boolean;
  amount?: number;
  error?: string;
}

export function validateTransferAmount(
  raw: string | number | null | undefined,
  limits: TransferValidationLimits = {}
): TransferValidationResult {
  if (raw === null || raw === undefined || raw === "") {
    return { valid: false, error: "Enter an amount" };
  }

  const num = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (isNaN(num) || !isFinite(num)) {
    return { valid: false, error: "Enter a valid amount" };
  }

  const min = limits.min ?? 1.0;
  if (num < min) {
    return { valid: false, error: `Minimum transfer is RM${min.toFixed(2)}` };
  }

  // Fractional cents check (e.g. 5.001)
  const parts = String(raw).trim().split(".");
  if (parts.length > 1 && parts[1].length > 2) {
    return { valid: false, error: "Amount cannot have fractional cents" };
  }
  if (Math.round(num * 100) !== num * 100) {
    return { valid: false, error: "Amount cannot have fractional cents" };
  }

  if (limits.max !== undefined && num > limits.max) {
    return { valid: false, error: `Maximum transfer is RM${limits.max.toFixed(2)}` };
  }

  if (limits.balance !== undefined && num > limits.balance) {
    return { valid: false, error: "Amount exceeds your available balance" };
  }

  if (limits.dailyLeft !== undefined && num > limits.dailyLeft) {
    return {
      valid: false,
      error: `Amount exceeds daily transfer limit (RM${limits.dailyLeft.toFixed(2)} left today)`,
    };
  }

  return { valid: true, amount: Math.round(num * 100) / 100 };
}

export function validateTransferNote(
  note: string | null | undefined
): { valid: boolean; note?: string; error?: string } {
  if (!note || !note.trim()) {
    return { valid: true, note: undefined };
  }
  const clean = note.trim();
  if (clean.length > 40) {
    return { valid: false, error: "Note must be 40 characters or less" };
  }
  return { valid: true, note: clean };
}
