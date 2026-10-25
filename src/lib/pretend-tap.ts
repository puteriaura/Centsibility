/** Local practice feedback only. No request, ledger or persisted state. */
export function pretendTap(price: number, { locked, limit }: { locked: boolean; limit: number }): string {
  if (locked) return "Declined: card is locked.";
  if (price > limit) return `Declined: over your RM${limit} limit.`;
  return `Paid! Under your RM${limit} limit.`;
}
