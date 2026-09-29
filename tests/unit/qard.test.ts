import { describe, it, expect } from "vitest";
import { computeQardPayout, QARD_FEES, QARD_MIN_LOAN, QARD_MAX_LOAN } from "../../src/lib/qard";

describe("computeQardPayout", () => {
  it("computes fee and payout for RM100 loan", () => {
    const res = computeQardPayout(100);
    expect(res.adminFee).toBe(1.0);
    expect(res.totalFees).toBe(1.0);
    expect(res.payout).toBe(99.0);
  });

  it("computes fee and payout for RM10 loan", () => {
    const res = computeQardPayout(10);
    expect(res.adminFee).toBe(1.0);
    expect(res.totalFees).toBe(1.0);
    expect(res.payout).toBe(9.0);
  });

  it("computes fee and payout for RM4.10 loan (legacy amount; cents are exact)", () => {
    const res = computeQardPayout(4.1);
    expect(res.adminFee).toBe(1.0);
    expect(res.totalFees).toBe(1.0);
    expect(res.payout).toBe(3.1);
  });

  it("computes capped fee and payout for RM0.50 loan (legacy amount)", () => {
    const res = computeQardPayout(0.5);
    expect(res.adminFee).toBe(0.5);
    expect(res.totalFees).toBe(0.5);
    expect(res.payout).toBe(0);
  });

  it("exposes fee constants and loan limits", () => {
    expect(QARD_FEES.admin).toBe(1.0);
    expect(QARD_MIN_LOAN).toBe(10);
    expect(QARD_MAX_LOAN).toBe(500);
  });
});
