import type { MarketUsage } from "./market-types.ts";
// supabase/functions/_shared/market.ts
// T36: Market Tracker integration with Twelve Data
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
  lastClose?: number;
  lastCloseAsOf?: string;
}

export interface MarketTimeSeriesResult {
  available: boolean;
  stale?: boolean;
  closes: Array<{ day: string; close: number }>;
}

export function parseQuotePayload(data: unknown): MarketQuote | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  // HTTP-200 error payload from Twelve Data
  if (obj.status === "error" || obj.code !== undefined && Number(obj.code) >= 400) {
    return null;
  }

  const symbol = String(obj.symbol || "").trim();
  const closeStr = obj.close;
  if (!symbol || closeStr === undefined || closeStr === null || closeStr === "") {
    return null;
  }

  const price = parseFloat(String(closeStr));
  if (isNaN(price) || price <= 0) {
    return null;
  }

  const prevClose = obj.previous_close !== undefined && obj.previous_close !== null && obj.previous_close !== ""
    ? parseFloat(String(obj.previous_close))
    : null;

  let changePercent: number | null = null;
  if (obj.percent_change !== undefined && obj.percent_change !== null && obj.percent_change !== "") {
    const pc = parseFloat(String(obj.percent_change));
    if (!isNaN(pc)) changePercent = Math.round(pc * 100) / 100;
  } else if (prevClose && prevClose > 0) {
    changePercent = Math.round(((price - prevClose) / prevClose) * 10000) / 100;
  }

  const isOpen = obj.is_market_open === true || obj.is_market_open === "true";
  const currency = String(obj.currency || "USD");

  let priceTime: string | null = null;
  if (obj.timestamp !== undefined && obj.timestamp !== null) {
    const tsSec = Number(obj.timestamp);
    if (!isNaN(tsSec) && tsSec > 0) {
      priceTime = new Date(tsSec * 1000).toISOString();
    }
  } else if (obj.datetime) {
    try {
      priceTime = new Date(String(obj.datetime)).toISOString();
    } catch {
      priceTime = null;
    }
  }

  return {
    symbol,
    price,
    previous_close: isNaN(Number(prevClose)) ? null : prevClose,
    currency,
    is_market_open: isOpen,
    price_time: priceTime,
    fetched_at: new Date().toISOString(),
    change_percent: changePercent,
  };
}

export function parseTimeSeriesPayload(data: unknown): Array<{ day: string; close: number }> | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  if (obj.status === "error" || obj.code !== undefined && Number(obj.code) >= 400) {
    return null;
  }

  const values = obj.values;
  if (!Array.isArray(values)) {
    return null;
  }

  const result: Array<{ day: string; close: number }> = [];
  for (const item of values) {
    if (!item || typeof item !== "object") continue;
    const v = item as Record<string, unknown>;
    const day = String(v.datetime || "").split(" ")[0].trim();
    const close = parseFloat(String(v.close || ""));
    if (day && !isNaN(close) && close > 0) {
      result.push({ day, close });
    }
  }

  // Sort ascending by day
  result.sort((a, b) => a.day.localeCompare(b.day));
  return result;
}

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

export function isMarketHoursWindow(now: Date = new Date()): boolean {
  return marketSession(now) === "open";
}

export function isQuoteStale(quote: MarketQuote, now: Date = new Date()): boolean {
  const fetchedTime = new Date(quote.fetched_at).getTime();
  const nowTime = now.getTime();
  const diffMs = nowTime - fetchedTime;

  if (!Number.isFinite(fetchedTime)) return true;
  // Fetching an old provider value must not make an open-market price look fresh.
  if (quote.is_market_open && quote.price_time) {
    const priceTime = Date.parse(quote.price_time);
    if (!Number.isFinite(priceTime) || nowTime - priceTime > 20 * 60 * 1000) return true;
  }
  if (isMarketHoursWindow(now) || quote.is_market_open) {
    return diffMs >= 15 * 60 * 1000;
  } else {
    // Market closed and outside market hours window: stale after 3 hours
    return diffMs > 3 * 3600 * 1000;
  }
}

