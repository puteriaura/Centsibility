import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  edgeKidLogin,
  edgeKidVerifyAccessCode,
  edgeKidSetInitialPin,
} from "@/lib/edge";
import { setKidSession } from "@/lib/kid-session";
import { markJustUnlocked } from "@/features/privacy";
import { adminBypassKid, ADMIN_BYPASS } from "@/lib/admin-bypass";
import { AppIcon } from "@/components/ui/app-icon";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/kid-login")({
  head: () => ({ meta: [{ title: "Kid Login | Centsibility" }] }),
  component: KidLogin,
});

function KidLogin() {
  const nav = useNavigate();
  // Default tab is Username + PIN for returning kids
  const [tab, setTab] = useState<"login" | "code">("login");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [quickCode, setQuickCode] = useState("");
  const [busy, setBusy] = useState(false);

  // One-time access code -> PIN setup state
  const [codeVerifiedKid, setCodeVerifiedKid] = useState<{
    kidId: string;
    username: string;
    name: string;
    needsBirthday?: boolean;
  } | null>(null);
  const [comfortName, setComfortName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) return;
    if (pin.length !== 6) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }
    setBusy(true);
    try {
      const res = await edgeKidLogin({ username: username.trim(), pin: pin.trim() });
      setKidSession({ kidId: res.kidId, code: res.code || "", name: res.name });
      markJustUnlocked();
      toast.success(`Welcome back, ${res.name}!`);
      nav({ to: "/kid" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid username or PIN";
      toast.error(msg);
      if (msg.toLowerCase().includes("access code")) {
        setTab("code");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = quickCode.trim().toUpperCase();
    if (!cleanCode) return;
    setBusy(true);
    try {
      const res = await edgeKidVerifyAccessCode({ loginCode: cleanCode });
      setCodeVerifiedKid(res);
      setComfortName(res.name);
      toast.success(`Code verified! Welcome, ${res.name}. Let's create your 6-digit PIN.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired access code.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeVerifiedKid) return;
    if (codeVerifiedKid.needsBirthday && !birthDate) {
      toast.error("Please enter your birthday so we can find your quests!");
      return;
    }
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      toast.error("Your secret PIN must be exactly 6 numbers");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("PINs do not match. Please re-enter.");
      return;
    }
    setBusy(true);
    try {
      const cleanCode = quickCode.trim().toUpperCase();
      const res = await edgeKidSetInitialPin({
        loginCode: cleanCode,
        pin: newPin,
        comfortName: comfortName.trim() || undefined,
        birthDate: birthDate || undefined,
      });
      setKidSession({ kidId: res.kidId, code: res.code || "", name: res.name });
      markJustUnlocked();
      toast.success(`All set, ${res.name}! Your 6-digit PIN is active.`);
      nav({ to: "/kid" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to activate PIN. Please try again.");
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
            Young Saver Vault
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Enter your secret PIN or one-time access code to open your vault!
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
                aria-selected={tab === "login"}
                variant={tab === "login" ? "primary" : "ghost"}
                size="sm"
                onClick={() => {
                  setTab("login");
                  setCodeVerifiedKid(null);
                }}
                style={{ borderRadius: "0.625rem" }}
              >
                <AppIcon name="user" size={16} />
                <span>Username + PIN</span>
              </Button>
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
                <span>First Time Code</span>
              </Button>
            </div>
          </div>

          <CardContent style={{ padding: "1.25rem 1.5rem 1.5rem" }}>
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
                    placeholder="Your username"
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
                  <small style={{ display: "block", textAlign: "center", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                    First time or forgot your PIN? Use a code from your parent.
                  </small>
                </div>

                <div style={{ marginTop: "0.5rem" }}>
                  <Button
                    disabled={busy || pin.length !== 6}
                    type="submit"
                    variant="primary"
                    style={{ width: "100%", height: "48px", fontSize: "1rem" }}
                  >
                    {busy ? "Opening Vault…" : "Open Vault ✨"}
                  </Button>
                </div>
              </form>
            )}

            {tab === "code" && !codeVerifiedKid && (
              <form onSubmit={handleVerifyCode} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <label htmlFor="kid-code" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem", textAlign: "center" }}>
                    Enter Your One-Time Access Code
                  </label>
                  <Input
                    id="kid-code"
                    required
                    value={quickCode}
                    onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC123"
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
                    Ask your parent for your one-time code to set up your 6-digit PIN
                  </small>
                </div>

                <Button disabled={busy || !quickCode.trim()} type="submit" variant="primary" style={{ width: "100%", height: "48px", fontSize: "1rem" }}>
                  {busy ? "Checking code…" : "Continue →"}
                </Button>
              </form>
            )}

            {tab === "code" && codeVerifiedKid && (
              <form onSubmit={handleCreatePin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                    Create Your 6-Digit PIN
                  </h3>
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: "0.25rem 0 0" }}>
                    Hi <strong>{codeVerifiedKid.name}</strong> (@{codeVerifiedKid.username})! You'll use this PIN for all future logins.
                  </p>
                </div>

                <div>
                  <label htmlFor="kid-comfort-name" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                    What should Penny call you? (Comfort Name)
                  </label>
                  <Input
                    id="kid-comfort-name"
                    value={comfortName}
                    onChange={(e) => setComfortName(e.target.value)}
                    placeholder="e.g. Aiman"
                    maxLength={30}
                  />
                </div>

                {codeVerifiedKid.needsBirthday && (
                  <div>
                    <label htmlFor="kid-birthdate" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      When is your birthday?
                    </label>
                    <Input
                      id="kid-birthdate"
                      required
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                    />
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      We use this to pick the right quests for your age!
                    </p>
                  </div>
                )}

                <div>
                  <label htmlFor="new-kid-pin" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                    Choose 6-Digit PIN
                  </label>
                  <Input
                    id="new-kid-pin"
                    required
                    type="password"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    style={{ textAlign: "center", fontSize: "1.35rem", letterSpacing: "0.3em" }}
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="confirm-kid-pin" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                    Confirm 6-Digit PIN
                  </label>
                  <Input
                    id="confirm-kid-pin"
                    required
                    type="password"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    style={{ textAlign: "center", fontSize: "1.35rem", letterSpacing: "0.3em" }}
                  />
                </div>

                <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCodeVerifiedKid(null)}
                    style={{ flex: 1 }}
                  >
                    Back
                  </Button>
                  <Button
                    disabled={busy || newPin.length !== 6 || confirmPin.length !== 6}
                    type="submit"
                    variant="primary"
                    style={{ flex: 2, height: "48px", fontSize: "1rem" }}
                  >
                    {busy ? "Saving PIN…" : "Activate Vault ✨"}
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
                  minHeight: "44px",
                  padding: "0.5rem 0.75rem",
                }}
              >
                <AppIcon name="parent" size={16} />
                <span>Parent sign in here →</span>
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
                      toast.success(`Admin bypass: hi ${name}!`);
                      nav({ to: "/kid" });
                    } catch (err: unknown) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : `Bypass failed. Seed kid ${ADMIN_BYPASS.kid.username} first.`,
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
                  Logs in as {ADMIN_BYPASS.kid.username}
                </small>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
