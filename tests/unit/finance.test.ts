import { describe, expect, it } from "vitest";
import {
  isDebitTransaction,
  formatTransactionSign,
  isWalletTransaction,
  isSpendingTransaction,
  getBalanceSummary,
} from "@/lib/finance";
import { buildSpendingSummary } from "@/lib/penny-insights";

describe("isDebitTransaction", () => {
  it("treats money leaving the account as a debit", () => {
    const debitTypes = ["WITHDRAWAL", "SADAQAH", "INVEST_IN", "FEE", "QARD_REPAY", "GOAL_IN", "TRANSFER_OUT"];
    for (const type of debitTypes) {
      expect(isDebitTransaction(type)).toBe(true);
      expect(formatTransactionSign(type)).toBe("-");
    }
  });

  it("treats credit types as not debit", () => {
    const creditTypes = ["DEPOSIT", "HIBAH", "INVEST_OUT", "TRANSFER_IN"];
    for (const type of creditTypes) {
      expect(isDebitTransaction(type)).toBe(false);
      expect(formatTransactionSign(type)).toBe("+");
    }
  });

  it("treats QARD disbursements as credits", () => {
    expect(isDebitTransaction("QARD")).toBe(false);
    expect(formatTransactionSign("QARD")).toBe("+");

    expect(isDebitTransaction("QARD", "Qard approved: new bike")).toBe(false);
    expect(formatTransactionSign("QARD", "Qard approved: new bike")).toBe("+");

    expect(isDebitTransaction("QARD", "Qard approved: repayment for my friend")).toBe(false);
    expect(formatTransactionSign("QARD", "Qard approved: repayment for my friend")).toBe("+");
  });

  it("treats legacy QARD with exact label Loan repayment as a debit", () => {
    expect(isDebitTransaction("QARD", "Loan repayment")).toBe(true);
    expect(formatTransactionSign("QARD", "Loan repayment")).toBe("-");
  });
});

describe("isWalletTransaction", () => {
  it("returns true for wallet transactions", () => {
    const walletTypes = [
      "DEPOSIT",
      "WITHDRAWAL",
      "HIBAH",
      "QARD",
      "SADAQAH",
      "INVEST_IN",
      "INVEST_OUT",
      "FEE",
      "QARD_REPAY",
      "GOAL_IN",
      "GOAL_OUT",
      "TRANSFER_IN",
      "TRANSFER_OUT",
    ];
    for (const type of walletTypes) {
      expect(isWalletTransaction(type)).toBe(true);
    }
  });

  it("returns false for pot-only transactions", () => {
    expect(isWalletTransaction("INVEST_GAIN")).toBe(false);
    expect(isWalletTransaction("INVEST_LOSS")).toBe(false);
  });
});

describe("penny-insights QARD disbursement", () => {
  it("does not count QARD loan disbursement as an outflow", () => {
    const now = new Date().toISOString();
    const summary = buildSpendingSummary([
      {
        id: "1",
        type: "QARD",
        label: "Qard approved: new bike",
        amount: 100,
        created_at: now,
      },
      {
        id: "2",
        type: "WITHDRAWAL",
        label: "Book",
        amount: 25,
        created_at: now,
      },
    ]);

    expect(summary.moneyIn).toBe(100);
    expect(summary.moneyOut).toBe(25);
    expect(summary.topCategories.some((c) => c.key === "QARD" || c.label === "Loan activity")).toBe(false);
  });

  it("does not change money in or out when investment gain or loss occurs", () => {
    const now = new Date().toISOString();
    const summary = buildSpendingSummary([
      {
        id: "1",
        type: "DEPOSIT",
        label: "Allowance",
        amount: 50,
        created_at: now,
      },
      {
        id: "2",
        type: "WITHDRAWAL",
        label: "Lunch",
        amount: 15,
        created_at: now,
      },
      {
        id: "3",
        type: "INVEST_GAIN",
        label: "Investment growth (1w)",
        amount: 20,
        created_at: now,
      },
      {
        id: "4",
        type: "INVEST_LOSS",
        label: "Investment loss (1w)",
        amount: 5,
        created_at: now,
      },
    ]);

    expect(summary.moneyIn).toBe(50);
    expect(summary.moneyOut).toBe(15);
    expect(summary.txCount).toBe(2);
  });
});

describe("isSpendingTransaction", () => {
  it("counts WITHDRAWAL, SADAQAH, FEE and QARD_REPAY as spending", () => {
    const spendingTypes = ["WITHDRAWAL", "SADAQAH", "FEE", "QARD_REPAY"];
    for (const type of spendingTypes) {
      expect(isSpendingTransaction(type)).toBe(true);
    }
  });

  it("does not count savings moves (INVEST_IN, GOAL_IN)", () => {
    expect(isSpendingTransaction("INVEST_IN")).toBe(false);
    expect(isSpendingTransaction("GOAL_IN")).toBe(false);
  });

  it("does not count credit types as spending", () => {
    const creditTypes = ["DEPOSIT", "HIBAH", "QARD", "INVEST_OUT", "GOAL_OUT"];
    for (const type of creditTypes) {
      expect(isSpendingTransaction(type)).toBe(false);
    }
  });

  it("does not count pot-only transactions as spending", () => {
    expect(isSpendingTransaction("INVEST_GAIN")).toBe(false);
    expect(isSpendingTransaction("INVEST_LOSS")).toBe(false);
  });

  it("treats legacy QARD with exact label Loan repayment as spending", () => {
    expect(isSpendingTransaction("QARD", "Loan repayment")).toBe(true);
  });

  it("does not treat normal QARD loan disbursement as spending", () => {
    expect(isSpendingTransaction("QARD", "Qard approved: bike")).toBe(false);
  });
});

describe("getBalanceSummary", () => {
  it("calculates spending, tabung, growth, total, and owed correctly", () => {
    const summary = getBalanceSummary(
      { balance: 57, invest_balance: 0 },
      [{ saved: 27 }, { saved: 3 }],
      [{ amount: 100, repaid: 34, status: "active" }],
    );
    expect(summary.spending).toBe(57);
    expect(summary.tabung).toBe(30);
    expect(summary.growth).toBe(0);
    expect(summary.total).toBe(87);
    expect(summary.owed).toBe(66);
  });

  it("avoids floating-point drift: 0.1 + 0.2 sums to 0.3", () => {
    const summary = getBalanceSummary(
      { balance: 0.1, invest_balance: 0 },
      [{ saved: 0.2 }],
      [],
    );
    expect(summary.total).toBe(0.3);
  });

  it("treats repaid or non-active loans as owing nothing", () => {
    const summary = getBalanceSummary(
      { balance: 50, invest_balance: 10 },
      [{ saved: 20 }],
      [
        { amount: 100, repaid: 100, status: "active" },
        { amount: 100, repaid: 0, status: "repaid" },
      ],
    );
    expect(summary.owed).toBe(0);
    expect(summary.total).toBe(80);
  });

  it("handles missing or null invest_balance as 0", () => {
    const summary = getBalanceSummary(
      { balance: 40, invest_balance: null },
      [{ saved: 15 }],
      [],
    );
    expect(summary.growth).toBe(0);
    expect(summary.total).toBe(55);
  });
});

