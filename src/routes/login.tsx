import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth";
import { getQuickLogin, clearQuickLogin } from "@/lib/quick-login";
import { toast } from "sonner";

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
    <div style={{ maxWidth: "450px", margin: "2rem auto" }}>
      <section className="wireframe-card">
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          <h2>Centsibility</h2>
        </Link>

        {usePin && quick ? (
          <>
            <h1>Quick login</h1>
            <p>Welcome back, {quick.email}.</p>
            <form onSubmit={submitPin} className="wireframe-col" style={{ marginTop: "1rem" }}>
              <label>Enter PIN</label>
              <input
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                inputMode="numeric"
                pattern="\d{4,6}"
                maxLength={6}
                placeholder="Enter PIN"
              />
              <button disabled={busy} type="submit">
                {busy ? "…" : "Unlock"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                clearQuickLogin();
                setUsePin(false);
              }}
              style={{ marginTop: "0.5rem" }}
            >
              Use different account
            </button>
          </>
        ) : (
          <>
            <h1>{mode === "signin" ? "Parent sign in" : "Create parent account"}</h1>
            <p>Manage your family's halal finance journey.</p>

            <form onSubmit={submit} className="wireframe-col" style={{ marginTop: "1rem" }}>
              {mode === "signup" && (
                <>
                  <div>
                    <label>Your name</label>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="wireframe-box">
                    <small>Does your child have their own device?</small>
                    <div className="wireframe-row" style={{ marginTop: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => setChildHasDevice(true)}
                        style={{
                          flex: 1,
                          border: childHasDevice === true ? "2px solid #000" : "1px solid #ccc",
                        }}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setChildHasDevice(false)}
                        style={{
                          flex: 1,
                          border: childHasDevice === false ? "2px solid #000" : "1px solid #ccc",
                        }}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label>Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="Email"
                />
                {emailError && (
                  <p style={{ color: "#000", fontWeight: "bold", fontSize: "0.85rem" }}>
                    [✗] {emailError}
                  </p>
                )}
              </div>

              <div>
                <label>Password</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Create a strong password" : "Password"}
                />
              </div>

              {mode === "signup" && password.length > 0 && (
                <div className="wireframe-box">
                  <small>Password strength:</small>
                  {[
                    { ok: password.length >= 8, label: "At least 8 characters" },
                    { ok: /[A-Z]/.test(password), label: "One uppercase letter" },
                    { ok: /\d/.test(password), label: "One number" },
                    { ok: /[^A-Za-z0-9]/.test(password), label: "One special character" },
                  ].map((r) => (
                    <div key={r.label} className="wireframe-row">
                      <span>{r.ok ? "[✓]" : "[✗]"}</span>
                      <small>{r.label}</small>
                    </div>
                  ))}
                </div>
              )}

              <button disabled={busy} type="submit" style={{ marginTop: "0.5rem" }}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setEmailError("");
              }}
              style={{ marginTop: "0.75rem" }}
            >
              {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
            </button>
          </>
        )}

        <div style={{ marginTop: "1.5rem", borderTop: "1px solid #ccc", paddingTop: "0.75rem", textAlign: "center" }}>
          <Link to="/kid-login">
            [icon: kid] Kid? Login with code →
          </Link>
        </div>
      </section>
    </div>
  );
}
