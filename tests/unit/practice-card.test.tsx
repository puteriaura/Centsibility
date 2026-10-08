import React from "react";
import fs from "node:fs";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PracticeCardHeader, PracticeCardHero, PracticeCardTips, PracticeCardHelp } from "../../src/features/kid/PracticeCard";

const source = fs.readFileSync("src/routes/kid.card.tsx", "utf8");
function callback(name: string) {
  const root = ts.createSourceFile("card.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(root) === name && node.initializer) expression = node.initializer.getText(root);
    ts.forEachChild(node, visit);
  }
  visit(root);
  expect(expression).not.toBe("");
  return ts.transpile(`const handler = ${expression}`, { target: ts.ScriptTarget.ES2022 });
}
function lockControl(options: { locked?: boolean; managed?: boolean; fail?: boolean } = {}) {
  const setIsLocked = vi.fn(); const setLockFeedback = vi.fn(); const refresh = vi.fn();
  const edgeKidSetCardControls = options.fail ? vi.fn().mockRejectedValue(new Error("Network unavailable")) : vi.fn().mockResolvedValue({});
  const handler = new Function("savingFreeze", "sfx", "isControlsLocked", "isLocked", "setIsLocked", "getKidSession", "setSavingFreeze", "edgeKidSetCardControls", "toast", "refresh", "setLockFeedback", `${callback("toggleLock")}; return handler;`)(false, { pop: vi.fn() }, !!options.managed, !!options.locked, setIsLocked, () => ({ code: "synthetic-only" }), vi.fn(), edgeKidSetCardControls, { error: vi.fn(), success: vi.fn() }, refresh, setLockFeedback);
  return { handler, setIsLocked, setLockFeedback, edgeKidSetCardControls, refresh };
}

describe("practice card components", () => {
  it("masks number, CVV and expiry and retains the last four and holder", () => {
    const html = renderToStaticMarkup(<PracticeCardHero name="Synthetic Child" revealed={false} locked={false} />);
    expect(html).toContain("6553"); expect(html).toContain("Synthetic Child"); expect(html).toContain("Practice card");
    for (const secret of ["4556", "7812", "9034", "428", "10/29"]) expect(html).not.toContain(secret);
    expect(html).toContain("••/••");
  });
  it("reveals only explicitly and leaves the holder visible while locked", () => {
    const html = renderToStaticMarkup(<PracticeCardHero name="Synthetic Child" revealed locked />);
    expect(html).toContain("4556 7812 9034 6553"); expect(html).toContain("428"); expect(html).toContain("10/29"); expect(html).toContain("Locked"); expect(html).toContain("Synthetic Child");
  });
  it("has the centered heading, accessible help, three slides and native pagination buttons", () => {
    expect(renderToStaticMarkup(<PracticeCardHeader onHelp={vi.fn()} />)).toContain('aria-label="Ask Penny about practice cards"');
    const html = renderToStaticMarkup(<PracticeCardTips onSettings={vi.fn()} onHelp={vi.fn()} />);
    expect(html.match(/aria-roledescription="slide"/g)).toHaveLength(3);
    expect(html.match(/aria-label="Show tip /g)).toHaveLength(3);
    expect(html).toContain('tabindex="0"'); expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Ask a parent to unlock");
  });
  it("plainly discloses unsupported payments and existing account controls", () => {
    const html = renderToStaticMarkup(<PracticeCardHelp />);
    expect(html).toContain("cannot pay in shops, online or at an ATM"); expect(html).toContain("sadaqah and cash withdrawal requests"); expect(html).toContain("no separate card PIN or lost-card report service");
  });
  it("locks and unlocks through the existing control with visible success feedback", async () => {
    for (const locked of [false, true]) {
      const test = lockControl({ locked }); await test.handler();
      expect(test.edgeKidSetCardControls).toHaveBeenCalledExactlyOnceWith({ code: "synthetic-only", frozen: !locked });
      expect(test.setLockFeedback).toHaveBeenCalledWith(expect.objectContaining({ error: false })); expect(test.refresh).toHaveBeenCalledOnce();
    }
  });
  it("restores the prior state on failure and prevents parent-managed unlocking", async () => {
    const failed = lockControl({ fail: true }); await failed.handler();
    expect(failed.setIsLocked).toHaveBeenLastCalledWith(false);
    expect(failed.setLockFeedback).toHaveBeenCalledWith({ error: true, text: "Network unavailable" });
    const managed = lockControl({ managed: true, locked: true }); await managed.handler();
    expect(managed.edgeKidSetCardControls).not.toHaveBeenCalled(); expect(managed.setLockFeedback).toHaveBeenCalledWith(expect.objectContaining({ error: true }));
  });
  it("hides revealed details after 30 seconds and when the tab becomes hidden", () => {
    const root = ts.createSourceFile("card.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let effect = "";
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText(root) === "useEffect" && node.arguments[0]?.getText(root).includes("30000")) effect = node.arguments[0].getText(root);
      ts.forEachChild(node, visit);
    }
    visit(root); expect(effect).not.toBe("");
    vi.useFakeTimers();
    try {
      const setShowDetails = vi.fn(); const add = vi.fn(); const remove = vi.fn();
      const js = ts.transpile(`const handler = ${effect}`, { target: ts.ScriptTarget.ES2022 });
      const handler = new Function("showDetails", "setShowDetails", "window", "document", `${js}; return handler;`)(true, setShowDetails, { setTimeout, clearTimeout }, { addEventListener: add, removeEventListener: remove });
      const cleanup = handler(); vi.advanceTimersByTime(29999); expect(setShowDetails).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1); expect(setShowDetails).toHaveBeenCalledExactlyOnceWith(false);
      expect(add).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
      add.mock.calls[0][1](); expect(setShowDetails).toHaveBeenCalledTimes(2);
      cleanup(); expect(remove).toHaveBeenCalledWith("visibilitychange", add.mock.calls[0][1]);
    } finally { vi.useRealTimers(); }
  });

  it("moves pagination without animation for reduced motion and clamps the target slide", () => {
    const text = fs.readFileSync("src/features/kid/PracticeCard.tsx", "utf8");
    const root = ts.createSourceFile("tips.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let expression = "";
    function visit(node: ts.Node) {
      if (ts.isFunctionDeclaration(node) && node.name?.text === "goTo") expression = node.getText(root);
      ts.forEachChild(node, visit);
    }
    visit(root); expect(expression).not.toBe("");
    const scrollTo = vi.fn();
    const js = ts.transpile(expression, { target: ts.ScriptTarget.ES2022 });
    const goTo = new Function("list", "window", "TIPS", `${js}; return goTo;`)({ current: { firstElementChild: { clientWidth: 250 }, scrollTo } }, { matchMedia: () => ({ matches: true }) }, [1, 2, 3]);
    goTo(1); expect(scrollTo).toHaveBeenLastCalledWith({ left: 262, behavior: "instant" });
    goTo(100); expect(scrollTo).toHaveBeenLastCalledWith({ left: 524, behavior: "instant" });
    goTo(-1); expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: "instant" });
  });

});
