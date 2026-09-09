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
