import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { setMarketTracker } from "./market_tracker.ts";
import { OwnershipError } from "./ownership.ts";

function makeStubClient(rows: Array<{ id: string; parent_id: string; [key: string]: any }>) {
  return {
    from(table: string) {
      if (table === "kids") {
        return {
          select(cols: string) {
            return {
              eq(col1: string, val1: string) {
                return {
                  eq(col2: string, val2: string) {
                    return {
                      async maybeSingle() {
                        const found = rows.find(
                          (r) => r[col1] === val1 && r[col2] === val2,
                        );
                        if (!found) return { data: null, error: null };
                        if (cols === "*") return { data: found, error: null };
                        const picked: Record<string, any> = {};
                        cols.split(",").forEach((c) => {
                          const k = c.trim();
                          picked[k] = found[k];
                        });
                        return { data: picked, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
          update(patch: Record<string, any>) {
            return {
              eq(col: string, val: string) {
                const found = rows.find((r) => r[col] === val);
                if (found) {
                  Object.assign(found, patch);
                }
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

const PARENT_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_PARENT_ID = "00000000-0000-0000-0000-000000000002";
const KID_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_KID_ID = "22222222-2222-2222-2222-222222222222";

Deno.test("set-market-tracker: non-boolean enabled is refused with 400", async () => {
  const client = makeStubClient([
    { id: KID_ID, parent_id: PARENT_ID, market_tracker_enabled: false },
  ]);

  const resString = await setMarketTracker(client, PARENT_ID, {
    kidId: KID_ID,
    enabled: "true" as any,
  });
  assertEquals(resString.ok, false);
  assertEquals(resString.status, 400);
  assertEquals(resString.error, "enabled must be a boolean");

  const resNull = await setMarketTracker(client, PARENT_ID, {
    kidId: KID_ID,
    enabled: null as any,
  });
  assertEquals(resNull.ok, false);
  assertEquals(resNull.status, 400);

  const resNumber = await setMarketTracker(client, PARENT_ID, {
    kidId: KID_ID,
    enabled: 1 as any,
  });
  assertEquals(resNumber.ok, false);
  assertEquals(resNumber.status, 400);
});

Deno.test("set-market-tracker: missing or invalid kidId is refused with 400", async () => {
  const client = makeStubClient([
    { id: KID_ID, parent_id: PARENT_ID, market_tracker_enabled: false },
  ]);

  const resNoKid = await setMarketTracker(client, PARENT_ID, {
    enabled: true,
  });
  assertEquals(resNoKid.ok, false);
  assertEquals(resNoKid.status, 400);
  assertEquals(resNoKid.error, "kidId is required");
});

Deno.test("set-market-tracker: another parent's child is refused", async () => {
  const client = makeStubClient([
    { id: KID_ID, parent_id: PARENT_ID, market_tracker_enabled: false },
    { id: OTHER_KID_ID, parent_id: OTHER_PARENT_ID, market_tracker_enabled: false },
  ]);

  await assertRejects(
    async () => {
      await setMarketTracker(client, PARENT_ID, {
        kidId: OTHER_KID_ID,
        enabled: true,
      });
    },
    OwnershipError,
    "Not found or not your child",
  );
});

Deno.test("set-market-tracker: toggles enabled boolean successfully for own child", async () => {
  const kid = { id: KID_ID, parent_id: PARENT_ID, market_tracker_enabled: false };
  const client = makeStubClient([kid]);

  const res = await setMarketTracker(client, PARENT_ID, {
    kidId: KID_ID,
    enabled: true,
  });
  assertEquals(res.ok, true);
  assertEquals(res.status, 200);
  assertEquals(res.data, { ok: true, kidId: KID_ID, enabled: true });
  assertEquals(kid.market_tracker_enabled, true);

  const resOff = await setMarketTracker(client, PARENT_ID, {
    kidId: KID_ID,
    enabled: false,
  });
  assertEquals(resOff.ok, true);
  assertEquals(resOff.status, 200);
  assertEquals(resOff.data, { ok: true, kidId: KID_ID, enabled: false });
  assertEquals(kid.market_tracker_enabled, false);
});
