import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MarketCatalogueNotice } from "../../src/features/kid/MarketCatalogueNotice";
import { marketCatalogueNeedsUpdate } from "../../src/lib/market-search";

describe("old catalogue response", () => {
  const oldShape = [{ symbol: "NVDA", name: "NVIDIA Corporation" }];
  it("renders the updating state and retry for a response without verified", () => {
    expect(marketCatalogueNeedsUpdate(oldShape)).toBe(true);
    const html = renderToStaticMarkup(<MarketCatalogueNotice symbols={oldShape} failed={false} query="nvda" onRetry={vi.fn()} />);
    expect(html).toContain("Market data is updating, try again soon");
    expect(html).toContain('role="alert"'); expect(html).toContain(">Retry</button>");
    expect(html).not.toContain("Not in our list");
  });
  it("does not mistake explicit false verification or an empty modern response for old shape", () => {
    expect(marketCatalogueNeedsUpdate([{ verified: false }, { verified: true }])).toBe(false);
    expect(marketCatalogueNeedsUpdate([])).toBe(false);
    expect(marketCatalogueNeedsUpdate([{ verified: "true" }])).toBe(true);
    expect(marketCatalogueNeedsUpdate([{ verified: true }, ...oldShape])).toBe(true);
  });
});
