import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { checkKidPin } from "./pin.ts";

Deno.test("unlock action validation: non-6-digit PIN gets a 400", async () => {
  const dummyAdmin = {} as any;
  const dummyKid = { id: "k1", hashed_pin: "$2a$10$abcdef" };

  // Too short
  const resShort = await checkKidPin(dummyAdmin, dummyKid, "12345");
  assertEquals(resShort.ok, false);
  assertEquals(resShort.status, 400);
  assertEquals(resShort.error, "PIN must be 6 digits");

  // Too long
  const resLong = await checkKidPin(dummyAdmin, dummyKid, "1234567");
  assertEquals(resLong.ok, false);
  assertEquals(resLong.status, 400);
  assertEquals(resLong.error, "PIN must be 6 digits");

  // Non-digit characters
  const resAlpha = await checkKidPin(dummyAdmin, dummyKid, "12a456");
  assertEquals(resAlpha.ok, false);
  assertEquals(resAlpha.status, 400);
  assertEquals(resAlpha.error, "PIN must be 6 digits");

  // Empty string
  const resEmpty = await checkKidPin(dummyAdmin, dummyKid, "");
  assertEquals(resEmpty.ok, false);
  assertEquals(resEmpty.status, 400);
  assertEquals(resEmpty.error, "PIN must be 6 digits");

  // Non-string
  const resNull = await checkKidPin(dummyAdmin, dummyKid, null);
  assertEquals(resNull.ok, false);
  assertEquals(resNull.status, 400);
  assertEquals(resNull.error, "PIN must be 6 digits");

  // Whitespace only
  const resSpaces = await checkKidPin(dummyAdmin, dummyKid, "      ");
  assertEquals(resSpaces.ok, false);
  assertEquals(resSpaces.status, 400);
  assertEquals(resSpaces.error, "PIN must be 6 digits");
});
