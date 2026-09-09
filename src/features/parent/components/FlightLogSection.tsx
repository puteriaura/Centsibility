import type { Transaction } from "@/hooks/use-parent-data";
import { formatTransactionSign } from "@/lib/finance";

interface FlightLogSectionProps {
  kidTxs: Transaction[];
}

export function FlightLogSection({ kidTxs }: FlightLogSectionProps) {
  return (
    <div className="wireframe-box" style={{ marginTop: "1rem" }}>
      <div>
        <strong>Flight Log</strong>
      </div>
      {kidTxs.length === 0 ? (
        <p>No transactions yet</p>
      ) : (
        <ul>
          {kidTxs.slice(0, 30).map((t) => (
            <li key={t.id} className="wireframe-space-between">
              <span>{t.label}</span>
              <small>{new Date(t.created_at).toLocaleDateString()}</small>
              <strong>
                {formatTransactionSign(t.type, t.label)}
                RM {Number(t.amount).toFixed(2)}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
