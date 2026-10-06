import { assertEquals, assertNotEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseQuotePayload,
  parseTimeSeriesPayload,
  isQuoteStale,
  checkRateLimit,
  getQuote,
  getDailyCloses,
  MarketQuote,
} from "./market.ts";

function createMockAdmin(initialState?: {
  quotes?: Record<string, any>;
  dailyCloses?: Array<{ symbol: string; day: string; close: number }>;
  apiCalls?: Array<{ id: number; symbol: string; endpoint: string; called_at: string }>;
}) {
  const quotes = { ...(initialState?.quotes || {}) };
  let dailyCloses = [...(initialState?.dailyCloses || [])];
  let apiCalls = [...(initialState?.apiCalls || [])];
  let nextCallId = apiCalls.length + 1;

  return {
    _state: { quotes, dailyCloses, apiCalls },
    from(table: string) {
      if (table === "market_quotes") {
        return {
          select(_cols = "*") {
            return {
              eq(col: string, val: any) {
                return {
                  async maybeSingle() {
                    return { data: quotes[val] || null, error: null };
                  },
                };
              },
            };
          },
          async upsert(row: any) {
            quotes[row.symbol] = { ...row };
            return { data: row, error: null };
          },
        };
      }
      if (table === "market_daily_closes") {
        return {
          select(_cols = "*") {
            return {
              eq(col: string, val: any) {
                return {
                  order(_orderCol: string, _opts: any) {
                    const rows = dailyCloses
                      .filter((r) => r.symbol === val)
                      .sort((a, b) => a.day.localeCompare(b.day));
                    return Promise.resolve({ data: rows, error: null });
                  },
                };
              },
            };
          },
          async upsert(rows: any[]) {
            for (const r of rows) {
              const idx = dailyCloses.findIndex((d) => d.symbol === r.symbol && d.day === r.day);
              if (idx >= 0) dailyCloses[idx] = r;
              else dailyCloses.push(r);
            }
            return { data: rows, error: null };
          },
        };
      }
      if (table === "market_api_calls") {
        return {
          select(_cols: string, opts?: any) {
            let filterSymbol: string | null = null;
            let filterEndpoint: string | null = null;
            let gteTime: string | null = null;

            const chain = {
              eq(col: string, val: any) {
                if (col === "symbol") filterSymbol = val;
                if (col === "endpoint") filterEndpoint = val;
                return chain;
              },
              gte(col: string, val: any) {
                if (col === "called_at") gteTime = val;
                const filtered = apiCalls.filter((c) => {
                  if (filterSymbol && c.symbol !== filterSymbol) return false;
                  if (filterEndpoint && c.endpoint !== filterEndpoint) return false;
                  if (gteTime && c.called_at < gteTime) return false;
                  return true;
                });
                return Promise.resolve({
                  data: filtered,
                  count: opts?.count === "exact" ? filtered.length : null,
                  error: null,
                });
              },
            };
            return chain;
          },
          delete() {
            return {
              lt(_col: string, val: string) {
                apiCalls = apiCalls.filter((c) => c.called_at >= val);
                return Promise.resolve({ error: null });
              },
            };
          },
          async insert(row: any) {
            apiCalls.push({ id: nextCallId++, ...row });
            return { data: row, error: null };
          },
        };
      }
      throw new Error(`Unknown table: ${table}`);
    },
  };
}

Deno.test("market: parsing quote and time series payloads", () => {
  // Quote
  const rawQuote = {
    symbol: "SPUS",
    name: "SP Funds S&P 500 Sharia Industry Exclusions ETF",
    close: "60.63000",
    previous_close: "60.33000",
    is_market_open: true,
    currency: "USD",
    datetime: "2026-10-05 15:59:00",
    timestamp: 1791217140,
    percent_change: "0.49726",
  };
  const parsedQuote = parseQuotePayload(rawQuote);
  assert(parsedQuote !== null);
  assertEquals(parsedQuote.symbol, "SPUS");
  assertEquals(parsedQuote.price, 60.63);
  assertEquals(parsedQuote.previous_close, 60.33);
  assertEquals(parsedQuote.is_market_open, true);
  assertEquals(parsedQuote.currency, "USD");
  assertEquals(parsedQuote.change_percent, 0.5);

  // Time series
  const rawTs = {
    status: "ok",
    values: [
      { datetime: "2026-10-05", close: "60.63" },
      { datetime: "2026-10-04", close: "60.33" },
      { datetime: "2026-10-03", close: "59.80" },
    ],
  };
  const parsedTs = parseTimeSeriesPayload(rawTs);
  assert(parsedTs !== null);
  assertEquals(parsedTs.length, 3);
  // Sorted ascending by day
  assertEquals(parsedTs[0].day, "2026-10-03");
  assertEquals(parsedTs[0].close, 59.80);
  assertEquals(parsedTs[2].day, "2026-10-05");
  assertEquals(parsedTs[2].close, 60.63);
});

