import { describe, it, expect } from "vitest";
import { computeQardPayout, QARD_FEES, QARD_MIN_LOAN, QARD_MAX_LOAN } from "../../src/lib/qard";

describe("Qard Hasan", () => {
  it.each([100, 10, 4.1, 0.5])("pays the full RM%s without fees", (amount) => {
    expect(computeQardPayout(amount)).toEqual({ adminFee: 0, totalFees: 0, payout: amount });
  });

  it("charges no admin fee and keeps current loan limits", () => {
    expect(QARD_FEES.admin).toBe(0);
    expect(QARD_MIN_LOAN).toBe(10);
    expect(QARD_MAX_LOAN).toBe(500);
  });
});
