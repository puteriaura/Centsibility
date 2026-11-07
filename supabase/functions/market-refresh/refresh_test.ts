import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { authorize, runMarketRefresh } from "./refresh.ts";
import { createMarketAdmin, marketFixture, fixtureFetch } from "../_shared/fixtures/market/mock-admin.ts";
const now = new Date("2026-10-27T02:00:00Z");
const catalogue = (symbols: string[]) => symbols.map(symbol => ({ symbol, kind: "stock", active: true }));

Deno.test("market: held refresh uses the 15-minute cutoff in both US seasons and skips closed sessions", async () => {
  const admin = createMarketAdmin();
  const cutoffs: string[] = [];
  const mock = fixtureFetch(admin.trace, () => { throw new Error("Unexpected provider request"); });
  const db = { ...admin, rpc(name: string, args: { p_cutoff: string }) {
    assertEquals(name, "market_held_refresh_candidates");
    cutoffs.push(args.p_cutoff);
    return { data: [], error: null };
  } };
  for (const time of ["2026-10-26T13:30:00Z", "2026-11-09T14:30:00Z"]) {
    const result = await runMarketRefresh(db, { held: true, now: new Date(time), fetchFn: mock.fetchFn });
    assert("due" in result);
    assertEquals(result.due, 0);
  }
  for (const time of ["2026-11-09T13:30:00Z", "2026-11-26T16:00:00Z", "2026-11-27T18:00:00Z"]) {
    assertEquals(await runMarketRefresh(db, { held: true, now: new Date(time), fetchFn: mock.fetchFn }),
      { ran: false, reason: "market_closed" });
  }
  assertEquals(cutoffs, ["2026-10-26T13:15:00.000Z", "2026-11-09T14:15:00.000Z"]);
  assertEquals(mock.urls, []);
});

Deno.test("market: held refresh takes the first six candidates and stops at the shared budget", async () => {
  const open = new Date("2026-11-09T16:00:00Z");
  const data = await marketFixture("yahoo-chart-msft-closed");
  const symbols = ["NVDA", "MSFT", "AAPL", "GOOGL", "TSLA", "AVGO", "HLAL"];
  for (const used of [0, 4]) {
    const admin = createMarketAdmin({ calls: Array.from({ length: used }, () => ({ called_at: open.toISOString() })) });
    const mock = fixtureFetch(admin.trace, url => {
      const copy = structuredClone(data);
      copy.chart.result[0].meta.symbol = new URL(url).pathname.split("/").at(-1);
      return Response.json(copy);
    });
    const result = await runMarketRefresh({ ...admin, rpc: () => ({ data: catalogue(symbols), error: null }) },
      { held: true, now: open, fetchFn: mock.fetchFn });
    assert("stoppedForBudget" in result);
    assertEquals(mock.urls.map(url => new URL(url).pathname.split("/").at(-1)), symbols.slice(0, 6 - used));
    assertEquals(result.stoppedForBudget, used > 0);
  }
});