Deno.test("market: HTTP-200 error body counts as failure", () => {
  const errorQuote = {
    status: "error",
    code: 429,
    message: "You have run out of API credits for today",
  };
  assertEquals(parseQuotePayload(errorQuote), null);

  const notFoundQuote = {
    status: "error",
    code: 404,
    message: "symbol parameter is invalid",
  };
  assertEquals(parseQuotePayload(notFoundQuote), null);

  const errorTs = {
    status: "error",
    code: 429,
    message: "Limit reached",
  };
  assertEquals(parseTimeSeriesPayload(errorTs), null);
});

Deno.test("market: a fresh cache means no call", async () => {
  let fetchCalled = false;
  const mockFetch = async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const now = new Date("2026-10-05T12:00:00Z");
  const admin = createMockAdmin({
    quotes: {
      SPUS: {
        symbol: "SPUS",
        price: 60.00,
        previous_close: 59.00,
        currency: "USD",
        is_market_open: true,
        // Fetched 3 minutes ago
        fetched_at: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
      },
    },
  });

  const res = await getQuote(admin, "SPUS", {
    apiKey: "test_key",
    fetchFn: mockFetch as any,
    now,
  });

  assertEquals(fetchCalled, false);
  assertEquals(res.available, true);
  assertEquals(res.stale, false);
  assertEquals(res.quote?.price, 60.00);
});

Deno.test("market: stale-while-open triggers refresh, closed-and-recent does not", async () => {
  const now = new Date("2026-10-05T12:00:00Z");

  // Case A: Open and 12 minutes old -> stale, triggers fetch
  let fetchCalledA = false;
  const mockFetchA = async () => {
    fetchCalledA = true;
    return new Response(
      JSON.stringify({
        symbol: "SPUS",
        close: "61.00",
        previous_close: "60.00",
        is_market_open: true,
      }),
      { status: 200 }
    );
  };

  const adminA = createMockAdmin({
    quotes: {
      SPUS: {
        symbol: "SPUS",
        price: 60.00,
        previous_close: 59.00,
        is_market_open: true,
        fetched_at: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
      },
    },
  });

  const resA = await getQuote(adminA, "SPUS", {
    apiKey: "test_key",
    fetchFn: mockFetchA as any,
    now,
  });
  assertEquals(fetchCalledA, true);
  assertEquals(resA.quote?.price, 61.00);

  // Case B: Closed and 45 minutes old -> NOT stale, does not trigger fetch
  let fetchCalledB = false;
  const mockFetchB = async () => {
    fetchCalledB = true;
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const adminB = createMockAdmin({
    quotes: {
      HLAL: {
        symbol: "HLAL",
        price: 40.00,
        previous_close: 39.50,
        is_market_open: false,
        fetched_at: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      },
    },
  });

  const resB = await getQuote(adminB, "HLAL", {
    apiKey: "test_key",
    fetchFn: mockFetchB as any,
    now,
  });
  assertEquals(fetchCalledB, false);
  assertEquals(resB.stale, false);
  assertEquals(resB.quote?.price, 40.00);

  // Case C: Closed and 3.5 hours old -> stale, triggers fetch
  let fetchCalledC = false;
  const mockFetchC = async () => {
    fetchCalledC = true;
    return new Response(
      JSON.stringify({
        symbol: "HLAL",
        close: "41.00",
        previous_close: "40.00",
        is_market_open: false,
      }),
      { status: 200 }
    );
  };

  const adminC = createMockAdmin({
    quotes: {
      HLAL: {
        symbol: "HLAL",
        price: 40.00,
        is_market_open: false,
        fetched_at: new Date(now.getTime() - 3.5 * 3600 * 1000).toISOString(),
      },
    },
  });

  const resC = await getQuote(adminC, "HLAL", {
    apiKey: "test_key",
    fetchFn: mockFetchC as any,
    now,
  });
  assertEquals(fetchCalledC, true);
  assertEquals(resC.quote?.price, 41.00);
});

Deno.test("market: rate guard blocks 7th call in a minute", async () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const calls = [];
  for (let i = 0; i < 6; i++) {
    calls.push({
      id: i + 1,
      symbol: "SPUS",
      endpoint: "quote",
      called_at: new Date(now.getTime() - (30 - i) * 1000).toISOString(),
    });
  }

  const admin = createMockAdmin({
    apiCalls: calls,
    quotes: {
      SPUS: {
        symbol: "SPUS",
        price: 60.00,
        is_market_open: true,
        // Stale
        fetched_at: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      },
    },
  });

  let fetchCalled = false;
  const res = await getQuote(admin, "SPUS", {
    apiKey: "test_key",
    fetchFn: (async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({}), { status: 200 });
    }) as any,
    now,
  });

  // Guard blocked fetch
  assertEquals(fetchCalled, false);
  assertEquals(res.available, true);
  assertEquals(res.stale, true);
  assertEquals(res.quote?.price, 60.00);
});

