// supabase/functions/_shared/investments_test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { currentInvestmentValues } from "./investments.ts";
import { buildKidCoachContext } from "./deepseek.ts";

function createStubAdmin(options: {
  investments: any[];
  quotes?: Record<string, any>;
  fundPaths?: Record<string, any[]>;
}) {
  return {
    from(table: string) {
      if (table === "investments") {
        return {
          select(_cols = "*") {
            const chain = {
              eq(col: string, val: any) {
                return chain;
              },
              order(_col: string, _opts: any) {
                return Promise.resolve({ data: options.investments, error: null });
              },
            };
            return chain;
          },
        };
      }
      if (table === "market_quotes") {
        return {
          select(_cols = "*") {
            return {
              eq(col: string, val: any) {
                return {
                  async maybeSingle() {
                    const row = options.quotes?.[val] || null;
                    return { data: row, error: null };
                  },
                };
              },
            };
          },
        };
      }
      return {};
    },
    rpc(fn: string, params: any) {
      if (fn === "investment_fund_path") {
        const rows = options.fundPaths?.[params.p_id] || [];
        return Promise.resolve({ data: rows, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
}

Deno.test("investments: market position at +10% counts as 1.10 * principal", async () => {
  const principal = 50.0;
  const entryPrice = 100.0;
  const currentPrice = 110.0; // +10%

  const stubAdmin = createStubAdmin({
    investments: [
      {
        id: "inv-market-1",
        kid_id: "kid-1",
        mode: "market",
        symbol: "SPUS",
        principal,
        entry_price: entryPrice,
        status: "active",
        created_at: new Date().toISOString(),
      },
    ],
    quotes: {
      SPUS: {
        symbol: "SPUS",
        price: currentPrice,
        fetched_at: new Date().toISOString(),
        is_market_open: true,
      },
    },
  });

  const res = await currentInvestmentValues(stubAdmin, "kid-1");

  // +10% of 50.00 is 55.00 (= 1.10 * principal)
  assertEquals(res.totalValue, 55.00);
  assertEquals(res.investments.length, 1);
  assertEquals(res.investments[0].currentValue, 55.00);
  assertEquals(res.investments[0].profitPct, 10.00);
});

Deno.test("investments: Penny context lines contain 'Investment Centsibility Fund (low)...'", async () => {
  const principal = 10.0;
  const stubAdmin = createStubAdmin({
    investments: [
      {
        id: "inv-fund-1",
        kid_id: "kid-2",
        mode: "fund",
        tier: "low",
        frequency: "minute",
        lock_ticks: 5,
        principal,
        status: "active",
        created_at: new Date().toISOString(),
      },
    ],
    fundPaths: {
      "inv-fund-1": [
        { tick: 1, rate: 0.007, value: 10.07 },
      ],
    },
  });

  const { totalValue, investments } = await currentInvestmentValues(stubAdmin, "kid-2");
  assertEquals(totalValue, 10.07);
  assertEquals(investments.length, 1);
  assertEquals(investments[0].tier, "low");

  const contextLines = buildKidCoachContext({
    ageGroup: "10-12",
    balance: 50.0,
    investmentsValue: totalValue,
    investments,
  });

  const matchingLine = contextLines.find((line) =>
    line.includes("Investment Centsibility Fund (low)")
  );
  assert(
    matchingLine !== undefined,
    `Expected context lines to contain "Investment Centsibility Fund (low)", found: ${JSON.stringify(contextLines)}`
  );
  assert(matchingLine.includes("put in RM10.00"));
});
