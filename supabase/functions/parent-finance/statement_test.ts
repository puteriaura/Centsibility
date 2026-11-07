import { assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { getStatement, mytRange, StatementError } from "./statement.ts";

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

const kidId = "a0000000-0000-0000-0000-000000000001";
const parentId = "parent-fixture";
const ledger = [
  { id: "after-debit", created_at: "2026-11-02T04:00:00Z", type: "QARD", label: "Loan repayment", amount: 4.25 },
  { id: "after-pot", created_at: "2026-11-01T04:00:00Z", type: "INVEST_GAIN", amount: 99 },
  { id: "boundary", created_at: "2026-10-31T16:00:00.000Z", type: "HIBAH", amount: 25 },
  { id: "last", created_at: "2026-10-31T15:59:59.999999Z", type: "GOAL_IN", amount: 5.25 },
  { id: "first", created_at: "2026-09-30T16:00:00.000Z", type: "DEPOSIT", amount: 10.5 },
  { id: "before", created_at: "2026-09-30T15:59:59.999Z", type: "WITHDRAWAL", amount: 999 },
];

function statementAdmin(rows = ledger, balances = [126]) {
  let reads = 0;
  return { from(table: string) {
    let start = "";
    const query = {
      select: () => query,
      eq(column: string, value: string) {
        assertEquals(value, column === "parent_id" ? parentId : kidId);
        return query;
      },
      gte(column: string, value: string) {
        assertEquals(column, "created_at");
        start = value;
        return query;
      },
      order: () => query,
      range(from: number, to: number) {
        assertEquals(table, "transactions");
        const data = rows.filter(tx => Date.parse(tx.created_at) >= Date.parse(start)).slice(from, to + 1);
        return { data, error: null };
      },
      maybeSingle() {
        assertEquals(table, "kids");
        return { data: { id: kidId, name: "Demo saver", balance: balances[Math.min(reads++, balances.length - 1)] }, error: null };
      },
    };
    return query;
  } };
}

Deno.test("past month reverses later wallet movements and keeps the final MYT instant", async () => {
  const statement = await getStatement(statementAdmin(), parentId, { kidId, from: "2026-10-01", to: "2026-10-31" });
  assertEquals(statement.closingBalance, 105.25);
  assertEquals(statement.openingBalance, 100);
  assertEquals(statement.transactions.map(tx => tx.id), ["last", "first"]);
});

Deno.test("current month closes at the current wallet balance and ignores pot-only gains", async () => {
  const statement = await getStatement(statementAdmin(), parentId, { kidId, from: "2026-11-01", to: "2026-11-30" });
  assertEquals(statement.closingBalance, 126);
  assertEquals(statement.openingBalance, 105.25);
  assertEquals(statement.transactions.map(tx => tx.id), ["after-debit", "after-pot", "boundary"]);
});

Deno.test("statement reads every page and retries after a concurrent balance change", async () => {
  const rows = Array.from({ length: 501 }, (_, i) => ({
    id: String(i), created_at: "2026-11-03T04:00:00Z", type: "DEPOSIT", amount: 0.01,
  }));
  const statement = await getStatement(statementAdmin(rows, [5, 5.01]), parentId, { kidId, from: "2026-10-01", to: "2026-10-31" });
  assertEquals(statement.transactions, []);
  assertEquals(statement.openingBalance, 0);
  assertEquals(statement.closingBalance, 0);
});
