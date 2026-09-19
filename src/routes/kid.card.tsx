import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useKidData } from "@/hooks/use-kid-data";
import { AppIcon } from "@/components/ui/app-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";

export const Route = createFileRoute("/kid/card")({
  head: () => ({ meta: [{ title: "Debit Card-i — Centsibility" }] }),
  component: KidCard,
});

function KidCard() {
  const { data, loading } = useKidData();
  const [showDetails, setShowDetails] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [onlineEnabled, setOnlineEnabled] = useState(true);

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

  const toggleLock = () => {
    sfx.pop();
    setIsLocked(!isLocked);
    toast.success(isLocked ? "Debit Card-i unlocked!" : "Debit Card-i temporarily locked");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Benchmark Image 1: Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--ink)]">Debit Card-i</h1>
        <button
          type="button"
          onClick={() => {
            sfx.tap();
            toast("Customer Care: Card support available 24/7.");
          }}
          className="p-2 rounded-full hover:bg-[var(--surface-soft)] text-[var(--ink)] transition-colors"
          aria-label="Card support chat"
        >
          <AppIcon name="messagecircle" size={22} />
        </button>
      </div>

      {/* Benchmark Image 1: Deep Blue Physical Debit Card */}
      <div
        className="relative rounded-3xl p-6 text-white shadow-xl overflow-hidden transition-all"
        style={{
          background: isLocked ? "#4A5568" : "var(--navy-dark)",
          aspectRatio: "1.586",
          maxWidth: "420px",
          margin: "0 auto",
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

          <div className="flex items-center gap-4 tabular-nums text-white/90">
            <div>
              <span className="text-[11px] block opacity-75">CVV</span>
              <strong>{showDetails ? "428" : "•••"}</strong>
            </div>
            <div>
              <span className="text-[11px] block opacity-75">EXP</span>
              <strong>10/29</strong>
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

        {/* Bottom: Name + MyDebit / VISA logos */}
        <div className="flex items-end justify-between relative z-10 text-xs font-bold">
          <div>
            <span className="text-[11px] uppercase tracking-wider block opacity-75 font-normal">
              Cardholder
            </span>
            <span className="text-sm font-semibold tracking-wide">
              {k.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-black tracking-wider uppercase text-white/90">
              MyDebit
            </span>
            <span className="text-base font-black italic tracking-tighter text-white">
              VISA
            </span>
          </div>
        </div>

        {/* Locked Overlay */}
        {isLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-20" style={{ background: "rgba(17, 17, 17, 0.72)" }}>
            <AppIcon name="lock" size={36} color="#fff" />
            <strong className="text-sm font-bold text-white uppercase tracking-wider">
              Card Locked
            </strong>
          </div>
        )}
      </div>

      {/* Benchmark Image 1: 4 Circular Actions (View details, Settings, Lock, Report) */}
      <div className="grid grid-cols-4 gap-2 max-w-[420px] mx-auto text-center">
        <button
          type="button"
          onClick={() => {
            sfx.tap();
            setShowDetails(!showDetails);
          }}
          className="aeon-quick-btn"
        >
          <span className="aeon-quick-circle">
            <AppIcon name={showDetails ? "hide" : "show"} size={22} />
          </span>
          <span className="aeon-quick-label">{showDetails ? "Hide details" : "View details"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.tap();
            setShowSettings(!showSettings);
          }}
          className="aeon-quick-btn"
        >
          <span className="aeon-quick-circle">
            <AppIcon name="settings" size={22} />
          </span>
          <span className="aeon-quick-label">Settings</span>
        </button>

        <button
          type="button"
          onClick={toggleLock}
          className="aeon-quick-btn"
        >
          <span className="aeon-quick-circle" style={isLocked ? { borderColor: "var(--error)", color: "var(--error)" } : undefined}>
            <AppIcon name="lock" size={22} />
          </span>
          <span className="aeon-quick-label">{isLocked ? "Unlock" : "Lock"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            sfx.tap();
            toast.error("Card replacement request sent to branch.");
          }}
          className="aeon-quick-btn"
        >
          <span className="aeon-quick-circle">
            <AppIcon name="recall" size={22} />
          </span>
          <span className="aeon-quick-label">Report</span>
        </button>
      </div>

      {/* Card Settings Modal / Drawer */}
      {showSettings && (
        <Card variant="default" className="p-5 space-y-4 max-w-[420px] mx-auto border border-[var(--border)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--ink)]">Card Security Controls</h3>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--ink)]"
            >
              Done
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <strong className="block text-[var(--ink)]">Daily Spending Limit</strong>
                <span className="text-[var(--text-muted)]">Max contactless & store spend</span>
              </div>
              <strong className="text-sm text-[var(--primary)] tabular-nums">RM {dailyLimit}</strong>
            </div>
            <input
              type="range"
              min={10}
              max={200}
              step={10}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
              <div>
                <strong className="block text-[var(--ink)]">Online Purchases</strong>
                <span className="text-[var(--text-muted)]">Allow e-commerce transactions</span>
              </div>
              <input
                type="checkbox"
                checked={onlineEnabled}
                onChange={(e) => setOnlineEnabled(e.target.checked)}
                className="toggle-switch accent-[var(--primary)]"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Benchmark Image 1: Section Header TAP & SAVE */}
      <div className="max-w-[420px] mx-auto">
        <div className="aeon-section-tag">
          <span>TAP & SAVE</span>
        </div>

        {/* Benchmark Image 1: Amber Banner (RM0 card issuance fee) */}
        <div className="aeon-banner aeon-banner--amber">
          <div className="max-w-[70%]">
            <h3 className="text-sm sm:text-base font-extrabold text-[var(--ink)] leading-snug">
              RM0 card issuance fee
            </h3>
            <button
              type="button"
              onClick={() => {
                sfx.pop();
                toast.success("Free Visa debit card waiver active for all accounts!");
              }}
              className="aeon-banner__pill-btn"
            >
              View more
            </button>
          </div>
          <div className="w-14 h-14 rounded-full bg-[var(--ink)]/10 flex items-center justify-center text-[var(--ink)] shrink-0 shadow-inner">
            <AppIcon name="creditcard" size={28} />
          </div>
        </div>

        {/* Carousel Dots */}
        <div className="aeon-dots" aria-hidden="true">
          <span className="aeon-dot-active" />
          <span className="aeon-dot-inactive" />
        </div>
      </div>
    </div>
  );
}
