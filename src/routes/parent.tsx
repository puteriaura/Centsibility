import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { edgeParentGetPin, edgeParentSetPin, edgeParentGetProfile } from "@/lib/edge";
import { useAuth } from "@/providers/auth";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { supabase } from "@/integrations/supabase/client";
import { NumericKeypad, PIN_KEYPAD_KEYS } from "@/components/ui/numeric-keypad";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { isParentBypassed, setParentBypassed } from "@/lib/admin-bypass";

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
  setParentBypassed(false);
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
      if (!isParentBypassed()) {
        try {
          const profile = await edgeParentGetProfile();
          if (cancelled) return;

          if (!profile) {
            return await ejectUser("Profile not found.");
          }
        } catch {
          return await ejectUser("Unable to verify your profile.");
        }
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
        <div>[loading commander status...]</div>
      </AppShell>
    );
  }

  // No user — let child routes render their own auth guards
  if (!user) return <Outlet />;

  // PIN not yet verified — show the PIN screen
  if (!pinVerified) {
    return (
      <div
        className="min-h-screen flex flex-col justify-between p-6 sm:p-8"
        style={{
          background: "var(--surface-pink)",
          maxWidth: "440px",
          margin: "0 auto",
        }}
      >
        {/* Benchmark Header: ✕ Cancel on left, ? Help on right */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              clearParentSession();
              supabase.auth.signOut().then(() => {
                window.location.href = "/kid-login";
              });
            }}
            className="p-2 rounded-full hover:bg-[var(--surface-soft)] text-[var(--ink)] transition-colors"
            aria-label="Cancel and exit"
          >
            <AppIcon name="close" size={24} />
          </button>

          <button
            type="button"
            onClick={() => {
              toast("Security PIN prevents children from accessing parent controls.");
            }}
            className="p-2 rounded-full hover:bg-[var(--surface-soft)] text-[var(--ink)] transition-colors"
            aria-label="Help information"
          >
            <AppIcon name="messagecircle" size={22} />
          </button>
        </div>

        {/* PIN Title & Digit Boxes */}
        <div className="text-center my-auto py-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">
            {isSettingPin ? "Create 6-digit PIN" : "Enter your 6-digit PIN"}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-2">
            {isSettingPin
              ? "Create a secure PIN to protect the parent dashboard"
              : "Enter your PIN to manage your family banking"}
          </p>

          {/* 6 Rounded Square Boxes */}
          <div className="flex items-center justify-center gap-2.5 sm:gap-3 my-8">
            {Array.from({ length: 6 }).map((_, i) => {
              const filled = i < pinInput.length;
              return (
                <div
                  key={i}
                  className={`aeon-pin-box ${filled ? "is-filled" : ""}`}
                  style={{
                    width: "48px",
                    height: "56px",
                    borderRadius: "14px",
                    fontSize: "24px",
                  }}
                  aria-hidden="true"
                >
                  {filled ? "●" : ""}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              clearParentSession();
              supabase.auth.signOut().then(() => {
                window.location.href = "/login";
              });
            }}
            className="text-xs sm:text-sm font-semibold text-[var(--ink)] hover:text-[var(--primary)] transition-colors inline-flex items-center gap-1.5"
          >
            <span>Login with password</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>

        {/* Keypad & Submit Action */}
        <div className="pb-4">
          <NumericKeypad
            keys={PIN_KEYPAD_KEYS}
            onKeyPress={handleKeyPress}
            disabled={pinProcessing}
            variant="aeon"
          />

          {pinInput.length >= 4 && (
            <div className="mt-4">
              <Button
                variant="primary"
                onClick={submitPin}
                disabled={pinProcessing}
                className="w-full justify-center py-3 text-sm font-bold shadow-md"
              >
                {pinProcessing ? "Verifying..." : isSettingPin ? "Set PIN" : "Unlock Dashboard"}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // PIN verified — render the actual parent child routes
  return (
    <AppShell mode="parent">
      <Outlet />
    </AppShell>
  );
}
