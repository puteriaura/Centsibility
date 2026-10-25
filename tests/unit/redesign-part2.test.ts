import { describe, expect, it } from "vitest";
import { weeklyBars, isInsightTransaction, mytDay } from "@/lib/insight-period";
import { claimDailyWelcome } from "@/lib/daily-welcome";
import { pretendTap } from "@/lib/pretend-tap";
import { kidLevel } from "@/lib/kid-level";

describe("part 2 weekly bars", () => {
  it("uses Malaysia Monday boundaries, cents and the actual current day", () => {
    const now = new Date("2026-10-28T10:00:00Z");
    const rows = [
      { type: "DEPOSIT", amount: .1, created_at: "2026-10-25T16:00:00Z" },
      { type: "DEPOSIT", amount: .2, created_at: "2026-10-26T02:00:00Z" },
      { type: "DEPOSIT", amount: 99, created_at: "2026-10-25T15:59:59Z" },
      { type: "DEPOSIT", amount: 99, created_at: "2026-10-28T10:00:01Z" },
      { type: "DEPOSIT", amount: 99, created_at: "invalid" },
    ];
    const bars = weeklyBars(rows, now);
    expect(bars).toHaveLength(7); expect(bars[0]).toEqual({ day: "Monday", date: "2026-10-26", amount: .3, today: false });
    expect(bars[6].date).toBe("2026-11-01"); expect(bars.filter(b => b.today).map(b => b.day)).toEqual(["Wednesday"]);
    expect(bars.reduce((sum, b) => sum + b.amount, 0)).toBe(.3);
  });
  it("separates the two cashflow tabs and handles an empty week", () => {
    const now = new Date("2026-10-26T05:00:00Z");
    const rows = ["DEPOSIT", "WITHDRAWAL", "GOAL_IN"].map(type => ({ type, amount: 5, created_at: "2026-10-26T00:00:00Z" }));
    expect(weeklyBars(rows.filter(t => isInsightTransaction(t, "income")), now)[0].amount).toBe(5);
    expect(weeklyBars(rows.filter(t => isInsightTransaction(t, "spending")), now)[0].amount).toBe(5);
    expect(weeklyBars([], now).map(b => b.amount)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(weeklyBars([], new Date("2026-10-25T16:00:00Z"))[0].today).toBe(true);
  });
});
describe("part 2 daily welcome", () => {
  it("claims once per Malaysia day and per child", () => {
    const values = new Map<string, string>();
    const store = () => ({ getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } });
    const before = new Date("2026-10-25T15:59:59Z"), after = new Date("2026-10-25T16:00:00Z");
    expect(mytDay(before)).toBe("2026-10-25"); expect(mytDay(after)).toBe("2026-10-26");
    expect(claimDailyWelcome("child-a", before, store)).toBe(true); expect(claimDailyWelcome("child-a", before, store)).toBe(false);
    expect(claimDailyWelcome("child-a", after, store)).toBe(true); expect(claimDailyWelcome("child-b", after, store)).toBe(true);
    expect(values.get("centsibility.welcome.child-a")).toBe("2026-10-26");
  });
  it("falls back to once per session when storage access or writes fail", () => {
    for (const storage of [() => { throw new Error("unavailable"); }, () => ({ getItem: () => null, setItem: () => { throw new Error("full"); } })]) {
      const seen = new Set<string>();
      expect(claimDailyWelcome("child", new Date("2026-10-25"), storage, seen)).toBe(true);
      expect(claimDailyWelcome("child", new Date("2026-10-26"), storage, seen)).toBe(false);
      expect(claimDailyWelcome("other", new Date("2026-10-26"), storage, seen)).toBe(true);
    }
  });
});
describe("part 2 local practice", () => {
  it("declines locks first, checks the real cap, and permits the exact limit", () => {
    expect(pretendTap(3, { locked: true, limit: 50 })).toBe("Declined: card is locked.");
    expect(pretendTap(60, { locked: false, limit: 50 })).toBe("Declined: over your RM50 limit.");
    expect(pretendTap(12, { locked: false, limit: 12 })).toBe("Paid! Under your RM12 limit.");
    expect(pretendTap(12, { locked: false, limit: Math.min(50, 10) })).toBe("Declined: over your RM10 limit.");
  });
  it("shares the existing Missions level rule without inventing progress", () => {
    expect(kidLevel({ xp: 120 })).toEqual({ level: 2, xp: 120, progress: null });
    expect(kidLevel({ xp: 120, level: 2 })).toEqual({ level: 2, xp: 120, progress: 20 });
    expect(kidLevel({ xp: 120, level: 8 }).progress).toBeNull();
  });
});
