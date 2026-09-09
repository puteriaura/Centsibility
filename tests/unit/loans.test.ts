import { describe, it, expect } from "vitest";
import { calculateLoanRepayment } from "../../src/lib/math";

describe("calculateLoanRepayment", () => {
  it("should calculate partial repayment correctly", () => {
    const { newRepaid, fullyRepaid } = calculateLoanRepayment(100, 20, 30);
    expect(newRepaid).toBe(50);
    expect(fullyRepaid).toBe(false);
  });

  it("should calculate exact full repayment correctly", () => {
    const { newRepaid, fullyRepaid } = calculateLoanRepayment(100, 50, 50);
    expect(newRepaid).toBe(100);
    expect(fullyRepaid).toBe(true);
  });

  it("should cap overpayment to the loan amount", () => {
    const { newRepaid, fullyRepaid } = calculateLoanRepayment(100, 90, 50);
    expect(newRepaid).toBe(100);
    expect(fullyRepaid).toBe(true);
  });

  it("should handle floating point inaccuracies (e.g. 0.1 + 0.2)", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    // If loan is 0.3, and we paid 0.1 then pay 0.2, it should be fully repaid
    const { newRepaid, fullyRepaid } = calculateLoanRepayment(0.3, 0.1, 0.2);
    expect(fullyRepaid).toBe(true);
    // Even if mathematically the difference is a tiny epsilon
  });

  it("should handle floating point under-calculations near epsilon", () => {
    // Example: loan 100, repaid 99.9999
    // Due to precision, JS might say it's not exactly 100
    const { fullyRepaid } = calculateLoanRepayment(100, 0, 99.9995);
    expect(fullyRepaid).toBe(true); // Within 0.001 epsilon
  });
});
