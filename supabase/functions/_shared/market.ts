import type { MarketUsage } from "./market-types.ts";
// supabase/functions/_shared/market.ts
// Keyless Market Tracker quotes, shared attempt budgets and close-aware caching.
import { SCREENING } from "./market-screening.ts";
import { marketSession } from "./market-calendar.ts";

export interface MarketQuote {
  symbol: string;
  price: number;
  previous_close?: number | null;
  currency: string;
  is_market_open: boolean;
  price_time?: string | null;
  fetched_at: string;
  change_percent?: number | null;
}

export interface MarketDailyClose {
  symbol: string;
  day: string;
  close: number;
}

export interface MarketSymbol {
  symbol: string;
  name: string;
  kind: "etf" | "stock";
  halal_source: string;
  halal_checked_on: string;
  active: boolean;
  price?: number | null;
  previous_close?: number | null;
  change_percent?: number | null;
  is_market_open?: boolean;
  last_updated?: string | null;
  stale?: boolean;
  halal_url?: string;
  verified?: boolean;
}

export interface MarketQuoteResult {
  available: boolean;
  stale?: boolean;
  fetchedAt?: string;
  quote?: MarketQuote;
  marketState?: "open" | "closed" | "unknown";
  degradedReason?: "local_quota" | "provider_quota" | "monitor_unavailable";
  provider?: "yahoo" | "nasdaq";
  lastClose?: number;
  lastCloseAsOf?: string;
}

export interface MarketTimeSeriesResult {
  available: boolean;
  stale?: boolean;
  closes: Array<{ day: string; close: number }>;
}

import { yahooChartUrl, nasdaqWatchlistUrl, nasdaqHistoricalUrl, YAHOO_HEADERS, NASDAQ_HEADERS,
  parseYahooChart, parseNasdaqWatchlist, parseNasdaqHistorical, fetchProviderJson, logProviderAttempt } from "./market-providers.ts";

export async function getMarketUsage(admin: any, now = new Date()): Promise<MarketUsage> {
  const countSince = async (since: string) => {
    try {return await admin.from("market_api_calls").select("id",{count:"exact",head:true}).gte("called_at",since)}
    catch {return {count:null,error:true}}
  };
  const minute = await countSince(new Date(now.getTime()-60000).toISOString());
  const day = await countSince(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())).toISOString());
  const monitoringAvailable = !minute.error && !day.error && Number.isInteger(minute.count) && Number.isInteger(day.count);
  const usage = {minuteCalls: minute.error || !Number.isInteger(minute.count) ? null : minute.count, dailyCalls: day.error || !Number.isInteger(day.count) ? null : day.count, minuteLimit:6, dailyLimit:700, quotaHit: monitoringAvailable && (minute.count >= 6 || day.count >= 700), monitoringAvailable};
  console.log(JSON.stringify({event:"market-call-count", ...usage}));
  return usage;
}
export async function checkRateLimit(admin: any, symbol: string, endpoint: string, now = new Date()): Promise<boolean> {
  // ponytail: observational counters can race across requests; an atomic budget RPC
  // is needed if exact multi-request credit enforcement becomes a requirement.
  try {await admin.from("market_api_calls").delete().lt("called_at", new Date(now.getTime()-2*86400000).toISOString())} catch { /* Counts below determine whether refresh is safe. */ }
  const usage = await getMarketUsage(admin, now);
  if (!usage.monitoringAvailable || usage.quotaHit) return false;
  try {
    const recorded = await admin.from("market_api_calls").insert({called_at:now.toISOString(),symbol,endpoint});
    return !recorded.error;
  } catch {return false}
}

export const QUOTE_CACHE_MS = 15 * 60 * 1000;
export const CLOSE_SETTLE_MS = 20 * 60 * 1000;
export const CLOSED_FALLBACK_STALE_MS = 3 * 60 * 60 * 1000;
export const TRADE_MARGIN_MS = 60 * 1000;
const nyDate = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

