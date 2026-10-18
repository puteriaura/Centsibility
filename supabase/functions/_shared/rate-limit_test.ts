import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { clientIpKey, hashKey, hit, tooMany, preAuthLimit, actorLimit, pennyGlobalLimit } from "./rate-limit.ts";

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
  assertEquals(buckets,["login-username","login-global"]);
  buckets.length=0;
  await preAuthLimit(admin,new Request("https://example.test"),"verify-access-code",null,{});
  assertEquals(buckets,["onboarding-global"]);
  buckets.length=0;
  await actorLimit(admin,"kid","synthetic-kid","penny-chat",{});
  assertEquals(buckets,["kid-requests","kid-penny"]);
  assert(!buckets.includes("onboarding-ip"));
});

Deno.test("IP denials never consume login or onboarding global budgets", async () => {
  for (const action of ["login", "verify-access-code"]) {
    const buckets: string[] = [];
    const admin = { rpc: (_name: string, args: Record<string, unknown>) => {
      buckets.push(String(args.p_bucket));
      return Promise.resolve({ data: { allowed: false, retryAfter: 42 }, error: null });
    } };
    const response = await preAuthLimit(admin, new Request("https://example.test", {
      headers: { "x-real-ip": "192.0.2.1" },
    }), action, "testuser", {});
    assertEquals(response?.status, 429);
    assertEquals(buckets, [action === "login" ? "login-ip" : "onboarding-ip"]);
  }
});

Deno.test("username denial never consumes login global budget", async () => {
  const buckets: string[] = [];
  const admin = { rpc: (_name: string, args: Record<string, unknown>) => {
    const bucket = String(args.p_bucket);
    buckets.push(bucket);
    return Promise.resolve({ data: { allowed: bucket !== "login-username", retryAfter: 42 }, error: null });
  } };
  const request = new Request("https://example.test", { headers: { "x-real-ip": "192.0.2.1" } });
  assertEquals((await preAuthLimit(admin, request, "login", "testuser", {}))?.status, 429);
  assertEquals(buckets, ["login-ip", "login-username"]);
});

Deno.test("allowed login checks IP then username then global", async () => {
  const buckets: string[] = [];
  const admin = { rpc: (_name: string, args: Record<string, unknown>) => {
    buckets.push(String(args.p_bucket));
    return Promise.resolve({ data: { allowed: true }, error: null });
  } };
  assertEquals(await preAuthLimit(admin, new Request("https://example.test", {
    headers: { "x-real-ip": "192.0.2.1" },
  }), "login", "testuser", {}), null);
  assertEquals(buckets, ["login-ip", "login-username", "login-global"]);
});

Deno.test("Penny actor gates preserve per-minute limits without touching shared budget", async () => {
  for (const actor of ["kid", "parent"] as const) {
    const buckets: string[] = [];
    const admin = { rpc: (_name: string, args: Record<string, unknown>) => {
      const bucket = String(args.p_bucket);
      buckets.push(bucket);
      if (bucket === `${actor}-penny`) {
        assertEquals(args.p_limit, 10);
        assertEquals(args.p_window_seconds, 60);
      }
      return Promise.resolve({ data: { allowed: bucket === `${actor}-requests`, retryAfter: 42 }, error: null });
    } };
    assertEquals((await actorLimit(admin, actor, "synthetic-actor", "penny-chat", {}))?.status, 429);
    assertEquals(buckets, [`${actor}-requests`, `${actor}-penny`]);
  }
});

Deno.test("Penny shared ceiling returns Retry-After and emits the 80 percent event once", async () => {
  const previousLimit = Deno.env.get("PENNY_GLOBAL_DAILY_LIMIT");
  const previousLog = console.log;
  const events: string[] = [];
  const buckets: string[] = [];
  let hits = 0;
  const admin = { rpc: (_name: string, args: Record<string, unknown>) => {
    buckets.push(String(args.p_bucket));
    assertEquals(args.p_key, "all");
    assertEquals(args.p_limit, 10);
    assertEquals(args.p_window_seconds, 86400);
    hits++;
    return Promise.resolve({ data: { allowed: hits <= 10, hits, retryAfter: 123 }, error: null });
  } };
  try {
    Deno.env.set("PENNY_GLOBAL_DAILY_LIMIT", "10");
    console.log = (message: string) => { events.push(message); };
    for (let i = 0; i < 10; i++) assertEquals(await pennyGlobalLimit(admin, {}), null);
    for (let i = 0; i < 2; i++) {
      const response = await pennyGlobalLimit(admin, { "Access-Control-Allow-Origin": "*" });
      assertEquals(response?.status, 429);
      assertEquals(response?.headers.get("Retry-After"), "123");
      assertEquals(response?.headers.get("Access-Control-Allow-Origin"), "*");
    }
    assertEquals(buckets, Array(12).fill("penny-global"));
    assertEquals(events.map(message => JSON.parse(message).event), ["ALERT_AI_BUDGET_80"]);
  } finally {
    console.log = previousLog;
    if (previousLimit === undefined) Deno.env.delete("PENNY_GLOBAL_DAILY_LIMIT");
    else Deno.env.set("PENNY_GLOBAL_DAILY_LIMIT", previousLimit);
  }
});
