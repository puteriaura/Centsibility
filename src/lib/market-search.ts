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

export function marketCatalogueMessage(loaded: boolean, failed: boolean, query: string): string {
  if (failed) return "Catalogue failed to load. Please retry.";
  if (!loaded) return "Loading investment catalogue…";
  return query.trim()
    ? "Not in our list. Search only covers our curated, Shariah-screened investments, not every stock."
    : "No verified instruments are available in this catalogue. Please retry.";
}
