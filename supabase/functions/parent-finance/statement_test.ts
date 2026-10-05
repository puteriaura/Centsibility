import { assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { mytRange, StatementError } from "./statement.ts";

Deno.test("mytRange('2026-10-01', '2026-10-31') produces exact expected UTC ISO bounds", () => {
  const range = mytRange("2026-10-01", "2026-10-31");
  assertEquals(range.startIso, "2026-09-30T16:00:00.000Z");
  assertEquals(range.endIso, "2026-10-31T15:59:59.999Z");
});

Deno.test("mytRange rejects non-yyyy-MM-dd date formats", () => {
  assertThrows(
    () => mytRange("01-10-2026", "2026-10-31"),
    StatementError,
    "Invalid date format",
  );

  assertThrows(
    () => mytRange("2026/10/01", "2026/10/31"),
    StatementError,
    "Invalid date format",
  );

  assertThrows(
    () => mytRange("2026-10-1", "2026-10-31"),
    StatementError,
    "Invalid date format",
  );

  assertThrows(
    () => mytRange("", "2026-10-31"),
    StatementError,
    "Invalid date format",
  );

  assertThrows(
    () => mytRange("invalid", "invalid"),
    StatementError,
    "Invalid date format",
  );
});
