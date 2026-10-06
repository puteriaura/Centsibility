import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { edgeParentGetPin, edgeParentSetPin, edgeParentVerifyPin, edgeParentGetProfile, clearParentPinSession } from "@/lib/edge";
import { useAuth } from "@/providers/auth";
import { AppShell } from "@/components/AppShell";
import { PrivacyProvider, markJustUnlocked } from "@/features/privacy";
import { PennyProvider } from "@/features/penny";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { supabase } from "@/integrations/supabase/client";
import { NumericKeypad, PIN_KEYPAD_KEYS } from "@/components/ui/numeric-keypad";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isParentBypassed, setParentBypassed } from "@/lib/admin-bypass";

export const Route = createFileRoute("/parent")({
  component: ParentLayout,
});

// ---------------------------------------------------------------------------
// Helpers (outside component so they're stable references)
// ---------------------------------------------------------------------------

/** Clear every parent-session flag from sessionStorage. */
function clearParentSession() {
  sessionStorage.removeItem("parentSessionValidUntil");
  clearParentPinSession();
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

export function ParentLoadingState() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[var(--primary)] border-t-transparent mb-3" />
      <p className="text-sm font-medium text-[var(--ink-muted)]">Loading…</p>
    </div>
  );
}

function ParentLayout() {
  const { user, loading: authLoading } = useAuth();

  // --- UI state ---
  const [initialising, setInitialising] = useState(true);
  const [pinVerified, setPinVerified] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinProcessing, setPinProcessing] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3>(1);
  const [comfortNameInput, setComfortNameInput] = useState(() => {
    const meta = (user?.user_metadata as any);
    return meta?.comfort_name || meta?.name || "";
  });

  // -----------------------------------------------------------------------
  // Listen for server-side 403 PIN required events
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handlePinRequired = () => {
      clearParentSession();
      setPinVerified(false);
      setPinInput("");
      toast.error("Enter your PIN to continue");
    };

    window.addEventListener("centsibility:pin-required", handlePinRequired);
    return () => {
      window.removeEventListener("centsibility:pin-required", handlePinRequired);
    };
  }, []);

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
        const { hasPin } = await edgeParentGetPin();
        if (cancelled) return;

        if (hasPin) {
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
  const submitPin = async () => {
    if (pinInput.length !== 6) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }



    setPinProcessing(true);

    try {
      if (isSettingPin) {
        // ---- SET new PIN ----
        const res = await edgeParentSetPin({ pin: pinInput });

        if (comfortNameInput.trim()) {
          try {
            await supabase.auth.updateUser({
              data: { comfort_name: comfortNameInput.trim() },
            });
          } catch {
            // Non-critical if user metadata fails
          }
        }

        const expiry = res.pinSessionExpiresAt
          ? new Date(res.pinSessionExpiresAt).getTime()
          : Date.now() + SESSION_DURATION_MS;
        sessionStorage.setItem("parentSessionValidUntil", String(expiry));
        markJustUnlocked();
        sfx.success();
        setOnboardingStep(3);
      } else {
        // ---- VERIFY existing PIN ----
        const res = await edgeParentVerifyPin({ pin: pinInput });

        if (res.valid) {
          setPinVerified(true);
          const expiry = res.pinSessionExpiresAt
            ? new Date(res.pinSessionExpiresAt).getTime()
            : Date.now() + SESSION_DURATION_MS;
          sessionStorage.setItem("parentSessionValidUntil", String(expiry));
          markJustUnlocked();
          sfx.success();
        } else {
          const attemptsMsg = res.attemptsLeft !== undefined
            ? `Incorrect PIN. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? "" : "s"} left`
            : "Incorrect PIN";
          toast.error(attemptsMsg);
          sfx.error();
          setPinInput("");
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "PIN operation failed");
      sfx.error();
      setPinInput("");
    } finally {
      setPinProcessing(false);
    }
  };

  // -----------------------------------------------------------------------
  // 4️⃣  Render
  // -----------------------------------------------------------------------

  // Loading state
  if (authLoading || initialising) {
    return <ParentLoadingState />;
  }

  // No user: let child routes render their own auth guards
  if (!user) return <Outlet />;

  // PIN not yet verified: show Onboarding (if setting PIN) or PIN unlock screen
  if (!pinVerified) {
    if (isSettingPin) {
      return (
        <div
          className="min-h-[100dvh] flex flex-col justify-between p-6 sm:p-8"
          style={{
            background: "linear-gradient(180deg, #fdf0f3 0%, #ffffff 60%)",
            maxWidth: "440px",
            margin: "0 auto",
          }}
        >
          {/* Top Progress Header */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] mb-2">
              <span>STEP {onboardingStep} OF 3</span>
              <span>
                {onboardingStep === 1
                  ? "Comfort Name"
                  : onboardingStep === 2
                  ? "6-Digit PIN"
                  : "All Set!"}
              </span>
            </div>
            <div className="w-full bg-[var(--border)] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[var(--primary)] h-full transition-all duration-300"
                style={{
                  width: onboardingStep === 1 ? "33%" : onboardingStep === 2 ? "66%" : "100%",
                }}
              />
            </div>
          </div>

          {/* Step 1: Comfort Name */}
          {onboardingStep === 1 && (
            <div className="my-auto py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[var(--surface-pink)] border border-[var(--primary-soft)] flex items-center justify-center mx-auto shadow-sm">
                <AppIcon name="penny" size={32} color="var(--primary)" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-extrabold text-[var(--ink)] tracking-tight">
                  Salam! Welcome to Centsibility
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                  What should your children and Penny call you?
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--ink)] block">
                  Choose a suggested name or type your own:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {["Mama", "Papa", "Ummi", "Baba", "Abi", "Coach Dan"].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setComfortNameInput(suggestion);
                        sfx.pop();
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        comfortNameInput === suggestion
                          ? "bg-[var(--primary)] text-white shadow-sm"
                          : "bg-white border border-[var(--border)] text-[var(--ink)] hover:border-[var(--primary)]"
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Your Comfort Name"
                value={comfortNameInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComfortNameInput(e.target.value)}
                placeholder="e.g. Mama, Papa, Ummi"
                maxLength={30}
              />

              <div className="p-3 bg-[var(--surface-pink)] border border-[var(--primary-soft)] rounded-xl text-xs text-[var(--ink)] text-center font-medium">
                ✨ The app and Penny will greet you as:{" "}
                <strong>{comfortNameInput.trim() || "Parent"}</strong>
              </div>

              <Button
                variant="primary"
                disabled={!comfortNameInput.trim()}
                onClick={() => {
                  sfx.tap();
                  setOnboardingStep(2);
                }}
                className="w-full justify-center py-3 text-sm font-bold shadow-md mt-4"
              >
                Next: Protect Your Vault →
              </Button>
            </div>
          )}

          {/* Step 2: 6-Digit PIN */}
          {onboardingStep === 2 && (
            <div className="my-auto py-6 text-center">
              <h1 className="text-2xl font-extrabold text-[var(--ink)] tracking-tight">
                Create Your 6-Digit PIN
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                Set a secret 6-digit PIN to protect parent settings and loan approvals.
              </p>

              {/* 6 Rounded Square Boxes */}
              <div className="flex items-center justify-center gap-2.5 sm:gap-3 my-6">
                {Array.from({ length: 6 }).map((_, i) => {
                  const filled = i < pinInput.length;
                  return (
                    <div
                      key={i}
                      className={`pin-box ${filled ? "is-filled" : ""}`}
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

              <NumericKeypad
                keys={PIN_KEYPAD_KEYS}
                onKeyPress={handleKeyPress}
                disabled={pinProcessing}
                variant="pin"
              />

              {pinInput.length === 6 && (
                <div className="mt-4">
                  <Button
                    variant="primary"
                    onClick={submitPin}
                    disabled={pinProcessing}
                    className="w-full justify-center py-3 text-sm font-bold shadow-md"
                  >
                    {pinProcessing ? "Saving..." : "Save 6-Digit PIN →"}
                  </Button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setOnboardingStep(1)}
                className="text-xs text-[var(--text-secondary)] hover:underline mt-4 inline-block"
              >
                ← Back to Comfort Name
              </button>
            </div>
          )}

          {/* Step 3: All Set Celebration */}
          {onboardingStep === 3 && (
            <div className="my-auto py-6 space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] flex items-center justify-center mx-auto shadow-sm">
                <AppIcon name="sparkles" size={32} color="#059669" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-[var(--ink)] tracking-tight">
                  You're all set, {comfortNameInput.trim() || "Parent"}! 🎉
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                  Your halal family banking command center is ready.
                </p>
              </div>

              <div className="p-4 bg-white border border-[var(--border)] rounded-2xl text-left space-y-3 shadow-sm">
                <div className="flex items-center gap-2.5 text-xs text-[var(--ink)]">
                  <span className="w-6 h-6 rounded-full bg-[var(--surface-pink)] flex items-center justify-center text-[var(--primary)] font-bold text-xs shrink-0">
                    ✓
                  </span>
                  <span><strong>6-Digit Security PIN</strong> active & safe</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-[var(--ink)]">
                  <span className="w-6 h-6 rounded-full bg-[var(--surface-pink)] flex items-center justify-center text-[var(--primary)] font-bold text-xs shrink-0">
                    ✓
                  </span>
                  <span><strong>Real RM Savings & Hibah</strong> rewards enabled</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-[var(--ink)]">
                  <span className="w-6 h-6 rounded-full bg-[var(--surface-pink)] flex items-center justify-center text-[var(--primary)] font-bold text-xs shrink-0">
                    ✓
                  </span>
                  <span><strong>Penny AI Companion</strong> ready to guide your family</span>
                </div>
              </div>

              <Button
                variant="primary"
                onClick={() => {
                  sfx.coin();
                  setPinVerified(true);
                  setIsSettingPin(false);
                  toast.success("Welcome to your dashboard!");
                }}
                className="w-full justify-center py-3.5 text-sm font-bold shadow-md mt-4"
              >
                Open my family dashboard
              </Button>
            </div>
          )}
        </div>
      );
    }

    // Returning parent PIN unlock screen
    return (
      <div
        className="min-h-[100dvh] flex flex-col justify-between p-6 sm:p-8"
        style={{
          background: "linear-gradient(180deg, #fdf0f3 0%, #ffffff 60%)",
          maxWidth: "440px",
          margin: "0 auto",
        }}
      >
        {/* Quiet outline controls: close on the left, help on the right */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              clearParentSession();
              supabase.auth.signOut().then(() => {
                window.location.href = "/kid-login";
              });
            }}
            className="w-11 h-11 rounded-full hover:bg-black/5 text-[var(--ink)] transition-colors"
            aria-label="Cancel and exit"
          >
            <AppIcon name="close" size={24} />
          </button>

          <button
            type="button"
            onClick={() => {
              toast("Security PIN prevents children from accessing parent controls.");
            }}
            className="w-11 h-11 rounded-full hover:bg-black/5 text-[var(--ink)] transition-colors"
            aria-label="Help information"
          >
            <AppIcon name="messagecircle" size={22} />
          </button>
        </div>

        {/* PIN Title & Digit Boxes */}
        <div className="text-center my-auto py-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">
            Enter your 6-digit PIN
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-2">
            Enter your PIN to manage your family banking
          </p>

          {/* 6 Rounded Square Boxes */}
          <div className="flex items-center justify-center gap-2.5 sm:gap-3 my-8">
            {Array.from({ length: 6 }).map((_, i) => {
              const filled = i < pinInput.length;
              return (
                <div
                  key={i}
                  className={`pin-box ${filled ? "is-filled" : ""}`}
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
            className="text-xs sm:text-sm font-semibold text-[var(--ink)] hover:text-[var(--primary-text)] transition-colors inline-flex items-center gap-1.5"
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
            variant="pin"
          />

          {pinInput.length === 6 && (
            <div className="mt-4">
              <Button
                variant="primary"
                onClick={submitPin}
                disabled={pinProcessing}
                className="w-full justify-center py-3 text-sm font-bold shadow-md"
              >
                {pinProcessing ? "Verifying..." : "Unlock Dashboard"}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // PIN verified: render the actual parent child routes
  return (
    <PrivacyProvider mode="parent">
      <PennyProvider mode="parent">
        <AppShell mode="parent">
          <Outlet />
        </AppShell>
      </PennyProvider>
    </PrivacyProvider>
  );
}
