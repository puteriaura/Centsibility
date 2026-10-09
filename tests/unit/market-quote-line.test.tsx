import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MarketQuoteLine } from "../../src/features/kid/MarketQuoteLine";

it("shows one unavailable price state, separate from market closure", () => {
  const html = renderToStaticMarkup(<MarketQuoteLine state="closed" />);
  expect(html).toBe("<span>Market closed · data unavailable</span>");
  expect(html).not.toContain("US$");
});
it("uses the last close while closed and identifies stale saved data", () => {
  const html = renderToStaticMarkup(<MarketQuoteLine state="closed" price={100} lastClose={95} stale />);
  expect(html).toContain("95.00"); expect(html).not.toContain("100.00"); expect(html).toContain("Saved data (stale)");
});
it("keeps unknown status separate from open-market missing quotes", () => {
  expect(renderToStaticMarkup(<MarketQuoteLine state="unknown" />)).toContain("Market status unavailable");
  expect(renderToStaticMarkup(<MarketQuoteLine state="open" />)).toBe("<span>Data unavailable</span>");
});
