import assert from "node:assert/strict";
import { getMytDateInfo } from "./penny-ai.ts";
import { previousTurnIntent } from "./penny-intents.ts";

Deno.test("Penny account replies stay on the authenticated Edge Function path without AI", async (t) => {
  const serve = Object.getOwnPropertyDescriptor(Deno, "serve")!;
  const fetch = globalThis.fetch;
  const handlers: Array<(request: Request) => Promise<Response>> = [];
  const settings = {
    SUPABASE_URL: "https://account-fixture.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
    SUPABASE_ANON_KEY: "fixture-public",
    DEEPSEEK_API_KEY: "fixture-ai",
  };
  const saved = Object.keys(settings).map(key => [key, Deno.env.get(key)] as const);
  const unexpected: string[] = [];
  const now = new Date();
  const { thisWeekStartMs, thisMonthStartMs } = getMytDateInfo(now);
  const sessionToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte =>
    byte.toString(16).padStart(2, "0")).join("");

  try {
    Object.defineProperty(Deno, "serve", {
      configurable: true,
      value: (handler: (request: Request) => Promise<Response>) => handlers.push(handler),
    });
    for (const [key, value] of Object.entries(settings)) Deno.env.set(key, value);
    globalThis.fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const query = url.searchParams;
      const path = url.pathname;
      if (url.origin === settings.SUPABASE_URL) {
        if (path === "/auth/v1/user") return Response.json({ id: "parent-a", aud: "authenticated" });
        if (path === "/rest/v1/rpc/rate_limit_hit") return Response.json({ allowed: true });
        if (path === "/rest/v1/commander_pins" && query.get("parent_id") === "eq.parent-a") return Response.json([]);
        if (path === "/rest/v1/kid_sessions" && query.has("token_hash")) {
          return Response.json([{
            id: "session-a", kid_id: "kid-a", created_at: now.toISOString(),
            last_seen_at: now.toISOString(), expires_at: new Date(+now + 60000).toISOString(),
          }]);
        }
        if (path === "/rest/v1/kids" && query.get("id") === "eq.kid-a") {
          return Response.json([{ id: "kid-a", parent_id: "parent-a", balance: "12.34", hashed_pin: "fixture" }]);
        }
        if (path === "/rest/v1/kids" && query.get("parent_id") === "eq.parent-a") {
          return Response.json([
            { id: "kid-a", name: "Demo A", balance: "12.34" },
            { id: "kid-b", name: "Demo B", balance: "56.78" },
          ]);
        }
        if (path === "/rest/v1/goals" && query.get("kid_id") === "eq.kid-a") {
          return Response.json(query.get("id") ? [] : [{ target: "25.00", saved: "8.50" }]);
        }
        if (path === "/rest/v1/transactions" && query.has("order")) {
          const start = query.getAll("created_at").find(value => value.startsWith("gte."));
          const at = Date.parse(start?.slice(4) ?? "");
          if (at === thisWeekStartMs || at === thisMonthStartMs) {
            const kid = query.get("kid_id");
            if (kid === "eq.kid-a" || kid === "eq.kid-b") {
              const amount = kid === "eq.kid-b" ? 3 : at === thisWeekStartMs ? 2 : 5;
              return Response.json([
                { type: "WITHDRAWAL", amount, created_at: new Date(at).toISOString() },
                { type: "GOAL_IN", amount: 99, created_at: new Date(at).toISOString() },
              ]);
            }
          }
        }
      }
      unexpected.push(path);
      throw new Error("Unexpected fixture request");
    };

    await import("../kid-finance/index.ts");
    await import("../parent-finance/index.ts");
    assert.equal(handlers.length, 2);
    const [kid, parent] = handlers;
    async function reply(handler: typeof kid, message: string, context = {}) {
      const res = await handler(new Request("https://account-fixture.invalid", {
        method: "POST",
        headers: { Authorization: "Bearer fixture" },
        body: JSON.stringify({ action: "penny-chat", message, code: sessionToken, context }),
      }));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.thinking, false);
      assert.equal(body.model, undefined);
      assert.equal(body.remaining, undefined);
      return String(body.reply);
    }
    await t.step("balance", async () => assert.match(await reply(kid, "What is my balance?"), /RM12\.34/));
    await t.step("weekly and monthly spending exclude savings transfers", async () => {
      assert.match(await reply(kid, "How much did I spend this week?"), /RM2\.00 this week/);
      const month = await reply(kid, "How much did I spend this month?");
      assert.match(month, thisWeekStartMs === thisMonthStartMs ? /RM2\.00 this month/ : /RM5\.00 this month/);
    });
    await t.step("goal progress stays scoped to the signed-in child", async () => {
      assert.match(await reply(kid, "How is my goal doing?"), /RM8\.50 saved toward RM25\.00/);
      assert.match(await reply(kid, "How is my goal doing?", { goalId: "other-kid-goal" }), /couldn’t find/);
    });
    await t.step("account awareness remains local and is excluded from model history", async () => {
      assert.match(await reply(kid, "What do you know about me?"), /spending balance, transactions and Tabung/);
      for (const intent of ["family", "memory"]) assert.equal(previousTurnIntent([{ role: "assistant", intent }]), undefined);
    });
    await t.step("parent overview uses only owned children and gives separate figures", async () => {
      const text = await reply(parent, "Give me an overview of how my kids are doing with their spending and savings habits.");
      assert.match(text, /Demo A: RM12\.34 to spend, RM2\.00 spent this week/);
      assert.match(text, /Demo B: RM56\.78 to spend, RM3\.00 spent this week/);
    });
    assert.deepEqual(unexpected, [], "Account replies must make no provider or model quota calls");
  } finally {
    globalThis.fetch = fetch;
    Object.defineProperty(Deno, "serve", serve);
    for (const [key, value] of saved) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});
