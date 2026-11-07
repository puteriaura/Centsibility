import { createClient } from "npm:@supabase/supabase-js@2.105.3";
import { authorize, runMarketRefresh } from "./refresh.ts";

Deno.serve(async (req: Request) => {
  const denied = authorize(req, Deno.env.get("MARKET_REFRESH_TOKEN"));
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    return Response.json(await runMarketRefresh(admin, { probe: body?.probe === true, held: body?.mode === "held" }));
  } catch {
    return Response.json({ error: "market_refresh_failed" }, { status: 500 });
  }
});