export function nyWallTimeUtc(day: string, hour: number, minute: number): Date {
  const wall = Date.parse(`${day}T00:00:00Z`) + (hour * 60 + minute) * 60000;
  for (const offset of [4, 5]) {
    const date = new Date(wall + offset * 3600000);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    if (Number(parts.find(p => p.type === "hour")?.value) === hour && Number(parts.find(p => p.type === "minute")?.value) === minute) return date;
  }
  throw new Error("Invalid New York wall time");
}
export function latestCloseAt(now = new Date()): Date | null {
  const today = Date.parse(nyDate(now) + "T00:00:00Z");
  for (let days = 0; days <= 10; days++) {
    const day = new Date(today - days * 86400000).toISOString().slice(0, 10);
    for (const hour of [16, 13]) {
      const close = nyWallTimeUtc(day, hour, 0);
      if (close <= now && marketSession(new Date(close.getTime() - 60000)) === "open" && marketSession(close) === "closed") return close;
    }
  }
  return null;
}
export function sessionOpenAt(now = new Date()): Date | null {
  return marketSession(now) === "open" ? nyWallTimeUtc(nyDate(now), 9, 30) : null;
}
export function isMarketHoursWindow(now = new Date()): boolean {
  return marketSession(now) === "open";
}
export function tradeGuardWouldRefuse(row: MarketQuote | null | undefined, now: Date, kind: "open" | "sell"): boolean {
  if (!row || !Number.isFinite(Number(row.price)) || Number(row.price) <= 0) return true;
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  const windowOpen = now.getUTCDay() >= 1 && now.getUTCDay() <= 5 && minute >= 810 && minute < 1260;
  const maxAge = windowOpen || row.is_market_open ? (kind === "open" ? 15 : 30) * 60000 : CLOSED_FALLBACK_STALE_MS;
  const fetched = Date.parse(row.fetched_at);
  return !Number.isFinite(fetched) || now.getTime() - fetched > maxAge - TRADE_MARGIN_MS;
}
export function isQuoteStale(quote: MarketQuote, now = new Date()): boolean {
  const fetched = Date.parse(quote.fetched_at);
  if (!Number.isFinite(fetched)) return true;
  const state = marketSession(now);
  if (state === "open") {
    const priceTime = quote.price_time ? Date.parse(quote.price_time) : null;
    return now.getTime() - fetched >= QUOTE_CACHE_MS || (priceTime !== null &&
      (!Number.isFinite(priceTime) || priceTime < sessionOpenAt(now)!.getTime()));
  }
  const close = state === "closed" ? latestCloseAt(now) : null;
  return close ? fetched < close.getTime() + CLOSE_SETTLE_MS : now.getTime() - fetched > CLOSED_FALLBACK_STALE_MS;
}

