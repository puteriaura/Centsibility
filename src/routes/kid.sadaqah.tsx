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
import { SuccessState } from "@/components/SuccessState";
import { useMoneyAction } from "@/hooks/use-money-action";
import { useState } from "react";
import { formatRM } from "@/lib/format";
import { sanitizeDisplayText } from "@/lib/labels";

export const Route = createFileRoute("/kid/sadaqah")({
  head: () => ({ meta: [{ title: "Sadaqah — Centsibility" }] }),
  component: KidSadaqah,
});

interface Cause {
  name: string;
  icon: string;
  impact: string;
}

const CAUSES: Cause[] = [
  { name: "Local Masjid", icon: "mosque", impact: "Helps community electricity & care" },
  { name: "Orphan Relief", icon: "baby", impact: "Provides wholesome hot meals" },
  { name: "Clean Water Wells", icon: "water", impact: "Brings fresh clean water to families" },
];

function KidSadaqah() {
  const { data, loading, error, refresh } = useKidData();
  const { busy, run } = useMoneyAction();

  const [selectedCause, setSelectedCause] = useState<string | null>(null);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    amount: number;
    cause: string;
    points: number;
  } | null>(null);

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

  const handleConfirmGive = async () => {
    if (!pendingAmount || !selectedCause) return;
    const code = getKidSession()?.code;
    if (!code) return;

    setModalError(null);

    await run(
      () =>
        edgeKidSadaqah({
          code,
          amount: pendingAmount,
          cause: selectedCause,
        }),
      {
        success: (res) =>
          `${formatRM(pendingAmount)} given to ${selectedCause}. +${res.coins_awarded ?? Math.floor(pendingAmount * 2)} points`,
        failure: "Sadaqah didn't go through",
        onSuccess: (res) => {
          setSuccessInfo({
            amount: pendingAmount,
            cause: selectedCause,
            points: res.coins_awarded ?? Math.floor(pendingAmount * 2),
          });
          setPendingAmount(null);
          setModalError(null);
        },
        onError: (err) => {
          setModalError(sanitizeDisplayText(err.message));
        },
        refresh,
      }
    );
  };

  const handleGiveAgain = () => {
    setSuccessInfo(null);
    setSelectedCause(null);
    setPendingAmount(null);
    setModalError(null);
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
            Give sadaqah and earn reward points - start with RM1
          </h2>
          <p className="text-xs text-[var(--ink)]/80 mt-1 mb-0">
            Your kindness reaches local masjids, orphans, and clean water projects.
          </p>
        </div>
        <div className="w-14 h-14 rounded-full bg-[var(--ink)]/10 flex items-center justify-center text-[var(--ink)] shrink-0">
          <AppIcon name="heart" size={28} />
        </div>
      </div>

      {/* Donation Form Card OR Success State */}
      {successInfo ? (
        <SuccessState
          title={`${formatRM(successInfo.amount)} given to ${successInfo.cause}`}
          detail={`+${successInfo.points} points · Jazakallah khair!`}
          buttonText="Give again"
          onAction={handleGiveAgain}
        />
      ) : (
        <Card variant="default" className="p-5 sm:p-6 space-y-4 border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pb-2 border-b border-[var(--border)]">
            <span>Available Wallet Balance</span>
            <strong className="text-sm text-[var(--ink)] tabular-nums">{formatRM(balance)}</strong>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider block mb-2">
              Choose a Cause
            </label>
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
              role="radiogroup"
              aria-label="Sadaqah causes"
            >
              {CAUSES.map((c) => {
                const isSelected = selectedCause === c.name;
                return (
                  <label
                    key={c.name}
                    className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border text-center cursor-pointer transition-all ${
                      isSelected
                        ? "border-[var(--primary)] bg-[var(--surface-pink)] ring-2 ring-[var(--primary)]/20 shadow-xs"
                        : "border-[var(--border)] bg-[var(--surface-soft)] hover:border-[var(--primary-soft)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sadaqah-cause"
                      value={c.name}
                      checked={isSelected}
                      onChange={() => {
                        setSelectedCause(c.name);
                        setModalError(null);
                      }}
                      className="sr-only"
                    />
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-1.5 transition-colors ${
                        isSelected
                          ? "bg-[var(--primary)] text-white"
                          : "bg-[var(--surface)] text-[var(--primary-text)] border border-[var(--border)]"
                      }`}
                    >
                      <AppIcon name={c.icon} size={18} />
                    </div>
                    <strong className="text-xs font-bold text-[var(--ink)] block">
                      {c.name}
                    </strong>
                    <small className="text-[11px] text-[var(--text-muted)] block leading-tight mt-0.5">
                      {c.impact}
                    </small>
                  </label>
                );
              })}
            </div>
          </div>

          <MoneyKeypad
            min={0.5}
            max={balance}
            busy={busy}
            confirmDisabled={!selectedCause}
            disabledHint="Pick a cause first"
            confirmLabel="Donate Sadaqah"
            onConfirm={(amt) => {
              setPendingAmount(amt);
              setModalError(null);
            }}
          />
        </Card>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={pendingAmount !== null}
        onClose={() => {
          if (!busy) {
            setPendingAmount(null);
            setModalError(null);
          }
        }}
        title="Confirm Sadaqah Donation"
        description="Share blessings from your digital savings with those in need."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setPendingAmount(null);
                setModalError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              loading={busy}
              onClick={handleConfirmGive}
            >
              {busy ? "Giving…" : `Confirm & Donate ${formatRM(pendingAmount ?? 0)}`}
            </Button>
          </div>
        }
      >
        <div className="text-center py-3 space-y-2.5">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center mx-auto shadow-xs">
            <AppIcon name="heart" size={28} />
          </div>
          <p className="text-sm text-[var(--ink)]">
            Are you sure you want to give{" "}
            <strong className="text-base text-[var(--primary-text)] font-extrabold tabular-nums">
              {formatRM(pendingAmount ?? 0)}
            </strong>{" "}
            to <strong className="font-bold text-[var(--ink)]">{selectedCause}</strong> as Sadaqah?
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            This amount will be deducted from your active wallet balance.
          </p>
          {modalError && (
            <div className="p-2.5 rounded-lg bg-white text-[var(--error-text)] text-xs font-semibold text-center border border-[var(--error)]">
              {modalError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
