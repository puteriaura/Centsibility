import React from "react";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { AppIcon, hasIcon } from "@/components/ui/app-icon";
import { PennyMascot, type PennyState } from "@/components/PennyMascot";

describe("Penny brand integration", () => {
  it("replaces the shared AI icon with the coin face", () => {
    expect(hasIcon("penny")).toBe(true);
    const markup = renderToStaticMarkup(<AppIcon name="penny" size={40} />);
    expect(markup).toContain('viewBox="29 22 102 102"');
    expect(markup).toContain("#E8DC8F");
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
      expect(markup.match(/data-limb="(?:left|right)-arm"/g)).toHaveLength(2);
      expect(markup.match(/data-limb="(?:left|right)-leg"/g)).toHaveLength(2);
      expect(markup.match(/data-penny-rig="true"/g)).toHaveLength(1);
      expect(markup).not.toContain("<script");
    }
  });
  it("honors system and app reduced motion and stops all active limb tweens", () => {
    // Static wiring guard complements the actual mid-animation browser assertions
    // in tests/runtime/penny-fidelity.mjs; SVG markup no longer embeds CSS.
    const source = fs.readFileSync("src/components/PennyMascot.tsx", "utf8");
    expect(source).toContain("const reduced = useReducedMotion()");
    expect(source).toMatch(/const still\s*=\s*!!reduced\s*\|\|\s*preferenceReduced/);
    for (const control of ["bodyMotion", "leftMotion", "rightMotion"]) {
      expect(source).toContain(`${control}.stop()`);
      expect(source).toContain(`${control}.set(`);
    }
    expect(source).toMatch(/if \(still\)/);
  });
});