type QuoteOptions = { fetchFn?: typeof fetch; now?: Date; allowClosedBootstrap?: boolean; forTrade?: "open" | "sell"; kind?: "etf" | "stock" };
async function symbolKind(admin: any, symbol: string, kind?: "etf" | "stock"): Promise<"etf" | "stock"> {
  if (kind) return kind;
  const { data } = await admin.from("market_symbols").select("kind").eq("symbol", symbol).maybeSingle();
  return data?.kind === "etf" ? "etf" : "stock";
}
export async function getQuote(admin: any, symbol: string, options: QuoteOptions = {}): Promise<MarketQuoteResult> {
  const now = options.now ?? new Date();
  const fetchFn = options.fetchFn ?? fetch;
  const state = marketSession(now);
  if (!SCREENING[symbol]) return { available: false, marketState: state };
  const { data: row } = await admin.from("market_quotes").select("*").eq("symbol", symbol).maybeSingle();
  const cached: MarketQuote | null = row && Number.isFinite(Number(row.price)) && Number(row.price) > 0 ? {
    symbol: row.symbol, price: Number(row.price), previous_close: row.previous_close ? Number(row.previous_close) : null,
    currency: row.currency || "USD", is_market_open: Boolean(row.is_market_open), price_time: row.price_time,
    fetched_at: row.fetched_at,
    change_percent: row.previous_close > 0 ? Math.round(((Number(row.price) - Number(row.previous_close)) / Number(row.previous_close)) * 10000) / 100 : null,
  } : null;
  const fetched = cached && Number.isFinite(Date.parse(cached.fetched_at)) ? Date.parse(cached.fetched_at) : -Infinity;
  const close = state === "closed" ? latestCloseAt(now) : null;
  const settled = close ? close.getTime() + CLOSE_SETTLE_MS : null;
  const tradeDue = options.forTrade ? tradeGuardWouldRefuse(cached, now, options.forTrade) : false;
  const refresh = state === "unknown" ? false : state === "open"
    ? !cached || now.getTime() - fetched >= QUOTE_CACHE_MS || tradeDue
    : !cached ? Boolean(options.allowClosedBootstrap || options.forTrade)
    : settled === null || now.getTime() < settled ? false
    : fetched < settled || tradeDue;
  const presentation = cached ? { ...cached, is_market_open: state === "closed" ? false : cached.is_market_open } : null;
  if (!refresh) {
    const lastClose = cached ? cached.is_market_open || isMarketHoursWindow(new Date(cached.fetched_at)) ? cached.previous_close : cached.price : null;
    return cached ? { available: true, stale: isQuoteStale(cached, now), fetchedAt: cached.fetched_at, quote: presentation!, marketState: state,
      ...(state === "closed" && Number.isFinite(lastClose) && Number(lastClose) > 0 ? { lastClose: Number(lastClose), lastCloseAsOf: cached.price_time ?? cached.fetched_at } : {}) }
      : { available: false, marketState: state };
  }
  const fallback = (degradedReason?: MarketQuoteResult["degradedReason"]): MarketQuoteResult => cached
    ? { available: true, stale: true, fetchedAt: cached.fetched_at, quote: presentation!, marketState: state, degradedReason }
    : { available: false, marketState: state, degradedReason };
  let quota = false;
  for (const provider of ["yahoo", "nasdaq"] as const) {
    if (!await checkRateLimit(admin, symbol, provider === "yahoo" ? "yahoo:chart" : "nasdaq:watchlist", now)) {
      const usage = await getMarketUsage(admin, now);
      return fallback(usage.quotaHit ? "local_quota" : "monitor_unavailable");
    }
    const url = provider === "yahoo" ? yahooChartUrl(symbol) : nasdaqWatchlistUrl(symbol, await symbolKind(admin, symbol, options.kind));
    const response = await fetchProviderJson(fetchFn, url, provider === "yahoo" ? YAHOO_HEADERS : NASDAQ_HEADERS);
    const yahoo = response.ok && provider === "yahoo" ? parseYahooChart(response.json, symbol) : null;
    const quote = yahoo?.quote ?? (response.ok && provider === "nasdaq" ? parseNasdaqWatchlist(response.json, symbol) : null);
    logProviderAttempt({ provider, symbol, ok: Boolean(quote), status: response.status, ms: response.ms, reason: response.ok ? quote ? undefined : "invalid_payload" : response.reason });
    if (response.status === 429) quota = true;
    if (!quote) continue;
    const saved: MarketQuote = { ...quote, is_market_open: state === "open", fetched_at: now.toISOString(),
      change_percent: quote.previous_close && quote.previous_close > 0 ? Math.round((quote.price - quote.previous_close) / quote.previous_close * 10000) / 100 : null };
    const result = await admin.from("market_quotes").upsert({ symbol, price: saved.price, previous_close: saved.previous_close, currency: saved.currency,
      is_market_open: saved.is_market_open, price_time: saved.price_time, fetched_at: saved.fetched_at });
    if (result.error) return fallback();
    if (yahoo?.closes.length) await admin.from("market_daily_closes").upsert(yahoo.closes.map(bar => ({ symbol, ...bar })), { onConflict: "symbol,day" });
    return { available: true, stale: isQuoteStale(saved, now), fetchedAt: saved.fetched_at, quote: saved, marketState: state, provider,
      ...(state === "closed" ? { lastClose: saved.price, lastCloseAsOf: saved.price_time ?? saved.fetched_at } : {}) };
  }
  return fallback(quota ? "provider_quota" : undefined);
}

