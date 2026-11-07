// In-memory query fixture. Unexpected tables fail instead of reaching a service.
export function createMarketAdmin(initial: {
  quotes?: any[]; closes?: any[]; calls?: any[]; symbols?: any[];
  countError?: boolean; insertError?: boolean; quoteWriteError?: boolean;
} = {}) {
  const state: Record<string, any[]> = {
    market_quotes: structuredClone(initial.quotes ?? []),
    market_daily_closes: structuredClone(initial.closes ?? []),
    market_api_calls: structuredClone(initial.calls ?? []),
    market_symbols: structuredClone(initial.symbols ?? [{ symbol: "MSFT", kind: "stock", active: true, name: "Microsoft" }]),
  };
  const trace: string[] = [];
  return { state, trace, from(table: string) {
    if (!(table in state)) throw new Error("Unexpected fixture table: " + table);
    const filters: Array<(row: any) => boolean> = [];
    const orders: Array<[string, boolean]> = [];
    let count = false;
    let limit = Infinity;
    const rows = () => state[table].filter(row => filters.every(filter => filter(row))).sort((a, b) => {
      for (const [key, ascending] of orders) {
        if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1);
      }return 0;
    }).slice(0, limit);
    const result = () => initial.countError && table === "market_api_calls"
      ? { data: null, count: null, error: { message: "fixture monitor failure" } }
      : { data: rows(), count: count ? rows().length : null, error: null };
    const chain = {
      select(_columns = "*", options?: { count?: string; head?: boolean }) { count = options?.count === "exact";return chain; },
      eq(key: string, value: any) { filters.push(row => row[key] === value);return chain; },
      in(key: string, values: any[]) { filters.push(row => values.includes(row[key]));return chain; },
      gte(key: string, value: any) { filters.push(row => row[key] >= value);return chain; },
      order(key: string, options?: { ascending?: boolean }) { orders.push([key, options?.ascending !== false]);return chain; },
      limit(value: number) { limit = value; return chain; },
      async maybeSingle() { return { ...result(), data: rows()[0] ?? null }; },
      then(resolve: (value: any) => any, reject?: (error: any) => any) { return Promise.resolve(result()).then(resolve, reject); },
      delete() { return { async lt(key: string, value: string) { state[table] = state[table].filter(row => row[key] >= value);return { error: null }; } }; },
      async insert(row: any) {
        if (initial.insertError) return { error: { message: "fixture write failure" } };
        trace.push(table + ":insert");state[table].push({ ...row });return { error: null };
      },
      async upsert(input: any, _options?: any) {
        if (initial.quoteWriteError && table === "market_quotes") return { error: { message: "fixture write failure" } };
        trace.push(table + ":upsert");
        for (const row of Array.isArray(input) ? input : [input]) {
          const index = state[table].findIndex(r => r.symbol === row.symbol && (table !== "market_daily_closes" || r.day === row.day));
          if (index < 0) state[table].push({ ...row });else state[table][index] = { ...row };
        }return { error: null };
      },
    };
    return chain;
  } };
}
export async function marketFixture(name: string): Promise<any> {
  return JSON.parse(await Deno.readTextFile(new URL(`./${name}.json`, import.meta.url)));
}
export function fixtureFetch(trace: string[], reply: (url: string, index: number) => Response | Promise<Response>) {
  const urls: string[] = [];
  const fetchFn: typeof fetch = (input) => {
    const url = String(input);urls.push(url);trace.push("fetch");
    if (!url.startsWith("https://query1.finance.yahoo.com/") && !url.startsWith("https://api.nasdaq.com/")) throw new Error("Unexpected provider URL");
    return Promise.resolve(reply(url, urls.length - 1));
  };
  return { urls, fetchFn };
}
