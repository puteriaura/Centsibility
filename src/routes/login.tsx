import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth";
import { adminBypassParent, ADMIN_BYPASS } from "@/lib/admin-bypass";
import { AppIcon } from "@/components/ui/app-icon";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Parent Login | Centsibility" }] }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) nav({ to: "/parent" });
  }, [session, loading, nav]);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/login`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("not enabled") || msg.includes("disabled") || msg.includes("unsupported provider")) {
          toast.error("Google sign-in isn't switched on yet.");
        } else {
          toast.error(error.message);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect to Google";
      if (msg.toLowerCase().includes("not enabled") || msg.toLowerCase().includes("disabled") || msg.toLowerCase().includes("unsupported provider")) {
        toast.error("Google sign-in isn't switched on yet.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        background: "var(--white)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "440px" }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              textDecoration: "none",
              color: "var(--ink)",
              fontWeight: 800,
              fontSize: "1.375rem",
              letterSpacing: "-0.02em",
              minHeight: "44px",
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "var(--primary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--white)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <AppIcon name="penny" size={20} color="var(--white)" />
            </span>
            <span>Centsibility</span>
          </Link>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Family money, the Shariah way
          </p>
        </div>

        {/* Main Card */}
        <Card variant="default" style={{ padding: "0.5rem" }}>
          <CardHeader style={{ textAlign: "center", padding: "1.5rem 1.5rem 0.5rem" }}>
            <CardTitle style={{ fontSize: "1.35rem" }}>
              Parent Sign In
            </CardTitle>
            <CardDescription>
              Use your Google account. New parents get an account automatically.
            </CardDescription>
          </CardHeader>

          <CardContent style={{ padding: "1rem 1.5rem 1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={busy}
                aria-busy={busy}
                style={{
                  width: "100%",
                  minHeight: "44px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.75rem",
                  padding: "0.625rem 1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.7 : 1,
                  boxShadow: "var(--shadow-sm)",
                  transition: "background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard)",
                }}
              >
                {/* Google brand colors - the only permitted raw hex on this page per spec */}
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
                  <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z" />
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
                </svg>
                <span>{busy ? "Connecting to Google…" : "Continue with Google"}</span>
              </button>

              <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.4 }}>
                Use the same Google email as your existing parent account to keep your family's data.
              </p>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.25rem 0" }} />

            {/* Kid Login Redirection */}
            <div style={{ textAlign: "center" }}>
              <Link
                to="/kid-login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.875rem",
                  color: "var(--primary)",
                  fontWeight: 600,
                  textDecoration: "none",
                  minHeight: "44px",
                  padding: "0.5rem 0.75rem",
                }}
              >
                <AppIcon name="kid" size={16} />
                <span>Kid? Sign in with your code</span>
              </Link>
            </div>

            {/* Dev Demo Bypass */}
            {import.meta.env.DEV && (
              <div
                style={{
                  marginTop: "1.5rem",
                  padding: "0.875rem",
                  borderRadius: "0.875rem",
                  background: "var(--surface-soft)",
                  border: "1px dashed var(--border)",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await adminBypassParent();
                      toast.success("Admin bypass: parent demo activated");
                      nav({ to: "/parent" });
                    } catch (err: unknown) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : `Bypass failed. Seed ${ADMIN_BYPASS.parent.email} first.`,
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <AppIcon name="shieldcheck" size={16} />
                  <span>Dev Mode: Bypass Parent Auth</span>
                </Button>
                <small style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                  Uses {ADMIN_BYPASS.parent.email} · skips PIN gate in dev
                </small>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
