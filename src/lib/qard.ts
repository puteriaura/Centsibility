export interface ParsedQardReason {
  reason: string;
  dueDays: number;
  signature: string | null;
}

/**
 * Parses a Qard loan reason string encoded with signature and due days.
 * Format: `${reason} (due ${dueDays}d) :: SIG::${signature}`
 */
export function parseQardReason(rawReason: string | null | undefined): ParsedQardReason {
  const [main, sig] = (rawReason || "").split(" :: SIG::");
  const dueMatch = main.match(/\(due (\d+)d\)/);
  const dueDays = dueMatch ? parseInt(dueMatch[1], 10) : 14;
  const cleanReason = main.replace(/\(due \d+d\)$/, "").trim();
  return { reason: cleanReason, dueDays, signature: sig || null };
}

/**
 * Extracts just the clean human-readable reason from a formatted approval reason string.
 */
export function cleanApprovalReason(rawReason: string | null | undefined): string {
  return parseQardReason(rawReason).reason;
}

// Keep in sync with resolve_approval in supabase/migrations/20261114000000_final_check_fixes.sql
export const QARD_FEES = { admin: 0.0 } as const;
export const QARD_MIN_LOAN = 10;
export const QARD_MAX_LOAN = 500;

export function computeQardPayout(amount: number) {
  const amountCents = Math.round(amount * 100);
  const feeCents = Math.min(Math.round(QARD_FEES.admin * 100), amountCents);
  const payoutCents = amountCents - feeCents;

  const adminFee = feeCents / 100;
  return {
    adminFee,
    totalFees: adminFee,
    payout: payoutCents / 100,
  };
}
