export function filterMarketSymbols<T extends { symbol: string; name: string }>(
  symbols: T[],
  query: string,
): T[] {
  const term = query.trim().toLowerCase();
  return term
    ? symbols.filter(
        (item) =>
          item.symbol.toLowerCase().includes(term) ||
          item.name.toLowerCase().includes(term),
      )
    : symbols;
}

export function marketCatalogueNeedsUpdate(symbols: Array<{ symbol?: string; verified?: unknown }>): boolean {
  return symbols.some(row => typeof row.verified !== "boolean");
}

export function marketCatalogueMessage(loaded: boolean, failed: boolean, query: string, outdated = false): string {
  if (outdated) return "Market data is updating, try again soon";
  if (failed) return "Catalogue failed to load. Please retry.";
  if (!loaded) return "Loading investment catalogue…";
  return query.trim()
    ? "Not included in our learning catalogue. This does not mean the stock is not Shariah-compliant. Search our selected stocks and ETFs."
    : "No verified instruments are available in this catalogue. Please retry.";
}
