import { isDebitTransaction, isWalletTransaction } from "./finance";

/** Incoming wallet money in the trailing seven days, with a zero total hidden. */
export function weeklyIncoming(txs: ReadonlyArray<{ type: string; label?: string | null; amount: number | string; created_at: string }>, now = Date.now()): number {
  const start = now - 7 * 24 * 60 * 60 * 1000;
  return txs.reduce((cents, t) => {
    const date = Date.parse(t.created_at);
    return date >= start && date <= now && isWalletTransaction(t.type) && !isDebitTransaction(t.type, t.label)
      ? cents + Math.round(Number(t.amount) * 100) : cents;
  }, 0) / 100;
}

export function topUnfinishedGoal<T extends { saved: number | string; target: number | string }>(goals: readonly T[]): T | undefined {
  return goals.filter(g => Number(g.target) > 0 && Number(g.saved) < Number(g.target))
    .reduce<T | undefined>((top, goal) => !top || Number(goal.saved) / Number(goal.target) > Number(top.saved) / Number(top.target) ? goal : top, undefined);
}
