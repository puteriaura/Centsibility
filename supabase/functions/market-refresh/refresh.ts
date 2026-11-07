import { constantTimeEqual } from "../_shared/constant-time.ts";
import { checkRateLimit, getCuratedSymbols, getQuote, isMarketHoursWindow, latestCloseAt, CLOSE_SETTLE_MS, QUOTE_CACHE_MS } from "../_shared/market.ts";
import { yahooChartUrl, nasdaqWatchlistUrl, YAHOO_HEADERS, NASDAQ_HEADERS, fetchProviderJson, parseYahooChart, parseNasdaqWatchlist, logProviderAttempt } from "../_shared/market-providers.ts";

export function authorize(req: Request, expected: string | undefined): Response | null {
  if (req.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  if (!expected || expected.length < 32) return Response.json({ error: "not_configured" }, { status: 503 });
  const supplied = req.headers.get("x-market-refresh-token");
  if (!supplied || !constantTimeEqual(supplied, expected)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

export async function runMarketRefresh(admin: any, options: { now?: Date; fetchFn?: typeof fetch; probe?: boolean; held?: boolean } = {}) {
  const now = options.now ?? new Date();
  const fetchFn = options.fetchFn ?? fetch;
  if (options.probe) {
    const results = {} as Record<"yahoo" | "nasdaq", { ok: boolean; status: number | null; ms: number; parsed: boolean; price: number | null }>;
    for (const provider of ["yahoo", "nasdaq"] as const) {
      if (!await checkRateLimit(admin, "MSFT", provider === "yahoo" ? "yahoo:chart" : "nasdaq:watchlist", now)) {
        results[provider] = { ok: false, status: null, ms: 0, parsed: false, price: null };
        continue;
      }
      const response = await fetchProviderJson(fetchFn, provider === "yahoo" ? yahooChartUrl("MSFT") : nasdaqWatchlistUrl("MSFT", "stock"), provider === "yahoo" ? YAHOO_HEADERS : NASDAQ_HEADERS);
      const quote = response.ok ? provider === "yahoo" ? parseYahooChart(response.json, "MSFT")?.quote : parseNasdaqWatchlist(response.json, "MSFT") : null;
      logProviderAttempt({ provider, symbol: "MSFT", ok: Boolean(quote), status: response.status, ms: response.ms, reason: response.ok ? quote ? undefined : "invalid_payload" : response.reason });
      results[provider] = { ok: response.ok, status: response.status, ms: response.ms, parsed: Boolean(quote), price: quote?.price ?? null };
    }
    return { probe: true, ...results };
  }
  let due: { symbol: string; kind: "etf" | "stock" }[];
  let close: Date | null = null;
  if (options.held) {
    if (!isMarketHoursWindow(now)) return { ran: false, reason: "market_closed" };
    const { data, error } = await admin.rpc("market_held_refresh_candidates", {
      p_cutoff: new Date(now.getTime() - QUOTE_CACHE_MS).toISOString(),
    });
    if (error || !data) throw new Error("Held market symbols are unavailable");
    due = data.slice(0, 6);
  } else {
    close = latestCloseAt(now);
    if (!close || now.getTime() < close.getTime() + CLOSE_SETTLE_MS) return { ran: false, reason: "no_settled_close" };
    const settledAt = close.getTime() + CLOSE_SETTLE_MS;
    const symbols = await getCuratedSymbols(admin);
    const { data: quotes, error } = symbols.length ? await admin.from("market_quotes").select("*").in("symbol", symbols.map(s => s.symbol)) : { data: [], error: null };
    if (error) throw new Error("Market quote cache is unavailable");
    due = symbols.map(symbol => ({ ...symbol, row: (quotes ?? []).find((q: any) => q.symbol === symbol.symbol) }))
      .filter(symbol => !symbol.row || !Number.isFinite(Date.parse(symbol.row.fetched_at)) || Date.parse(symbol.row.fetched_at) < settledAt)
      .sort((a, b) => Number(Boolean(a.row)) - Number(Boolean(b.row)) || (Date.parse(a.row?.fetched_at) || 0) - (Date.parse(b.row?.fetched_at) || 0));
  }
  let refreshed = 0, failed = 0, stoppedForBudget = false;
  const providers = { yahoo: 0, nasdaq: 0 };
  for (const symbol of due) {
    const result = await getQuote(admin, symbol.symbol, { now, fetchFn, allowClosedBootstrap: true, kind: symbol.kind });
    if (result.degradedReason === "local_quota" || result.degradedReason === "monitor_unavailable") { stoppedForBudget = true;break; }
    if (result.available && result.provider) { refreshed++;providers[result.provider]++; } else failed++;
  }
  return { ran: true, ...(close ? { close: close.toISOString() } : { mode: "held" }), due: due.length, refreshed, failed, stoppedForBudget, providers };
}
