import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { edgeKidLogin, edgeKidLoginByCode } from "@/lib/edge";
import { setKidSession } from "@/lib/kid-session";
import { adminBypassKid, ADMIN_BYPASS } from "@/lib/admin-bypass";
import { AppIcon } from "@/components/ui/app-icon";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/kid-login")({
  head: () => ({ meta: [{ title: "Kid Login — Centsibility" }] }),
  component: KidLogin,
});

function KidLogin() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"code" | "login">("code");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [quickCode, setQuickCode] = useState("");
  const [busy, setBusy] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) return;
    setBusy(true);
    try {
      const res = await edgeKidLogin({ username: username.trim(), pin: pin.trim() });
      setKidSession({ kidId: res.kidId, code: res.code || "", name: res.name });
      toast.success(`Welcome back, ${res.name}!`);
      nav({ to: "/kid" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid username or PIN");
    } finally {
      setBusy(false);
    }
  };

  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCode.trim()) return;
    setBusy(true);
    try {
      const res = await edgeKidLoginByCode({ loginCode: quickCode.trim() });
      setKidSession({ kidId: res.kidId, code: res.code || "", name: res.name });
      toast.success(`Welcome back, ${res.name}!`);
      nav({ to: "/kid" });
    } catch (err: unknown) {
      console.error("Kid login error:", err);
      toast.error(err instanceof Error ? err.message : "Invalid code. Please check and try again.");
    } finally {
      setBusy(false);
    }
  };

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
        {/* Brand / Logo */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--primary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 4px 16px rgba(230, 0, 18, 0.25)",
              marginBottom: "0.75rem",
            }}
          >
            <AppIcon name="penny" size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--ink)", margin: 0, letterSpacing: "-0.02em" }}>
            Young Saver Login
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Enter your secret code or username to open your vault!
          </p>
        </div>

        <Card variant="default" style={{ padding: "0.5rem" }}>
          {/* Method Switcher Tabs */}
          <div style={{ padding: "1rem 1rem 0" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                padding: "0.25rem",
                background: "var(--surface-soft)",
                borderRadius: "0.875rem",
                border: "1px solid var(--border)",
                gap: "0.25rem",
              }}
              role="tablist"
              aria-label="Login method"
            >
              <Button
                type="button"
                role="tab"
                aria-selected={tab === "code"}
                variant={tab === "code" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setTab("code")}
                style={{ borderRadius: "0.625rem" }}
              >
                <AppIcon name="key" size={16} />
                <span>6-Digit Code</span>
              </Button>
              <Button
                type="button"
                role="tab"
                aria-selected={tab === "login"}
                variant={tab === "login" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setTab("login")}
                style={{ borderRadius: "0.625rem" }}
              >
                <AppIcon name="user" size={16} />
                <span>Username + PIN</span>
              </Button>
            </div>
          </div>

          <CardContent style={{ padding: "1.25rem 1.5rem 1.5rem" }}>
            {tab === "code" && (
              <form onSubmit={handleCodeLogin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <label htmlFor="kid-code" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem", textAlign: "center" }}>
                    Your 6-Character Access Code
                  </label>
                  <Input
                    id="kid-code"
                    required
                    value={quickCode}
                    onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AIMAN1"
                    maxLength={6}
                    autoFocus
                    autoComplete="one-time-code"
                    style={{
                      textAlign: "center",
                      fontSize: "1.65rem",
                      fontWeight: 800,
                      letterSpacing: "0.25em",
                      textTransform: "uppercase",
                      height: "56px",
                    }}
                  />
                  <small style={{ display: "block", textAlign: "center", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                    Ask your parent for your unique code
                  </small>
                </div>

                <Button disabled={busy} type="submit" variant="primary" style={{ width: "100%", height: "48px", fontSize: "1rem" }}>
                  {busy ? "Checking Code…" : "Let's Go! 🚀"}
                </Button>
              </form>
            )}

            {tab === "login" && (
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label htmlFor="kid-username" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                    Username
                  </label>
                  <Input
                    id="kid-username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. aiman"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label htmlFor="kid-pin" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                    6-Digit Secret PIN
                  </label>
                  <Input
                    id="kid-pin"
                    required
                    type="password"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    autoComplete="current-password"
                    style={{ textAlign: "center", fontSize: "1.35rem", letterSpacing: "0.3em" }}
                  />
                </div>

                <div style={{ marginTop: "0.5rem" }}>
                  <Button disabled={busy} type="submit" variant="primary" style={{ width: "100%", height: "48px", fontSize: "1rem" }}>
                    {busy ? "Signing in…" : "Open Vault ✨"}
                  </Button>
                </div>
              </form>
            )}

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.25rem 0" }} />

            {/* Parent Login Link */}
            <div style={{ textAlign: "center" }}>
              <Link
                to="/login"
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
                <AppIcon name="parent" size={16} />
                <span>Parent? Commander sign in here →</span>
              </Link>
            </div>

            {/* Dev Mode Bypass */}
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
                      const name = await adminBypassKid();
                      toast.success(`Admin bypass — hi ${name}!`);
                      nav({ to: "/kid" });
                    } catch (err: unknown) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : `Bypass failed. Seed kid ${ADMIN_BYPASS.kid.username} / ${ADMIN_BYPASS.kid.code} first.`,
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <AppIcon name="shieldcheck" size={16} />
                  <span>Dev Mode: Demo Kid Bypass</span>
                </Button>
                <small style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                  Logs in as {ADMIN_BYPASS.kid.username} ({ADMIN_BYPASS.kid.code})
                </small>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

