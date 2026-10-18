import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  isValidPinFormat,
  hashPin,
  constantTimeEqual,
  verifyStoredPin,
} from "./pin.ts";

Deno.test("isValidPinFormat accepts 6 digits only", () => {
  assertEquals(isValidPinFormat("1234"), false);
  assertEquals(isValidPinFormat("12345"), false);
  assertEquals(isValidPinFormat("123456"), true);

  assertEquals(isValidPinFormat("123"), false);
  assertEquals(isValidPinFormat("1234567"), false);
  assertEquals(isValidPinFormat("12a456"), false);
  assertEquals(isValidPinFormat(""), false);
  assertEquals(isValidPinFormat("abcdef"), false);
});


Deno.test("constantTimeEqual compares strings correctly", () => {
  assertEquals(constantTimeEqual("hello", "hello"), true);
  assertEquals(constantTimeEqual("hello", "world"), false);
  assertEquals(constantTimeEqual("hello", "hell"), false);
});

Deno.test("verifyStoredPin matches bcrypt hash and reports no rehash needed", async () => {
  const pin = "1234";
  const hashed = await hashPin(pin);
  assertEquals(hashed.startsWith("$2"), true);

  const match = await verifyStoredPin(pin, hashed);
  assertEquals(match, { valid: true, needsRehash: false });

  const mismatch = await verifyStoredPin("5678", hashed);
  assertEquals(mismatch, { valid: false, needsRehash: false });
});


Deno.test("verifyStoredPin rejects malformed stored values", async () => {
  const res1 = await verifyStoredPin("1234", "not-a-valid-hash");
  assertEquals(res1, { valid: false, needsRehash: false });

  const res2 = await verifyStoredPin("1234", "");
  assertEquals(res2, { valid: false, needsRehash: false });

  const res3 = await verifyStoredPin("1234", "1234");
  assertEquals(res3, { valid: false, needsRehash: false });
});
