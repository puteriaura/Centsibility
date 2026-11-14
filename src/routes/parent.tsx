// PIN and onboarding screens centre on the keypad by convention (AEON's PIN screen does too).
// avoid-ai-design-ignore-file: L1, SD4w
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { edgeParentGetPin, edgeParentSetPin, edgeParentVerifyPin, edgeParentGetProfile } from "@/lib/edge";
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
import { endParentUnlock, isParentBypassed } from "@/lib/admin-bypass";
import { usePinStatus } from "@/hooks/use-pin-status";

export const Route = createFileRoute("/parent")({
  component: ParentLayout,
});

// ---------------------------------------------------------------------------
// Helpers (outside component so they're stable references)
// ---------------------------------------------------------------------------

/** Sign out + redirect — returns a never-resolving promise so callers can
 *  `return await ejectUser(…)` and TypeScript knows nothing runs after it. */
async function ejectUser(message: string, to = "/kid-login"): Promise<never> {
  endParentUnlock();
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
  const attemptStatus = usePinStatus("parent", Boolean(user) && !initialising && !pinVerified && !isSettingPin);
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
      endParentUnlock();
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
  const submitPin = useCallback(async (overridePin?: string) => {
    const pinToUse = overridePin ?? pinInput;
    if (pinToUse.length !== 6 || pinProcessing) {
      return;
    }

    setPinProcessing(true);

    try {
      if (isSettingPin) {
        // ---- SET new PIN ----
        const res = await edgeParentSetPin({ pin: pinToUse });

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
        const res = await edgeParentVerifyPin({ pin: pinToUse });

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
  }, [pinInput, pinProcessing, isSettingPin, comfortNameInput]);

  // -----------------------------------------------------------------------
  // 2️⃣  Keypad
  // -----------------------------------------------------------------------
  const handleKeyPress = useCallback((key: string) => {
    if (pinProcessing) return;

    if (key === "⌫" || key === "delete") {
      setPinInput((p) => p.slice(0, -1));
      return;
    }

    if (pinInput.length >= 6) return;
    if (key !== "00" && !/^\d$/.test(key)) return;
    const next = (pinInput + key).slice(0, 6);
    setPinInput(next);
    // Event handlers are not replayed as functional state updaters are.
    if (next.length === 6) void submitPin(next);
  }, [pinInput, pinProcessing, submitPin]);

  // -----------------------------------------------------------------------
  // 4️⃣  Render
  // -----------------------------------------------------------------------

  // Loading state
  if (authLoading || initialising) {
    return <ParentLoadingState />;
  }

  // Signed out (expired session, another tab, a bookmark): child routes have no guard of their own.
  if (!user) return <Navigate to="/login" replace />;

  // PIN not yet verified: show Onboarding (if setting PIN) or PIN unlock screen
  if (!pinVerified) {
    if (isSettingPin) {
      return (
        <div className="pin-screen">
          {/* Top Progress Header */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-2)] mb-2">
              <span>Step {onboardingStep} of 3</span>
              <span>
                {onboardingStep === 1
                  ? "Your name"
                  : onboardingStep === 2
                  ? "6-digit PIN"
                  : "All set"}
              </span>
            </div>
            <div className="w-full bg-[var(--surface-sunken)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[var(--primary)] h-full transition-colors duration-300"
                style={{
                  width: onboardingStep === 1 ? "33%" : onboardingStep === 2 ? "66%" : "100%",
                }}
              />
            </div>
          </div>

          {/* Step 1: Comfort Name */}
          {onboardingStep === 1 && (
            <div className="my-auto py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[var(--action-tint)] flex items-center justify-center mx-auto">
                <AppIcon name="penny" size={32} color="var(--action)" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-extrabold text-[var(--ink)] tracking-tight">
                  Salam, welcome to Centsibility
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                  What should your children and Penny call you?
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--ink)] m-0">
                  Pick one or type your own
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["Mama", "Papa", "Ummi", "Baba", "Abi", "Coach Dan"].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setComfortNameInput(suggestion);
                        sfx.pop();
                      }}
                      aria-pressed={comfortNameInput === suggestion}
                      className={`kid-chip px-3.5 ${comfortNameInput === suggestion ? "is-active" : ""}`}
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

              <p className="m-0 text-sm text-[var(--text-2)] text-center">
                The app and Penny will call you{" "}
                <strong className="text-[var(--ink)]">{comfortNameInput.trim() || "Parent"}</strong>
              </p>

              <Button
                variant="primary"
                disabled={!comfortNameInput.trim()}
                onClick={() => {
                  sfx.tap();
                  setOnboardingStep(2);
                }}
                size="lg"
                className="w-full mt-4"
              >
                Next: set your PIN
              </Button>
            </div>
          )}

          {/* Step 2: 6-Digit PIN */}
          {onboardingStep === 2 && (
            <div className="my-auto py-6 text-center">
              <h1 className="text-2xl font-extrabold text-[var(--ink)] tracking-tight">
                Create your 6-digit PIN
              </h1>
              <p className="text-sm text-[var(--text-2)] mt-1.5">
                It protects parent settings and loan approvals.
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

              <button
                type="button"
                onClick={() => setOnboardingStep(1)}
                className="text-sm font-semibold text-[var(--action-text)] mt-4 min-h-[44px] inline-flex"
              >
                Back to name
              </button>
            </div>
          )}

          {/* Step 3: All Set Celebration */}
          {onboardingStep === 3 && (
            <div className="my-auto py-6 space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--pos-bg)] flex items-center justify-center mx-auto">
                <AppIcon name="check" size={32} color="var(--pos)" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-[var(--ink)] tracking-tight">
                  You're all set, {comfortNameInput.trim() || "Parent"}
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                  Your family dashboard is ready.
                </p>
              </div>

              <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl text-left space-y-3">
                <div className="flex items-center gap-2.5 text-xs text-[var(--ink)]">
                  <AppIcon name="check" size={20} color="var(--pos)" className="shrink-0" />
                  <span><strong>6-digit PIN</strong> is on</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-[var(--ink)]">
                  <AppIcon name="check" size={20} color="var(--pos)" className="shrink-0" />
                  <span><strong>Savings and Hibah</strong> rewards are on</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-[var(--ink)]">
                  <AppIcon name="check" size={20} color="var(--pos)" className="shrink-0" />
                  <span><strong>Penny</strong> is ready to help your family</span>
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
                size="lg"
                className="w-full mt-4"
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
      <div className="pin-screen">
        {/* Quiet outline controls: close on the left, help on the right */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              endParentUnlock();
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
          <h1 className="text-2xl font-bold text-[var(--ink)]">
            Enter your 6-digit PIN
          </h1>
          <p className="text-sm text-[var(--text-2)] mt-2">
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
              endParentUnlock();
              supabase.auth.signOut().then(() => {
                window.location.href = "/login";
              });
            }}
            className="text-sm font-semibold text-[var(--action-text)] min-h-[44px] inline-flex items-center"
          >
            <span>Sign in with Google instead</span>
          </button>
        </div>

        {/* Keypad & Submit Action */}
        <div className="pb-4">
          <NumericKeypad
            keys={PIN_KEYPAD_KEYS}
            onKeyPress={handleKeyPress}
            disabled={pinProcessing || attemptStatus.locked}
            variant="pin"
          />
          <p role="status" className="text-xs text-[var(--text-secondary)] text-center">{attemptStatus.message}</p>
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
