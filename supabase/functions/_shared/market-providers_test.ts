import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseYahooChart, parseNasdaqWatchlist, parseNasdaqHistorical, yahooChartUrl, nasdaqWatchlistUrl, nasdaqHistoricalUrl, YAHOO_HEADERS, NASDAQ_HEADERS, fetchProviderJson, logProviderAttempt } from "./market-providers.ts";
const fixture = async (name: string) => JSON.parse(await Deno.readTextFile(new URL(`./fixtures/market/${name}.json`, import.meta.url)));

Deno.test("market: Yahoo closed fixture uses the previous trading day, never the range baseline", async () => {
  const parsed = parseYahooChart(await fixture("yahoo-chart-msft-closed"), "MSFT")!;
  assertEquals(parsed.quote, { symbol: "MSFT", price: 531.52, previous_close: 525.10, currency: "USD", price_time: "2026-10-26T20:00:00.000Z" });
  assertEquals(parsed.closes, [{ day: "2026-10-21", close: 521.10 }, { day: "2026-10-23", close: 525.10 }, { day: "2026-10-26", close: 531.52 }]);
});
Deno.test("market: Yahoo open fixture preserves the real price time", async () => {
  const quote = parseYahooChart(await fixture("yahoo-chart-msft-open"), "MSFT")!.quote;
  assertEquals([quote.price, quote.previous_close, quote.price_time], [528, 525.10, "2026-10-26T14:59:30.000Z"]);
});
Deno.test("market: Yahoo rejects errors, mismatches and invalid prices", async () => {
  assertEquals(parseYahooChart(await fixture("yahoo-chart-error"), "MSFT"), null);
  const json = await fixture("yahoo-chart-msft-closed");
  assertEquals(parseYahooChart(json, "AAPL"), null);
  for (const price of [0, -1, Infinity, "531.52", null]) {
    json.chart.result[0].meta.regularMarketPrice = price;
    assertEquals(parseYahooChart(json, "MSFT"), null);
  }
});
Deno.test("market: Yahoo deduplicates bars and handles missing timestamps and currency", async () => {
  const json = await fixture("yahoo-chart-msft-closed");const r = json.chart.result[0];
  r.timestamp.push(r.timestamp[3]);r.indicators.quote[0].close.push(532);
  delete r.meta.regularMarketTime;delete r.meta.currency;
  const parsed = parseYahooChart(json, "MSFT")!;
  assertEquals(parsed.closes.at(-1)?.close, 532);
  assertEquals(parsed.quote.previous_close, 525.1);
  assertEquals(parsed.quote.price_time, null);assertEquals(parsed.quote.currency, "USD");
});
Deno.test("market: Nasdaq watchlist parses strictly and matches the requested symbol", async () => {
  const json = await fixture("nasdaq-watchlist");
  assertEquals(parseNasdaqWatchlist(json, "MSFT"), { symbol: "MSFT", price: 531.52, previous_close: 525.113614, currency: "USD", price_time: null });
  assertEquals(parseNasdaqWatchlist(json, "AAPL"), null);
  for (const value of ["N/A", "UNCH", "", "12bad", "0", null]) {
    json.data[0].lastSalePrice = value;assertEquals(parseNasdaqWatchlist(json, "MSFT"), null);
  }
  json.data[0].lastSalePrice = "$531.52";
  for (const pct of ["N/A", "UNCH", "-100%", "-101%", ""]) {
    json.data[0].percentageChange = pct;assertEquals(parseNasdaqWatchlist(json, "MSFT")!.previous_close, null);
  }
});
Deno.test("market: Nasdaq historical skips invalid rows and sorts ascending", async () => {
  const json = await fixture("nasdaq-historical");
  json.data.tradesTable.rows.push({ date: "02/30/2026", close: "$12" });
  assertEquals(parseNasdaqHistorical(json), [{ day: "2026-10-23", close: 525.1 }, { day: "2026-10-26", close: 531.52 }]);
  assertEquals(parseNasdaqHistorical({}), []);
});
Deno.test("market: provider URLs and headers use the approved shapes and encode symbols", () => {
  assertEquals(yahooChartUrl("MSFT"), "https://query1.finance.yahoo.com/v8/finance/chart/MSFT?interval=1d&range=6mo&includePrePost=false");
  assert(yahooChartUrl("A/B").includes("A%2FB"));
  assertEquals(nasdaqWatchlistUrl("MSFT", "stock"), "https://api.nasdaq.com/api/quote/watchlist?symbol=msft%7Cstocks");
  assert(nasdaqWatchlistUrl("SPUS", "etf").endsWith("spus%7Cetf"));
  assertEquals(nasdaqHistoricalUrl("A/B", "etf", new Date("2026-10-26T20:30Z")), "https://api.nasdaq.com/api/quote/A%2FB/historical?assetclass=etf&fromdate=2026-04-09&limit=9999&todate=2026-10-26");
  assertEquals(YAHOO_HEADERS, { "User-Agent": "Mozilla/5.0", Accept: "application/json" });
  assertEquals(NASDAQ_HEADERS.Origin, "https://www.nasdaq.com");assertEquals(NASDAQ_HEADERS.Referer, "https://www.nasdaq.com/");
});
Deno.test("market: fetch helper reports HTTP, network, timeout and JSON failures", async () => {
  const run = (fn: typeof fetch) => fetchProviderJson(fn, "https://fixture.invalid", YAHOO_HEADERS);
  const cases: Array<[typeof fetch, string]> = [
    [async () => new Response("", { status: 429 }), "http_429"],
    [() => Promise.reject(new Error("fixture failure")), "network"],
    [() => Promise.reject(new DOMException("fixture abort", "AbortError")), "timeout"],
    [async () => new Response("not json"), "bad_json"],
  ];
  for (const [fn, reason] of cases) { const result = await run(fn);assert(!result.ok);assertEquals(result.reason, reason); }
  const timeout = await fetchProviderJson((_url, init) => new Promise((_resolve, reject) => (init as { signal: AbortSignal }).signal.addEventListener("abort", () => reject((init as { signal: AbortSignal }).signal.reason))), "https://fixture.invalid", {}, 1);
  assert(!timeout.ok);assertEquals(timeout.reason, "timeout");
  const ok = await run(async () => Response.json({ fixture: true }));assert(ok.ok);assertEquals(ok.json, { fixture: true });
});
Deno.test("market: provider attempt logs exactly one structured line", () => {
  const saved = console.log;const lines: string[] = [];
  try { console.log = value => lines.push(value);logProviderAttempt({ provider: "yahoo", symbol: "MSFT", ok: false, status: 429, ms: 3, reason: "http_429" }); }
  finally { console.log = saved; }
  assertEquals(lines.length, 1);assertEquals(JSON.parse(lines[0]), { event: "market-provider", provider: "yahoo", symbol: "MSFT", ok: false, status: 429, ms: 3, reason: "http_429" });
});
