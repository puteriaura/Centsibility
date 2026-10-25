import { PretendTap } from "@/features/kid/PretendTap";
// The card face uses embossed-style capitals like a real debit card.
// avoid-ai-design-ignore-file: SD4
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import { AppIcon } from "@/components/ui/app-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { formatRM } from "@/lib/format";
import { getKidSession } from "@/lib/kid-session";
import { edgeKidSetCardControls } from "@/lib/edge";
import { PracticeCardHero, PracticeCardTips, PracticeCardHelp } from "@/features/kid/PracticeCard";
import { PrivacyUnlockSheet } from "@/features/privacy/PrivacyUnlockSheet";
import { reduceAnimations } from "@/lib/theme";
import { Money } from "@/features/privacy";

export const Route = createFileRoute("/kid/card")({
  head: () => ({ meta: [{ title: "Practice Card | Centsibility" }] }),
  component: KidCard,
});

function KidCard() {
  const [lockFeedback, setLockFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const { data, loading, error, refresh } = useKidData();
  const [showDetails, setShowDetails] = useState(false);
  const [revealPinOpen, setRevealPinOpen] = useState(false);
  const [savingFreeze, setSavingFreeze] = useState(false);
  useEffect(() => {
    if (!showDetails) return;
    const hide = () => setShowDetails(false);
    const timer = window.setTimeout(hide, 30000);
    document.addEventListener("visibilitychange", hide);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", hide); };
  }, [showDetails]);
  const [isLocked, setIsLocked] = useState(() => Boolean(data?.kid?.card_frozen));
  const [showSettings, setShowSettings] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(() =>
    data?.kid?.card_daily_limit != null ? Number(data.kid.card_daily_limit) : 50,
  );
  const [onlineEnabled, setOnlineEnabled] = useState(() =>
    data?.kid?.card_online_enabled !== undefined ? Boolean(data.kid.card_online_enabled) : true,
  );
  const [savingLimit, setSavingLimit] = useState(false);
  const [savingOnline, setSavingOnline] = useState(false);

  useEffect(() => {
    if (data?.kid) {
      if (data.kid.card_frozen !== undefined && data.kid.card_frozen !== null) {
        setIsLocked(Boolean(data.kid.card_frozen));
      }
      if (data.kid.card_daily_limit != null) {
        setDailyLimit(Number(data.kid.card_daily_limit));
      }
      if (data.kid.card_online_enabled !== undefined && data.kid.card_online_enabled !== null) {
        setOnlineEnabled(Boolean(data.kid.card_online_enabled));
      }
    }
  }, [data?.kid?.card_frozen, data?.kid?.card_daily_limit, data?.kid?.card_online_enabled]);

  if (!data && error) return <KidLoadError onRetry={refresh} />;
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "14rem", borderRadius: "24px" }} />
        <div className="grid grid-cols-4 gap-3">
          <Skeleton style={{ height: "4rem", borderRadius: "50%" }} />
          <Skeleton style={{ height: "4rem", borderRadius: "50%" }} />
          <Skeleton style={{ height: "4rem", borderRadius: "50%" }} />
          <Skeleton style={{ height: "4rem", borderRadius: "50%" }} />
        </div>
        <Skeleton style={{ height: "8rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const k = data.kid;
  const isControlsLocked = Boolean(k.card_controls_locked);
  const parentLimit = k.card_daily_limit != null ? Number(k.card_daily_limit) : 50;
  const sliderMax = isControlsLocked ? parentLimit : 200;
  const effectiveLimit = isControlsLocked ? Math.min(dailyLimit, parentLimit) : dailyLimit;
  const parentOnline = k.card_online_enabled !== undefined ? Boolean(k.card_online_enabled) : true;

  const toggleLock = async () => {
    if (savingFreeze) return;
    sfx.pop();
    if (isControlsLocked && isLocked) {
      setLockFeedback({ error: true, text: "Ask your parent to unlock these settings." });
      toast.error("Your parent manages these card settings. You can still make them stricter.");
      return;
    }
    const prevLocked = isLocked;
    const nextLocked = !prevLocked;

    const code = getKidSession()?.code;
    if (!code) {
      setIsLocked(prevLocked);
      setLockFeedback({ error: true, text: "Session missing. Log in again to change card controls." });
      toast.error("Session missing. Log in again to change card controls.");
      return;
    }

    setSavingFreeze(true);
    try {
      await edgeKidSetCardControls({ code, frozen: nextLocked });
      setIsLocked(nextLocked);
      setLockFeedback({ error: false, text: nextLocked ? "Locked. Sadaqah and cash requests are blocked." : "Practice card unlocked." });
      toast.success(
        nextLocked
          ? "Card frozen. Sadaqah and cash withdrawal requests are blocked until you unfreeze it."
          : "Card unfrozen",
      );
      refresh();
    } catch (e: unknown) {
      setIsLocked(prevLocked);
      const message = e instanceof Error ? e.message : "Failed to update card status";
      setLockFeedback({ error: true, text: message });
      toast.error(message);
    } finally {
      setSavingFreeze(false);
    }
  };

  const saveDailyLimit = async () => {
    const code = getKidSession()?.code;
    if (!code) return;
    if (isControlsLocked && dailyLimit > sliderMax) {
      toast.error("Your parent manages these card settings. You can still make them stricter.");
      return;
    }
    setSavingLimit(true);
    try {
      await edgeKidSetCardControls({ code, dailyLimit });
      toast.success(`Daily limit saved: ${formatRM(dailyLimit)}`); // privacy-ok: toast
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save daily limit");
      if (data?.kid?.card_daily_limit != null) {
        setDailyLimit(Number(data.kid.card_daily_limit));
      }
    } finally {
      setSavingLimit(false);
    }
  };

  const saveOnlineEnabled = async () => {
    const code = getKidSession()?.code;
    if (!code) return;
    if (isControlsLocked && !parentOnline && onlineEnabled) {
      toast.error("Your parent manages these card settings. You can still make them stricter.");
      return;
    }
    setSavingOnline(true);
    try {
      await edgeKidSetCardControls({ code, onlineEnabled });
      toast.success("Online purchase setting saved");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save online setting");
      if (data?.kid?.card_online_enabled !== undefined) {
        setOnlineEnabled(Boolean(data.kid.card_online_enabled));
      }
    } finally {
      setSavingOnline(false);
    }
  };

  function showHelp() {
    const help = document.getElementById("practice-card-help");
    if (help instanceof HTMLDetailsElement) help.open = true;
    help?.focus({ preventScroll: true });
    help?.scrollIntoView({ behavior: reduceAnimations() ? "instant" : "smooth", block: "center" });
  }

  return (
    <div className="space-y-6 pb-12 max-w-[420px] mx-auto">
      <PracticeCardHero name={k.name} revealed={showDetails} locked={isLocked} />
      <p className="text-xs text-center text-[var(--text-secondary)]">Practice only. It can't pay anywhere.</p>
      <ol className="practice-steps">{["Set a limit", "Lock it", "Try a tap"].map((step, i) => <li key={step}><span>{i + 1}</span><strong>{step}</strong></li>)}</ol>
      <PretendTap locked={isLocked} limit={effectiveLimit} />
      <div className="practice-summary"><Card><h2>Daily limit</h2><strong><Money amount={effectiveLimit} /></strong></Card>
        <Card><label htmlFor="practice-lock">Lock</label><input id="practice-lock" type="checkbox" role="switch" aria-label="Lock practice card" checked={isLocked} onChange={() => void toggleLock()} disabled={savingFreeze || (isControlsLocked && isLocked)} className="toggle-switch" /></Card>
      </div>
      {isControlsLocked && <p role="status" className="text-xs text-center">Your parent unlocks these controls.</p>}
      {lockFeedback && <p role={lockFeedback.error ? "alert" : "status"} className="rounded-xl bg-[var(--surface-soft)] p-3 text-sm">{lockFeedback.text}</p>}
      <div className="grid grid-cols-3 gap-2 max-w-[420px] mx-auto text-center">
        <button
          type="button"
          onClick={() => {
            sfx.tap();
            if (showDetails) setShowDetails(false);
            else setRevealPinOpen(true);
          }}
          aria-label={showDetails ? "Hide card details" : "View card details"}
          aria-pressed={showDetails}
          className="quick-btn"
        >
          <span className="quick-circle">
            <AppIcon name={showDetails ? "hide" : "show"} size={22} />
          </span>
          <span className="quick-label">{showDetails ? "Hide details" : "View details"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.tap();
            setShowSettings(!showSettings);
          }}
          aria-label="Card settings"
          aria-expanded={showSettings}
          className="quick-btn"
        >
          <span className="quick-circle">
            <AppIcon name="settings" size={22} />
          </span>
          <span className="quick-label">Settings</span>
        </button>



        <button
          type="button"
          onClick={() => {
            showHelp();
          }}
          aria-label="Practice card help"
          className="quick-btn"
        >
          <span className="quick-circle">
            <AppIcon name="recall" size={22} />
          </span>
          <span className="quick-label">Help</span>
        </button>
      </div>
      <PrivacyUnlockSheet isOpen={revealPinOpen} onClose={() => setRevealPinOpen(false)} onSuccess={() => { setRevealPinOpen(false); setShowDetails(true); }} mode="kid" title="View sample details" description="Your PIN reveals sample details. They cannot pay." />
      <PracticeCardTips onSettings={() => setShowSettings(true)} onHelp={showHelp} />
      <details className="short-details ui-card p-4 space-y-2 max-w-[420px] mx-auto">
        <summary className="font-bold" aria-label="Activity details">Details</summary>
        <h2 className="text-sm font-bold">Activity covered by these controls</h2>
        <p className="text-xs text-[var(--text-secondary)]">Limits cover sadaqah and cash withdrawal requests.</p>
        {data.txs.filter(t => t.type === "SADAQAH" || t.type === "WITHDRAWAL").slice(0, 10).map(t => <div key={t.id} className="flex justify-between gap-3 text-xs"><span>{t.label || (t.type === "SADAQAH" ? "Sadaqah" : "Cash withdrawal")} · {new Date(t.created_at).toLocaleDateString("en-MY")}</span><Money amount={Number(t.amount)} /></div>)}
        {!data.txs.some(t => t.type === "SADAQAH" || t.type === "WITHDRAWAL") && <p className="text-xs">No activity yet.</p>}
        <p className="text-xs text-[var(--text-secondary)]">Ask your parent to reset your account PIN.</p>
      </details>

      {/* Card Settings Modal / Drawer */}
      {showSettings && (
        <Card variant="default" className="p-5 space-y-4 max-w-[420px] mx-auto border border-[var(--border)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--ink)]">Practice card controls</h3>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-sm font-semibold text-[var(--primary-text)] hover:underline"
              aria-label="Close card controls"
            >
              Done
            </button>
          </div>

          {isControlsLocked && (
            <div
              role="status"
              className="p-3 rounded-xl border border-[var(--border)] text-xs flex items-start gap-2 bg-[var(--surface-soft)] text-[var(--ink)]"
            >
              <AppIcon name="info" size={16} color="var(--primary)" className="shrink-0 mt-0.5" />
              <p className="m-0 font-medium leading-relaxed">
                Your parent manages these settings.
              </p>
            </div>
          )}

          <div className="space-y-4 text-xs">
            {/* Daily Spending Limit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="daily-limit-slider" className="block font-bold text-[var(--ink)]">
                    Daily Spending Limit
                  </label>
                  <span className="text-[var(--text-secondary)] text-[11px] block mt-0.5">
                    Daily cap for sadaqah and cash requests.
                  </span>
                </div>
                <strong className="text-sm text-[var(--primary-text)] tabular-nums font-bold">
                  {formatRM(dailyLimit)} {/* privacy-ok: limit */}
                </strong>
              </div>
              <input
                id="daily-limit-slider"
                type="range"
                min={Math.min(10, sliderMax)}
                max={sliderMax}
                step={10}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                aria-label="Daily spending limit"
                className="w-full accent-[var(--primary)]"
              />
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={
                    savingLimit ||
                    dailyLimit ===
                      (data?.kid?.card_daily_limit != null
                        ? Number(data.kid.card_daily_limit)
                        : 50)
                  }
                  loading={savingLimit}
                  onClick={saveDailyLimit}
                >
                  Save limit
                </Button>
              </div>
            </div>

            {/* Online Purchases */}
            <div className="pt-3 border-t border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label htmlFor="online-purchases-toggle" className="block font-bold text-[var(--ink)]">
                    Online Purchases
                  </label>
                  <span className="text-[var(--text-secondary)] text-[11px] block mt-0.5">
                    Practice setting only. Your parent sees this.
                  </span>
                </div>
                <input
                  id="online-purchases-toggle"
                  type="checkbox"
                  role="switch"
                  aria-label="Online Purchases"
                  checked={onlineEnabled}
                  disabled={isControlsLocked && !parentOnline}
                  onChange={(e) => setOnlineEnabled(e.target.checked)}
                  className="toggle-switch accent-[var(--primary)] shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={
                    savingOnline ||
                    onlineEnabled ===
                      (data?.kid?.card_online_enabled !== undefined
                        ? Boolean(data.kid.card_online_enabled)
                        : true)
                  }
                  loading={savingOnline}
                  onClick={saveOnlineEnabled}
                >
                  Save setting
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <PracticeCardHelp />
    </div>
  );
}
