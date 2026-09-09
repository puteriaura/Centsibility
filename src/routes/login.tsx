import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth";
import { getQuickLogin, clearQuickLogin } from "@/lib/quick-login";
import { toast } from "sonner";
import { CheckCircle, XCircle, Smiley } from "@phosphor-icons/react";

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

  // Clear email error whenever email changes
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
        // Check profiles table for existing email (catches confirmed accounts)
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
          // Supabase returns "User already registered" for duplicate emails
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
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
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

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-mint/20 via-cream to-bubblegum/20 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-halal/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-bubblegum/10 blur-[120px] rounded-full animate-pulse" />

      <div className="w-full max-w-md rounded-[2.5rem] border border-white/40 bg-white/60 p-8 shadow-2xl backdrop-blur-xl relative z-10">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-full bg-gradient-halal shadow-glow-gold transition-transform group-hover:scale-110" />
          <span className="font-display text-2xl text-charcoal">Centsibility</span>
        </Link>

        {usePin && quick ? (
          <>
            <h1 className="mt-4 font-parent text-2xl font-bold text-charcoal">Quick login</h1>
            <p className="font-body text-sm text-pewter mt-1">Welcome back, {quick.email}.</p>
            <form onSubmit={submitPin} className="mt-6 space-y-3">
              <input
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                inputMode="numeric"
                pattern="\d{4,6}"
                maxLength={6}
                placeholder="Enter PIN"
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-center font-mono text-2xl tracking-widest"
              />
              <button
                disabled={busy}
                type="submit"
                className="btn-press w-full rounded-[1.25rem] bg-emerald-halal py-3.5 font-parent font-bold text-white disabled:opacity-50 shadow-soft"
              >
                {busy ? "…" : "Unlock"}
              </button>
            </form>
            <button
              onClick={() => {
                clearQuickLogin();
                setUsePin(false);
              }}
              className="mt-4 w-full text-center font-parent text-xs text-slate-parent"
            >
              Use different account
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-4 font-parent text-2xl font-bold text-charcoal">
              {mode === "signin" ? "Parent sign in" : "Create parent account"}
            </h1>
            <p className="font-body text-sm text-pewter mt-1">
              Manage your family's halal finance journey.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-3">
              {mode === "signup" && (
                <>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-2xl border border-border bg-card px-4 py-3 font-body text-sm"
                  />
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <div className="font-kid text-[10px] font-bold text-pewter uppercase tracking-wider mb-2">
                      Does your child have their own device?
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setChildHasDevice(true)}
                        className={`flex-1 rounded-xl py-2 font-body text-xs font-bold transition border ${childHasDevice === true ? "bg-emerald-halal text-white border-emerald-halal" : "bg-card text-pewter border-border hover:bg-slate-50"}`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setChildHasDevice(false)}
                        className={`flex-1 rounded-xl py-2 font-body text-xs font-bold transition border ${childHasDevice === false ? "bg-emerald-halal text-white border-emerald-halal" : "bg-card text-pewter border-border hover:bg-slate-50"}`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </>
              )}
              <input
                required
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="Email"
                className={`w-full rounded-2xl border bg-card px-4 py-3 font-body text-sm ${emailError ? "border-coral focus:border-coral" : "border-border"}`}
              />
              {emailError && (
                <p className="font-body text-xs text-coral flex items-center gap-1.5 -mt-1">
                  <XCircle weight="fill" className="w-3.5 h-3.5 shrink-0" />
                  {emailError}
                </p>
              )}
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Create a strong password" : "Password"}
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 font-body text-sm"
              />
              {mode === "signup" && password.length > 0 && (
                <div className="rounded-2xl bg-card border border-border p-3 space-y-1">
                  <div className="font-kid text-[10px] font-bold text-pewter uppercase tracking-wider mb-1.5">
                    Password strength
                  </div>
                  {[
                    { ok: password.length >= 8, label: "At least 8 characters" },
                    { ok: /[A-Z]/.test(password), label: "One uppercase letter" },
                    { ok: /\d/.test(password), label: "One number" },
                    { ok: /[^A-Za-z0-9]/.test(password), label: "One special character" },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-2 font-body text-xs">
                      {r.ok ? (
                        <CheckCircle weight="fill" className="text-emerald-halal w-4 h-4" />
                      ) : (
                        <XCircle weight="fill" className="text-coral w-4 h-4" />
                      )}
                      <span className={r.ok ? "text-charcoal" : "text-pewter"}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                disabled={busy}
                type="submit"
                className="btn-press w-full rounded-[1.25rem] bg-emerald-halal py-3.5 font-parent font-bold text-white disabled:opacity-50 shadow-soft"
              >
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setEmailError("");
              }}
              className="mt-4 w-full text-center font-parent text-xs text-slate-parent hover:text-emerald-halal"
            >
              {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
            </button>
          </>
        )}

        <div className="mt-6 border-t border-border pt-4 text-center">
          <Link
            to="/kid-login"
            className="font-kid text-sm font-bold text-bubblegum inline-flex items-center justify-center gap-1.5 hover:underline"
          >
            <Smiley weight="duotone" className="w-5 h-5" /> Kid? Login with code →
          </Link>
        </div>
      </div>
    </div>
  );
}
