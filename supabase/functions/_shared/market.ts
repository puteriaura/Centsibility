// supabase/functions/_shared/market.ts
// T36: Market Tracker integration with Twelve Data
import { SCREENING } from "./market-screening.ts";

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
}

export interface MarketQuoteResult {
  available: boolean;
  stale?: boolean;
  fetchedAt?: string;
  quote?: MarketQuote;
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

export async function checkRateLimit(
  admin: any,
  symbol: string,
  endpoint: string,
  now: Date = new Date()
): Promise<boolean> {
  const oneMinAgo = new Date(now.getTime() - 60 * 1000).toISOString();
  const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400 * 1000).toISOString();

  // Clean old rows older than 2 days
  try {
    await admin.from("market_api_calls").delete().lt("called_at", twoDaysAgo);
  } catch {
    // Non-fatal
  }

  // Check calls in last 60 seconds (max 6)
  const { count: countMin, error: errMin } = await admin
    .from("market_api_calls")
    .select("id", { count: "exact", head: true })
    .gte("called_at", oneMinAgo);

  if (!errMin && countMin !== null && countMin >= 6) {
    return false;
  }

  // Check calls today UTC (max 700)
  const { count: countDay, error: errDay } = await admin
    .from("market_api_calls")
    .select("id", { count: "exact", head: true })
    .gte("called_at", startOfDayUtc);

  if (!errDay && countDay !== null && countDay >= 700) {
    return false;
  }

  // Record call
  try {
    await admin.from("market_api_calls").insert({
      called_at: now.toISOString(),
      symbol,
      endpoint,
    });
  } catch {
    // Non-fatal
  }

  return true;
}

export function isMarketHoursWindow(now: Date = new Date()): boolean {
  // Used only for cache freshness; the provider determines open/closed, including holidays.
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  if (["Sat", "Sun"].includes(part("weekday") || "")) return false;
  const minutes = Number(part("hour")) * 60 + Number(part("minute"));
  return minutes >= 570 && minutes < 960;
}

export function isQuoteStale(quote: MarketQuote, now: Date = new Date()): boolean {
  const fetchedTime = new Date(quote.fetched_at).getTime();
  const nowTime = now.getTime();
  const diffMs = nowTime - fetchedTime;

  if (!Number.isFinite(fetchedTime)) return true;
  if (isMarketHoursWindow(now) || quote.is_market_open) {
    // In market hours window or when quote is reported open: stale after 10 minutes
    return diffMs > 10 * 60 * 1000;
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

  // Load from cache first
  const { data: cachedRow } = await admin
    .from("market_quotes")
    .select("*")
    .eq("symbol", symbol)
    .maybeSingle();

  let cachedQuote: MarketQuote | null = null;
  if (cachedRow) {
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

  // Stale or not cached -> check rate limit
  const allowed = await checkRateLimit(admin, symbol, "quote", now);
  if (!allowed) {
    if (cachedQuote) {
      return { available: true, stale: true, fetchedAt: cachedQuote.fetched_at, quote: cachedQuote };
    }
    return { available: false };
  }

  // Call Twelve Data
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetchFn(url, {
      headers: {
        Authorization: `apikey ${apiKey}`,
      },
    });

    if (!res.ok) {
      if (cachedQuote) {
        return { available: true, stale: true, fetchedAt: cachedQuote.fetched_at, quote: cachedQuote };
      }
      return { available: false };
    }

    const json = await res.json();
    const parsed = parseQuotePayload(json);
    if (!parsed) {
      if (cachedQuote) {
        return { available: true, stale: true, fetchedAt: cachedQuote.fetched_at, quote: cachedQuote };
      }
      return { available: false };
    }

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

    return { available: true, stale: false, fetchedAt: nowIso, quote: parsed };
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
  // Refresh serially: each request observes the existing provider budget.
  const freshness = new Map<string, MarketQuoteResult>();
  for (const symbol of symbols) freshness.set(symbol.symbol, await getQuote(admin, symbol.symbol));

  const { data: quotes, error: quotesError } = await admin
    .from("market_quotes")
    .select("*");

  if (quotesError) throw new Error("Quote data is unavailable. Try again.");
  const quoteMap = new Map<string, any>();
  for (const q of (quotes || [])) {
    quoteMap.set(q.symbol, q);
  }

  return symbols.filter((s: any) => SCREENING[s.symbol]).map((s: any) => {
    const q = quoteMap.get(s.symbol);
    let changePct: number | null = null;
    let price: number | null = null;
    let prevClose: number | null = null;
    let isOpen: boolean | undefined = undefined;
    let lastUpdated: string | null = null;

    if (q) {
      price = Number(q.price);
      prevClose = q.previous_close ? Number(q.previous_close) : null;
      if (prevClose && prevClose > 0 && price) {
        changePct = Math.round(((price - prevClose) / prevClose) * 10000) / 100;
      }
      isOpen = Boolean(q.is_market_open);
      lastUpdated = q.fetched_at;
    }

    return {
      symbol: s.symbol,
      name: s.name,
      kind: s.kind,
      halal_source: SCREENING[s.symbol].source,
      halal_checked_on: SCREENING[s.symbol].checked,
      halal_url: SCREENING[s.symbol].url,
      active: s.active,
      price,
      previous_close: prevClose,
      change_percent: changePct,
      is_market_open: isOpen,
      last_updated: lastUpdated,
      stale: q ? Boolean(freshness.get(s.symbol)?.stale) : false,
    };
  });
}
