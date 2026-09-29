import { describe, expect, it } from "vitest";
import { formatDate, formatRM } from "@/lib/format";

describe("formatRM", () => {
  it("uses one tight format with thousands separators", () => {
    expect(formatRM(1536.29)).toBe("RM1,536.29");
    expect(formatRM(0)).toBe("RM0.00");
    expect(formatRM(15)).toBe("RM15.00");
  });

  it("uses a true minus sign for negatives and an optional plus", () => {
    expect(formatRM(-12)).toBe("−RM12.00");
    expect(formatRM(25, { sign: true })).toBe("+RM25.00");
    expect(formatRM(0, { sign: true })).toBe("RM0.00");
  });

  it("treats non-finite input as zero", () => {
    expect(formatRM(Number.NaN)).toBe("RM0.00");
  });
});

describe("formatDate", () => {
  it("renders day, short month and year", () => {
    expect(formatDate(new Date(2026, 8, 5))).toBe("05 Sep 2026");
    expect(formatDate("2026-10-10T16:15:11.093Z")).toMatch(/^1[01] Oct 2026$/);
  });

  it("returns an empty string for invalid dates", () => {
    expect(formatDate("not a date")).toBe("");
  });
});
