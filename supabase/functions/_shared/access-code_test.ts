import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { genCode, isCodeUsable } from "./access-code.ts";
Deno.test("access codes have six characters from the unbiased 32-character alphabet", () => {
  for (let i=0;i<10000;i++) assert(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(genCode()));
});
Deno.test("only unredeemed unexpired access codes are usable", () => {
  const now=Date.parse("2026-10-18T00:00:00Z");
  const kid={login_code:"TEST23",hashed_pin:null,login_code_expires_at:"2026-10-19T00:00:00Z"};
  assertEquals(isCodeUsable(kid,now),true);
  for(const changed of [{login_code_expires_at:"2026-10-17T00:00:00Z"},{login_code_expires_at:"2026-10-18T00:00:00Z"},{login_code_expires_at:null},{login_code_expires_at:"invalid"},{hashed_pin:"synthetic-hash"},{login_code:null}]) assertEquals(isCodeUsable({...kid,...changed},now),false);
  assertEquals(isCodeUsable(null,now),false);
});
