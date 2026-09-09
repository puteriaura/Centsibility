import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { edgeKidLogin, edgeKidLoginByCode } from "@/lib/edge";
import { setKidSession } from "@/lib/kid-session";
import { toast } from "sonner";
import { Smiley, Key, User, RocketLaunch } from "@phosphor-icons/react";

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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-sky/20 via-cream to-mint/20 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] bg-sky/10 blur-[80px] rounded-full animate-float" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-mint/10 blur-[100px] rounded-full animate-float [animation-delay:2s]" />

      <div className="w-full max-w-md rounded-[2.5rem] border border-white/40 bg-white/60 p-8 shadow-2xl backdrop-blur-xl relative z-10">
        <div className="flex justify-center mb-2">
          <Smiley weight="duotone" className="w-16 h-16 text-bubblegum animate-bounce" />
        </div>
        <h1 className="mt-3 font-display text-2xl text-charcoal text-center">Kid Login</h1>
        <p className="font-body text-sm text-pewter text-center">
          Sign in with your code or username.
        </p>

        {/* Tab switcher */}
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-cream p-1">
          <button
            onClick={() => setTab("code")}
            className={`btn-press flex items-center justify-center gap-1.5 rounded-[1.25rem] py-3 font-kid text-xs font-bold transition shadow-sm ${
              tab === "code" ? "bg-bubblegum text-white" : "text-pewter hover:bg-white/50"
            }`}
          >
            <Key weight="bold" className="w-4 h-4" /> Login Code
          </button>
          <button
            onClick={() => setTab("login")}
            className={`btn-press flex items-center justify-center gap-1.5 rounded-[1.25rem] py-3 font-kid text-xs font-bold transition shadow-sm ${
              tab === "login" ? "bg-bubblegum text-white" : "text-pewter hover:bg-white/50"
            }`}
          >
            <User weight="bold" className="w-4 h-4" /> Username + PIN
          </button>
        </div>

        {/* Quick Code Login */}
        {tab === "code" && (
          <form onSubmit={handleCodeLogin} className="mt-5 space-y-3">
            <label className="font-kid text-xs font-bold text-pewter uppercase tracking-wider">
              6-character login code
            </label>
            <input
              required
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB12CD"
              maxLength={6}
              autoFocus
              className="w-full rounded-2xl border-2 border-border bg-cream px-4 py-4 text-center font-mono text-2xl font-bold tracking-widest uppercase placeholder:tracking-normal"
            />
            <button
              disabled={busy}
              type="submit"
              className="btn-press flex items-center justify-center gap-2 w-full rounded-[1.25rem] bg-bubblegum py-3.5 font-kid font-bold text-white disabled:opacity-50 shadow-soft"
            >
              {busy ? (
                "Checking…"
              ) : (
                <>
                  Let's go! <RocketLaunch weight="fill" className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Username + PIN Login */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="mt-5 space-y-3">
            <div>
              <label className="font-kid text-xs font-bold text-pewter uppercase tracking-wider">
                Username
              </label>
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. aiman"
                className="mt-1 w-full rounded-2xl border-2 border-border bg-cream px-4 py-3 font-body text-sm"
              />
            </div>
            <div>
              <label className="font-kid text-xs font-bold text-pewter uppercase tracking-wider">
                6-digit PIN
              </label>
              <input
                required
                type="password"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="mt-1 w-full rounded-2xl border-2 border-border bg-cream px-4 py-3 font-mono text-center text-lg tracking-[0.5em]"
              />
            </div>
            <button
              disabled={busy}
              type="submit"
              className="btn-press flex items-center justify-center gap-2 w-full rounded-[1.25rem] bg-bubblegum py-3.5 font-kid font-bold text-white disabled:opacity-50 shadow-soft"
            >
              {busy ? (
                "Signing in…"
              ) : (
                <>
                  Sign In <RocketLaunch weight="fill" className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}

        <Link to="/login" className="mt-6 inline-block font-parent text-xs text-slate-parent">
          Parent? Sign in here →
        </Link>
      </div>
    </div>
  );
}
