import { describe, expect, it } from "vitest";
import { recapBackgrounds, isStoryTap } from "../../src/lib/recap-backgrounds";
describe("recap selection and press semantics", () => {
  it("preserves each recap's six unique backgrounds while changing periods", () => {
    const first = recapBackgrounds("kid", "1-7 Oct");
    expect(first).toEqual(recapBackgrounds("kid", "1-7 Oct"));
    expect(new Set(first).size).toBe(6);
    expect(first).not.toEqual(recapBackgrounds("kid", "8-14 Oct"));
    expect(first).not.toEqual(recapBackgrounds("another", "1-7 Oct"));
  });
  it("does not navigate when a hold is released", () => {
    expect(isStoryTap(100, 200)).toBe(true);
    expect(isStoryTap(100, 350)).toBe(false);
    expect(isStoryTap(100, 5100)).toBe(false);
  });
});
