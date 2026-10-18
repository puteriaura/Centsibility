import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { enforceKidLimit } from "./kid-limit.ts";
Deno.test("eleventh child is refused and count failures fail closed", async () => {
  for (const [count, error, expected] of [[9,null,0],[10,null,400],[null,"offline",503]] as const) {
    const admin = {from:()=>({select:()=>({eq:()=>Promise.resolve({count,error})})})} as unknown as Parameters<typeof enforceKidLimit>[0];
    const response = await enforceKidLimit(admin,"synthetic-parent",{});
    assertEquals(response?.status ?? 0,expected);
    if (expected === 400) assertEquals((await response!.json()).code,"kid_limit");
  }
});
