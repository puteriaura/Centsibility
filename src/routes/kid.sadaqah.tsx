import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import { edgeKidSadaqah } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { AppIcon } from "@/components/ui/app-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState } from "react";
import { formatRM } from "@/lib/format";

export const Route = createFileRoute("/kid/sadaqah")({
  head: () => ({ meta: [{ title: "Sadaqah — Centsibility" }] }),
  component: KidSadaqah,
});

function KidSadaqah() {
  const { data, loading, error, refresh } = useKidData();
  const [given, setGiven] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);

  const causes = [
    { name: "Local Masjid", icon: "mosque", impact: "Helps community electricity & care" },
    { name: "Orphan Relief", icon: "baby", impact: "Provides wholesome hot meals" },
    { name: "Clean Water Wells", icon: "water", impact: "Brings fresh clean water to families" },
  ];

  if (!data && error) return <KidLoadError onRetry={refresh} />;
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "10rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const balance = Number(data.kid.balance);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const sadaqahTotal = (data.txs ?? []).reduce(
    (sum: number, t: (typeof data.txs)[number]) =>
      t.type === "SADAQAH" && new Date(t.created_at) >= yearStart
        ? sum + Number(t.amount)
        : sum,
    0,
  );

  const give = async (amount: number) => {
    if (amount > balance) return;
    const code = getKidSession()?.code;
    if (!code) return;
    try {
      await edgeKidSadaqah({ code, amount });
      setGiven(true);
      setPendingAmount(null);
      setTimeout(() => setGiven(false), 3000);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <section className="deposit-hero" aria-label="Sadaqah contributions this year">
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">Given this year</p>
          <p className="deposit-hero__amount tabular-nums">{formatRM(sadaqahTotal)}</p>
          <p className="deposit-hero__link" style={{ cursor: "default", textDecoration: "none" }}>
            Wallet {formatRM(balance)} · Give anytime
          </p>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="sadaqah" size={32} color="#fff" />
        </div>
      </section>

      <div className="p-3 rounded-xl bg-[var(--surface-pink)] border border-[var(--primary-soft)] text-center">
        <p className="text-sm font-bold text-[var(--primary-text)] m-0">
          &ldquo;Charity extinguishes sins just as water extinguishes fire.&rdquo;
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-0">— Hadith</p>
      </div>

      <div className="promo-banner promo-banner--aqua">
        <div className="max-w-[70%]">
          <h2 className="text-sm sm:text-base font-extrabold text-[var(--ink)] leading-snug m-0">
            Give sadaqah and earn stardust — start with RM1
          </h2>
          <p className="text-xs text-[var(--ink)]/80 mt-1 mb-0">
            Your kindness reaches local masjids, orphans, and clean water projects.
          </p>
        </div>
        <div className="w-14 h-14 rounded-full bg-[var(--ink)]/10 flex items-center justify-center text-[var(--ink)] shrink-0">
          <AppIcon name="heart" size={28} />
        </div>
      </div>

      {/* Donation Form Card */}
      <Card variant="default" className="p-5 sm:p-6 space-y-4 border border-[var(--border)]">
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pb-2 border-b border-[var(--border)]">
          <span>Available Wallet Balance</span>
          <strong className="text-sm text-[var(--ink)] tabular-nums">{formatRM(balance)}</strong>
        </div>

        {/* Causes Grid — Common Region / Similarity */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="list" aria-label="Sadaqah causes">
          {causes.map((c) => (
            <div
              key={c.name}
              role="listitem"
              className="p-3 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] text-center space-y-1"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center mx-auto">
                <AppIcon name={c.icon} size={16} />
              </div>
              <strong className="text-xs font-bold text-[var(--ink)] block">{c.name}</strong>
              <small className="text-[10px] text-[var(--text-muted)] block leading-tight">{c.impact}</small>
            </div>
          ))}
        </div>

        <MoneyKeypad
          min={0.5}
          max={balance}
          confirmLabel="Donate Sadaqah"
          onConfirm={(amt) => setPendingAmount(amt)}
        />

        {given && (
          <div
            className="p-4 rounded-xl bg-[var(--success-soft)] text-[var(--success-text)] text-xs font-bold flex items-center gap-2 border border-[var(--success)]/20"
            role="status"
          >
            <AppIcon name="approve" size={18} />
            <span>Jazakallah khair! May Allah bless your kindness and generosity.</span>
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={pendingAmount !== null}
        onClose={() => setPendingAmount(null)}
        title="Confirm Sadaqah Donation"
        description="Share blessings from your digital savings with those in need."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setPendingAmount(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pendingAmount !== null) give(pendingAmount);
              }}
            >
              Confirm & Donate {formatRM(pendingAmount ?? 0)}
            </Button>
          </div>
        }
      >
        <div className="text-center py-4 space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center mx-auto shadow-xs">
            <AppIcon name="heart" size={28} />
          </div>
          <p className="text-sm text-[var(--ink)]">
            Are you sure you want to give{" "}
            <strong className="text-base text-[var(--primary-text)] font-extrabold tabular-nums">
              {formatRM(pendingAmount ?? 0)}
            </strong>{" "}
            as Sadaqah?
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            This amount will be deducted from your active wallet balance.
          </p>
        </div>
      </Modal>
    </div>
  );
}
