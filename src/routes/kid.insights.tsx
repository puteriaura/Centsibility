import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import { buildSpendingSummary, buildStorySlides } from "@/lib/penny-insights";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { sfx } from "@/lib/sounds";
import { formatRM } from "@/lib/format";

export const Route = createFileRoute("/kid/insights")({
  head: () => ({ meta: [{ title: "Insights — Centsibility" }] }),
  component: KidInsights,
});

const MONTHS = ["May", "Jun", "Jul", "Aug", "Sep"];
const CAT_COLORS = ["#3B5BDB", "#DD2D4A", "#F5A623", "#0F8FA3", "#6E5FB8"];

function KidInsights() {
  const nav = useNavigate();
  const { data, loading, error, refresh } = useKidData();
  const [month, setMonth] = useState("Sep");
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyIdx, setStoryIdx] = useState(0);

  const summary = useMemo(
    () => buildSpendingSummary((data?.txs ?? []) as Parameters<typeof buildSpendingSummary>[0], 90),
    [data?.txs],
  );
  const slides = useMemo(
    () => buildStorySlides(summary, Number(data?.kid?.coins ?? 0)),
    [summary, data?.kid?.coins],
  );

  useEffect(() => {
    if (!storyOpen) return;
    const t = window.setTimeout(() => {
      if (storyIdx >= slides.length - 1) {
        setStoryOpen(false);
        return;
      }
      setStoryIdx((i) => i + 1);
    }, 5500);
    return () => window.clearTimeout(t);
  }, [storyOpen, storyIdx, slides.length]);

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

  const k = data?.kid ?? { name: "Explorer", coins: 0 };
  const goals = data?.goals ?? [];
  const openStory = () => {
    sfx.pop();
    setStoryIdx(0);
    setStoryOpen(true);
  };
  const nextStory = () => {
    if (storyIdx >= slides.length - 1) {
      setStoryOpen(false);
      return;
    }
    setStoryIdx((i) => i + 1);
    sfx.tap();
  };
  const prevStory = () => {
    if (storyIdx <= 0) return;
    setStoryIdx((i) => i - 1);
    sfx.tap();
  };

  return (
    <div className="insights-page pb-12">
      {/* Assistant hero: the one place with a soft glow */}
      <section className="insights-ask-hero" aria-label="Ask Penny">
        <h1 className="insights-ask-hero__title">
          Hi {k.name}! Ask me about:
        </h1>
        <div className="insights-ask-actions">
          <button
            type="button"
            className="insights-ask-chip"
            onClick={() => {
              sfx.tap();
              nav({ to: "/kid/chat", search: { q: "spending" } });
            }}
          >
            <AppIcon name="trend" size={16} /> Spending
          </button>
          <button
            type="button"
            className="insights-ask-chip"
            onClick={() => {
              sfx.tap();
              nav({ to: "/kid/chat", search: { q: "savings" } });
            }}
          >
            <AppIcon name="wallet" size={16} /> Savings
          </button>
          <button
            type="button"
            className="insights-ask-chip insights-ask-chip--wide"
            onClick={() => {
              sfx.tap();
              nav({ to: "/kid/chat", search: { q: "surprise" } });
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
            nav({ to: "/kid/chat" });
          }}
        >
          Pull down to chat
        </button>
      </section>

      <div className="insights-sheet">
        <div className="insights-sheet__handle" aria-hidden="true" />

        <div className="section-tag">
          <span>MONTHLY CASHFLOW</span>
        </div>
        <div className="insights-cashflow">
          <Card variant="default" className="insights-cashflow__card p-4 m-0">
            <span className="text-xs text-[var(--text-muted)]">Money in</span>
            <strong className="insights-cashflow__in tabular-nums">
              {formatRM(summary.moneyIn)}
            </strong>
          </Card>
          <Card variant="default" className="insights-cashflow__card p-4 m-0">
            <span className="text-xs text-[var(--text-muted)]">Money out</span>
            <strong className="insights-cashflow__out tabular-nums">
              {formatRM(summary.moneyOut)}
            </strong>
          </Card>
        </div>

        <div className="section-tag">
          <span>SPENDING RECAP</span>
        </div>
        <button type="button" className="insights-recap" onClick={openStory}>
          <span className="insights-recap__avatar" aria-hidden="true">
            <AppIcon name="penny" size={22} color="#fff" />
          </span>
          <span className="insights-recap__text">{summary.highlight}</span>
        </button>

        <div className="section-tag">
          <span>SPENDING TRACKER</span>
        </div>
        <Card variant="default" className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="insights-recap__avatar shrink-0" aria-hidden="true">
              <AppIcon name="penny" size={18} color="#fff" />
            </span>
            <p className="text-sm text-[var(--ink)] m-0 leading-relaxed">
              {goals.length === 0
                ? "You haven't created a budget plan. Let's create one together!"
                : `You have ${goals.length} savings pot${goals.length === 1 ? "" : "s"} tracking progress. Keep allocating!`}
            </p>
          </div>
          <Link
            to={goals.length === 0 ? "/kid/goals" : "/kid/chat"}
            onClick={() => sfx.tap()}
            className="block w-full min-h-[44px]"
          >
            <Button variant="outline" size="sm" className="w-full justify-center font-bold">
              {goals.length === 0 ? "Create budget" : "Ask Penny"}
            </Button>
          </Link>
        </Card>

        <div className="section-tag">
          <span>MONTHLY EXPENSES</span>
        </div>
        <div className="insights-months" role="tablist" aria-label="Month">
          {MONTHS.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={month === m}
              className={`insights-month ${month === m ? "is-active" : ""}`}
              onClick={() => {
                sfx.tap();
                setMonth(m);
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <Card variant="default" className="p-5 space-y-4">
          <div className="insights-donut-wrap" aria-hidden="true">
            <svg viewBox="0 0 120 120" className="insights-donut-svg" width="160" height="160">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="4" />
              {summary.topCategories.length > 0 &&
                (() => {
                  const r = 50;
                  const c = 2 * Math.PI * r;
                  let offset = 0;
                  return summary.topCategories.map((cat, i) => {
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
            <div className="insights-donut__hole insights-donut__hole--overlay">
              <span className="text-sm text-[var(--text-secondary)]">Monthly spending</span>
              <strong className="tabular-nums text-[var(--ink)] text-2xl font-bold">
                {formatRM(summary.moneyOut)}
              </strong>
            </div>
          </div>

          <ul className="insights-cat-list">
            {summary.topCategories.length === 0 ? (
              <li className="text-sm text-[var(--text-muted)] text-center py-4">
                No expenses in this window yet.
              </li>
            ) : (
              summary.topCategories.map((c, i) => (
                <li key={c.key} className="insights-cat-row">
                  <span
                    className="insights-cat-row__icon"
                    style={{ color: CAT_COLORS[i % CAT_COLORS.length] }}
                  >
                    <AppIcon name={i === 0 ? "trend" : i === 1 ? "meal" : "wallet"} size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="text-sm text-[var(--ink)] block">{c.label}</strong>
                    <span className="text-xs text-[var(--text-muted)]">
                      {c.count} transaction{c.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[var(--error-text)] tabular-nums">
                    {formatRM(-(c.amount))}
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
          <Link to="/kid/chat" className="flex-1" onClick={() => sfx.tap()}>
            <Button type="button" variant="secondary" className="w-full justify-center font-bold">
              Chat Penny
            </Button>
          </Link>
        </div>
      </div>

      {storyOpen && (
        <div className="story-overlay" role="dialog" aria-modal="true" aria-label="Daily wrap">
          <div className="story-progress" aria-hidden="true">
            {slides.map((_, i) => (
              <span key={i} className={`story-progress__seg ${i <= storyIdx ? "is-on" : ""}`} />
            ))}
          </div>
          <div
            className={`story-card story-card--${slides[storyIdx].tone}`}
            onClick={(e) => {
              const x = e.nativeEvent.offsetX;
              const w = (e.currentTarget as HTMLElement).clientWidth;
              if (x < w / 3) prevStory();
              else nextStory();
            }}
          >
            <div className="story-card__top">
              <div className="flex items-center gap-2">
                <span className="insights-recap__avatar">
                  <AppIcon name="penny" size={18} color="#fff" />
                </span>
                <strong className="text-white text-sm">{slides[storyIdx].title}</strong>
              </div>
              <button
                type="button"
                className="story-close"
                aria-label="Close"
                onClick={(e) => {
                  e.stopPropagation();
                  setStoryOpen(false);
                }}
              >
                <AppIcon name="close" size={20} color="#fff" />
              </button>
            </div>
            <p className="story-card__body">{slides[storyIdx].body}</p>
            <div className="story-card__mascot" aria-hidden="true">
              <AppIcon name="penny" size={64} color="#fff" />
            </div>
          </div>
          <div className="story-footer">
            <span>Based on your transactions from {summary.rangeLabel}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="story-footer__btn"
                aria-label="Open insights"
                onClick={() => setStoryOpen(false)}
              >
                <AppIcon name="chat" size={18} color="#fff" />
              </button>
              <button
                type="button"
                className="story-footer__btn"
                aria-label="Chat with Penny"
                onClick={() => {
                  setStoryOpen(false);
                  nav({ to: "/kid/chat" });
                }}
              >
                <AppIcon name="penny" size={18} color="#fff" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
