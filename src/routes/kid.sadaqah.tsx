import { SADAQAH_HADITH } from "@/content/lessons";
import { getMalaysiaSeason, malaysiaDateIso } from "@/content/ramadan";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme";
import { getKidCopy } from "@/lib/i18n";
import { LessonCard } from "@/components/LessonCard";
import { Term } from "@/components/ui/Term";
import { SpeakButton } from "@/components/ui/SpeakButton";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Money } from "@/features/privacy";
import { ZakatSection } from "@/features/zakat";

export const Route = createFileRoute("/kid/sadaqah")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => {
    return {
      tab: typeof search.tab === "string" ? search.tab : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Sadaqah & Zakat | Centsibility" }] }),
  component: KidSadaqah,
});

interface Cause {
  name: string;
  icon: string;
  impact: string;
}

const CAUSES: Cause[] = [
  {
    name: "Local Masjid",
    icon: "mosque",
    impact: "Helps community electricity & care",
  },
  {
    name: "Orphan Relief",
    icon: "baby",
    impact: "Provides wholesome hot meals",
  },
  {
    name: "Clean Water Wells",
    icon: "water",
    impact: "Brings fresh clean water to families",
  },
];

function KidSadaqah() {
  const { data, loading, error, refresh } = useKidData();
  const { busy, run } = useMoneyAction();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const activeTab = search.tab === "zakat" ? "zakat" : "sadaqah";

  const [selectedCause, setSelectedCause] = useState<string | null>(null);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    amount: number;
    cause: string;
  } | null>(null);
  const { seasonPreview, reduced, lang } = useTheme();
  const copy = getKidCopy(lang, data?.ageGroup ?? "10-12");
  const season = getMalaysiaSeason(new Date(), seasonPreview);
  const [rayaOpen, setRayaOpen] = useState(false);

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
        success: () =>
          `${formatRM(pendingAmount)} pledged to ${selectedCause}.`, // privacy-ok: toast
        failure: "Sadaqah didn't go through",
        onSuccess: () => {
          setSuccessInfo({
            amount: pendingAmount,
            cause: selectedCause,
          });
          setPendingAmount(null);
          setModalError(null);
        },
        onError: (err) => {
          setModalError(sanitizeDisplayText(err.message));
        },
        refresh,
      },
    );
  };

  const givingDays = new Set(
    (data?.txs ?? [])
      .filter((t) => t.type === "SADAQAH")
      .map((t) => malaysiaDateIso(new Date(t.created_at))),
  ).size;

  const handleGiveAgain = () => {
    setSuccessInfo(null);
    setSelectedCause(null);
    setPendingAmount(null);
    setModalError(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Tabs: Sadaqah | Zakat */}
      <div
        role="tablist"
        aria-label="Sadaqah and Zakat options"
        className="tab-pills-container"
      >
        <button
          type="button"
          role="tab"
          id="tab-sadaqah"
          aria-selected={activeTab === "sadaqah"}
          aria-controls="tabpanel-sadaqah"
          tabIndex={activeTab === "sadaqah" ? 0 : -1}
          onClick={() =>
            navigate({ to: "/kid/sadaqah", search: { tab: undefined } })
          }
          onKeyDown={(e) => {
            if (e.key === "ArrowRight")
              navigate({ to: "/kid/sadaqah", search: { tab: "zakat" } });
          }}
          className="tab-pill"
        >
          Sadaqah
        </button>
        <button
          type="button"
          role="tab"
          id="tab-zakat"
          aria-selected={activeTab === "zakat"}
          aria-controls="tabpanel-zakat"
          tabIndex={activeTab === "zakat" ? 0 : -1}
          onClick={() =>
            navigate({ to: "/kid/sadaqah", search: { tab: "zakat" } })
          }
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft")
              navigate({ to: "/kid/sadaqah", search: { tab: undefined } });
          }}
          className="tab-pill"
        >
          Zakat
        </button>
      </div>

      {activeTab === "zakat" ? (
        <div role="tabpanel" id="tabpanel-zakat" aria-labelledby="tab-zakat">
          <ZakatSection />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="tabpanel-sadaqah"
          aria-labelledby="tab-sadaqah"
          className="space-y-6"
        >
          <section
            className="deposit-hero"
            aria-label="Sadaqah contributions this year"
          >
            <div className="deposit-hero__copy">
              <p className="deposit-hero__label">{copy.sadaqahHeroLabel}</p>
              <p className="deposit-hero__amount tabular-nums">
                <Money amount={sadaqahTotal} />
              </p>
              <p
                className="deposit-hero__link flex items-center gap-1.5"
                style={{ cursor: "default", textDecoration: "none" }}
              >
                <span>{copy.wallet}</span>
                <Money amount={balance} />
                <span>· {copy.giveAnytime}</span>
              </p>
            </div>
            <div className="deposit-hero__mascot" aria-hidden="true">
              <AppIcon name="sadaqah" size={32} color="#fff" />
            </div>
          </section>

          <div className="px-2 text-center space-y-2">
            <p className="text-base font-semibold leading-snug text-[var(--ink)] m-0">
              &ldquo;{SADAQAH_HADITH.text}&rdquo;
            </p>
            <p className="text-xs font-semibold text-[var(--text-2)] mt-1 mb-0">
              {SADAQAH_HADITH.source} · <Term termKey="sadaqah" />
            </p>
            <SpeakButton
              text={`${SADAQAH_HADITH.text} ${SADAQAH_HADITH.source}. This is practice money. Ask your parent to pass it on.`}
            />
          </div>

          {season.mode !== "none" && (
            <section
              aria-label={season.mode === "raya" ? "Raya mode" : "Ramadan mode"}
              className="rounded-3xl bg-[#101629] p-5 text-[#F6E7A8] space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-base font-bold text-white">
                  {season.mode === "raya" ? "Hari Raya" : "Ramadan"}
                </span>
                <span className="rounded-full bg-[#1B2447] px-3 py-1 text-xs font-bold text-[#F6E7A8]">
                  {season.mode === "raya"
                    ? `Syawal Day ${season.syawalDay}`
                    : `Day ${season.ramadanDay} of 30`}
                </span>
              </div>

              <div className="rounded-2xl bg-[#1B2447] p-4 text-center space-y-3">
                <div className="mx-auto relative h-14 w-14 overflow-hidden rounded-full bg-[#101629]">
                  <motion.div
                    initial={reduced ? false : { x: -28 }}
                    animate={{ x: Math.round(-28 + (season.ramadanDay / 30) * 28) }}
                    transition={reduced ? { duration: 0.12 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    className="h-14 w-14 rounded-full bg-[#F6E7A8]"
                  />
                </div>
                <p className="text-xs text-white/85">
                  A little each day. One lamp lights for every day you give (no points in Ramadan mode).
                </p>
                <div
                  className="mx-auto grid max-w-[260px] grid-cols-10 gap-1.5"
                  aria-label={`${Math.min(30, givingDays)} pelita lamps lit`}
                >
                  {Array.from({ length: 30 }).map((_, idx) => {
                    const lit = idx < Math.max(givingDays, season.mode === "ramadan" ? 1 : 0);
                    return (
                      <span
                        key={idx}
                        className={`h-4 w-4 rounded-full ${
                          lit ? "bg-[#F6E7A8] shadow-[0_0_8px_#F6E7A8]" : "bg-[#2A3558]"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {season.mode === "raya" && (
                <div className="rounded-2xl bg-[#1B2447] p-4 text-center space-y-3">
                  <button
                    type="button"
                    onClick={() => setRayaOpen((v) => !v)}
                    className="min-h-[44px] rounded-xl bg-[#0E7A4E] px-4 py-2 text-xs font-bold text-white"
                  >
                    {rayaOpen ? "Close Raya packet" : "Open Raya packet"}
                  </button>
                  <div className="mx-auto max-w-[220px] overflow-hidden rounded-2xl bg-[#0E7A4E] p-4 text-white">
                    <motion.div
                      animate={
                        rayaOpen
                          ? reduced
                            ? { opacity: 1 }
                            : { rotateX: 160 }
                          : { rotateX: 0 }
                      }
                      transition={reduced ? { duration: 0.12 } : { type: "spring", stiffness: 195, damping: 20.1 }}
                      className="mx-auto mb-2 h-6 w-24 rounded-t-xl bg-[#169B65]"
                    />
                    {rayaOpen && (
                      <motion.div
                        initial={reduced ? { opacity: 0 } : { y: 46, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={reduced ? { duration: 0.12 } : { duration: 0.4, ease: "easeOut" }}
                        className="rounded-xl bg-[#F6E7A8] px-3 py-2 text-xs font-extrabold text-[#262101]"
                      >
                        Duit raya from {data.parent?.display_name || "Parent"}
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-white/75">
                {season.sightingNote}
              </p>
            </section>
          )}

          <div className="promo-banner promo-banner--aqua">
            <div className="max-w-[70%]">
              <h2 className="text-base font-bold text-[var(--ink)] leading-snug m-0">
                {copy.sadaqahBannerTitle}
              </h2>
              <p className="text-sm text-[var(--text-2)] mt-1 mb-0">{copy.sadaqahBannerBody}</p>
            </div>
            <div className="w-14 h-14 rounded-full bg-[var(--ink)]/10 flex items-center justify-center text-[var(--ink)] shrink-0">
              <AppIcon name="heart" size={28} />
            </div>
          </div>

          {/* Donation Form Card OR Success State */}
          {successInfo ? (
            <div className="space-y-4">
              <SuccessState
                title={`${formatRM(successInfo.amount)} pledged to ${successInfo.cause}`} // privacy-ok: toast
                detail="Ask your parent to pass on the pledge."
                buttonText="Pledge again"
                onAction={handleGiveAgain}
              />
              <LessonCard kind="sadaqah" />
            </div>
          ) : (
            <Card
              variant="default"
              className="p-5 sm:p-6 space-y-4 border border-[var(--border)]"
            >
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pb-2 border-b border-[var(--border)]">
                <span>Available Wallet Balance</span>
                <strong className="text-sm text-[var(--ink)] tabular-nums">
                  <Money amount={balance} />
                </strong>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--ink)] block mb-2">
                  Choose a cause
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
                        className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border text-center cursor-pointer transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--primary)] ${
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--surface-pink)] ring-2 ring-[var(--primary)]/20 shadow-xs"
                            : "border-[var(--border)] bg-[var(--surface-soft)] hover:border-[var(--primary-soft)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="sadaqah-cause"
                          value={c.name}
                          aria-label={c.name}
                          checked={isSelected}
                          onChange={() => {
                            setSelectedCause(c.name);
                            setModalError(null);
                          }}
                          className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
        </div>
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
              {busy
                ? "Pledging…"
                : `Confirm & Donate ${formatRM(pendingAmount ?? 0 /* privacy-ok: typing */)}`}
            </Button>
          </div>
        }
      >
        <div className="text-center py-3 space-y-2.5">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center mx-auto shadow-xs">
            <AppIcon name="heart" size={28} />
          </div>
          <p className="text-sm text-[var(--ink)]">
            Pledge{" "}
            <strong className="text-base text-[var(--primary-text)] font-extrabold tabular-nums">
              {formatRM(pendingAmount ?? 0 /* privacy-ok: typing */)}
            </strong>{" "}
            to{" "}
            <strong className="font-bold text-[var(--ink)]">
              {selectedCause}
            </strong>{" "}
            as Sadaqah?
          </p>
          <p className="text-xs text-[var(--text-secondary)]">This leaves your active wallet balance.</p>
          {modalError && (
            <div className="p-2.5 rounded-lg bg-[var(--surface)] text-[var(--error-text)] text-xs font-semibold text-center border border-[var(--error)]">
              {modalError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
