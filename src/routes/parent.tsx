import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { edgeParentGetPin, edgeParentSetPin, edgeParentGetProfile } from "@/lib/edge";
import { useAuth } from "@/providers/auth";
import { AppShell } from "@/components/AppShell";
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
        <div>[loading commander status...]</div>
      </AppShell>
    );
  }

  // No user — let child routes render their own auth guards
  if (!user) return <Outlet />;

  // PIN not yet verified — show the PIN screen
  if (!pinVerified) {
    return (
      <div>
        {/* Cancel → sign out + go to kid-login */}
        <button
          onClick={() => {
            clearParentSession();
            supabase.auth.signOut().then(() => {
              window.location.href = "/kid-login";
            });
          }}
        >
          [icon: back] Cancel
        </button>

        <section>
          {/* Lock icon */}
          <div>[icon: lock]</div>

          <h2>
            {isSettingPin ? "Set Commander PIN" : "Enter Commander PIN"}
          </h2>
          <p>
            {isSettingPin
              ? "Create a 4–6 digit PIN to protect the parent dashboard."
              : "Enter your PIN to access the parent dashboard."}
          </p>

          {/* PIN circles */}
          <div>
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i}>
                {i < pinInput.length ? "[●]" : "[○]"}
              </span>
            ))}
          </div>

          {/* Numeric keypad */}
          <div>
            {KEYS.map((row, rIdx) => (
              <div key={rIdx}>
                {row.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeyPress(key)}
                  >
                    {key}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Submit button with spinner */}
          <button
            onClick={submitPin}
            disabled={pinInput.length < 4 || pinProcessing}
          >
            {pinProcessing && "[loading...] "}
            {isSettingPin ? "Set PIN" : "Unlock"}
          </button>
        </section>
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
