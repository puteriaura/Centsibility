import type { Transaction } from "@/hooks/use-parent-data";
import { isWalletTransaction, transactionAmount } from "@/lib/finance";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { transactionTitle, transactionTypeLabel } from "@/lib/labels";
import { useMoney, MASKED_AMOUNT } from "@/features/privacy";

interface FlightLogSectionProps {
  kidTxs: Transaction[];
}

export function FlightLogSection({ kidTxs }: FlightLogSectionProps) {
  const { isMasked, locked, openUnlockSheet } = useMoney();
  const walletTxs = kidTxs.filter((t) => isWalletTransaction(t.type));
  return (
    <Card
      variant="default"
      className="mt-4 p-4 space-y-3 border border-[var(--border)]"
    >
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
        <strong className="text-sm font-bold text-[var(--ink)]">
          Activity Log
        </strong>
        <span className="text-xs text-[var(--text-muted)]">
          {walletTxs.length} records
        </span>
      </div>
      {walletTxs.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">
          No transactions recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] max-h-64 overflow-y-auto no-scrollbar">
          {walletTxs.slice(0, 30).map((t) => {
            const amt = transactionAmount(t.type, t.label, t.amount);
            return (
              <li
                key={t.id}
                className="py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={amt.tone === "out" ? "default" : "success"}>
                      {transactionTypeLabel(t.type, t.label)}
                    </Badge>
                    <span className="font-semibold text-[var(--ink)] truncate">
                      {transactionTitle(t)}
                    </span>
                  </div>
                  <small className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                    {formatDate(t.created_at)}
                  </small>
                </div>
                <strong
                  className={`tabular-nums shrink-0 text-xs font-bold ${
                    amt.tone === "out"
                      ? "text-[var(--ink)]"
                      : "text-[var(--success-text)]"
                  }`}
                  aria-label={isMasked ? "Amount hidden" : undefined}
                  onClick={locked ? openUnlockSheet : undefined}
                  style={locked ? { cursor: "pointer" } : undefined}
                >
                  {isMasked ? MASKED_AMOUNT : amt.text}
                </strong>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
