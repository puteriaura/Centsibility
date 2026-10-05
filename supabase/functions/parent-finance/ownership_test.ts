import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { verifyKidOwnership, OwnershipError } from "./ownership.ts";

function makeStubClient(rows: Array<{ id: string; parent_id: string; [key: string]: any }>) {
  return {
    from(_table: string) {
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
      };
    },
  };
}

const PARENT_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_PARENT_ID = "00000000-0000-0000-0000-000000000002";
const KID_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_KID_ID = "22222222-2222-2222-2222-222222222222";

const client = makeStubClient([
  {
    id: KID_ID,
    parent_id: PARENT_ID,
    name: "Aiman",
    username: "aiman",
    balance: 142.5,
  },
  {
    id: OTHER_KID_ID,
    parent_id: OTHER_PARENT_ID,
    name: "Other Kid",
    username: "other",
    balance: 50.0,
  },
]);

Deno.test("verifyKidOwnership passes for own child with real select lists ('id', 'username', 'id, name, balance')", async () => {
  // 1. select "id"
  const rowId = await verifyKidOwnership(client, KID_ID, PARENT_ID, "id");
  assertEquals(rowId, { id: KID_ID });

  // 2. select "username"
  const rowUser = await verifyKidOwnership(client, KID_ID, PARENT_ID, "username");
  assertEquals(rowUser, { username: "aiman" });

  // 3. select "id, name, balance"
  const rowStmt = await verifyKidOwnership(client, KID_ID, PARENT_ID, "id, name, balance");
  assertEquals(rowStmt, { id: KID_ID, name: "Aiman", balance: 142.5 });
});

Deno.test("verifyKidOwnership throws 'Not found or not your child' for another parent's child", async () => {
  await assertRejects(
    async () => {
      await verifyKidOwnership(client, OTHER_KID_ID, PARENT_ID, "id, name, balance");
    },
    OwnershipError,
    "Not found or not your child",
  );
});

Deno.test("verifyKidOwnership throws 'Not found or not your child' for unknown UUID", async () => {
  const UNKNOWN_UUID = "33333333-3333-3333-3333-333333333333";
  await assertRejects(
    async () => {
      await verifyKidOwnership(client, UNKNOWN_UUID, PARENT_ID, "id");
    },
    OwnershipError,
    "Not found or not your child",
  );
});

Deno.test("verifyKidOwnership rejects non-UUID with 400 'Invalid child'", async () => {
  await assertRejects(
    async () => {
      await verifyKidOwnership(client, "not-a-uuid", PARENT_ID, "id");
    },
    OwnershipError,
    "Invalid child",
  );

  await assertRejects(
    async () => {
      await verifyKidOwnership(client, "", PARENT_ID, "id");
    },
    OwnershipError,
    "Invalid child",
  );
});
