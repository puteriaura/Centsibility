import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { logEvent } from "./log.ts";

Deno.test("logEvent only logs allowed fields", () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (line: string) => lines.push(line);
  try {
    logEvent({ action: "x", code: "abc", pin: "123456", username: "a", body: {} });
    assertEquals(lines.length, 1);
    assertEquals(JSON.parse(lines[0]), { action: "x" });
  } finally {
    console.log = original;
  }
});
