import type { Transaction } from "@/hooks/use-parent-data";
import { formatTransactionSign, isDebitTransaction, isWalletTransaction } from "@/lib/finance";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRM } from "@/lib/format";

interface FlightLogSectionProps {
  kidTxs: Transaction[];
}

export function FlightLogSection({ kidTxs }: FlightLogSectionProps) {
  const walletTxs = kidTxs.filter((t) => isWalletTransaction(t.type));
  return (
    <Card variant="default" className="mt-4 p-4 space-y-3 border border-[var(--border)]">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
        <strong className="text-sm font-bold text-[var(--ink)]">Transaction Flight Log</strong>
        <span className="text-xs text-[var(--text-muted)]">{walletTxs.length} records</span>
      </div>
      {walletTxs.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">No transactions recorded yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] max-h-64 overflow-y-auto no-scrollbar">
          {walletTxs.slice(0, 30).map((t) => {
            const debit = isDebitTransaction(t.type, t.label);
            return (
              <li key={t.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={debit ? "default" : "success"}>{t.type}</Badge>
                    <span className="font-semibold text-[var(--ink)] truncate">{t.label}</span>
                  </div>
                  <small className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                    {formatDate(t.created_at)}
                  </small>
                </div>
                <strong
                  className={`tabular-nums shrink-0 text-xs font-bold ${
                    debit ? "text-[var(--ink)]" : "text-[var(--success-text)]"
                  }`}
                >
                  {formatTransactionSign(t.type, t.label)}
                  {formatRM(Number(t.amount))}
                </strong>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

