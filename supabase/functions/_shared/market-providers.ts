// Adapts the Yahoo and Nasdaq request and parsing approach from Quant Terminal's lib/providers.js.
// MIT License
//
// Copyright (c) 2026 Lewis Jackson
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
// Market data endpoints are undocumented public endpoints used under each provider's own terms; no data licence is held.

export type ProviderQuote = {
  symbol: string;
  price: number;
  previous_close: number | null;
  currency: string;
  price_time: string | null;
};
export type DailyClose = { day: string; close: number };
type Kind = "etf" | "stock";

export const YAHOO_HEADERS = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };
export const NASDAQ_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.nasdaq.com",
  Referer: "https://www.nasdaq.com/",
};
export const yahooChartUrl = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo&includePrePost=false`;
export const nasdaqWatchlistUrl = (symbol: string, kind: Kind = "stock") =>
  `https://api.nasdaq.com/api/quote/watchlist?symbol=${encodeURIComponent(`${symbol.toLowerCase()}|${kind === "etf" ? "etf" : "stocks"}`)}`;
export function nasdaqHistoricalUrl(symbol: string, kind: Kind = "stock", now = new Date()): string {
  const from = new Date(now.getTime() - 200 * 86400000).toISOString().slice(0, 10);
  return `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical?assetclass=${kind === "etf" ? "etf" : "stocks"}&fromdate=${from}&limit=9999&todate=${now.toISOString().slice(0, 10)}`;
}

function strictNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).replace(/[$,%\s]/g, "");
  return text !== "" && Number.isFinite(Number(text)) ? Number(text) : null;
}

export function parseYahooChart(json: unknown, symbol: string): { quote: ProviderQuote; closes: DailyClose[] } | null {
  const r = (json as any)?.chart?.result?.[0];
  const meta = r?.meta;
  if (typeof meta?.symbol !== "string" || meta.symbol.toUpperCase() !== symbol.toUpperCase() ||
      !Number.isFinite(meta.regularMarketPrice) || meta.regularMarketPrice <= 0) return null;
  const offset = Number.isFinite(meta.gmtoffset) ? meta.gmtoffset : 0;
  const stamp = typeof meta.regularMarketTime === "number" && meta.regularMarketTime > 0
    ? new Date(meta.regularMarketTime * 1000) : null;
  const price_time = stamp && Number.isFinite(stamp.getTime()) ? stamp.toISOString() : null;
  const days = new Map<string, number>();
  const timestamps = Array.isArray(r.timestamp) ? r.timestamp : [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = r.indicators?.quote?.[0]?.close?.[i];
    const date = new Date((timestamps[i] + offset) * 1000);
    if (typeof timestamps[i] === "number" && Number.isFinite(date.getTime()) && Number.isFinite(close) && close > 0) {
      days.set(date.toISOString().slice(0, 10), close);
    }
  }
  const closes = [...days].map(([day, close]) => ({ day, close })).sort((a, b) => a.day.localeCompare(b.day));
  const priceDay = price_time
    ? new Date(price_time).toLocaleDateString("en-CA", { timeZone: "America/New_York" })
    : closes.at(-1)?.day;
  const previous_close = closes.filter(bar => priceDay && bar.day < priceDay).at(-1)?.close ?? null;
  return { quote: { symbol: meta.symbol.toUpperCase(), price: meta.regularMarketPrice, previous_close,
    currency: typeof meta.currency === "string" && meta.currency ? meta.currency : "USD", price_time }, closes };
}

export function parseNasdaqWatchlist(json: unknown, symbol: string): ProviderQuote | null {
  const rows = (json as any)?.data;
  const row = Array.isArray(rows) ? rows.find(r => typeof r?.symbol === "string" && r.symbol.toUpperCase() === symbol.toUpperCase()) : null;
  const price = strictNumber(row?.lastSalePrice);
  if (price === null || price <= 0) return null;
  const pct = strictNumber(row.percentageChange);
  const previous_close = pct !== null && pct > -100 ? Math.round(price / (1 + pct / 100) * 1e6) / 1e6 : null;
  return { symbol: symbol.toUpperCase(), price, previous_close, currency: "USD", price_time: null };
}

export function parseNasdaqHistorical(json: unknown): DailyClose[] {
  const rows = (json as any)?.data?.tradesTable?.rows;
  if (!Array.isArray(rows)) return [];
  const closes: DailyClose[] = [];
  for (const row of rows) {
    const match = typeof row?.date === "string" ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row.date) : null;
    const close = strictNumber(row?.close);
    if (!match || close === null || close <= 0) continue;
    const day = `${match[3]}-${match[1]}-${match[2]}`;
    const date = new Date(day + "T00:00:00Z");
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day) closes.push({ day, close });
  }
  return closes.sort((a, b) => a.day.localeCompare(b.day));
}

type ProviderResponse = { ok: true; json: unknown; status: number; ms: number } |
  { ok: false; status: number | null; ms: number; reason: string };
export async function fetchProviderJson(fetchFn: typeof fetch, url: string, headers: Record<string, string>, timeoutMs = 8000): Promise<ProviderResponse> {
  const start = performance.now();
  const signal = AbortSignal.timeout(timeoutMs);
  const ms = () => Math.round(performance.now() - start);
  const timedOut = (error: unknown) => signal.aborted || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name));
  let response: Response;
  try { response = await fetchFn(url, { headers, signal }); }
  catch (error) { return { ok: false, status: null, ms: ms(), reason: timedOut(error) ? "timeout" : "network" }; }
  if (!response.ok) return { ok: false, status: response.status, ms: ms(), reason: `http_${response.status}` };
  try { return { ok: true, json: await response.json(), status: response.status, ms: ms() }; }
  catch (error) { return { ok: false, status: response.status, ms: ms(), reason: timedOut(error) ? "timeout" : "bad_json" }; }
}
export function logProviderAttempt(attempt: { provider: "yahoo" | "nasdaq"; symbol: string; ok: boolean; status: number | null; ms: number; reason?: string }): void {
  console.log(JSON.stringify({ event: "market-provider", ...attempt }));
}
