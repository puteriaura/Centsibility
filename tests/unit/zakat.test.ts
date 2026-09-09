import { describe, it, expect } from "vitest";

// Zakat pure logic for testing
export function calculateZakat(netWealth: number, nisab: number = 22000, zakatRate: number = 0.025): number {
  const aboveNisab = netWealth >= nisab;
  return aboveNisab ? netWealth * zakatRate : 0;
}

describe("Zakat Calculator Logic", () => {
  it("should return 0 if net wealth is below Nisab", () => {
    expect(calculateZakat(10000)).toBe(0);
  });

  it("should calculate 2.5% if net wealth is exactly Nisab", () => {
    expect(calculateZakat(22000)).toBe(550);
  });

  it("should calculate 2.5% if net wealth is above Nisab", () => {
    expect(calculateZakat(100000)).toBe(2500);
  });
});
