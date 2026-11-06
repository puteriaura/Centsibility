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
  expect(html).toContain("95.00"); expect(html).not.toContain("100.00"); expect(html).toContain("Saved price");
});
it("keeps unknown status separate from open-market missing quotes", () => {
  expect(renderToStaticMarkup(<MarketQuoteLine state="unknown" />)).toContain("Market status unavailable");
  expect(renderToStaticMarkup(<MarketQuoteLine state="open" />)).toBe("<span>Data unavailable</span>");
});

it("omits the entire updated clause for missing or invalid timestamps", () => {
  for (const updatedAt of [undefined, null, "", "invalid"]) {
    const html = renderToStaticMarkup(<MarketQuoteLine state="closed" updatedAt={updatedAt} />);
    expect(html).not.toContain("Price from");
    expect(html.match(/data unavailable/g)).toHaveLength(1);
  }
});
it("shows a timestamp only with a real quote", () => {
  expect(renderToStaticMarkup(<MarketQuoteLine state="open" price={100} updatedAt="2026-10-09T14:00:00Z" />)).toContain("Price from");
  expect(renderToStaticMarkup(<MarketQuoteLine state="closed" updatedAt="2026-10-09T14:00:00Z" />)).not.toContain("Price from");
});
