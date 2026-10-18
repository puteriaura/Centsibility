import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeUsername, isValidNewUsername } from "./username.ts";
Deno.test("usernames normalize whitespace and phone keyboard capitalization", () => {
  assertEquals(normalizeUsername(" Aiman "),"aiman");
  assertEquals(normalizeUsername("\tA.B_C-D\n"),"a.b_c-d");
});
Deno.test("new usernames use 3-24 lowercase letters, digits, dots, hyphens and underscores", () => {
  for (const value of ["abc","a.b_c-123","a".repeat(24)]) assertEquals(isValidNewUsername(value),true);
  for (const value of ["", "ab", "Aiman", "a b", "a@b", "a".repeat(25),"a\nb"]) assertEquals(isValidNewUsername(value),false);
});
