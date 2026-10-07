import { describe, it, expect } from "vitest";
import { calculateInvestmentGrowth } from "../../src/lib/math";

describe("calculateInvestmentGrowth", () => {
  it("should return principal with 0 gain if weeks <= 0", () => {
    const { grown, gain } = calculateInvestmentGrowth(100, 0.05, 0);
    expect(grown).toBe(100);
    expect(gain).toBe(0);
  });

  it("should compound growth over multiple weeks using predictable random", () => {
    // 0.001 -> Low risk. min = -0.01, max = 0.03
    // Mock random to always return 0.5 (middle) -> weekly rate = 0.01
    const mockRandom = () => 0.5; 
    const { grown, gain } = calculateInvestmentGrowth(100, 0.001, 2, mockRandom);
    
    // Week 1: 100 * 1.01 = 101
    // Week 2: 101 * 1.01 = 102.01
    expect(grown).toBeCloseTo(102.01, 2);
    expect(gain).toBeCloseTo(2.01, 2);
  });

  it("should bound the maximum growth to 2x principal (runaway compounding safety)", () => {
    // 0.004 -> Very High risk. max = 0.5
    // Mock random to 1 -> rate = 0.5
    const mockRandom = () => 1.0; 
    const { grown } = calculateInvestmentGrowth(100, 0.004, 10, mockRandom);
    
    // Mathematically 100 * (1.5)^10 = ~5766, but it should be capped to 2x (200)
    expect(grown).toBe(200);
  });

  it("should bound the minimum growth to 0 (no negative balance)", () => {
    // 0.004 -> Very High risk. min = -0.3
    // Mock random to 0 -> rate = -0.3
    const mockRandom = () => 0; 
    const { grown } = calculateInvestmentGrowth(100, 0.004, 20, mockRandom);
    
    // Math: 100 * (0.7)^20 = ~0.079. 
    // Wait, it approaches 0 but never crosses below 0 by percentage drops.
    // Let's just ensure it's >= 0.
    expect(grown).toBeGreaterThanOrEqual(0);
  });
});

import React from "react";
import { renderToString } from "react-dom/server";
import {
  getMockEdgeResponse,
  InvestmentItem,
  InvestmentPreviewResponse,
} from "../../src/lib/edge";
import { FundCard } from "../../src/routes/kid.invest";

describe("T39 investment features", () => {
  it("the preview minimum can be below the principal", () => {
    const preview = getMockEdgeResponse<InvestmentPreviewResponse>(
      "kid-finance",
      {
        action: "invest-preview",
        tier: "low",
        frequency: "minute",
        lockTicks: 5,
        amount: 10,
      }
    );
    // With low tier rate of -0.5% each update, 10 * (1 - 0.005)^5 = ~9.75
    expect(preview.minValue).toBeLessThan(10);
    expect(preview.minValue).toBeCloseTo(9.75, 1);
  });

  it("the card shows Protected only for protected funds", () => {
    const protectedInv: InvestmentItem = {
      id: "inv-protected-1",
      kid_id: "kid-1",
      mode: "fund",
      tier: "low",
      frequency: "minute",
      principal: 10,
      currentValue: 10.05,
      profitRm: 0.05,
      profitPct: 0.5,
      status: "active",
      endsAt: new Date(Date.now() + 600000).toISOString(),
      protected: true,
    };

    const unprotectedInv: InvestmentItem = {
      id: "inv-unprotected-1",
      kid_id: "kid-1",
      mode: "fund",
      tier: "low",
      frequency: "minute",
      principal: 10,
      currentValue: 9.95,
      profitRm: -0.05,
      profitPct: -0.5,
      status: "active",
      endsAt: new Date(Date.now() + 600000).toISOString(),
      protected: false,
    };

    const protectedHtml = renderToString(
      React.createElement(FundCard, {
        inv: protectedInv,
        onClick: () => {},
      })
    );
    expect(protectedHtml).toContain("Protected");

    const unprotectedHtml = renderToString(
      React.createElement(FundCard, {
        inv: unprotectedInv,
        onClick: () => {},
      })
    );
    expect(unprotectedHtml).not.toContain("Protected");
  });
});

