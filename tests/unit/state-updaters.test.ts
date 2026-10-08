import fs from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Execute the real callback; simulate Strict Mode evaluating functional updates twice.
function parentKeypad(pinInput: string) {
  const source = fs.readFileSync("src/routes/parent.tsx", "utf8");
  const root = ts.createSourceFile("parent.tsx", source, ts.ScriptTarget.Latest, true);
  let callback = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(root) === "handleKeyPress" && node.initializer && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0].getText(root);
    ts.forEachChild(node, visit);
  }
  visit(root);
  expect(callback).not.toBe("");
  const js = ts.transpile(`const handler = ${callback}`, { target: ts.ScriptTarget.ES2022 });
  const submitPin = vi.fn();
  const setPinInput = vi.fn((update: string | ((previous: string) => string)) => {
    if (typeof update === "function") { update(pinInput); return update(pinInput); }
    return update;
  });
  const handler = new Function("pinProcessing", "pinInput", "setPinInput", "submitPin", `${js}; return handler;`)(false, pinInput, setPinInput, submitPin);
  return { handler, submitPin, setPinInput };
}

describe("parent PIN updater purity", () => {
  it("submits the sixth digit once, even when React repeats updater functions", () => {
    const { handler, submitPin } = parentKeypad("12345");
    handler("6"); expect(submitPin).toHaveBeenCalledExactlyOnceWith("123456");
  });
  it("does not submit delete, unknown keys, incomplete input or an already full PIN", () => {
    for (const [pin, key] of [["12345", "delete"], ["12345", "bad"], ["123", "4"], ["123456", "7"]]) {
      const { handler, submitPin } = parentKeypad(pin);
      handler(key); expect(submitPin).not.toHaveBeenCalled();
    }
  });
  it("submits once when the double-zero key completes the PIN", () => {
    const { handler, submitPin } = parentKeypad("1234");
    handler("00"); expect(submitPin).toHaveBeenCalledExactlyOnceWith("123400");
  });
});
