export const PENNY_ALLOWLIST = {
  education: [], navigation: ["screen"], numeric: [],
  spending: ["period", "totalSpent", "categoryTotals"],
  comparison: ["periods"], frequency: ["period", "categoryCounts"],
  budget: ["period", "availableSpending", "expectedIncome", "selectedObligations"],
  goal: ["remainingAmount", "timeRemainingDays", "plannedContribution"],
  loan: ["outstanding", "dueInDays", "requiredRepayment"],
  investment: ["positionType", "returnPct", "timeLeftDays", "quoteAvailable"],
  card: ["frozen", "parentManaged"],
  quest: ["publicDescription", "completed", "streakDays"], sensitive: [],
} as const;
export type PennyIntent = keyof typeof PENNY_ALLOWLIST;

// Only a canonical topic label may cross the history boundary. It grants no data access.
export function canonicalPreviousIntent(value: unknown): PennyIntent | undefined {
  return typeof value === "string" && Object.hasOwn(PENNY_ALLOWLIST, value)
    ? value as PennyIntent : undefined;
}
export function previousTurnIntent(turns: ReadonlyArray<{ role: string; intent?: unknown }>): PennyIntent | undefined {
  const last = [...turns].reverse().find(turn => turn.role === "assistant");
  return canonicalPreviousIntent(last?.intent);
}
