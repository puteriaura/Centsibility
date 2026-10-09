import { describe, expect, it } from "vitest";
import { filterMarketSymbols, marketCatalogueMessage } from "../../src/lib/market-search";

describe("quote-independent catalogue search", () => {
  const catalogue = [{ symbol: "NVDA", name: "NVIDIA Corporation" }, { symbol: "AAPL", name: "Apple Inc." }];
  it.each(["nvda", "NVDA", "Nvda", " NVIDIA Corporation "])("normalizes %s", query => {
    expect(filterMarketSymbols(catalogue, query)).toEqual([catalogue[0]]);
  });
  it("searches company names and browses an empty query", () => {
    expect(filterMarketSymbols(catalogue, "apple")).toEqual([catalogue[1]]);
    expect(filterMarketSymbols(catalogue, "")).toEqual(catalogue);
    expect(filterMarketSymbols(catalogue, "   ")).toEqual(catalogue);
  });
  it("distinguishes failure, loading, empty catalogue and no match", () => {
    expect(marketCatalogueMessage(false, true, "nvda")).toContain("failed to load");
    expect(marketCatalogueMessage(false, false, "nvda")).toContain("Loading");
    expect(marketCatalogueMessage(true, false, "")).toContain("No verified instruments");
    expect(marketCatalogueMessage(true, false, "SNDK")).toContain("Not included in our learning catalogue");
    expect(marketCatalogueMessage(true, false, "SNDK")).toContain("does not mean the stock is not Shariah-compliant");
  });
});
