import { describe, expect, it } from "vitest";
import { SUGGESTED_REWARDS } from "../../supabase/functions/_shared/reward-catalogue";
import { DAILY_LESSONS } from "../../src/content/lessons";

describe("Final check content", () => {
  it("starts rewards at 600 points and preserves relative price order", () => {
    const prices = Object.fromEntries(SUGGESTED_REWARDS.map(({ name, cost }) => [name, cost]));
    expect(Math.min(...Object.values(prices))).toBe(600);
    expect(prices["Pick the family movie"]).toBeLessThan(prices["Cook favourite meal"]);
    expect(prices["Toy of my choice"]).toBeLessThan(prices["Stay up 30 min late"]);
  });

  it("shows only daily lessons with a numbered source", () => {
    for (const lesson of DAILY_LESSONS) {
      expect(lesson.source).toMatch(/(?:Qur’an \d+:\d+|Jamiʿ at-Tirmidhi \d+)$/);
    }
  });
});
