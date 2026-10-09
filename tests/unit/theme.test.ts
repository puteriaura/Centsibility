import { describe, expect, it } from "vitest";
import { normalizeTheme, resolveTheme } from "../../src/lib/theme";

describe("appearance preference", () => {
  it("defaults missing and invalid saved values to System", () => {
    for (const value of [null, undefined, "old-theme", {}]) expect(normalizeTheme(value)).toBe("system");
  });
  it("follows the OS only when System is selected", () => {
    expect(resolveTheme("system", true)).toBe("dark"); expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light"); expect(resolveTheme("dark", false)).toBe("dark");
  });
});
