import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import { buildSpendingSummary, buildStorySlides } from "@/lib/penny-insights";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { sfx } from "@/lib/sounds";
import { formatRM } from "@/lib/format";
import {
  isDebitTransaction,
  isWalletTransaction,
  transactionAmount,
} from "@/lib/finance";
import {
  transactionTitle,
  transactionTypeLabel,
  humanizeCode,
} from "@/lib/labels";
import { usePrivacy, Money, LogInToView, maskAmounts } from "@/features/privacy";
import { usePenny } from "@/features/penny";
import { useReducedMotion } from "framer-motion";
import { recapBackgrounds, isStoryTap } from "@/lib/recap-backgrounds";

export const Route = createFileRoute("/kid/insights")({
  head: () => ({ meta: [{ title: "Insights | Centsibility" }] }),
  component: KidInsights,
});

// Chart palette (styles.css --chart-*): distinct hues for categories only; red stays reserved for money out.
const CAT_COLORS = ["#1F4FD1", "#0F766E", "#B45309", "#6941C6", "#475467"];

function formatDateHeader(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function KidInsights() {
  const { data, loading, error, refresh } = useKidData();
  const { locked, openUnlockSheet } = usePrivacy();
  const { openPenny } = usePenny();

  // Pull-down hero touch state
  const touchStartY = useRef<number | null>(null);
  const [pullOffset, setPullOffset] = useState(0);

  // Story modal state
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyIdx, setStoryIdx] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [receiptSheetOpen, setReceiptSheetOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const pointerStartedAt = useRef<number | null>(null);

  // Dynamically compute active months (from user's earliest transaction to current month)
  const activeMonths = useMemo(() => {
    const now = new Date();
    const currentMonthStr = now.toLocaleString("en-US", { month: "short" });

    if (!data?.txs || data.txs.length === 0) {
      return [currentMonthStr];
    }

    const txDates = data.txs
      .map((t) => new Date(t.created_at).getTime())
      .filter((t) => !isNaN(t));

    const earliest = txDates.length > 0 ? new Date(Math.min(...txDates)) : now;
    const months: string[] = [];
    const cur = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);

    while (cur <= end) {
      months.push(cur.toLocaleString("en-US", { month: "short" }));
      cur.setMonth(cur.getMonth() + 1);
    }

    return months.length > 0 ? months : [currentMonthStr];
  }, [data?.txs]);

  // Selected month defaults to current/latest active month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toLocaleString("en-US", { month: "short" });
  });

  // Keep selectedMonth valid within activeMonths
  useEffect(() => {
    if (activeMonths.length > 0 && !activeMonths.includes(selectedMonth)) {
      setSelectedMonth(activeMonths[activeMonths.length - 1]);
    }
  }, [activeMonths, selectedMonth]);

  // Global 90-day summary for general metrics and stories
  const summary = useMemo(
    () =>
      buildSpendingSummary(
        (data?.txs ?? []) as Parameters<typeof buildSpendingSummary>[0],
        90,
      ),
    [data?.txs],
  );

  const slides = useMemo(
    () => buildStorySlides(summary, Number(data?.kid?.coins ?? 0)),
    [summary, data?.kid?.coins],
  );
  const backgrounds = useMemo(() => recapBackgrounds(data?.kid?.id || "guest", summary.rangeLabel), [data?.kid?.id, summary.rangeLabel]);

  // Month-filtered spending data for Monthly Expenses section (fixes May RM1.00 bug)
  const monthData = useMemo(() => {
    const txsInMonth = (data?.txs ?? []).filter((t) => {
      const d = new Date(t.created_at);
      return d.toLocaleString("en-US", { month: "short" }) === selectedMonth;
    });

    const outflowTxs = txsInMonth.filter(
      (t) =>
        isWalletTransaction(t.type) &&
        isDebitTransaction(
          t.type,
          (t as { label?: string }).label || t.description,
        ),
    );

    const totalOut = outflowTxs.reduce(
      (sum, t) => sum + Math.abs(Number(t.amount) || 0),
      0,
    );

    const catMap: Record<
      string,
      { label: string; count: number; amount: number }
    > = {};
    for (const t of outflowTxs) {
      const cat =
        t.category ||
        (t.type === "FEE"
          ? "Fees"
          : t.type === "SADAQAH"
            ? "Sadaqah"
            : "General");
      if (!catMap[cat]) catMap[cat] = { label: cat, count: 0, amount: 0 };
      catMap[cat].count += 1;
      catMap[cat].amount += Math.abs(Number(t.amount) || 0);
    }

    const topCategories = Object.values(catMap)
      .map((c) => ({
        ...c,
        key: c.label.toLowerCase(),
        pct: totalOut > 0 ? (c.amount / totalOut) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { totalOut, topCategories, txsInMonth };
  }, [data?.txs, selectedMonth]);

  // Group transactions for the receipt sheet
  const groupedPeriodTxs = useMemo(() => {
    const list = data?.txs ?? [];
    const groups: Record<string, typeof list> = {};
    for (const t of list) {
      const header = formatDateHeader(t.created_at);
      if (!groups[header]) groups[header] = [];
      groups[header].push(t);
    }
    return groups;
  }, [data?.txs]);

  // Instagram Stories auto-progress ticker
  useEffect(() => {
    if (!storyOpen || isPaused || receiptSheetOpen || reducedMotion) return;

    const interval = 50; // ms
    const step = (interval / 5000) * 100; // 5 seconds per slide

    const timer = window.setInterval(() => {
      setSlideProgress((prev) => {
        if (prev + step >= 100) {
          if (storyIdx >= slides.length - 1) {
            setStoryOpen(false);
            setStoryIdx(0);
            return 0;
          }
          setStoryIdx((i) => i + 1);
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => window.clearInterval(timer);
  }, [storyOpen, isPaused, receiptSheetOpen, storyIdx, slides.length, reducedMotion]);

  if (!data && error) return <KidLoadError onRetry={refresh} />;
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "10rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "8rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const k = data?.kid ?? { name: "Young Saver", coins: 0 };
  const goals = data?.goals ?? [];

  const openStory = () => {
    sfx.pop();
    setStoryIdx(0);
    setSlideProgress(0);
    setIsPaused(false);
    setReceiptSheetOpen(false);
    setStoryOpen(true);
  };

  const nextStory = () => {
    if (storyIdx >= slides.length - 1) {
      setStoryOpen(false);
      return;
    }
    setStoryIdx((i) => i + 1);
    setSlideProgress(0);
    sfx.tap();
  };

  const prevStory = () => {
    if (storyIdx <= 0) {
      setSlideProgress(0);
      return;
    }
    setStoryIdx((i) => i - 1);
    setSlideProgress(0);
    sfx.tap();
  };

  // Pull down touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 10) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0 && window.scrollY <= 5) {
      setPullOffset(Math.min(dy * 0.5, 75));
    }
  };

  const handleTouchEnd = () => {
    if (pullOffset > 40) {
      sfx.pop();
      openPenny({ context: { page: "Insights" } });
    }
    touchStartY.current = null;
    setPullOffset(0);
  };

  return (
    <div className="insights-page pb-12">
      {/* Assistant hero with interactive pull-down to chat */}
      <section
        className="insights-ask-hero"
        aria-label="Ask Penny"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateY(${pullOffset}px)`,
          transition:
            pullOffset === 0
              ? "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)"
              : "none",
        }}
      >
        <h2 className="insights-ask-hero__title">Hi {k.name}! Ask me about:</h2>
        <div className="insights-ask-actions">
          <button
            type="button"
            className="insights-ask-chip"
            onClick={() => {
              sfx.tap();
              openPenny({
                prompt: "I would like to know more about spending.",
                context: {
                  page: "Insights",
                  detail:
                    `${selectedMonth}; in RM${summary.moneyIn.toFixed(2)}, out RM${summary.moneyOut.toFixed(2)}${summary.topCategories[0] ? `; top category ${summary.topCategories[0].label}` : ""}`.slice(
                      0,
                      600,
                    ),
                },
              });
            }}
          >
            <AppIcon name="trend" size={16} /> Spending
          </button>
          <button
            type="button"
            className="insights-ask-chip"
            onClick={() => {
              sfx.tap();
              openPenny({
                prompt: "How can I save better?",
                context: {
                  page: "Insights",
                  detail:
                    `${selectedMonth}; in RM${summary.moneyIn.toFixed(2)}, out RM${summary.moneyOut.toFixed(2)}${summary.topCategories[0] ? `; top category ${summary.topCategories[0].label}` : ""}`.slice(
                      0,
                      600,
                    ),
                },
              });
            }}
          >
            <AppIcon name="wallet" size={16} /> Savings
          </button>
          <button
            type="button"
            className="insights-ask-chip insights-ask-chip--wide"
            onClick={() => {
              sfx.tap();
              openPenny({
                prompt: "Surprise me with a tip.",
                context: {
                  page: "Insights",
                  detail:
                    `${selectedMonth}; in RM${summary.moneyIn.toFixed(2)}, out RM${summary.moneyOut.toFixed(2)}${summary.topCategories[0] ? `; top category ${summary.topCategories[0].label}` : ""}`.slice(
                      0,
                      600,
                    ),
                },
              });
            }}
          >
            <AppIcon name="sparkles" size={16} /> Surprise me
          </button>
        </div>
        <button
          type="button"
          className="insights-ask-hint"
          onClick={() => {
            sfx.tap();
            openPenny({ context: { page: "Insights" } });
          }}
        >
          {pullOffset > 30 ? "Release to open chat" : "Pull down to chat"}
        </button>
      </section>

      <div className="insights-sheet">
        <div className="insights-sheet__handle" aria-hidden="true" />

        <div className="section-tag">
          <span>MONTHLY CASHFLOW</span>
        </div>
        <div className="insights-cashflow">
          <Card
            variant="default"
            className="insights-cashflow__card p-4 m-0"
            onClick={locked ? openUnlockSheet : undefined}
            style={locked ? { cursor: "pointer" } : undefined}
          >
            <span className="text-xs text-[var(--text-muted)]">Money in</span>
            {locked ? (
              <LogInToView className="mt-1" />
            ) : (
              <strong className="insights-cashflow__in tabular-nums">
                <Money amount={summary.moneyIn} />
              </strong>
            )}
          </Card>
          <Card
            variant="default"
            className="insights-cashflow__card p-4 m-0"
            onClick={locked ? openUnlockSheet : undefined}
            style={locked ? { cursor: "pointer" } : undefined}
          >
            <span className="text-xs text-[var(--text-muted)]">Money out</span>
            {locked ? (
              <LogInToView className="mt-1" />
            ) : (
              <strong className="insights-cashflow__out tabular-nums">
                <Money amount={summary.moneyOut} />
              </strong>
            )}
          </Card>
        </div>

        <div className="section-tag">
          <span>SPENDING RECAP</span>
        </div>
        <button type="button" className="insights-recap" onClick={openStory}>
          <span className="insights-recap__avatar" aria-hidden="true">
            <AppIcon name="penny" size={22} color="#fff" />
          </span>
          <span className="insights-recap__text">{maskAmounts(summary.highlight, locked)}</span>
        </button>

        <div className="section-tag">
          <span>SPENDING TRACKER</span>
        </div>
        <Card variant="default" className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span
              className="insights-recap__avatar shrink-0"
              aria-hidden="true"
            >
              <AppIcon name="penny" size={18} color="#fff" />
            </span>
            <p className="text-sm text-[var(--ink)] m-0 leading-relaxed">
              {goals.length === 0
                ? "You haven't created a Tabung yet. Let's create one together!"
                : `You have ${goals.length} Tabung tracking progress. Keep allocating!`}
            </p>
          </div>
          {goals.length === 0 ? (
            <Link
              to="/kid/goals"
              onClick={() => sfx.tap()}
              className="block w-full min-h-[44px]"
            >
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center font-bold"
              >
                Create Tabung
              </Button>
            </Link>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-center font-bold min-h-[44px]"
              onClick={() => {
                sfx.tap();
                openPenny({
                  context: {
                    page: "Insights",
                    detail: `Tabung; ${goals.length} goal${goals.length === 1 ? "" : "s"} active`,
                  },
                });
              }}
            >
              Ask Penny
            </Button>
          )}
        </Card>

        <div className="section-tag">
          <span>MONTHLY EXPENSES</span>
        </div>
        <div className="insights-months" role="tablist" aria-label="Month">
          {activeMonths.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={selectedMonth === m}
              className={`insights-month ${selectedMonth === m ? "is-active" : ""}`}
              onClick={() => {
                sfx.tap();
                setSelectedMonth(m);
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <Card variant="default" className="p-5 space-y-4">
          <div className="insights-donut-wrap" aria-hidden="true">
            <svg
              viewBox="0 0 120 120"
              className="insights-donut-svg"
              width="160"
              height="160"
            >
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="var(--border)"
                strokeWidth="4"
              />
              {monthData.topCategories.length > 0 &&
                (() => {
                  const r = 50;
                  const c = 2 * Math.PI * r;
                  let offset = 0;
                  return monthData.topCategories.map((cat, i) => {
                    const len = (cat.pct / 100) * c;
                    const el = (
                      <circle
                        key={cat.key}
                        cx="60"
                        cy="60"
                        r={r}
                        fill="none"
                        stroke={CAT_COLORS[i % CAT_COLORS.length]}
                        strokeWidth="4"
                        strokeDasharray={`${len} ${c - len}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 60 60)"
                      />
                    );
                    offset += len;
                    return el;
                  });
                })()}
            </svg>
            <div
              className="insights-donut__hole insights-donut__hole--overlay"
              onClick={locked ? openUnlockSheet : undefined}
              style={locked ? { cursor: "pointer" } : undefined}
            >
              <span className="text-sm text-[var(--text-secondary)]">
                Monthly spending
              </span>
              {locked ? (
                <LogInToView className="mt-2 text-base" />
              ) : (
                <strong className="tabular-nums text-[var(--ink)] text-2xl font-bold">
                  <Money amount={monthData.totalOut} />
                </strong>
              )}
            </div>
          </div>

          <ul className="insights-cat-list">
            {monthData.topCategories.length === 0 ? (
              <li className="text-sm text-[var(--text-muted)] text-center py-4">
                No expenses in {selectedMonth}.
              </li>
            ) : (
              monthData.topCategories.map((c, i) => (
                <li key={c.key} className="insights-cat-row">
                  <span
                    className="insights-cat-row__icon"
                    style={{ color: CAT_COLORS[i % CAT_COLORS.length] }}
                  >
                    <AppIcon
                      name={i === 0 ? "trend" : i === 1 ? "meal" : "wallet"}
                      size={20}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="text-sm text-[var(--ink)] block">
                      {c.label}
                    </strong>
                    <span className="text-xs text-[var(--text-muted)]">
                      {c.count} transaction{c.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[var(--error-text)] tabular-nums">
                    <Money amount={-c.amount} sign />
                  </span>
                </li>
              ))
            )}
          </ul>
        </Card>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="primary"
            className="flex-1 justify-center font-bold"
            onClick={openStory}
          >
            Open Daily Wrap
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 justify-center font-bold"
            onClick={() => {
              sfx.tap();
              openPenny({
                context: {
                  page: "Insights",
                  detail:
                    `${selectedMonth}; in RM${summary.moneyIn.toFixed(2)}, out RM${summary.moneyOut.toFixed(2)}${summary.topCategories[0] ? `; top category ${summary.topCategories[0].label}` : ""}`.slice(
                      0,
                      600,
                    ),
                },
              });
            }}
          >
            Chat Penny
          </Button>
        </div>
      </div>

      {/* Instagram Stories Modal */}
      {storyOpen && (
        <div
          className="story-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Daily wrap"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "#000",
            display: "flex",
            flexDirection: "column",
            padding: "16px 16px calc(20px + env(safe-area-inset-bottom))",
          }}
        >
          {/* Top Instagram-style progress bars */}
          <div
            className="story-progress"
            aria-hidden="true"
            style={{ display: "flex", gap: "5px", marginBottom: "12px" }}
          >
            {slides.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: "3.5px",
                  borderRadius: "999px",
                  background: "rgba(255, 255, 255, 0.28)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: "999px",
                    background: "#ffffff",
                    width:
                      i < storyIdx
                        ? "100%"
                        : i === storyIdx
                          ? `${slideProgress}%`
                          : "0%",
                    transition:
                      i === storyIdx && !isPaused && !reducedMotion
                        ? "width 0.05s linear"
                        : "none",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Main Story Card (matches reference screenshot gradient & layout) */}
          <div
            className="story-card"
            style={{
              flex: "none",
              width: "min(100%, calc((100dvh - 170px) * 9 / 16))",
              aspectRatio: "9 / 16",
              alignSelf: "center",
              borderRadius: "24px",
              padding: "20px 20px 24px",
              display: "flex",
              flexDirection: "column",
              color: "#fff",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              backgroundImage: `linear-gradient(rgba(0,0,0,.3), rgba(0,0,0,.12)), url("${backgrounds[storyIdx % backgrounds.length]}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              touchAction: "manipulation",
              userSelect: "none",
            }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("button,a")) return;
              pointerStartedAt.current = performance.now();
              e.currentTarget.setPointerCapture(e.pointerId);
              setIsPaused(true);
            }}
            onPointerUp={(e) => {
              setIsPaused(false);
              const started = pointerStartedAt.current;
              pointerStartedAt.current = null;
              if (started === null || !isStoryTap(started, performance.now())) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              if (x < rect.width * 0.35) {
                prevStory();
              } else {
                nextStory();
              }
            }}
            onPointerCancel={() => { pointerStartedAt.current = null; setIsPaused(false); }}
          >
            {/* Top Bar: Mascot Avatar, Title, Close Button */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "1.5px solid rgba(255, 255, 255, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AppIcon name="penny" size={18} color="#fff" />
                </div>
                <strong className="text-white text-sm font-bold tracking-tight">
                  {slides[storyIdx].title}
                </strong>
              </div>
              <button
                type="button"
                className="story-close"
                aria-label="Close story"
                onClick={(e) => {
                  e.stopPropagation();
                  setStoryOpen(false);
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#fff",
                  padding: "6px",
                  cursor: "pointer",
                }}
              >
                <AppIcon name="close" size={22} color="#fff" />
              </button>
            </div>

            {/* Story Text Body */}
            <p
              style={{
                fontSize: "clamp(1.2rem, 5vw, 1.55rem)",
                fontWeight: 800,
                lineHeight: 1.35,
                margin: 0,
                flex: 1,
                color: "#ffffff",
                letterSpacing: "-0.01em",
              }}
            >
              {maskAmounts(slides[storyIdx].body, locked)}
            </p>

            {/* Mascot Illustration at Bottom (matching Reference Screenshot 2) */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                paddingTop: "16px",
                opacity: 0.95,
              }}
              aria-hidden="true"
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppIcon name="penny" size={54} color="#ffffff" />
              </div>

            </div>
          </div>

          {/* Story Footer with Receipt & Mascot AI buttons (matching Reference Screenshot 2) */}
          <div className="flex justify-between gap-3 text-white text-xs py-2">
            <button type="button" onClick={prevStory} disabled={storyIdx === 0}>Previous slide</button>
            <span role="status">{storyIdx + 1} of {slides.length}{reducedMotion ? " · Tap to advance" : ""}</span>
            <button type="button" onClick={nextStory}>{storyIdx === slides.length - 1 ? "Finish" : "Next slide"}</button>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "14px",
              gap: "12px",
            }}
          >
            <span
              style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.7)" }}
            >
              Based on your transactions from {summary.rangeLabel}
            </span>
            <div style={{ display: "flex", gap: "10px" }}>
              {/* Receipt Icon: Opens Transaction History Sheet */}
              <button
                type="button"
                aria-label="View transaction history for this period"
                title="View transactions"
                onClick={() => {
                  sfx.tap();
                  setIsPaused(true);
                  setReceiptSheetOpen(true);
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <AppIcon name="receipt" size={20} color="#fff" />
              </button>

              {/* Penny AI Icon: Opens Penny Chat with specific insight prompt */}
              <button
                type="button"
                aria-label="Ask Penny to deep dive on this insight"
                title="Deep dive with Penny"
                onClick={() => {
                  sfx.tap();
                  setStoryOpen(false);
                  const divePrompt = `Take a deeper dive into this insight: ${slides[storyIdx].body} (${summary.rangeLabel})`;
                  openPenny({
                    prompt: divePrompt,
                    context: { page: "Insights" },
                  });
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <AppIcon name="penny" size={20} color="#fff" />
              </button>
            </div>
          </div>

          {/* Transaction History Bottom Sheet (matching Reference Screenshot 1) */}
          {receiptSheetOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 200,
                background: "rgba(0, 0, 0, 0.65)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
              onClick={() => {
                setReceiptSheetOpen(false);
                setIsPaused(false);
              }}
            >
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "24px 24px 0 0",
                  maxHeight: "75vh",
                  display: "flex",
                  flexDirection: "column",
                  padding: "16px 20px calc(24px + env(safe-area-inset-bottom))",
                  overflowY: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Grab Handle */}
                <div
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    background: "var(--border)",
                    margin: "0 auto 12px",
                  }}
                  aria-hidden="true"
                />

                {/* Sheet Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <div style={{ width: 28 }} />
                  <h2
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 800,
                      color: "var(--ink)",
                      margin: 0,
                      textAlign: "center",
                    }}
                  >
                    Transaction history
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptSheetOpen(false);
                      setIsPaused(false);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--ink)",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                    aria-label="Close transaction history"
                  >
                    <AppIcon name="close" size={22} />
                  </button>
                </div>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    textAlign: "center",
                    margin: "0 0 16px",
                  }}
                >
                  {summary.rangeLabel}
                </p>

                {/* Grouped Transactions List */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {Object.keys(groupedPeriodTxs).length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "2rem",
                        color: "var(--text-muted)",
                        fontSize: "0.875rem",
                      }}
                    >
                      No transactions recorded in this period.
                    </div>
                  ) : (
                    Object.entries(groupedPeriodTxs).map(
                      ([dateHeader, txs]) => (
                        <div key={dateHeader}>
                          <div
                            style={{
                              background: "var(--surface-soft)",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "0.8125rem",
                              fontWeight: 700,
                              color: "var(--ink)",
                              marginBottom: "8px",
                            }}
                          >
                            {dateHeader}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                              padding: "0 4px",
                            }}
                          >
                            {txs.map((t) => {
                              const amt = transactionAmount(
                                t.type,
                                (t as { label?: string }).label ||
                                  t.description,
                                t.amount,
                              );
                              return (
                                <div
                                  key={t.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    borderBottom: "1px solid var(--border)",
                                    paddingBottom: "10px",
                                  }}
                                >
                                  <div>
                                    <strong
                                      style={{
                                        display: "block",
                                        fontSize: "0.9375rem",
                                        color: "var(--ink)",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {transactionTitle({
                                        type: t.type,
                                        label:
                                          (t as { label?: string }).label ||
                                          t.description,
                                      })}
                                    </strong>
                                    <span
                                      style={{
                                        fontSize: "0.75rem",
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      {t.category
                                        ? humanizeCode(t.category)
                                        : transactionTypeLabel(
                                            t.type,
                                            (t as { label?: string }).label ||
                                              t.description,
                                          )}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: "0.9375rem",
                                      fontWeight: 800,
                                      fontFamily: "monospace",
                                      color:
                                        amt.tone === "out"
                                          ? "var(--ink)"
                                          : "var(--success-text)",
                                    }}
                                  >
                                    {amt.text}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
