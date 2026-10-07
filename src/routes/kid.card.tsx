// The card face uses embossed-style capitals like a real debit card.
// avoid-ai-design-ignore-file: SD4
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { usePenny } from "@/features/penny";
import { PrivacyUnlockSheet } from "@/features/privacy/PrivacyUnlockSheet";
import { Money } from "@/features/privacy";

export const Route = createFileRoute("/kid/card")({
  head: () => ({ meta: [{ title: "Practice Card | Centsibility" }] }),
  component: KidCard,
});

function KidCard() {
  const { openPenny } = usePenny();
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
  const parentOnline = k.card_online_enabled !== undefined ? Boolean(k.card_online_enabled) : true;

  const toggleLock = async () => {
    if (savingFreeze) return;
    sfx.pop();
    if (isControlsLocked && isLocked) {
      toast.error("Your parent manages these card settings. You can still make them stricter.");
      return;
    }
    const prevLocked = isLocked;
    const nextLocked = !prevLocked;
    setIsLocked(nextLocked);

    const code = getKidSession()?.code;
    if (!code) {
      setIsLocked(prevLocked);
      toast.error("Session missing. Log in again to change card controls.");
      return;
    }

    setSavingFreeze(true);
    try {
      await edgeKidSetCardControls({ code, frozen: nextLocked });
      toast.success(
        nextLocked
          ? "Card frozen. Sadaqah and cash withdrawal requests are blocked until you unfreeze it."
          : "Card unfrozen",
      );
      refresh();
    } catch (e: unknown) {
      setIsLocked(prevLocked);
      toast.error(e instanceof Error ? e.message : "Failed to update card status");
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

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between gap-3 -mt-2">
        <p className="text-xs font-semibold text-[var(--text-secondary)] m-0">
          Practice card for learning. It is not a real bank card.
        </p>
        <button
          type="button"
          onClick={() => {
            sfx.tap();
            openPenny({ context: { page: "Card", detail: "Kid practice card controls" } });
          }}
          className="p-2 rounded-full hover:bg-[var(--surface-soft)] text-[var(--ink)] transition-colors shrink-0 bg-transparent border-none cursor-pointer"
          aria-label="Ask Penny about cards"
        >
          <AppIcon name="messagecircle" size={22} />
        </button>
      </div>

      {isLocked && (
        <div
          role="status"
          className="p-3.5 rounded-xl border border-[var(--error)]/30 text-xs flex items-start gap-2.5 max-w-[420px] mx-auto bg-[var(--error-soft)] text-[var(--ink)]"
        >
          <AppIcon name="info" size={18} color="var(--error-strong)" className="shrink-0 mt-0.5" />
          <p className="m-0 leading-relaxed font-medium">
            Card frozen. Sadaqah and cash withdrawal requests are blocked until you unfreeze it.
          </p>
        </div>
      )}

      <div
        className="relative rounded-3xl p-6 text-white shadow-xl transition-all flex flex-col justify-between"
        style={{
          background: isLocked ? "var(--text-secondary)" : "var(--navy-dark)",
          // No overflow clipping, so on narrow phones the card grows to fit its
          // content instead of cutting off the cardholder row.
          aspectRatio: "1.586",
          maxWidth: "420px",
          // Inline-only margin keeps the space-y gap below the card.
          marginInline: "auto",
        }}
      >
        {/* Top: brand + CVV/EXP */}
        <div className="flex items-center justify-between relative z-10 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]" />
            </span>
            <span className="text-sm font-black tracking-wider uppercase">Centsibility</span>
          </div>

          <div className="flex items-center gap-4 tabular-nums text-white">
            <div>
              <span className="text-[11px] block">CVV</span>
              <strong className="text-white">{showDetails ? "428" : "•••"}</strong>
            </div>
            <div>
              <span className="text-[11px] block">EXP</span>
              <strong className="text-white">10/29</strong>
            </div>
          </div>
        </div>

        {/* Mascot Center Graphic */}
        <div className="my-auto py-4 text-center relative z-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-2">
            <AppIcon name="penny" size={28} color="#fff" />
          </div>

          {/* Card Number */}
          <div className="text-xl sm:text-2xl font-mono tracking-widest font-bold tabular-nums">
            {showDetails ? "4556  7812  9034  6553" : "••••  ••••  ••••  6553"}
          </div>
        </div>

        {/* Bottom: cardholder and card type (no third-party card network marks) */}
        <div className="flex items-end justify-between relative z-10 text-xs font-bold">
          <div>
            <span className="text-[11px] uppercase tracking-wider block font-normal">
              Cardholder
            </span>
            <span className="text-sm font-semibold tracking-wide">
              {k.name}
            </span>
          </div>

          <span className="text-[11px] font-bold tracking-wider uppercase text-white">
            Practice only
          </span>
        </div>

        {/* Locked Overlay */}
        {isLocked && (
          <div className="absolute inset-0 rounded-[inherit] flex flex-col items-center justify-center gap-2 z-20" style={{ background: "rgba(17, 17, 17, 0.72)" }}>
            <AppIcon name="lock" size={36} color="#fff" />
            <strong className="text-sm font-bold text-white uppercase tracking-wider">
              Card Frozen
            </strong>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 max-w-[420px] mx-auto text-center">
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
          onClick={toggleLock}
          disabled={savingFreeze || (isControlsLocked && isLocked)}
          aria-label={
            isLocked
              ? isControlsLocked
                ? "Card frozen (managed by parent)"
                : "Unfreeze card (currently frozen)"
              : "Freeze card"
          }
          aria-pressed={isLocked}
          className={`quick-btn ${isControlsLocked && isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <span
            className="quick-circle"
            style={
              isLocked
                ? { background: "var(--error-soft)", color: "var(--error-text)" }
                : undefined
            }
          >
            <AppIcon name="lock" size={22} />
          </span>
          <span
            className="quick-label"
            style={isLocked ? { color: "var(--error-text)", fontWeight: 700 } : undefined}
          >
            {isLocked ? "Unfreeze" : "Freeze"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.tap();
            toast.info("Practice card, so no report is sent. If a real card is lost, tell your parent.");
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
      <PrivacyUnlockSheet isOpen={revealPinOpen} onClose={() => setRevealPinOpen(false)} onSuccess={() => { setRevealPinOpen(false); setShowDetails(true); }} mode="kid" title="View sample details" description="Verify your account PIN to reveal the sample card number. This number cannot make payments." />
      <Card className="p-4 space-y-2 max-w-[420px] mx-auto">
        <h2 className="text-sm font-bold">Activity covered by these controls</h2>
        <p className="text-xs text-[var(--text-secondary)]">Sadaqah and cash withdrawal requests use these limits. These are account activities; there are no bank-card payments.</p>
        {data.txs.filter(t => t.type === "SADAQAH" || t.type === "WITHDRAWAL").slice(0, 10).map(t => <div key={t.id} className="flex justify-between gap-3 text-xs"><span>{t.label || (t.type === "SADAQAH" ? "Sadaqah" : "Cash withdrawal")} · {new Date(t.created_at).toLocaleDateString("en-MY")}</span><Money amount={Number(t.amount)} /></div>)}
        {!data.txs.some(t => t.type === "SADAQAH" || t.type === "WITHDRAWAL") && <p className="text-xs">No activity yet.</p>}
        <p className="text-xs text-[var(--text-secondary)]">To change your account PIN, ask your parent to reset it from your profile in their app. Sample card details do not have a separate PIN.</p>
      </Card>

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
                Your parent manages these settings. You can still make them stricter.
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
                    Most you can give as sadaqah or ask to withdraw in one day.
                  </span>
                </div>
                <strong className="text-sm text-[var(--primary-text)] tabular-nums font-bold">
                  {formatRM(dailyLimit)} {/* privacy-ok: limit */}
                </strong>
              </div>
              <input
                id="daily-limit-slider"
                type="range"
                min={10}
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
                    Practice setting. There are no online payments in Centsibility yet. Your parent can see this.
                  </span>
                </div>
                <input
                  id="online-purchases-toggle"
                  type="checkbox"
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
                  variant="primary"
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

      <div className="max-w-[420px] mx-auto">
        <div className="section-tag">
          <span>Spend smart</span>
        </div>

        <div className="promo-banner promo-banner--amber">
          <div className="max-w-[70%]">
            <h3 className="text-base font-bold text-[var(--ink)] leading-snug m-0">
              Set a daily limit your parent can see
            </h3>
            <button
              type="button"
              onClick={() => {
                sfx.pop();
                setShowSettings(true);
              }}
              className="promo-banner__btn"
              aria-label="Open card settings to set daily limit"
            >
              Set limit
            </button>
          </div>
          <div className="w-16 h-16 rounded-full bg-white/60 flex items-center justify-center text-[var(--ink)] shrink-0">
            <AppIcon name="creditcard" size={30} />
          </div>
        </div>
      </div>
    </div>
  );
}
