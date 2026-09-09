// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function createSupabaseAdminClient() {
  const SUPABASE_URL =
    (typeof import.meta.env !== "undefined" ? import.meta.env.VITE_SUPABASE_URL : undefined) ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const isBrowser = typeof window !== "undefined";

  const SUPABASE_ANON_KEY =
    (typeof import.meta.env !== "undefined"
      ? import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      : undefined) ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // In the browser, we MUST use the anon key because remote Supabase strictly blocks service_role keys.
  const keyToUse = isBrowser ? SUPABASE_ANON_KEY : SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !keyToUse) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!keyToUse ? ["SUPABASE_ANON_KEY / SERVICE_ROLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Please set the required Supabase environment variables.`;
    console.error(`[Supabase Admin] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, keyToUse, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
