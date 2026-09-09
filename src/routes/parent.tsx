import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { edgeParentGetPin, edgeParentSetPin, edgeParentGetProfile } from "@/lib/edge";
import { useAuth } from "@/providers/auth";
import { AppShell, Card } from "@/components/AppShell";
import { ShieldCheck, LockKey, CaretLeft } from "@phosphor-icons/react";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/parent")({
  component: ParentLayout,
});

// ---------------------------------------------------------------------------
// Helpers (outside component so they're stable references)
// ---------------------------------------------------------------------------

/** SHA-256 hash a PIN string, returns lowercase hex. */
async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Clear every parent-session flag from sessionStorage. */
function clearParentSession() {
  sessionStorage.removeItem("parentSessionValidUntil");
}

/** Sign out + redirect — returns a never-resolving promise so callers can
 *  `return await ejectUser(…)` and TypeScript knows nothing runs after it. */
async function ejectUser(message: string, to = "/kid-login"): Promise<never> {
  clearParentSession();
  await supabase.auth.signOut();
  toast.error(message);
  window.location.href = to;
  // Never resolves — the page navigates away
  return new Promise(() => {});
}

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ParentLayout() {
  const { user, loading: authLoading } = useAuth();

  // --- UI state ---
  const [initialising, setInitialising] = useState(true);
  const [pinVerified, setPinVerified] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinProcessing, setPinProcessing] = useState(false);

  // -----------------------------------------------------------------------
  // 1️⃣  INIT — runs once when auth settles
  //     Order: role check → session check → PIN existence check
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (authLoading) return; // wait for auth to resolve

    let cancelled = false; // guard against unmount during async work

    (async () => {
      // No user at all — let child routes handle it
      if (!user) {
        setInitialising(false);
        return;
      }

      // ------ STEP 1: Verify profile exists ------
      try {
        const profile = await edgeParentGetProfile();
        if (cancelled) return;

        if (!profile) {
          return await ejectUser("Profile not found.");
        }
      } catch {
        return await ejectUser("Unable to verify your profile.");
      }

      // ------ STEP 2: Valid session? Skip PIN entirely ------
      const validUntil = sessionStorage.getItem("parentSessionValidUntil");
      if (validUntil && Number(validUntil) > Date.now()) {
        if (!cancelled) {
          setPinVerified(true);
          setInitialising(false);
        }
        return;
      }

      // ------ STEP 3: Does a PIN already exist? ------
      try {
        const { pin_hash } = await edgeParentGetPin();
        if (cancelled) return;

        if (pin_hash) {
          // PIN exists → user must enter it
          setIsSettingPin(false);
        } else {
          // No PIN yet — allow setting unconditionally
          setIsSettingPin(true);
        }
      } catch {
        return await ejectUser("Failed to load PIN status.", "/login");
      }

      if (!cancelled) setInitialising(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // -----------------------------------------------------------------------
  // 2️⃣  Keypad
  // -----------------------------------------------------------------------
  const KEYS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["00", "0", "⌫"],
  ];

  const handleKeyPress = useCallback((key: string) => {
    if (key === "⌫") {
      setPinInput((p) => p.slice(0, -1));
    } else if (key === "00") {
      // "00" appends two zeros but never exceeds 6 digits
      setPinInput((p) => {
        const next = p + "00";
        return next.slice(0, 6);
      });
    } else {
      setPinInput((p) => {
        if (p.length >= 6) return p;
        return p + key;
      });
    }
  }, []);

  // -----------------------------------------------------------------------
  // 3️⃣  Submit — SET or VERIFY
  // -----------------------------------------------------------------------
  const submitPin = async () => {
    if (pinInput.length < 4) {
      toast.error("PIN must be 4–6 digits");
      return;
    }

    setPinProcessing(true);

    try {
      const hashed = await hashPin(pinInput);

      if (isSettingPin) {
        // ---- SET new PIN ----
        await edgeParentSetPin({ pin_hash: hashed });

        setPinVerified(true);
        setIsSettingPin(false);
        sessionStorage.setItem("parentSessionValidUntil", String(Date.now() + SESSION_DURATION_MS));
        sfx.success();
        toast.success("Commander PIN set!");
      } else {
        // ---- VERIFY existing PIN ----
        const { pin_hash } = await edgeParentGetPin();

        if (pin_hash === hashed) {
          setPinVerified(true);
          sessionStorage.setItem(
            "parentSessionValidUntil",
            String(Date.now() + SESSION_DURATION_MS),
          );
          sfx.success();
        } else {
          toast.error("Incorrect PIN");
          sfx.error();
          setPinInput("");
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "PIN operation failed");
      sfx.error();
    } finally {
      setPinProcessing(false);
    }
  };

  // -----------------------------------------------------------------------
  // 4️⃣  Render
  // -----------------------------------------------------------------------

  // Loading state
  if (authLoading || initialising) {
    return (
      <AppShell mode="parent">
        <div className="flex h-full items-center justify-center">
          <ShieldCheck className="w-12 h-12 text-starlight/50 animate-pulse" />
        </div>
      </AppShell>
    );
  }

  // No user — let child routes render their own auth guards
  if (!user) return <Outlet />;

  // PIN not yet verified — show the PIN screen
  if (!pinVerified) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-void px-4 font-body relative">
        {/* Cancel → sign out + go to kid-login */}
        <button
          onClick={() => {
            clearParentSession();
            supabase.auth.signOut().then(() => {
              window.location.href = "/kid-login";
            });
          }}
          className="absolute top-6 left-6 flex items-center gap-2 text-starlight/60 hover:text-starlight transition font-kid text-sm tracking-wider"
        >
          <CaretLeft weight="bold" className="w-5 h-5" />
          Cancel
        </button>

        <Card className="w-full max-w-sm glass-panel border border-starlight/20 text-center py-8 px-6">
          {/* Lock icon */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-void border border-starlight/20">
            <LockKey weight="duotone" className="h-8 w-8 text-starlight" />
          </div>

          <h2 className="font-display text-2xl text-starlight mb-2">
            {isSettingPin ? "Set Commander PIN" : "Enter Commander PIN"}
          </h2>
          <p className="text-sm text-starlight/70 mb-6">
            {isSettingPin
              ? "Create a 4–6 digit PIN to protect the parent dashboard."
              : "Enter your PIN to access the parent dashboard."}
          </p>

          {/* PIN circles */}
          <div className="mb-6 flex justify-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`h-4 w-4 rounded-full border-2 transition-colors ${
                  i < pinInput.length
                    ? "border-starlight bg-starlight"
                    : "border-starlight/30 bg-transparent"
                }`}
              />
            ))}
          </div>

          {/* Numeric keypad */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {KEYS.flat().map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleKeyPress(key)}
                className={`rounded-2xl py-4 font-mono text-xl font-bold transition active:scale-90 ${
                  key === "⌫"
                    ? "bg-white/10 text-coral text-2xl border border-white/10"
                    : "glass-panel text-starlight hover:bg-white/10 border border-white/10"
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Submit button with spinner */}
          <button
            onClick={submitPin}
            disabled={pinInput.length < 4 || pinProcessing}
            className="w-full btn-press rounded-full glass-panel border border-neon-mint/30 px-6 py-3.5 font-kid text-sm font-bold text-starlight hover:bg-neon-mint hover:text-void disabled:opacity-50 transition shadow-neon uppercase tracking-wider flex items-center justify-center gap-2"
          >
            {pinProcessing && (
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            )}
            {isSettingPin ? "Set PIN" : "Unlock"}
          </button>
        </Card>
      </div>
    );
  }

  // PIN verified — render the actual parent child routes
  return <Outlet />;
}
