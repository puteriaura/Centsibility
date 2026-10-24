import { describe, expect, it } from "vitest";
import { topUnfinishedGoal, weeklyIncoming } from "@/lib/home-summary";

describe("home summary", () => {
  it("includes only incoming wallet money in the last seven days and hides zero", () => {
    const now = Date.parse("2026-10-25T12:00:00Z");
    const tx = (type: string, created_at: string, amount = 2, label: string | null = null) => ({ type, created_at, amount, label });
    expect(weeklyIncoming([
      tx("DEPOSIT", "2026-10-18T12:00:00Z", 0.1),
      tx("TRANSFER_IN", "2026-10-25T12:00:00Z", 0.2),
      tx("DEPOSIT", "2026-10-18T11:59:59Z", 10),
      tx("DEPOSIT", "2026-10-25T12:00:01Z", 10),
      tx("WITHDRAWAL", "2026-10-24T12:00:00Z"),
      tx("QARD", "2026-10-24T12:00:00Z", 2, "Loan repayment"),
      tx("INVEST_GAIN", "2026-10-24T12:00:00Z"),
      tx("INVEST_LOSS", "2026-10-24T12:00:00Z"),
    ], now)).toBe(0.3);
    expect(weeklyIncoming([], now)).toBe(0);
    expect(weeklyIncoming([tx("GOAL_IN", "2026-10-24T12:00:00Z")], now) > 0).toBe(false);
  });
  it("picks the highest unfinished percentage or the start-a-goal fallback", () => {
    const goals = [{ saved: 90, target: 100 }, { saved: 150, target: 200 }, { saved: 100, target: 100 }, { saved: 0, target: 0 }];
    expect(topUnfinishedGoal(goals)).toBe(goals[0]);
    expect(topUnfinishedGoal([goals[2], goals[3]])).toBeUndefined();
    expect(topUnfinishedGoal([])).toBeUndefined();
  });
});
