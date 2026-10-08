import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { AppIcon, hasIcon } from "@/components/ui/app-icon";
import { PennyMascot, type PennyState } from "@/components/PennyMascot";

describe("Penny brand integration", () => {
  it("replaces the shared AI icon with the coin face", () => {
    expect(hasIcon("penny")).toBe(true);
    const markup = renderToStaticMarkup(<AppIcon name="penny" size={40} />);
    expect(markup).toContain('viewBox="0 0 64 64"');
    expect(markup).toContain("#E2C66B");
    expect(markup).not.toContain("lucide-cat");
  });
  it("ships every state with a reduced-motion fallback and accessible labeling", () => {
    const states: PennyState[] = [
      "neutral",
      "welcome",
      "guide",
      "happy",
      "encouraging",
      "attentive",
      "proud",
      "celebrate",
      "reassuring",
      "loading",
      "saved",
      "unavailable",
    ];
    for (const state of states) {
      const markup = renderToStaticMarkup(
        <PennyMascot state={state} label="Penny" />,
      );
      expect(markup).toContain('aria-label="Penny"');
      expect(markup).toContain(`data-state="${state}"`);
      expect(markup).toContain("prefers-reduced-motion");
      expect(markup).not.toContain("<script");
    }
  });
});
