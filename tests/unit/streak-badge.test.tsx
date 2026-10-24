import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { StreakBadge } from "@/components/StreakBadge";

describe("StreakBadge", () => {
  it("renders the count with a flame icon and an aria-label when count > 0", () => {
    const html = renderToString(<StreakBadge count={2} />);
    expect(html).toContain(">2</span>");
    expect(html).toContain("<svg");
    expect(html).toContain('stroke-width="1.5"');
    expect(html).toContain('aria-label="2 day streak"');
  });

  it("renders nothing when count is 0", () => {
    const html = renderToString(<StreakBadge count={0} />);
    expect(html).toBe("");
  });

  it("renders nothing when count is negative", () => {
    const html = renderToString(<StreakBadge count={-1} />);
    expect(html).toBe("");
  });
});
