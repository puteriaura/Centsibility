import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { edgeKidLogin, edgeKidLoginByCode } from "@/lib/edge";
import { setKidSession } from "@/lib/kid-session";
import { toast } from "sonner";

export const Route = createFileRoute("/kid-login")({
  head: () => ({ meta: [{ title: "Kid Login — Centsibility" }] }),
  component: KidLogin,
});

function KidLogin() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"login" | "code">("code");

  // Username+PIN login state
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");

  // Quick code login state
  const [quickCode, setQuickCode] = useState("");

  const [busy, setBusy] = useState(false);

  /* ── Username + PIN Login ── */
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

  /* ── Quick Code Login ── */
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
    <div style={{ maxWidth: "450px", margin: "2rem auto" }}>
      <section className="wireframe-card" style={{ textAlign: "center" }}>
        <div className="wireframe-icon" style={{ fontSize: "2rem" }}>[icon: kid]</div>
        <h1>Kid Login</h1>
        <p>Sign in with your code or username.</p>

        {/* Tab switcher */}
        <div className="wireframe-row" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            onClick={() => setTab("code")}
            style={{
              flex: 1,
              border: tab === "code" ? "2px solid #000" : "1px solid #ccc",
              fontWeight: tab === "code" ? "bold" : "normal",
            }}
          >
            [icon: key] Login Code
          </button>
          <button
            type="button"
            onClick={() => setTab("login")}
            style={{
              flex: 1,
              border: tab === "login" ? "2px solid #000" : "1px solid #ccc",
              fontWeight: tab === "login" ? "bold" : "normal",
            }}
          >
            [icon: user] Username + PIN
          </button>
        </div>

        {/* Quick Code Login */}
        {tab === "code" && (
          <form onSubmit={handleCodeLogin} className="wireframe-col" style={{ marginTop: "1rem", textAlign: "left" }}>
            <label>6-character login code</label>
            <input
              required
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB12CD"
              maxLength={6}
              autoFocus
              style={{ textAlign: "center", fontSize: "1.25rem", letterSpacing: "0.2em" }}
            />
            <button disabled={busy} type="submit" style={{ marginTop: "0.5rem" }}>
              {busy ? "Checking…" : "Let's go! [icon: go]"}
            </button>
          </form>
        )}

        {/* Username + PIN Login */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="wireframe-col" style={{ marginTop: "1rem", textAlign: "left" }}>
            <div>
              <label>Username</label>
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. aiman"
              />
            </div>
            <div>
              <label>6-digit PIN</label>
              <input
                required
                type="password"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                style={{ textAlign: "center", letterSpacing: "0.4em" }}
              />
            </div>
            <button disabled={busy} type="submit" style={{ marginTop: "0.5rem" }}>
              {busy ? "Signing in…" : "Sign In [icon: go]"}
            </button>
          </form>
        )}

        <div style={{ marginTop: "1.5rem", borderTop: "1px solid #ccc", paddingTop: "0.75rem" }}>
          <Link to="/login">
            Parent? Sign in here →
          </Link>
        </div>
      </section>
    </div>
  );
}
