import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isParentBypassed, DEMO_PARENT_SESSION } from "@/lib/admin-bypass";

type Ctx = { session: Session | null; user: User | null; loading: boolean };
const AuthCtx = createContext<Ctx>({ session: null, user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    if (isParentBypassed()) return DEMO_PARENT_SESSION;
    return null;
  });
  const [loading, setLoading] = useState(true);

  const syncBypassSession = useCallback(() => {
    if (isParentBypassed()) {
      setSession(DEMO_PARENT_SESSION);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check bypass first
    if (isParentBypassed()) {
      setSession(DEMO_PARENT_SESSION);
      setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) {
        setSession(s);
      } else if (isParentBypassed()) {
        setSession(DEMO_PARENT_SESSION);
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) {
          setSession(data.session);
        } else if (isParentBypassed()) {
          setSession(DEMO_PARENT_SESSION);
        }
      })
      .catch(() => {
        if (isParentBypassed()) {
          setSession(DEMO_PARENT_SESSION);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    window.addEventListener("centsibility:auth-bypass-change", syncBypassSession);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("centsibility:auth-bypass-change", syncBypassSession);
    };
  }, [syncBypassSession]);

  const activeSession = session ?? (isParentBypassed() ? DEMO_PARENT_SESSION : null);

  return (
    <AuthCtx.Provider value={{ session: activeSession, user: activeSession?.user ?? null, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
