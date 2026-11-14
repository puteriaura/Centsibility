import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useKidData } from "@/hooks/use-kid-data";
import { getKidSession } from "@/lib/kid-session";
import { isKidBypassed } from "@/lib/admin-bypass";
import { DEMO_TRANSACTIONS } from "@/lib/demo-data";
import { edgeKidGetHistory, extractEdgeErrorMessage } from "@/lib/edge";
import { formatRM } from "@/lib/format";
import { transactionAmount } from "@/lib/finance";
import { transactionTitle, transactionTypeLabel } from "@/lib/labels";
import { groupByDay, type HistoryTx } from "@/lib/history";
import { sfx } from "@/lib/sounds";
import { useMoney, Money, MASKED_AMOUNT } from "@/features/privacy";

export const Route = createFileRoute("/kid/history")({
  head: () => ({ meta: [{ title: "Transactions | Centsibility" }] }),
  component: KidHistoryPage,
});

type PeriodDays = 7 | 30 | 90;

function KidHistoryPage() {
  const { data: kidState } = useKidData();
  const { isMasked, locked, openUnlockSheet } = useMoney();
  const [days, setDays] = useState<PeriodDays>(30);
  const [txs, setTxs] = useState<HistoryTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    const session = getKidSession();
    if (isKidBypassed()) {
      // DEV Demo mode: filter local demo transactions
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const filtered = DEMO_TRANSACTIONS.filter(
        (t) => new Date(t.created_at) >= cutoff,
      );
      setTxs(filtered);
      setLoading(false);
      return;
    }

    if (!session?.code) {
      setError("Please sign in to view your transactions.");
      setLoading(false);
      return;
    }

    try {
      const res = await edgeKidGetHistory({ code: session.code, days });
      setTxs(res.txs || []);
    } catch (err: unknown) {
      const msg = await extractEdgeErrorMessage(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const balance = Number(kidState?.kid?.balance ?? 0);
  const groups = groupByDay(txs);

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Compact blue balance card */}
      <Card
        variant="brand"
        className="p-4 rounded-2xl text-white shadow-sm"
        style={{ background: "var(--primary)" }}
      >
        <span className="text-xs font-semibold text-white block">
          Spending balance
        </span>
        <span className="text-2xl font-bold tabular-nums text-white block mt-1">
          <Money amount={balance} />
        </span>
      </Card>

      {/* 2. Period filter */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <label
          htmlFor="history-period-select"
          className="text-xs font-semibold text-[var(--text-secondary)]"
        >
          Filter by period
        </label>
        <select
          id="history-period-select"
          aria-label="Filter transactions by period"
          value={days}
          onChange={(e) => {
            sfx.tap();
            setDays(Number(e.target.value) as PeriodDays);
          }}
          className="h-11 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer min-h-[44px]"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* 3. Content States */}
      {loading ? (
        <div className="space-y-3 pt-2">
          <Skeleton style={{ height: "2.5rem", borderRadius: "12px" }} />
          <Skeleton style={{ height: "4.5rem", borderRadius: "16px" }} />
          <Skeleton style={{ height: "4.5rem", borderRadius: "16px" }} />
          <Skeleton style={{ height: "2.5rem", borderRadius: "12px" }} />
          <Skeleton style={{ height: "4.5rem", borderRadius: "16px" }} />
        </div>
      ) : error ? (
        <Card variant="soft" className="p-6 text-center space-y-3">
          <p className="text-xs sm:text-sm text-[var(--error-text)] font-semibold m-0 leading-relaxed">
            {error}
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              sfx.tap();
              fetchHistory();
            }}
            className="mx-auto min-h-[44px]"
          >
            Retry
          </Button>
        </Card>
      ) : groups.length === 0 ? (
        <Card variant="soft" className="p-8 text-center space-y-2">
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] m-0">
            No transactions in the last {days} days.
          </p>
        </Card>
      ) : (
        <div className="space-y-4 pt-1">
          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
              {/* Date Header: full-width band on soft surface */}
              <div
                className="section-title__heading px-1 pt-3 pb-2"
                style={{ background: "var(--surface-soft)" }}
              >
                {group.heading}
              </div>

              {/* Day's Rows */}
              <Card
                variant="default"
                className="p-2 divide-y divide-[var(--border)] overflow-hidden"
              >
                {group.rows.map((tx) => {
                  const amt = transactionAmount(tx.type, tx.label, tx.amount);
                  const title = transactionTitle(tx);
                  const typeLabel = transactionTypeLabel(tx.type, tx.label);
                  const subtitle =
                    title.trim().toLowerCase() ===
                    typeLabel.trim().toLowerCase()
                      ? undefined
                      : typeLabel;

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 p-3 min-h-[48px]"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <span className="text-sm font-semibold text-[var(--ink)] block truncate">
                          {title}
                        </span>
                        {subtitle && (
                          <span className="text-xs text-[var(--text-secondary)] block mt-0.5 truncate">
                            {subtitle}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-sm font-bold tabular-nums block ${
                            amt.tone === "out"
                              ? "text-[var(--ink)]"
                              : "text-[var(--success-text)]"
                          }`}
                          aria-label={isMasked ? "Amount hidden" : undefined}
                          onClick={
                            locked
                              ? (e) => {
                                  e.stopPropagation();
                                  openUnlockSheet();
                                }
                              : undefined
                          }
                          style={locked ? { cursor: "pointer" } : undefined}
                        >
                          {isMasked ? MASKED_AMOUNT : amt.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
