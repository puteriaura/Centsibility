import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketPickerStatus } from "../../src/features/kid/MarketPickerStatus";

describe("market picker timestamp banner", () => {
  const noTimestampFixture = { state: "closed" as const, updatedAt: null };
  it("omits the entire updated clause for a quote fixture with no timestamp", () => {
    const html = renderToStaticMarkup(<MarketPickerStatus {...noTimestampFixture} />);
    expect(html).toBe("<span>Market closed, showing last close where available</span>");
    expect(html).not.toContain("updated"); expect(html).not.toContain("·");
  });
  it.each([undefined, ""])("also omits absent or empty timestamps", updatedAt => {
    expect(renderToStaticMarkup(<MarketPickerStatus state="open" updatedAt={updatedAt} />)).toBe("<span>Delayed price</span>");
  });
  it("keeps the supplied timestamp and distinct market states", () => {
    expect(renderToStaticMarkup(<MarketPickerStatus state="closed" updatedAt="12:15 pm" />)).toContain(" · updated 12:15 pm");
    expect(renderToStaticMarkup(<MarketPickerStatus state="unknown" />)).toBe("<span>Market status unavailable</span>");
  });
});
