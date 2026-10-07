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
