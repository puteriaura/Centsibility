import { describe, expect, it } from "vitest";
import {
  TRANSACTION_TYPE_LABELS,
  humanizeCode,
  isCodeLike,
  transactionTypeLabel,
  transactionTitle,
  approvalKindLabel,
  sanitizeDisplayText,
} from "@/lib/labels";

describe("labels", () => {
  it("formats each of the 16 types without underscores or all-capitals", () => {
    const keys = Object.keys(TRANSACTION_TYPE_LABELS);
    expect(keys.length).toBe(16);
    for (const key of keys) {
      const label = TRANSACTION_TYPE_LABELS[key];
      expect(label).not.toContain("_");
      expect(label).not.toBe(label.toUpperCase());
    }
  });

  it("humanizeCode handles underscores, hyphens, and empty strings", () => {
    expect(humanizeCode("QARD_REPAY")).toBe("Qard repay");
    expect(humanizeCode("very_low")).toBe("Very low");
    expect(humanizeCode("")).toBe("");
    expect(humanizeCode("transfer-pending")).toBe("Transfer pending");
  });

  it("isCodeLike identifies code-like strings", () => {
    expect(isCodeLike("QARD_REPAY")).toBe(true);
    expect(isCodeLike("DEPOSIT")).toBe(true);
    expect(isCodeLike("very_low")).toBe(true);
    expect(isCodeLike("Saved to Bicycle")).toBe(false);
    expect(isCodeLike("Deposit")).toBe(false);
  });

  it("transactionTypeLabel returns legacy and mapped labels", () => {
    expect(transactionTypeLabel("QARD", "Loan repayment")).toBe("Loan repayment");
    expect(transactionTypeLabel("QARD")).toBe("Qard loan");
    expect(transactionTypeLabel("GOAL_IN")).toBe("Tabung deposit");
    expect(transactionTypeLabel("UNKNOWN_CODE")).toBe("Unknown code");
  });

  it("transactionTitle correctly derives title from label and type", () => {
    expect(transactionTitle({ type: "DEPOSIT", label: "DEPOSIT" })).toBe("Deposit");
    expect(transactionTitle({ type: "GOAL_IN", label: "Saved to Bicycle" })).toBe("Saved to Bicycle");
    expect(transactionTitle({ type: "WITHDRAWAL", label: "" })).toBe("Withdrawal");
    expect(transactionTitle({ type: "HIBAH", label: null })).toBe("Hibah");
    expect(transactionTitle({ type: "QARD_REPAY", label: "QARD_REPAY" })).toBe("Loan repayment");
  });

  it("approvalKindLabel formats approval kinds", () => {
    expect(approvalKindLabel("DEPOSIT")).toBe("Deposit request");
    expect(approvalKindLabel("WITHDRAWAL")).toBe("Withdrawal request");
    expect(approvalKindLabel("QARD")).toBe("Loan request");
    expect(approvalKindLabel("TRANSFER")).toBe("Transfer request");
    expect(approvalKindLabel("REWARD")).toBe("Reward request");
    expect(approvalKindLabel("custom_kind")).toBe("Custom kind");
  });

  it("sanitizeDisplayText cleans up codes and underscores in messages", () => {
    const errorWithKind = 'Invalid kind "WITHDRAWAL"';
    expect(sanitizeDisplayText(errorWithKind)).not.toContain("WITHDRAWAL");
    expect(sanitizeDisplayText("self_transfer")).toBe("Self transfer");
    expect(sanitizeDisplayText("Error in QARD_REPAY processing")).toContain("Loan repayment");
  });
});
