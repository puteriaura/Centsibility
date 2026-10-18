import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { clientIpKey, hashKey, hit, tooMany, preAuthLimit, actorLimit } from "./rate-limit.ts";

Deno.test("IP keys use header priority and contain only a truncated hash", async () => {
  const req = new Request("https://example.test", { headers: { "cf-connecting-ip": "192.0.2.1", "x-real-ip": "192.0.2.2", "x-forwarded-for": "192.0.2.3, 192.0.2.4" } });
  assertEquals(await clientIpKey(req), (await hashKey("192.0.2.1")).slice(0,32));
  req.headers.delete("cf-connecting-ip");
  assertEquals(await clientIpKey(req), (await hashKey("192.0.2.2")).slice(0,32));
  req.headers.delete("x-real-ip");
  assertEquals(await clientIpKey(req), (await hashKey("192.0.2.3")).slice(0,32));
  assertEquals(await clientIpKey(new Request("https://example.test")), null);
});
Deno.test("429 includes CORS, Retry-After and rate_limited code", async () => {
  const response = tooMany(42, { "Access-Control-Allow-Origin": "*" });
  assertEquals(response.status,429); assertEquals(response.headers.get("Retry-After"),"42");
  assertEquals(response.headers.get("Access-Control-Allow-Origin"),"*");
  assertEquals((await response.json()).code,"rate_limited");
});
Deno.test("RPC errors and rejected RPCs fail closed", async () => {
  assertEquals((await hit({rpc:()=>Promise.resolve({data:null,error:"failure"})},"x","x",1,60)).allowed,false);
  assertEquals(await hit({rpc:()=>Promise.reject(new Error("offline"))},"x","x",1,60),{allowed:false,retryAfter:60,hits:0});
});
Deno.test("missing IP skips only IP bucket; global and account limits remain", async () => {
  const buckets: string[] = [];
  const admin = {rpc:(_name:string,args:Record<string,unknown>)=>{buckets.push(String(args.p_bucket));return Promise.resolve({data:{allowed:true,hits:1},error:null});}};
  await preAuthLimit(admin,new Request("https://example.test"),"login"," TestUser ",{});
  assertEquals(buckets,["login-global","login-username"]);
  buckets.length=0;
  await preAuthLimit(admin,new Request("https://example.test"),"verify-access-code",null,{});
  assertEquals(buckets,["onboarding-global"]);
  buckets.length=0;
  await actorLimit(admin,"kid","synthetic-kid","penny-chat",{});
  assertEquals(buckets,["kid-requests","kid-penny","penny-global"]);
  assert(!buckets.includes("onboarding-ip"));
});
