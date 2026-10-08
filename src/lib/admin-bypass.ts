import { supabase } from "@/integrations/supabase/client";
import { edgeKidLogin, edgeKidLoginByCode } from "@/lib/edge";
import { setKidSession } from "@/lib/kid-session";
import type { Session, User } from "@supabase/supabase-js";

/** Seeded demo account from `seed.ts` — for local/demo UI work only. */
export const ADMIN_BYPASS = import.meta.env.DEV
  ? ({
      parent: {
        email: "test@centsibility.com",
        password: "password123",
      },
      kid: {
        username: "aiman",
        pin: "123456",
        code: "AIMAN1",
      },
    } as const)
  : {
      parent: { email: "", password: "" },
      kid: { code: "", username: "", pin: "" },
    };

export const PARENT_BYPASS_KEY = import.meta.env.DEV ? "centsibility:admin-bypass-parent" : "";
export const KID_BYPASS_KEY = import.meta.env.DEV ? "centsibility:admin-bypass-kid" : "";
const PARENT_PIN_SESSION_MS = 30 * 60 * 1000;

export const DEMO_PARENT_USER: User | null = import.meta.env.DEV ? {
  id: "demo-parent-id",
  app_metadata: { provider: "email" },
  user_metadata: { display_name: "Test Parent (Demo)" },
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00.000Z",
  email: ADMIN_BYPASS.parent.email,
  role: "authenticated",
  updated_at: "2026-01-01T00:00:00.000Z",
} : null;

export const DEMO_PARENT_SESSION: Session | null = import.meta.env.DEV ? {
  access_token: "demo-bypass-access-token",
  refresh_token: "demo-bypass-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: DEMO_PARENT_USER!,
} : null;

export function isParentBypassed(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(PARENT_BYPASS_KEY) === "true";
}

export function setParentBypassed(active: boolean) {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  if (active) {
    sessionStorage.setItem(PARENT_BYPASS_KEY, "true");
  } else {
    sessionStorage.removeItem(PARENT_BYPASS_KEY);
  }
  window.dispatchEvent(new Event("centsibility:auth-bypass-change"));
}

export function isKidBypassed(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KID_BYPASS_KEY) === "true";
}

export function setKidBypassed(active: boolean) {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  if (active) {
    sessionStorage.setItem(KID_BYPASS_KEY, "true");
  } else {
    sessionStorage.removeItem(KID_BYPASS_KEY);
  }
}

/** Skip parent PIN gate after demo sign-in (same flag parent layout uses). */
export function markParentPinBypassed() {
  if (!import.meta.env.DEV) return;
  sessionStorage.setItem(
    "parentSessionValidUntil",
    String(Date.now() + PARENT_PIN_SESSION_MS),
  );
}

export async function adminBypassParent() {
  if (!import.meta.env.DEV) {
    throw new Error("Admin bypass is only available in development mode.");
  }
  const { email, password } = ADMIN_BYPASS.parent;
  // Activate bypass session immediately so UI is unblocked
  setParentBypassed(true);
  markParentPinBypassed();

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.warn("Supabase live signInWithPassword failed, continuing in demo mode:", error.message);
    }
  } catch (err) {
    console.warn("Supabase backend unreachable, continuing in demo mode:", err);
  }

  return { name: "Test Parent", email };
}

export async function adminBypassKid() {
  if (!import.meta.env.DEV) {
    throw new Error("Admin bypass is only available in development mode.");
  }
  setKidBypassed(true);
  const fallbackKidSession = {
    kidId: "demo-kid-aiman",
    code: ADMIN_BYPASS.kid.code,
    name: "Aiman",
  };

  try {
    const res = await edgeKidLogin({
      username: ADMIN_BYPASS.kid.username,
      pin: ADMIN_BYPASS.kid.pin,
    });
    setKidSession({ kidId: res.kidId, code: res.code || "", name: res.name });
    return res.name;
  } catch {
    try {
      const res = await edgeKidLoginByCode({ loginCode: ADMIN_BYPASS.kid.code });
      setKidSession({ kidId: res.kidId, code: res.code || "", name: res.name });
      return res.name;
    } catch {
      // Offline / unseeded fallback
      setKidSession(fallbackKidSession);
      return fallbackKidSession.name;
    }
  }
}
