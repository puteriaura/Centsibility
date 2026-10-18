import { logEvent } from "./log.ts";

type Admin = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
let lastUnknownIpLog = 0;

export async function hashKey(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

export async function clientIpKey(req: Request): Promise<string | null> {
  const ip = req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) return (await hashKey(ip)).slice(0, 32);
  if (Date.now() - lastUnknownIpLog >= 60_000) {
    logEvent({ event: "ip-unknown" }); lastUnknownIpLog = Date.now();
  }
  return null;
}

export async function hit(admin: Admin, bucket: string, key: string, limit: number, windowSeconds: number) {
  try {
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_bucket: bucket, p_key: key, p_limit: limit, p_window_seconds: windowSeconds,
    });
    if (error || !data || typeof data !== "object") return { allowed: false, retryAfter: 60, hits: 0 };
    const result = data as { allowed?: unknown; retryAfter?: unknown; hits?: number };
    return { allowed: result.allowed === true,
      retryAfter: typeof result.retryAfter === "number" && result.retryAfter > 0 ? result.retryAfter : 60,
      hits: result.hits ?? 0 };
  } catch { return { allowed: false, retryAfter: 60, hits: 0 }; }
}

export function tooMany(retryAfter: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again later.", code: "rate_limited" }), {
    status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retryAfter) },
  });
}

export async function preAuthLimit(admin: Admin, req: Request, action: string, username: unknown, cors: Record<string, string>) {
  const login = action === "login";
  const group = login ? "login" : "onboarding";
  const global = await hit(admin, `${group}-global`, "all", login ? 5000 : 3000, 3600);
  if (!global.allowed) return tooMany(global.retryAfter, cors);
  const ip = await clientIpKey(req);
  if (ip) {
    const result = await hit(admin, `${group}-ip`, ip, login ? 30 : 10, 3600);
    if (!result.allowed) return tooMany(result.retryAfter, cors);
  }
  if (login) {
    const result = await hit(admin, "login-username", await hashKey(String(username ?? "").trim().toLowerCase()), 20, 3600);
    if (!result.allowed) return tooMany(result.retryAfter, cors);
  }
  return null;
}

export async function actorLimit(admin: Admin, actor: "kid" | "parent", id: string, action: string, cors: Record<string, string>) {
  const requests = await hit(admin, `${actor}-requests`, id, 120, 60);
  if (!requests.allowed) return tooMany(requests.retryAfter, cors);
  if (action === "create-kid") {
    const creation = await hit(admin, "create-kid", id, 5, 86400);
    if (!creation.allowed) return tooMany(creation.retryAfter, cors);
  }
  if (action === "penny-chat") {
    const perActor = await hit(admin, `${actor}-penny`, id, 10, 60);
    if (!perActor.allowed) return tooMany(perActor.retryAfter, cors);
    const configured = Number(Deno.env.get("PENNY_GLOBAL_DAILY_LIMIT") ?? 2000);
    const ceiling = Number.isSafeInteger(configured) && configured > 0 ? configured : 2000;
    const daily = await hit(admin, "penny-global", "all", ceiling, 86400);
    if (daily.hits === Math.ceil(ceiling * 0.8)) logEvent({ event: "ALERT_AI_BUDGET_80" });
    if (!daily.allowed) return tooMany(daily.retryAfter, cors);
  }
  return null;
}
