import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth";
import { getQuickLogin, clearQuickLogin } from "@/lib/quick-login";
import { adminBypassParent, ADMIN_BYPASS } from "@/lib/admin-bypass";
import { AppIcon } from "@/components/ui/app-icon";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Parent Login — Centsibility" }] }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const quick = typeof window !== "undefined" ? getQuickLogin() : null;
  const [usePin, setUsePin] = useState(!!quick);
  const [pin, setPin] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(quick?.email ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [childHasDevice, setChildHasDevice] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (!loading && session) nav({ to: "/parent" });
  }, [session, loading, nav]);

  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (emailError) setEmailError("");
  };

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quick) return;
    if (pin !== quick.pin) {
      toast.error("Wrong PIN");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: quick.email,
        password: quick.password,
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setEmailError("");
    try {
      if (mode === "signup") {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email.trim().toLowerCase())
          .maybeSingle();
        if (existingProfile) {
          setEmailError("An account with this email already exists. Please sign in.");
          setBusy(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/parent`,
            data: { display_name: name, child_has_device: childHasDevice },
          },
        });
        if (error) {
          if (
            error.message.toLowerCase().includes("already registered") ||
            error.message.toLowerCase().includes("already exists")
          ) {
            setEmailError("An account with this email already exists. Please sign in.");
            setBusy(false);
            return;
          }
          throw error;
        }
        toast.success("Account created!");
        nav({ to: "/parent" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        nav({ to: "/parent" });
      }
    } catch (err: unknown) {
      console.error("Authentication error detail:", err);
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const strength = [
    { ok: password.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Z]/.test(password), label: "One uppercase letter" },
    { ok: /\d/.test(password), label: "One number" },
    { ok: /[^A-Za-z0-9]/.test(password), label: "One special character" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
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
                color: "#fff",
                boxShadow: "0 2px 8px rgba(230, 0, 18, 0.25)",
              }}
            >
              <AppIcon name="penny" size={20} color="#fff" />
            </span>
            <span>Centsibility</span>
          </Link>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Next-Generation Halal Family Banking
          </p>
        </div>

        {/* Main Card */}
        <Card variant="default" style={{ padding: "0.5rem" }}>
          <CardHeader style={{ textAlign: "center", padding: "1.5rem 1.5rem 0.5rem" }}>
            <CardTitle style={{ fontSize: "1.35rem" }}>
              {usePin && quick
                ? "Device Quick PIN"
                : mode === "signin"
                ? "Parent Sign In"
                : "Create Parent Account"}
            </CardTitle>
            <CardDescription>
              {usePin && quick
                ? `Welcome back, ${quick.email}`
                : mode === "signin"
                ? "Access your family commander dashboard"
                : "Start your child's halal financial voyage"}
            </CardDescription>
          </CardHeader>

          <CardContent style={{ padding: "1rem 1.5rem 1.5rem" }}>
            {usePin && quick ? (
              <form onSubmit={submitPin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <label htmlFor="quick-pin" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                    Security PIN
                  </label>
                  <Input
                    id="quick-pin"
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    inputMode="numeric"
                    pattern="\d{4,6}"
                    maxLength={6}
                    placeholder="••••••"
                    autoComplete="one-time-code"
                    style={{ textAlign: "center", fontSize: "1.25rem", letterSpacing: "0.25em" }}
                    autoFocus
                  />
                </div>
                <Button disabled={busy} type="submit" variant="primary" style={{ width: "100%" }}>
                  {busy ? "Authenticating…" : "Unlock Dashboard"}
                </Button>

                <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      clearQuickLogin();
                      setUsePin(false);
                    }}
                  >
                    Use email and password instead
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {mode === "signup" && (
                  <>
                    <div>
                      <label htmlFor="parent-name" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                        Full Name
                      </label>
                      <Input
                        id="parent-name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Sarah Ahmad"
                        autoComplete="name"
                      />
                    </div>

                    <div>
                      <span style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                        Does your child have their own device?
                      </span>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                        <Button
                          type="button"
                          variant={childHasDevice === true ? "primary" : "outline"}
                          size="sm"
                          onClick={() => setChildHasDevice(true)}
                        >
                          Yes, own device
                        </Button>
                        <Button
                          type="button"
                          variant={childHasDevice === false ? "primary" : "outline"}
                          size="sm"
                          onClick={() => setChildHasDevice(false)}
                        >
                          No, shared device
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="parent-email" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                    Parent Email
                  </label>
                  <Input
                    id="parent-email"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="parent@example.com"
                    autoComplete="email"
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? "parent-email-error" : undefined}
                  />
                  {emailError && (
                    <p id="parent-email-error" style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", color: "var(--error)" }} role="alert">
                      {emailError}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="parent-password" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                    Password
                  </label>
                  <Input
                    id="parent-password"
                    required
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Choose secure password" : "Enter password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                </div>

                {mode === "signup" && password.length > 0 && (
                  <div style={{ padding: "0.75rem", background: "var(--surface-soft)", borderRadius: "0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem" }} aria-live="polite">
                    <small style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Password Requirements</small>
                    {strength.map((r) => (
                      <div key={r.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <AppIcon
                          name={r.ok ? "approve" : "close"}
                          size={14}
                          color={r.ok ? "var(--success)" : "var(--text-muted)"}
                        />
                        <small style={{ fontSize: "0.75rem", color: r.ok ? "var(--text-secondary)" : "var(--text-muted)" }}>{r.label}</small>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: "0.5rem" }}>
                  <Button disabled={busy} type="submit" variant="primary" style={{ width: "100%" }}>
                    {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Free Account"}
                  </Button>
                </div>

                <div style={{ textAlign: "center", marginTop: "0.25rem" }}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMode(mode === "signin" ? "signup" : "signin");
                      setEmailError("");
                    }}
                  >
                    {mode === "signin" ? "Need an account? Sign up" : "Already registered? Sign in"}
                  </Button>
                </div>
              </form>
            )}

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
                }}
              >
                <AppIcon name="kid" size={16} />
                <span>Young Saver? Sign in with Kid Code →</span>
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
                      toast.success("Admin bypass — parent demo activated");
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

