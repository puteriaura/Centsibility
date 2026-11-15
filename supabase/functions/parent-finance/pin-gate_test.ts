import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { pinGateFailure, sha256 } from "./pin-gate.ts";

type Gate = Parameters<typeof pinGateFailure>[0];

// A fake admin client. `pinRow` is what commander_pins returns; the session RPC accepts one token hash.
function fakeAdmin(pinRow: { pin_hash: string | null } | null, validHash = "", dbError?: string) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const admin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: pinRow, error: dbError ? { message: dbError } : null }),
        }),
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: args.p_token_hash === validHash, error: null });
    },
  } as unknown as Gate;
  return { admin, rpcCalls };
}

const MANDATORY = ["export-family-data", "delete-parent-account"];
const NEEDS_PIN = { message: "Set a 6-digit PIN first", status: 403 };
const PIN_REQUIRED = { message: "PIN required", status: 403 };

Deno.test("no PIN set: export and delete are refused with 403", async () => {
  for (const pinRow of [null, { pin_hash: null }, { pin_hash: "" }]) {
    for (const action of MANDATORY) {
      const { admin, rpcCalls } = fakeAdmin(pinRow);
      assertEquals(await pinGateFailure(admin, "p1", action, undefined), NEEDS_PIN);
      // A session token cannot stand in for a PIN that does not exist.
      assertEquals(await pinGateFailure(admin, "p1", action, "any-token"), NEEDS_PIN);
      assertEquals(rpcCalls.length, 0);
    }
  }
});

Deno.test("no PIN set: other gated actions keep today's behaviour", async () => {
  for (const action of ["deposit", "create-chore", "resolve-chore", "approve-request", "delete-kid"]) {
    assertEquals(await pinGateFailure(fakeAdmin(null).admin, "p1", action, undefined), null);
  }
});

Deno.test("PIN set but no session: 403 PIN required, and the session check is never reached", async () => {
  for (const action of [...MANDATORY, "deposit"]) {
    for (const token of [undefined, null, "", "   ", 42]) {
      const { admin, rpcCalls } = fakeAdmin({ pin_hash: "$2a$10$stored" }, await sha256("good"));
      assertEquals(await pinGateFailure(admin, "p1", action, token), PIN_REQUIRED);
      assertEquals(rpcCalls.length, 0);
    }
  }
});

Deno.test("PIN set, wrong or expired session: 403 PIN required", async () => {
  for (const action of [...MANDATORY, "deposit"]) {
    const { admin } = fakeAdmin({ pin_hash: "$2a$10$stored" }, await sha256("good"));
    assertEquals(await pinGateFailure(admin, "p1", action, "stale"), PIN_REQUIRED);
  }
});

Deno.test("PIN set, valid session: the gate opens and only the token hash is sent", async () => {
  const hash = await sha256("good");
  for (const action of [...MANDATORY, "deposit"]) {
    const { admin, rpcCalls } = fakeAdmin({ pin_hash: "$2a$10$stored" }, hash);
    assertEquals(await pinGateFailure(admin, "p1", action, "  good  "), null);
    assertEquals(rpcCalls, [{ fn: "parent_pin_session_valid", args: { p_parent_id: "p1", p_token_hash: hash } }]);
  }
});

Deno.test("a PIN lookup failure stops the call with 500", async () => {
  const { admin } = fakeAdmin(null, "", "db down");
  assertEquals(await pinGateFailure(admin, "p1", "export-family-data", "good"), { message: "db down", status: 500 });
});
