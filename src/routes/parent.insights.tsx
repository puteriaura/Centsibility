import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useParentData } from "@/hooks/use-parent-data";
import { buildSpendingSummary } from "@/lib/penny-insights";
import { resolveAvatar } from "@/lib/avatar";
import { AvatarBubble } from "@/components/AvatarBubble";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { sfx } from "@/lib/sounds";
import { transactionAmount } from "@/lib/finance";
import { ParentLoadError } from "@/features/parent/components/ParentLoadError";
import { usePrivacy, Money, LogInToView } from "@/features/privacy";

export const Route = createFileRoute("/parent/insights")({
  head: () => ({ meta: [{ title: "Insights | Centsibility" }] }),
  component: ParentInsights,
});

function ParentInsights() {
  const nav = useNavigate();
  const { kids, txs, loading, error, hasLoaded, lastLoadedAt, refresh } =
    useParentData();
  const { locked, openUnlockSheet, isMasked } = usePrivacy();
  const [kidFilter, setKidFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filteredKids = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...kids].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        (k.username ?? "").toLowerCase().includes(q),
    );
  }, [kids, query]);

  const scopedTxs = useMemo(() => {
    const list =
      kidFilter === "all" ? txs : txs.filter((t) => t.kid_id === kidFilter);
    return list.map((t) => ({
      id: t.id,
      type: t.type,
      label: t.label,
      amount: t.amount,
      created_at: t.created_at,
    }));
  }, [txs, kidFilter]);

  const summary = useMemo(
    () => buildSpendingSummary(scopedTxs, 90),
    [scopedTxs],
  );

  if (loading && !hasLoaded && !error) {
    return (
      <div className="parent-page mobile-stack">
        <Skeleton style={{ height: "7rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "8rem", borderRadius: "16px" }} />
      </div>
    );
  }

  if (error && !hasLoaded) {
    return (
      <div className="parent-page">
        <ParentLoadError variant="page" onRetry={refresh} message={error} />
      </div>
    );
  }

  const selectedKid = kids.find((k) => k.id === kidFilter);

  return (
    <div className="parent-page mobile-stack pb-4">
      {error && hasLoaded && (
        <ParentLoadError
          variant="banner"
          onRetry={refresh}
          lastLoadedAt={lastLoadedAt}
        />
      )}
      <section className="deposit-hero" aria-label="Family cashflow">
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">
            {selectedKid ? `${selectedKid.name} · 90 days` : "Family · 90 days"}
          </p>
          {locked ? (
            <div className="my-1">
              <LogInToView className="text-white text-base py-1" />
            </div>
          ) : (
            <p className="deposit-hero__amount tabular-nums">
              <Money amount={summary.moneyOut} />
            </p>
          )}
          <p
            className="deposit-hero__link"
            style={{ opacity: 0.9, cursor: "default" }}
          >
            Outflow · In {locked ? "•••" : <Money amount={summary.moneyIn} />} ·{" "}
            {summary.txCount} tx
          </p>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="reports" size={26} color="#fff" />
        </div>
      </section>

      <Card variant="default" className="m-0 p-3.5 space-y-2">
        <p className="text-[10px] font-bold tracking-wider text-[var(--text-muted)] m-0 uppercase">
          Spending recap
        </p>
        <p className="text-sm text-[var(--ink)] m-0 leading-snug font-semibold">
          {summary.highlight}
        </p>
        <p className="text-[11px] text-[var(--text-muted)] m-0">
          {summary.rangeLabel}
        </p>
      </Card>

      <div className="space-y-2">
        <p className="text-[10px] font-bold tracking-wider text-[var(--text-muted)] m-0 uppercase">
          Children
        </p>
        {kids.length > 4 && (
          <div className="kid-search">
            <AppIcon name="users" size={16} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${kids.length} children…`}
              aria-label="Search children"
            />
          </div>
        )}
        <div className="kid-chip-row" role="listbox" aria-label="Children">
          <button
            type="button"
            role="option"
            aria-selected={kidFilter === "all"}
            className={`kid-chip ${kidFilter === "all" ? "is-active" : ""}`}
            onClick={() => {
              sfx.tap();
              setKidFilter("all");
            }}
          >
            All ({kids.length})
          </button>
          {filteredKids.map((k) => (
            <button
              key={k.id}
              type="button"
              role="option"
              aria-selected={kidFilter === k.id}
              className={`kid-chip ${kidFilter === k.id ? "is-active" : ""}`}
              onClick={() => {
                sfx.tap();
                setKidFilter(k.id);
              }}
            >
              <AvatarBubble
                emoji={resolveAvatar(k.avatar, "kid")}
                size={22}
                kind="kid"
              />
              <span className="truncate">{k.name}</span>
            </button>
          ))}
        </div>
      </div>

      <Card variant="default" className="p-0 m-0 overflow-hidden">
        <p className="text-[10px] font-bold tracking-wider text-[var(--text-muted)] m-0 uppercase px-3.5 pt-3">
          Top categories
        </p>
        {hasLoaded && !error && summary.topCategories.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] p-4 m-0 text-center">
            No expenses in this window yet.
          </p>
        ) : (
          <ul className="insights-cat-list">
            {summary.topCategories.slice(0, 6).map((c, i) => {
              const amt = transactionAmount("WITHDRAWAL", null, c.amount);
              return (
                <li key={c.key} className="insights-cat-row px-3.5">
                  <span
                    className="insights-cat-row__icon"
                    style={{ color: "var(--primary)" }}
                  >
                    <AppIcon name={i === 0 ? "trend" : "wallet"} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="text-sm text-[var(--ink)] block">
                      {c.label}
                    </strong>
                    <span className="text-xs text-[var(--text-muted)]">
                      {c.pct.toFixed(0)}% · {c.count} tx
                    </span>
                  </div>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      amt.tone === "out"
                        ? "text-[var(--ink)]"
                        : "text-[var(--success-text)]"
                    }`}
                    aria-label={isMasked ? "Amount hidden" : undefined}
                    onClick={locked ? openUnlockSheet : undefined}
                    style={locked ? { cursor: "pointer" } : undefined}
                  >
                    {isMasked ? "RM*****" : amt.text}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Button
        type="button"
        variant="primary"
        className="w-full justify-center font-bold"
        onClick={() => {
          sfx.tap();
          nav({ to: "/parent/reports" });
        }}
      >
        Open detailed reports
      </Button>
    </div>
  );
}
