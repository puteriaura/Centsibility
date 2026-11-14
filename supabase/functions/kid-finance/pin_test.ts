import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import bcrypt from "npm:bcryptjs@3.0.3";
import { checkKidLoginPin } from "./pin.ts";

function makeMemoryRateLimitAdmin() {
  const counts = new Map<string, number>();
  return {
    rpc(name: string, args: Record<string, unknown>) {
      if (name !== "rate_limit_hit") return Promise.resolve({ data: null, error: "unexpected_rpc" });
      const bucket = String(args.p_bucket);
      const windowMs = Math.floor(Date.now() / 900_000) * 900_000;
      const win = new Date(windowMs).toISOString();
      const key = `${bucket}:${args.p_key}:${win}`;
      const limit = Number(args.p_limit);
      const windowSeconds = Number(args.p_window_seconds);
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return Promise.resolve({
        data: { allowed: next <= limit, hits: next, retryAfter: windowSeconds },
        error: null,
      });
    },
    from(table: string) {
      if (table !== "rate_limits") throw new Error("unexpected table " + table);
      const filters: Record<string, string> = {};
      const builder = {
        select() { return builder; },
        delete() {
          return {
            eq(col: string, val: string) {
              filters[col] = val;
              if (filters.bucket && filters.key) {
                const prefix = `${filters.bucket}:${filters.key}:`;
                for (const k of counts.keys()) {
                  if (k.startsWith(prefix)) counts.delete(k);
                }
              }
              return this;
            },
            then(resolve: (v: { error: null }) => void) {
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
        },
        eq(col: string, val: string) {
          filters[col] = val;
          return builder;
        },
        maybeSingle() {
          const key = `${filters.bucket}:${filters.key}:${filters.window_start}`;
          const hits = counts.get(key);
          return Promise.resolve({
            data: hits !== undefined ? { hits } : null,
            error: null,
          });
        },
      };
      return builder;
    },
  };
}

Deno.test("FC-58: 5 wrong PINs from sibling device lock that device, not the child on another device", async () => {
  const admin = makeMemoryRateLimitAdmin();
  const hashed_pin = await bcrypt.hash("246810", 4);
  const kid = { id: "kid-target", hashed_pin };
  const siblingReq = new Request("https://example.test", { headers: { "x-real-ip": "198.51.100.10" } });
  const childReq = new Request("https://example.test", { headers: { "x-real-ip": "198.51.100.10" } });

  for (let i = 0; i < 4; i++) {
    const res = await checkKidLoginPin(admin, siblingReq, kid, "111111", "sibling-device");
    assertEquals(res.ok, false);
    assertEquals(res.status, 400);
  }
  const fifth = await checkKidLoginPin(admin, siblingReq, kid, "111111", "sibling-device");
  assertEquals(fifth.ok, false);
  assertEquals(fifth.status, 403);

  // Even a 6th attempt with the right PIN from the locked sibling device is blocked.
  const sixth = await checkKidLoginPin(admin, siblingReq, kid, "246810", "sibling-device");
  assertEquals(sixth.ok, false);
  assertEquals(sixth.status, 403);

  // The target child on their own device can still sign in immediately.
  const childLogin = await checkKidLoginPin(admin, childReq, kid, "246810", "child-own-device");
  assertEquals(childLogin.ok, true);
});

Deno.test("V2.1: 6+ consecutive valid logins on the same device never lock out", async () => {
  const admin = makeMemoryRateLimitAdmin();
  const hashed_pin = await bcrypt.hash("246810", 4);
  const kid = { id: "kid-valid", hashed_pin };
  const req = new Request("https://example.test", { headers: { "x-real-ip": "198.51.100.20" } });

  for (let i = 0; i < 8; i++) {
    const res = await checkKidLoginPin(admin, req, kid, "246810", "same-device");
    assertEquals(res.ok, true);
  }
});