Deno.test("market: refresh authorization rejects configuration, method and header failures", async () => {
  const expected = "fixture-only".repeat(4);
  const request = (value?: string, method = "POST") => new Request("https://fixture.invalid", { method, headers: value ? { "x-market-refresh-token": value } : {} });
  for (const [req, value, status, code] of [
    [request(), undefined, 503, "not_configured"], [request(), "short", 503, "not_configured"],
    [request(), expected, 401, "unauthorized"], [request(expected + "wrong"), expected, 401, "unauthorized"],
    [request(undefined, "GET"), expected, 405, "method_not_allowed"],
  ] as const) {
    const response = authorize(req, value)!;assertEquals(response.status, status);assertEquals(await response.json(), { error: code });
    assertEquals(response.headers.has("Access-Control-Allow-Origin"), false);
  }
  assertEquals(authorize(request(expected), expected), null);
  const wrongSameLength = expected.slice(0, -1) + "X";assertEquals(authorize(request(wrongSameLength), expected)!.status, 401);
});
Deno.test("market: sweep skips post-close rows and refreshes missing symbols before older rows", async () => {
  const admin = createMarketAdmin({ symbols: catalogue(["MSFT", "AAPL", "NVDA"]), quotes: [
    { symbol: "MSFT", price: 531.52, fetched_at: "2026-10-26T20:30:00Z", is_market_open: false },
    { symbol: "AAPL", price: 100, fetched_at: "2026-10-26T19:00:00Z", is_market_open: true },
  ] });
  const data = await marketFixture("yahoo-chart-msft-closed");
  const mock = fixtureFetch(admin.trace, url => { const copy = structuredClone(data);copy.chart.result[0].meta.symbol = decodeURIComponent(new URL(url).pathname.split("/").at(-1)!);return Response.json(copy); });
  const result = await runMarketRefresh(admin, { now, fetchFn: mock.fetchFn });
  assertEquals(mock.urls.length, 2);assert(mock.urls[0].includes("/NVDA?"));assert(mock.urls[1].includes("/AAPL?"));
  assertEquals(result, { ran: true, close: "2026-10-26T20:00:00.000Z", due: 2, refreshed: 2, failed: 0, stoppedForBudget: false, providers: { yahoo: 2, nasdaq: 0 } });
  assertEquals(admin.state.market_daily_closes.length, 6);
});
Deno.test("market: eight due symbols stop after six HTTP attempts without exhausting the next run", async () => {
  const admin = createMarketAdmin({ symbols: catalogue(["MSFT", "AAPL", "NVDA", "GOOGL", "AVGO", "TSLA", "AMD", "ADBE"]) });
  const data = await marketFixture("yahoo-chart-msft-closed");
  const mock = fixtureFetch(admin.trace, url => { const copy = structuredClone(data);copy.chart.result[0].meta.symbol = new URL(url).pathname.split("/").at(-1)!;return Response.json(copy); });
  const result = await runMarketRefresh(admin, { now, fetchFn: mock.fetchFn });
  assertEquals(mock.urls.length, 6);assertEquals(result.ran, true);
  assert("refreshed" in result);assertEquals(result.refreshed, 6);assertEquals(result.due, 8);assertEquals(result.stoppedForBudget, true);
});
Deno.test("market: sweep before close settlement or with unknown calendar makes no request", async () => {
  const admin = createMarketAdmin();const mock = fixtureFetch(admin.trace, () => { throw new Error("Unexpected request"); });
  for (const time of ["2026-10-26T20:10Z", "2025-06-01T15:00Z"]) {
    assertEquals(await runMarketRefresh(admin, { now: new Date(time), fetchFn: mock.fetchFn }), { ran: false, reason: "no_settled_close" });
  }
  assertEquals(mock.urls.length, 0);
});
Deno.test("market: probe counts both provider attempts but writes no quotes or closes", async () => {
  const admin = createMarketAdmin();const yahoo = await marketFixture("yahoo-chart-msft-closed");const nasdaq = await marketFixture("nasdaq-watchlist");
  const mock = fixtureFetch(admin.trace, url => Response.json(url.includes("yahoo") ? yahoo : nasdaq));
  const result = await runMarketRefresh(admin, { now, fetchFn: mock.fetchFn, probe: true });
  assert("yahoo" in result);assertEquals(result.probe, true);assertEquals(mock.urls.length, 2);
  assertEquals([result.yahoo.ok, result.yahoo.parsed, result.yahoo.price, result.nasdaq.ok, result.nasdaq.parsed, result.nasdaq.price], [true, true, 531.52, true, true, 531.52]);
  assertEquals(admin.state.market_quotes, []);assertEquals(admin.state.market_daily_closes, []);assertEquals(admin.state.market_api_calls.length, 2);
});
Deno.test("market: probe respects budgets and a sweep with nothing due makes no request", async () => {
  const admin = createMarketAdmin({ countError: true });const mock = fixtureFetch(admin.trace, () => { throw new Error("Unexpected request"); });
  const probe = await runMarketRefresh(admin, { now, fetchFn: mock.fetchFn, probe: true });
  assert("yahoo" in probe);assertEquals(probe.yahoo.ok, false);assertEquals(probe.nasdaq.ok, false);assertEquals(mock.urls.length, 0);
  const fresh = createMarketAdmin({ quotes: [{ symbol: "MSFT", fetched_at: now.toISOString(), price: 531.52, is_market_open: false }] });
  const sweep = await runMarketRefresh(fresh, { now, fetchFn: mock.fetchFn });assert("due" in sweep);assertEquals(sweep.due, 0);assertEquals(mock.urls.length, 0);
});