export async function getQuote(
  admin: any,
  symbol: string,
  options?: {
    apiKey?: string | null;
    fetchFn?: typeof fetch;
    now?: Date;
  }
): Promise<MarketQuoteResult> {
  const apiKey = options?.apiKey !== undefined ? options.apiKey : Deno.env.get("TWELVEDATA_API_KEY");
  const fetchFn = options?.fetchFn || fetch;
  const now = options?.now || new Date();
  if (!SCREENING[symbol]) return { available: false, marketState: marketSession(now) };

  // Load from cache first
  const { data: cachedRow } = await admin
    .from("market_quotes")
    .select("*")
    .eq("symbol", symbol)
    .maybeSingle();

  let cachedQuote: MarketQuote | null = null;
  if (cachedRow && Number.isFinite(Number(cachedRow.price)) && Number(cachedRow.price) > 0) {
    let changePct: number | null = null;
    if (cachedRow.previous_close && cachedRow.previous_close > 0) {
      changePct = Math.round(((cachedRow.price - cachedRow.previous_close) / cachedRow.previous_close) * 10000) / 100;
    }
    cachedQuote = {
      symbol: cachedRow.symbol,
      price: Number(cachedRow.price),
      previous_close: cachedRow.previous_close ? Number(cachedRow.previous_close) : null,
      currency: cachedRow.currency || "USD",
      is_market_open: Boolean(cachedRow.is_market_open),
      price_time: cachedRow.price_time,
      fetched_at: cachedRow.fetched_at,
      change_percent: changePct,
    };
  }

  // Keep the trading quote intact. Last-close presentation must never substitute
  // an intraday cached value or entry price for a certified closing value.
  if (marketSession(now) !== "open") {
    const lastClose = cachedQuote ? cachedQuote.is_market_open || isMarketHoursWindow(new Date(cachedQuote.fetched_at)) ? cachedQuote.previous_close : cachedQuote.price : null;
    return cachedQuote ? {available:true, stale:isQuoteStale(cachedQuote,now), fetchedAt:cachedQuote.fetched_at, quote:{...cachedQuote,is_market_open:false}, marketState:marketSession(now),
      ...(Number.isFinite(lastClose) && Number(lastClose)>0 ? {lastClose:Number(lastClose),lastCloseAsOf:cachedQuote.price_time ?? cachedQuote.fetched_at} : {})}
      : {available:false,marketState:marketSession(now)};
  }
  // Stale provider timestamps do not bypass the 15-minute fetch cache.
  if (cachedQuote && Number.isFinite(Date.parse(cachedQuote.fetched_at)) && now.getTime() - Date.parse(cachedQuote.fetched_at) < 15 * 60 * 1000) return { available: true, stale: isQuoteStale(cachedQuote, now), fetchedAt: cachedQuote.fetched_at, quote: cachedQuote, marketState: cachedQuote.is_market_open ? "open" : "closed", ...(!cachedQuote.is_market_open && cachedQuote.previous_close && cachedQuote.previous_close > 0 ? {lastClose:cachedQuote.previous_close,lastCloseAsOf:cachedQuote.price_time ?? cachedQuote.fetched_at} : {}) };
  // A provider-reported exceptional closure during today's core session lasts until next session.
  const exchangeDate = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  if (cachedQuote && !cachedQuote.is_market_open && isMarketHoursWindow(new Date(cachedQuote.fetched_at)) && exchangeDate(now) === exchangeDate(new Date(cachedQuote.fetched_at))) return { available: true, stale: isQuoteStale(cachedQuote, now), fetchedAt: cachedQuote.fetched_at, quote: cachedQuote, marketState: "closed", ...(cachedQuote.previous_close && cachedQuote.previous_close > 0 ? {lastClose:cachedQuote.previous_close,lastCloseAsOf:cachedQuote.price_time ?? cachedQuote.fetched_at} : {}) };

  // If no key at all
  if (!apiKey || apiKey.trim() === "") {
    if (cachedQuote) {
      return { available: true, stale: true, fetchedAt: cachedQuote.fetched_at, quote: cachedQuote };
    }
    return { available: false };
  }

  // Check staleness
  if (cachedQuote && !isQuoteStale(cachedQuote, now)) {
    return { available: true, stale: false, fetchedAt: cachedQuote.fetched_at, quote: cachedQuote };
  }

  const fallback = (degradedReason?: MarketQuoteResult["degradedReason"]): MarketQuoteResult => cachedQuote
    ? {available:true,stale:true,fetchedAt:cachedQuote.fetched_at,quote:cachedQuote,marketState:marketSession(now),degradedReason}
    : {available:false,marketState:marketSession(now),degradedReason};
  const allowed = await checkRateLimit(admin, symbol, "quote", now);
  if (!allowed) {
    const usage = await getMarketUsage(admin,now);
    return fallback(usage.quotaHit ? "local_quota" : "monitor_unavailable");
  }

  // Call Twelve Data
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetchFn(url, {
      headers: {
        Authorization: `apikey ${apiKey}`,
      },
    });

    if (!res.ok) return fallback(res.status === 429 ? "provider_quota" : undefined);
    const json = await res.json();
    const parsed = parseQuotePayload(json);
    if (!parsed || parsed.symbol !== symbol) return fallback(Number(json?.code) === 429 ? "provider_quota" : undefined);

    // Upsert into market_quotes
    const nowIso = now.toISOString();
    parsed.fetched_at = nowIso;
    await admin.from("market_quotes").upsert({
      symbol: parsed.symbol,
      price: parsed.price,
      previous_close: parsed.previous_close,
      currency: parsed.currency,
      is_market_open: parsed.is_market_open,
      price_time: parsed.price_time,
      fetched_at: nowIso,
    });

    return { available: true, stale: isQuoteStale(parsed, now), fetchedAt: nowIso, quote: parsed, marketState: parsed.is_market_open ? "open" : "closed", ...(!parsed.is_market_open && parsed.previous_close && parsed.previous_close > 0 ? {lastClose:parsed.previous_close,lastCloseAsOf:parsed.price_time ?? nowIso} : {}) };
  } catch {
    if (cachedQuote) {
      return { available: true, stale: true, fetchedAt: cachedQuote.fetched_at, quote: cachedQuote };
    }
    return { available: false };
  }
}

