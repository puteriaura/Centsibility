import { describe, expect, it } from "vitest";
import {
  validateTransferAmount,
  validateTransferNote,
} from "@/features/transfer/validate";

describe("validateTransferAmount", () => {
  it("rejects empty, null, undefined and invalid strings", () => {
    expect(validateTransferAmount("").valid).toBe(false);
    expect(validateTransferAmount(null).valid).toBe(false);
    expect(validateTransferAmount(undefined).valid).toBe(false);
    expect(validateTransferAmount("abc").valid).toBe(false);
    expect(validateTransferAmount(NaN).valid).toBe(false);
  });

  it("rejects zero and negative amounts", () => {
    const res0 = validateTransferAmount(0);
    expect(res0.valid).toBe(false);
    expect(res0.error).toContain("Minimum transfer is RM1.00");

    const resNeg = validateTransferAmount(-5);
    expect(resNeg.valid).toBe(false);
    expect(resNeg.error).toContain("Minimum transfer is RM1.00");
  });

  it("rejects amounts below minimum RM1.00", () => {
    const res = validateTransferAmount(0.99);
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Minimum transfer is RM1.00");
  });

  it("rejects fractional cents with more than 2 decimal places", () => {
    const res1 = validateTransferAmount("5.001");
    expect(res1.valid).toBe(false);
    expect(res1.error).toBe("Amount cannot have fractional cents");

    const res2 = validateTransferAmount(5.1234);
    expect(res2.valid).toBe(false);
    expect(res2.error).toBe("Amount cannot have fractional cents");
  });

  it("rejects amounts exceeding available balance", () => {
    const res = validateTransferAmount(60, { balance: 50 });
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Amount exceeds your available balance");
  });

  it("rejects amounts exceeding daily transfer cap", () => {
    const res = validateTransferAmount(30, { balance: 100, dailyLeft: 20 });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Amount exceeds daily transfer limit");
  });

  it("rejects amounts exceeding maximum limit", () => {
    const res = validateTransferAmount(1500, { max: 1000 });
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Maximum transfer is RM1000.00");
  });

  it("accepts valid amounts within limits", () => {
    const res1 = validateTransferAmount(1.0);
    expect(res1.valid).toBe(true);
    expect(res1.amount).toBe(1.0);

    const res2 = validateTransferAmount("25.50", { balance: 50, dailyLeft: 50 });
    expect(res2.valid).toBe(true);
    expect(res2.amount).toBe(25.5);

    const res3 = validateTransferAmount(50, { balance: 50, dailyLeft: 50 });
    expect(res3.valid).toBe(true);
    expect(res3.amount).toBe(50.0);
  });
});

describe("validateTransferNote", () => {
  it("allows empty or omitted note", () => {
    expect(validateTransferNote(null)).toEqual({ valid: true, note: undefined });
    expect(validateTransferNote("")).toEqual({ valid: true, note: undefined });
    expect(validateTransferNote("   ")).toEqual({ valid: true, note: undefined });
  });

  it("trims and accepts note up to 40 characters", () => {
    const res = validateTransferNote("  Lunch money  ");
    expect(res.valid).toBe(true);
    expect(res.note).toBe("Lunch money");

    const exact40 = "A".repeat(40);
    expect(validateTransferNote(exact40)).toEqual({ valid: true, note: exact40 });
  });

  it("rejects notes longer than 40 characters", () => {
    const tooLong = "A".repeat(41);
    const res = validateTransferNote(tooLong);
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Note must be 40 characters or less");
  });
});