Deno.test("market: failure falls back to cache with stale: true", async () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const admin = createMockAdmin({
    quotes: {
      SPUS: {
        symbol: "SPUS",
        price: 60.00,
        is_market_open: true,
        fetched_at: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      },
    },
  });

  // Network error failure
  const resError = await getQuote(admin, "SPUS", {
    apiKey: "test_key",
    fetchFn: (async () => {
      throw new Error("Network offline");
    }) as any,
    now,
  });
  assertEquals(resError.available, true);
  assertEquals(resError.stale, true);
  assertEquals(resError.quote?.price, 60.00);

  // HTTP-200 429 response
  const res429 = await getQuote(admin, "SPUS", {
    apiKey: "test_key",
    fetchFn: (async () => {
      return new Response(
        JSON.stringify({ status: "error", code: 429, message: "Limit reached" }),
        { status: 200 }
      );
    }) as any,
    now,
  });
  assertEquals(res429.available, true);
  assertEquals(res429.stale, true);
  assertEquals(res429.quote?.price, 60.00);
});

Deno.test("market: missing key means available: false", async () => {
  const admin = createMockAdmin();
  const resNoCache = await getQuote(admin, "SPUS", {
    apiKey: "",
  });
  assertEquals(resNoCache.available, false);

  const resNullKey = await getQuote(admin, "SPUS", {
    apiKey: null,
  });
  assertEquals(resNullKey.available, false);
});

Deno.test("market: key is never logged", async () => {
  const secretKey = "SUPER_SECRET_TWELVEDATA_KEY_XYZZY";
  const logged: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  console.log = (...args: any[]) => logged.push(args.map(String).join(" "));
  console.error = (...args: any[]) => logged.push(args.map(String).join(" "));
  console.warn = (...args: any[]) => logged.push(args.map(String).join(" "));
  console.info = (...args: any[]) => logged.push(args.map(String).join(" "));

  try {
    const admin = createMockAdmin();
    await getQuote(admin, "SPUS", {
      apiKey: secretKey,
      fetchFn: (async () => {
        return new Response(
          JSON.stringify({ status: "error", code: 429, message: "Out of credits" }),
          { status: 200 }
        );
      }) as any,
    });
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    console.info = originalInfo;
  }

  for (const msg of logged) {
    assert(!msg.includes(secretKey), `Key was found in log: ${msg}`);
  }
});

Deno.test("market: isQuoteStale enforces 10-min window on weekdays during US market hours regardless of is_market_open", () => {
  // Tuesday 14:00 UTC: in market hours window (Mon-Fri 13:30 - 21:00 UTC)
  const tuesdayNow = new Date("2026-10-06T14:00:00Z");
  const quote20MinOldClosed: MarketQuote = {
    symbol: "SPUS",
    price: 60.00,
    currency: "USD",
    is_market_open: false, // cached as closed
    fetched_at: new Date(tuesdayNow.getTime() - 20 * 60 * 1000).toISOString(),
  };
  // On Tuesday at 14:00 UTC, a 20-min-old quote is STALE even if cached as closed
  assertEquals(isQuoteStale(quote20MinOldClosed, tuesdayNow), true);

  // Saturday 14:00 UTC: weekend, outside market hours window
  const saturdayNow = new Date("2026-10-10T14:00:00Z");
  const quote20MinOldWeekend: MarketQuote = {
    symbol: "SPUS",
    price: 60.00,
    currency: "USD",
    is_market_open: false,
    fetched_at: new Date(saturdayNow.getTime() - 20 * 60 * 1000).toISOString(),
  };
  // On Saturday at 14:00 UTC, a 20-min-old closed quote is NOT stale (stale only after 3h)
  assertEquals(isQuoteStale(quote20MinOldWeekend, saturdayNow), false);
});