export async function getDailyCloses(admin: any, symbol: string, options: Pick<QuoteOptions, "fetchFn" | "now" | "kind"> = {}): Promise<MarketTimeSeriesResult> {
  const now = options.now ?? new Date();
  const { data: cached } = await admin.from("market_daily_closes").select("day, close").eq("symbol", symbol).order("day", { ascending: true });
  const closes = (cached ?? []).map((bar: any) => ({ day: String(bar.day), close: Number(bar.close) }));
  const fallback = (): MarketTimeSeriesResult => ({ available: closes.length > 0, stale: true, closes });
  const close = latestCloseAt(now);
  if (!SCREENING[symbol] || !close || marketSession(now) === "unknown") return fallback();
  const target = nyDate(close);
  if (closes.length && closes.at(-1).day >= target) return { available: true, stale: false, closes };
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { count, error } = await admin.from("market_api_calls").select("id", { count: "exact", head: true }).eq("symbol", symbol).eq("endpoint", "nasdaq:historical").gte("called_at", midnight);
  if (error || !Number.isInteger(count) || count > 0) return fallback();
  if (!await checkRateLimit(admin, symbol, "nasdaq:historical", now)) return fallback();
  const response = await fetchProviderJson(options.fetchFn ?? fetch, nasdaqHistoricalUrl(symbol, await symbolKind(admin, symbol, options.kind), now), NASDAQ_HEADERS);
  const parsed = response.ok ? parseNasdaqHistorical(response.json) : [];
  logProviderAttempt({ provider: "nasdaq", symbol, ok: parsed.length > 0, status: response.status, ms: response.ms, reason: response.ok ? parsed.length ? undefined : "invalid_payload" : response.reason });
  if (!parsed.length) return fallback();
  const saved = await admin.from("market_daily_closes").upsert(parsed.map(bar => ({ symbol, ...bar })), { onConflict: "symbol,day" });
  return saved.error ? fallback() : { available: true, stale: parsed.at(-1)!.day < target, closes: parsed };
}

export async function getCuratedSymbols(admin: any): Promise<MarketSymbol[]> {
  const { data: symbols, error: symbolsError } = await admin
    .from("market_symbols")
    .select("*")
    .eq("active", true)
    .order("kind", { ascending: true })
    .order("symbol", { ascending: true });

  if (symbolsError) throw new Error("The instrument list is unavailable. Try again.");
  if (!symbols || symbols.length === 0) return [];
  // Catalogue search is independent of quote availability and provider configuration.
  return symbols.filter((s: MarketSymbol) => SCREENING[s.symbol]).map((s: MarketSymbol) => ({
    symbol: s.symbol, name: s.name, kind: s.kind, active: s.active,
    halal_source: SCREENING[s.symbol].source, halal_checked_on: SCREENING[s.symbol].checked,
    halal_url: SCREENING[s.symbol].url, verified: true,
  }));
}

export async function getVisibleQuotes(admin: Parameters<typeof getQuote>[0], requested: unknown, options?: Parameters<typeof getQuote>[2]) {
  if (!Array.isArray(requested) || requested.length > 12 || requested.some(s => typeof s !== "string")) throw new Error("Request at most 12 visible symbols");
  const catalogue = await getCuratedSymbols(admin);
  const allowed = new Set(catalogue.map(s => s.symbol));
  const symbols = [...new Set(requested.map(s => s.trim().toUpperCase()))];
  if (symbols.some(s => !allowed.has(s))) throw new Error("Instrument not in our verified catalogue");
  const quotes: Record<string, MarketQuoteResult> = {};
  for (const symbol of symbols) quotes[symbol] = await getQuote(admin, symbol, { ...options, kind: catalogue.find(s => s.symbol === symbol)!.kind });
  const usage = await getMarketUsage(admin, options?.now);
  return { quotes, marketState: marketSession(options?.now), usage };
}