export async function getDailyCloses(
  admin: any,
  symbol: string,
  options?: {
    apiKey?: string | null;
    fetchFn?: typeof fetch;
    now?: Date;
  }
): Promise<MarketTimeSeriesResult> {
  const apiKey = options?.apiKey !== undefined ? options.apiKey : Deno.env.get("TWELVEDATA_API_KEY");
  const fetchFn = options?.fetchFn || fetch;
  const now = options?.now || new Date();

  // Read existing closes from DB
  const { data: cachedCloses } = await admin
    .from("market_daily_closes")
    .select("day, close")
    .eq("symbol", symbol)
    .order("day", { ascending: true });

  const existingCloses = (cachedCloses || []).map((r: any) => ({
    day: String(r.day),
    close: Number(r.close),
  }));

  if (!SCREENING[symbol] || marketSession(now) !== "open") return { available: existingCloses.length > 0, stale: true, closes: existingCloses };

  // Check if refreshed today UTC
  const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { count: callsToday } = await admin
    .from("market_api_calls")
    .select("id", { count: "exact", head: true })
    .eq("symbol", symbol)
    .eq("endpoint", "time_series")
    .gte("called_at", startOfDayUtc);

  const alreadyRefreshedToday = callsToday !== null && callsToday > 0;

  if (alreadyRefreshedToday && existingCloses.length > 0) {
    return { available: true, stale: false, closes: existingCloses };
  }

  // No key
  if (!apiKey || apiKey.trim() === "") {
    if (existingCloses.length > 0) {
      return { available: true, stale: true, closes: existingCloses };
    }
    return { available: false, closes: [] };
  }

  // Rate guard check
  const allowed = await checkRateLimit(admin, symbol, "time_series", now);
  if (!allowed) {
    if (existingCloses.length > 0) {
      return { available: true, stale: true, closes: existingCloses };
    }
    return { available: false, closes: [] };
  }

  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=90`;
    const res = await fetchFn(url, {
      headers: {
        Authorization: `apikey ${apiKey}`,
      },
    });

    if (!res.ok) {
      if (existingCloses.length > 0) {
        return { available: true, stale: true, closes: existingCloses };
      }
      return { available: false, closes: [] };
    }

    const json = await res.json();
    const parsed = parseTimeSeriesPayload(json);
    if (!parsed || parsed.length === 0) {
      if (existingCloses.length > 0) {
        return { available: true, stale: true, closes: existingCloses };
      }
      return { available: false, closes: [] };
    }

    // Upsert batch
    const rows = parsed.map((p) => ({
      symbol,
      day: p.day,
      close: p.close,
    }));
    await admin.from("market_daily_closes").upsert(rows, { onConflict: "symbol,day" });

    return { available: true, stale: false, closes: parsed };
  } catch {
    if (existingCloses.length > 0) {
      return { available: true, stale: true, closes: existingCloses };
    }
    return { available: false, closes: [] };
  }
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
  for (const symbol of symbols) quotes[symbol] = await getQuote(admin, symbol, options);
  const usage = await getMarketUsage(admin, options?.now);
  return { quotes, marketState: marketSession(options?.now), usage };
}
