import { describe, expect, it } from "vitest";
import { insightMonth, insightPeriod } from "@/lib/insight-period";

describe("Insights periods", () => {
  const tx = (
    type: string,
    amount: number,
    created_at = "2026-10-14T00:00:00Z",
  ) => ({ type, amount, created_at });
  it("separates years, respects Malaysia's month boundary and excludes saving from spending", () => {
    expect(insightMonth(new Date("2026-09-30T16:00:00Z"))).toBe("2026-10");
    const rows = [
      tx("WITHDRAWAL", 0.1),
      tx("WITHDRAWAL", 0.2),
      tx("SADAQAH", 2),
      tx("GOAL_IN", 20),
      tx("INVEST_IN", 30),
      tx("WITHDRAWAL", 100, "2025-10-14T00:00:00Z"),
      tx("DEPOSIT", 8),
    ];
    expect(insightPeriod(rows, "2026-10", "spending").totalOut).toBe(2.3);
    expect(insightPeriod(rows, "2026-10", "income").totalOut).toBe(8);
    expect(
      insightPeriod(rows, "2026-10", "spending").topCategories.reduce(
        (sum, c) => sum + c.pct,
        0,
      ),
    ).toBeCloseTo(100);
  });
  it("does not invent empty slices or compare absent data", () => {
    expect(insightPeriod([], "2026-10", "spending")).toEqual({
      totalOut: 0,
      hasData: false,
      topCategories: [],
    });
    expect(
      insightPeriod([tx("DEPOSIT", 0)], "2026-10", "income").topCategories,
    ).toEqual([]);
  });
});
