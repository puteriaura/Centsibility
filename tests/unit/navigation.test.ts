import { describe, it, expect } from "vitest";
import { NAV, pageTitle, screenKind, upTarget } from "@/lib/navigation";

describe("navigation map", () => {
  it("treats dock destinations as roots and everything else as detail", () => {
    expect(screenKind("/kid", "kid")).toBe("home");
    expect(screenKind("/kid/", "kid")).toBe("home");
    expect(screenKind("/kid/wallet", "kid")).toBe("root");
    expect(screenKind("/kid/goals", "kid")).toBe("detail");
    expect(screenKind("/kid/insights", "kid")).toBe("root");
    expect(screenKind("/kid/more", "kid")).toBe("root");
    expect(screenKind("/kid/transfer", "kid")).toBe("detail");
    expect(screenKind("/kid/invest", "kid")).toBe("detail");
    expect(screenKind("/kid/quest/abc", "kid")).toBe("detail");
    expect(screenKind("/parent", "parent")).toBe("home");
    expect(screenKind("/parent/approvals", "parent")).toBe("root");
    // The centre pill opens a focused flow, like a scanner: no dock
    expect(screenKind("/parent/transfer", "parent")).toBe("detail");
    expect(screenKind("/parent/reports", "parent")).toBe("detail");
  });

  it("sends back one level up, not always home", () => {
    expect(upTarget("/kid/quest/abc", "kid")).toBe("/kid/missions");
    expect(upTarget("/kid/missions", "kid")).toBe("/kid");
    expect(upTarget("/kid/invest", "kid")).toBe("/kid");
    expect(upTarget("/parent/reports", "parent")).toBe("/parent/insights");
    expect(upTarget("/parent/transfer", "parent")).toBe("/parent");
  });

  it("uses the same words in the dock and the page title", () => {
    for (const mode of ["kid", "parent"] as const) {
      for (const item of NAV[mode]) {
        expect(pageTitle(item.to, mode)).toBe(item.label);
      }
    }
  });

  it("has exactly one centre pill per dock", () => {
    expect(NAV.kid.filter((i) => i.center)).toHaveLength(1);
    expect(NAV.parent.filter((i) => i.center)).toHaveLength(1);
  });
});
