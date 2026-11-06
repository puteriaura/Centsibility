import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { MoneyDonut } from "@/components/charts/money-donut";
import { BalanceCard } from "@/components/banking/BalanceCard";
import { Progress } from "@/components/ui/progress";
import { SlidingPill } from "@/components/ui/sliding-pill";
import { insightMonth, insightPeriod, isInsightTransaction, weeklyBars } from "@/lib/insight-period";
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
import { transactionAmount } from "@/lib/finance";
import {
  transactionTitle,
  transactionTypeLabel,
  humanizeCode,
} from "@/lib/labels";
import { useMoney, Money, LogInToView, maskAmounts } from "@/features/privacy";
import { usePenny } from "@/features/penny";
import { useTheme } from "@/lib/theme";
import { recapBackgrounds, isStoryTap } from "@/lib/recap-backgrounds";

export const Route = createFileRoute("/kid/insights")({
  head: () => ({ meta: [{ title: "Insights | Centsibility" }] }),
  component: KidInsights,
});

// Category colours are paired with names and amounts in the legend.
const CAT_COLORS = [1, 2, 3, 4, 5, 6].map(n => `var(--chart-${n})`);

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
  const { isMasked: locked, locked: pinLocked, openUnlockSheet, format: formatMoney } = useMoney();
  const { openPenny } = usePenny();
  const hiddenAmounts = pinLocked ? <LogInToView /> : <p className="text-sm text-[var(--text-2)]">Amounts hidden.</p>;

  const [metric, setMetric] = useState<"spending" | "income">("spending");

  // Story modal state
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyIdx, setStoryIdx] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [receiptSheetOpen, setReceiptSheetOpen] = useState(false);
  const { reduced: reducedMotion } = useTheme();
  const pointerStartedAt = useRef<number | null>(null);

  // Dynamically compute active months (from user's earliest transaction to current month)
  const activeMonths = useMemo(() => {
    const now = new Date();
    const currentMonthStr = insightMonth(now);

    if (!data?.txs || data.txs.length === 0) {
      return [currentMonthStr];
    }

    const txDates = data.txs
      .map((t) => new Date(t.created_at).getTime())
      .filter((t) => !isNaN(t));

    const earliest = txDates.length > 0 ? new Date(Math.min(...txDates)) : now;
    const months: string[] = [];
    const cur = new Date(`${insightMonth(earliest)}-01T00:00:00Z`);
    const end = new Date(`${currentMonthStr}-01T00:00:00Z`);

    while (cur <= end) {
      months.push(
        `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`,
      );
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }

    return months.length > 0 ? months : [currentMonthStr];
  }, [data?.txs]);

  // Selected month defaults to current/latest active month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return insightMonth(now);
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
  const backgrounds = useMemo(
    () => recapBackgrounds(data?.kid?.id || "guest", summary.rangeLabel),
    [data?.kid?.id, summary.rangeLabel],
  );

  const monthData = useMemo(
    () => insightPeriod(data?.txs ?? [], selectedMonth, metric),
    [data?.txs, selectedMonth, metric],
  );
  const previousDate = new Date(selectedMonth + "-01T12:00:00");
  previousDate.setMonth(previousDate.getMonth() - 1);
  const previousMonth = insightMonth(previousDate);
  const previousData = insightPeriod(data?.txs ?? [], previousMonth, metric);
  const monthIndex = activeMonths.indexOf(selectedMonth);
  // Focus matches today's chart mark in both approved themes.
  const week = weeklyBars((data?.txs ?? []).filter(t => isInsightTransaction(t, metric)));
  const currentMonth = selectedMonth === insightMonth(new Date());
  const monthName = new Date(selectedMonth + "-01T12:00:00").toLocaleDateString("en-MY", { month: "long" });
  const summaryTitle = metric === "spending" ? currentMonth ? "Spent this month" : `Spent in ${monthName}`
    : currentMonth ? "Came in this month" : `Came in during ${monthName}`;


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
      setSlideProgress((prev) => Math.min(100, prev + step));
    }, interval);

    return () => window.clearInterval(timer);
  }, [
    storyOpen,
    isPaused,
    receiptSheetOpen,
    storyIdx,
    slides.length,
    reducedMotion,
  ]);

  useEffect(() => {
    if (!storyOpen || slideProgress < 100) return;
    // Updaters must stay pure: Strict Mode may call them twice.
    if (storyIdx >= slides.length - 1) {
      setStoryOpen(false);
      setStoryIdx(0);
    } else {
      setStoryIdx((i) => i + 1);
    }
    setSlideProgress(0);
  }, [storyOpen, slideProgress, storyIdx, slides.length]);

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

  return (
    <div className="insights-page pb-12">
      <div className="space-y-5">
        <div
          className="insights-segment"
          role="group"
          aria-label="Transaction view"
        >
          {(["spending", "income"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={metric === value}
              onClick={() => setMetric(value)}
            >
              {metric === value && <SlidingPill layoutId="insights-metric" />}
              <span>{value === "spending" ? "Spending" : "Income"}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="shell-icon-btn"
            aria-label="Previous month"
            disabled={monthIndex <= 0}
            onClick={() => setSelectedMonth(activeMonths[monthIndex - 1])}
          >
            <AppIcon name="back" size={20} />
          </button>
          <label>
            <span className="sr-only">Month</span>
            <select
              className="bg-transparent text-center font-bold max-w-full"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {activeMonths.map((m) => (
                <option key={m} value={m}>
                  {new Date(m + "-01T12:00:00").toLocaleDateString("en-MY", {
                    month: "long",
                    year: "numeric",
                  })}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="shell-icon-btn"
            aria-label="Next month"
            disabled={monthIndex >= activeMonths.length - 1}
            onClick={() => setSelectedMonth(activeMonths[monthIndex + 1])}
          >
            <AppIcon name="chevron" size={20} />
          </button>
        </div>
        <BalanceCard className="insights-summary" title={summaryTitle} balance={monthData.totalOut}
          tag={previousData.hasData && !locked ? <><Money amount={Math.abs(monthData.totalOut - previousData.totalOut)} /> {monthData.totalOut >= previousData.totalOut ? "more" : "less"} than {previousDate.toLocaleDateString("en-MY", { month: "short" })}</> : undefined} />
        <Card className="p-5 insights-week"><h2>This week</h2>
          <div role="img" aria-label={locked ? "This week, amounts hidden" : "This week's daily activity"} className="weekly-bars">
            <BarChart data={week.map(day => ({
              name: day.date, regular: day.today ? 0 : day.amount, today: day.today ? day.amount : 0,
            }))} stacked margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
              aspectRatio="3 / 1" animationDuration={reducedMotion ? 0 : 450}
              enterTransition={{ type: "spring", bounce: 0, duration: 0.45 }}>
              <Bar dataKey="regular" animate={!reducedMotion} fill="var(--chart-1)" />
              <Bar dataKey="today" animate={!reducedMotion} fill="var(--chart-2)" />
            </BarChart>
          </div>
          <div className="grid grid-cols-7 text-center" aria-hidden="true">
            {week.map(day => <span key={day.date} className={day.today ? "font-bold" : undefined}>{day.day[0]}</span>)}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {week.map(day => <div key={day.date} className="flex justify-between gap-2">
              <dt className={day.today ? "font-bold" : undefined}>{day.day.slice(0, 3)}</dt>
              <dd className="m-0 tabular-nums">{locked ? "•••" : formatMoney(day.amount)}</dd>
            </div>)}
          </dl>
        </Card>
        <Card className="p-5 insights-categories"><h2>{metric === "spending" ? "Where it went" : "Where it came from"}</h2>
          <MoneyDonut label="Activity by category" data={monthData.topCategories.map(category => ({ label: category.label, value: category.amount }))} />
          {locked ? hiddenAmounts : monthData.topCategories.length === 0 ? <p>No {metric} this month.</p> : monthData.topCategories.map((category, i) => <div key={category.key} className="insights-category">
            <div><span><strong>{category.label}</strong> <small>{Math.round(category.pct)}%</small></span><Money amount={category.amount} /></div>
            <Progress value={category.pct} indicatorColor={CAT_COLORS[i % CAT_COLORS.length]} />
          </div>)}
        </Card>
        <section className="insights-tip"><AppIcon name="penny" size={32} /><p>Small steps count.</p><Button variant="selected" size="sm" onClick={() => openPenny({ context: { page: "Insights" } })}>Ask Penny</Button></section>
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1 justify-center font-bold"
            onClick={openStory}
          >
            Open Daily Wrap
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
          onKeyDown={(e) => {
            if (receiptSheetOpen) return;
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              prevStory();
            }
            if (e.key === "ArrowRight") {
              e.preventDefault();
              nextStory();
            }
          }}
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
                    width: "100%",
                    transformOrigin: "left",
                    transform: `scaleX(${i < storyIdx ? 1 : i === storyIdx ? slideProgress / 100 : 0})`,
                    transition:
                      i === storyIdx && !isPaused && !reducedMotion
                        ? "transform 0.05s linear"
                        : "none",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Main Story Card (matches reference screenshot gradient & layout) */}
          <div
            key={storyIdx}
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
              if (
                (e.target as HTMLElement).closest("button,a") &&
                !(e.target as HTMLElement).closest("[data-story-zone]")
              )
                return;
              pointerStartedAt.current = performance.now();
              e.currentTarget.setPointerCapture(e.pointerId);
              setIsPaused(true);
            }}
            onPointerUp={(e) => {
              setIsPaused(false);
              const started = pointerStartedAt.current;
              pointerStartedAt.current = null;
              if (started === null || !isStoryTap(started, performance.now()))
                return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              if (x < rect.width * 0.35) {
                prevStory();
              } else {
                nextStory();
              }
            }}
            onPointerCancel={() => {
              pointerStartedAt.current = null;
              setIsPaused(false);
            }}
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
                autoFocus
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

            <button
              type="button"
              data-story-zone
              aria-label="Previous slide"
              className="absolute left-0 top-20 bottom-0 w-[35%] border-0 bg-transparent"
              onClick={(e) => {
                if (e.detail === 0) prevStory();
              }}
            />
            <button
              type="button"
              data-story-zone
              aria-label="Next slide"
              className="absolute right-0 top-20 bottom-0 w-[65%] border-0 bg-transparent"
              onClick={(e) => {
                if (e.detail === 0) nextStory();
              }}
            />
          </div>
          <span className="sr-only" role="status">
            Slide {storyIdx + 1} of {slides.length}
          </span>
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
                  background: "var(--surface)",
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
                                    {maskAmounts(amt.text, locked)}
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
