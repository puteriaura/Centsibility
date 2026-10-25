import { assertEquals, assert, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { latestCloseAt, nyWallTimeUtc, sessionOpenAt, isQuoteStale, tradeGuardWouldRefuse, getQuote, getDailyCloses, checkRateLimit, getCuratedSymbols, getVisibleQuotes, type MarketQuote } from "./market.ts";
import { createMarketAdmin, marketFixture, fixtureFetch } from "./fixtures/market/mock-admin.ts";
const closedNow = new Date("2026-10-27T02:00Z");
const openNow = new Date("2026-10-26T15:00Z");
const old: MarketQuote = { symbol: "MSFT", price: 527.19, previous_close: 529.3, currency: "USD", is_market_open: true, price_time: "2026-10-07T13:30:00Z", fetched_at: "2026-10-07T14:06:42Z" };
const quoteAt = (time: string, extra = {}): MarketQuote => ({ ...old, fetched_at: new Date(time).toISOString(), ...extra });
const yahoo = () => marketFixture("yahoo-chart-msft-closed");
const nasdaq = () => marketFixture("nasdaq-watchlist");

Deno.test("market: latest close follows holidays, weekends, DST and early closes", () => {
  for (const [now, expected] of [
    ["2026-10-27T02:00Z", "2026-10-26T20:00:00.000Z"], ["2026-10-26T19:59Z", "2026-10-23T20:00:00.000Z"],
    ["2026-10-31T12:00Z", "2026-10-30T20:00:00.000Z"], ["2026-11-02T21:30Z", "2026-11-02T21:00:00.000Z"],
    ["2026-11-26T22:00Z", "2026-11-25T21:00:00.000Z"], ["2026-11-27T18:30Z", "2026-11-27T18:00:00.000Z"],
  ]) assertEquals(latestCloseAt(new Date(now))?.toISOString(), expected);
  assertEquals(latestCloseAt(new Date("2025-06-01T00:00Z")), null);
  assertEquals(nyWallTimeUtc("2026-11-02", 9, 30).toISOString(), "2026-11-02T14:30:00.000Z");
  assertEquals(sessionOpenAt(openNow)?.toISOString(), "2026-10-26T13:30:00.000Z");assertEquals(sessionOpenAt(closedNow), null);
});
Deno.test("market: open staleness uses fetch age and the session opening, including thin trading", () => {
  for (const [fetched, price, stale] of [
    ["14:50", "2026-10-26T14:49Z", false], ["14:44", "2026-10-26T14:44Z", true],
    ["14:59", "2026-10-23T20:00Z", true], ["14:58", "2026-10-26T14:20Z", false],
    ["14:45", "2026-10-26T14:49Z", true],
  ] as const) assertEquals(isQuoteStale(quoteAt(`2026-10-26T${fetched}Z`, { price_time: price }), openNow), stale);
  assert(isQuoteStale({ ...old, fetched_at: "invalid" }, openNow));
});
Deno.test("market: closed staleness waits for the settled close, with unknown-calendar age fallback", () => {
  for (const [now, fetched, stale] of [
    ["2026-10-27T02:00Z", "2026-10-26T20:30Z", false], ["2026-10-27T02:00Z", "2026-10-26T20:10Z", true],
    ["2026-10-27T02:00Z", "2026-10-26T19:00Z", true], ["2026-10-26T20:10Z", "2026-10-26T19:58Z", true],
  ] as const) assertEquals(isQuoteStale(quoteAt(fetched), new Date(now)), stale);
  assertEquals(isQuoteStale(quoteAt("2025-06-01T10:00Z"), new Date("2025-06-01T15:00Z")), true);
  assertEquals(isQuoteStale(quoteAt("2025-06-01T14:00Z"), new Date("2025-06-01T15:00Z")), false);
});
Deno.test("market: trade guard mirrors UTC SQL ages with a one-minute safety margin", () => {
  for (const [kind, now, age, flag, refused] of [
    ["open", closedNow, 178*60, false, false], ["open", closedNow, 179*60+30, false, true],
    ["open", openNow, 13*60, false, false], ["open", openNow, 14*60+30, false, true],
    ["sell", openNow, 28*60, false, false], ["sell", openNow, 29*60+30, false, true],
    ["open", closedNow, 15*60, true, true],
  ] as const) assertEquals(tradeGuardWouldRefuse(quoteAt(new Date(now.getTime()-age*1000).toISOString(), { is_market_open: flag }), now, kind), refused);
  assert(tradeGuardWouldRefuse(null, openNow, "open"));assert(tradeGuardWouldRefuse({ ...old, price: 0 }, openNow, "sell"));
});
Deno.test("market: old production row catches up once after close and saves all Yahoo closes", async () => {
  const admin = createMarketAdmin({ quotes: [old] });const data = await yahoo();
  const mock = fixtureFetch(admin.trace, () => Response.json(data));
  const result = await getQuote(admin, "MSFT", { now: closedNow, fetchFn: mock.fetchFn });
  assertEquals(mock.urls.length, 1);assertEquals(result.provider, "yahoo");assertEquals(result.marketState, "closed");assertEquals(result.stale, false);assertEquals(result.lastClose, 531.52);
  assertEquals(admin.state.market_quotes[0], { symbol: "MSFT", price: 531.52, previous_close: 525.1, currency: "USD", is_market_open: false, price_time: "2026-10-26T20:00:00.000Z", fetched_at: closedNow.toISOString() });
  assertEquals(admin.state.market_daily_closes.length, 3);assert(admin.trace.indexOf("market_api_calls:insert") < admin.trace.indexOf("fetch"));
  const again = await getQuote(admin, "MSFT", { now: new Date("2026-10-27T03:00Z"), fetchFn: mock.fetchFn });
  assertEquals(mock.urls.length, 1);assertEquals(again.stale, false);assertEquals(again.lastCloseAsOf, "2026-10-26T20:00:00.000Z");
});
Deno.test("market: unsettled close makes no catch-up call", async () => {
  const admin = createMarketAdmin({ quotes: [old] });const mock = fixtureFetch(admin.trace, () => { throw new Error("Unexpected request"); });
  const result = await getQuote(admin, "MSFT", { now: new Date("2026-10-26T20:10Z"), fetchFn: mock.fetchFn });
  assertEquals(mock.urls.length, 0);assertEquals(result.stale, true);assertEquals(result.quote?.is_market_open, false);
});
Deno.test("market: open cache refreshes at fifteen minutes and preserves real price time", async () => {
  const data = await marketFixture("yahoo-chart-msft-open");
  for (const [minutes, calls] of [[10, 0], [16, 1]]) {
    const admin = createMarketAdmin({ quotes: [quoteAt(new Date(openNow.getTime()-minutes*60000).toISOString(), { price_time: "2026-10-26T14:49Z" })] });
    const mock = fixtureFetch(admin.trace, () => Response.json(data));const result = await getQuote(admin, "MSFT", { now: openNow, fetchFn: mock.fetchFn });
    assertEquals(mock.urls.length, calls);assertEquals(result.quote?.is_market_open, true);
    if (calls) { assertEquals(result.quote?.price, 528);assertEquals(result.quote?.price_time, "2026-10-26T14:59:30.000Z"); }
  }
});
Deno.test("market: Yahoo 429 and error bodies fall back to a separately counted Nasdaq attempt", async () => {
  const watch = await nasdaq();const error = await marketFixture("yahoo-chart-error");
  for (const failure of [() => new Response("", { status: 429 }), () => Response.json(error)]) {
    const admin = createMarketAdmin();const mock = fixtureFetch(admin.trace, (_url, index) => index === 0 ? failure() : Response.json(watch));
    const result = await getQuote(admin, "MSFT", { now: openNow, fetchFn: mock.fetchFn });
    assertEquals(mock.urls.length, 2);assertEquals(result.provider, "nasdaq");assertEquals(result.quote?.previous_close, 525.113614);assertEquals(result.quote?.price_time, null);
    assertEquals(admin.state.market_api_calls.map(r => r.endpoint), ["yahoo:chart", "nasdaq:watchlist"]);
  }
});
Deno.test("market: failures never write invented prices and quota failures keep their reason", async () => {
  for (const cached of [true, false]) for (const quota of [true, false]) {
    const admin = createMarketAdmin({ quotes: cached ? [old] : [] });
    const mock = fixtureFetch(admin.trace, (_url, index) => { if (quota) return new Response("", { status: 429 });if (!index) return new Response("", { status: 500 });throw new Error("fixture network"); });
    const result = await getQuote(admin, "MSFT", { now: openNow, fetchFn: mock.fetchFn });
    assertEquals(result.available, cached);assertEquals(result.degradedReason, quota ? "provider_quota" : undefined);
    if (cached) { assertEquals(result.stale, true);assertEquals(result.quote?.price, old.price); }
    assertEquals(admin.trace.filter(t => t.endsWith(":upsert")), []);
  }
});
Deno.test("market: local quota and unavailable monitoring block requests before HTTP", async () => {
  const calls = Array.from({ length: 6 }, () => ({ symbol: "AAPL", endpoint: "yahoo:chart", called_at: openNow.toISOString() }));
  for (const monitor of [false, true]) {
    const admin = createMarketAdmin({ calls: monitor ? [] : calls, countError: monitor });const mock = fixtureFetch(admin.trace, () => { throw new Error("Unexpected request"); });
    const result = await getQuote(admin, "MSFT", { now: openNow, fetchFn: mock.fetchFn });
    assertEquals(mock.urls.length, 0);assertEquals(result.degradedReason, monitor ? "monitor_unavailable" : "local_quota");
  }
});
Deno.test("market: daily cap, two-day purge and failed attempt recording remain enforced", async () => {
  const admin = createMarketAdmin({ calls: Array.from({ length: 700 }, () => ({ symbol: "MSFT", endpoint: "fixture", called_at: "2026-10-26T00:01:00.000Z" })) });
  assertEquals(await checkRateLimit(admin, "MSFT", "yahoo:chart", openNow), false);
  const purge = createMarketAdmin({ calls: [{ called_at: "2026-10-22T00:00:00.000Z" }] });
  assert(await checkRateLimit(purge, "MSFT", "yahoo:chart", openNow));assertEquals(purge.state.market_api_calls.length, 1);
  const fail = createMarketAdmin({ insertError: true });assertEquals(await checkRateLimit(fail, "MSFT", "yahoo:chart", openNow), false);
});
Deno.test("market: closed bootstrap is explicit, while unknown calendar never fetches", async () => {
  const data = await yahoo();
  for (const options of [{}, { allowClosedBootstrap: true }, { forTrade: "open" as const }]) {
    const admin = createMarketAdmin();const mock = fixtureFetch(admin.trace, () => Response.json(data));
    const result = await getQuote(admin, "MSFT", { ...options, now: closedNow, fetchFn: mock.fetchFn });
    assertEquals(mock.urls.length, Object.keys(options).length ? 1 : 0);assertEquals(result.available, Object.keys(options).length > 0);
  }
  const admin = createMarketAdmin();const mock = fixtureFetch(admin.trace, () => { throw new Error("Unexpected request"); });
  await getQuote(admin, "MSFT", { now: new Date("2025-06-01T15:00Z"), forTrade: "open", fetchFn: mock.fetchFn });assertEquals(mock.urls.length, 0);
});
Deno.test("market: closed trade refreshes only when its saved row would fail the SQL age guard", async () => {
  const data = await yahoo();
  for (const [time, calls] of [["2026-10-26T21:00Z", 1], ["2026-10-27T01:30Z", 0]] as const) {
    const admin = createMarketAdmin({ quotes: [quoteAt(time, { is_market_open: false })] });const mock = fixtureFetch(admin.trace, () => Response.json(data));
    await getQuote(admin, "MSFT", { now: closedNow, forTrade: "open", fetchFn: mock.fetchFn });assertEquals(mock.urls.length, calls);
  }
});
Deno.test("market: open trade safety margin can refresh a cache younger than fifteen minutes", async () => {
  const admin = createMarketAdmin({ quotes: [quoteAt("2026-10-26T14:45:30Z", { price_time: "2026-10-26T14:45Z" })] });const data = await yahoo();
  const mock = fixtureFetch(admin.trace, () => Response.json(data));
  await getQuote(admin, "MSFT", { now: openNow, forTrade: "open", fetchFn: mock.fetchFn });assertEquals(mock.urls.length, 1);
});
Deno.test("market: Nasdaq fallback uses the option kind or the stored catalogue kind", async () => {
  const watch = await nasdaq();
  for (const kind of [undefined, "etf"] as const) {
    const admin = createMarketAdmin({ symbols: [{ symbol: "MSFT", kind: "etf", active: true }] });
    const mock = fixtureFetch(admin.trace, (_url, index) => index ? Response.json(watch) : new Response("", { status: 429 }));
    await getQuote(admin, "MSFT", { now: openNow, fetchFn: mock.fetchFn, kind });assert(mock.urls[1].endsWith("msft%7Cetf"));
  }
});
Deno.test("market: complete stored closes need no provider call", async () => {
  const admin = createMarketAdmin({ closes: [{ symbol: "MSFT", day: "2026-10-26", close: 531.52 }] });
  const mock = fixtureFetch(admin.trace, () => { throw new Error("Unexpected request"); });
  const result = await getDailyCloses(admin, "MSFT", { now: closedNow, fetchFn: mock.fetchFn });assertEquals(mock.urls.length, 0);assertEquals(result.stale, false);
});
Deno.test("market: behind closes refresh independently of fresh quotes, at most once per UTC day", async () => {
  const admin = createMarketAdmin({ quotes: [quoteAt("2026-10-27T01:30Z", { is_market_open: false })], closes: [{ symbol: "MSFT", day: "2026-10-21", close: 521.1 }] });
  const data = await marketFixture("nasdaq-historical");const mock = fixtureFetch(admin.trace, () => Response.json(data));
  const result = await getDailyCloses(admin, "MSFT", { now: closedNow, fetchFn: mock.fetchFn });
  assertEquals(result.stale, false);assertEquals(mock.urls.length, 1);assert(mock.urls[0].includes("/historical?"));
  await getDailyCloses(admin, "MSFT", { now: closedNow, fetchFn: mock.fetchFn });assertEquals(mock.urls.length, 1);
  assertEquals(admin.state.market_daily_closes.length, 3);
});
Deno.test("market: failed history attempts are not repeated on the same UTC day", async () => {
  const admin = createMarketAdmin();const mock = fixtureFetch(admin.trace, () => new Response("", { status: 500 }));
  assertEquals((await getDailyCloses(admin, "MSFT", { now: closedNow, fetchFn: mock.fetchFn })).available, false);
  await getDailyCloses(admin, "MSFT", { now: closedNow, fetchFn: mock.fetchFn });assertEquals(mock.urls.length, 1);
});
Deno.test("market: catalogue limits and screening stay enforced, and visible rows carry catalogue kinds", async () => {
  const admin = createMarketAdmin({ symbols: [{ symbol: "MSFT", kind: "etf", active: true }, { symbol: "NOTVERIFIED", kind: "stock", active: true }] });
  assertEquals((await getCuratedSymbols(admin)).map(r => r.symbol), ["MSFT"]);
  await assertRejects(() => getVisibleQuotes(admin, Array(13).fill("MSFT")), Error, "at most 12");
  await assertRejects(() => getVisibleQuotes(admin, ["NOTVERIFIED"]), Error, "verified catalogue");
  const data = await nasdaq();const mock = fixtureFetch(admin.trace, (_url, index) => index ? Response.json(data) : new Response("", { status: 500 }));
  await getVisibleQuotes(admin, [" msft ", "MSFT"], { now: openNow, fetchFn: mock.fetchFn });assertEquals(mock.urls.length, 2);assert(mock.urls[1].endsWith("msft%7Cetf"));
});
