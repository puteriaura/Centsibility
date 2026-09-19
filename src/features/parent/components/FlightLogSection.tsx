import type { Transaction } from "@/hooks/use-parent-data";
import { formatTransactionSign, isDebitTransaction } from "@/lib/finance";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FlightLogSectionProps {
  kidTxs: Transaction[];
}

export function FlightLogSection({ kidTxs }: FlightLogSectionProps) {
  return (
    <Card variant="default" className="mt-4 p-4 space-y-3 border border-[var(--border)]">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
        <strong className="text-sm font-bold text-[var(--ink)]">Transaction Flight Log</strong>
        <span className="text-xs text-[var(--text-muted)]">{kidTxs.length} records</span>
      </div>
      {kidTxs.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">No transactions recorded yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] max-h-64 overflow-y-auto no-scrollbar">
          {kidTxs.slice(0, 30).map((t) => {
            const debit = isDebitTransaction(t.type);
            return (
              <li key={t.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={debit ? "default" : "success"}>{t.type}</Badge>
                    <span className="font-semibold text-[var(--ink)] truncate">{t.label}</span>
                  </div>
                  <small className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                    {new Date(t.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </small>
                </div>
                <strong
                  className={`tabular-nums shrink-0 text-xs font-bold ${
                    debit ? "text-[var(--ink)]" : "text-[var(--success)]"
                  }`}
                >
                  {formatTransactionSign(t.type, t.label)}
                  RM {Number(t.amount).toFixed(2)}
                </strong>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

