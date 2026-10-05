import * as React from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { formatRM } from "@/lib/format";
import { transactionAmount } from "@/lib/finance";
import { useMoney, MASKED_AMOUNT } from "@/features/privacy";

export interface TransactionRowProps {
  id?: string;
  title: string;
  subtitle?: string;
  date?: string;
  amount: number;
  isIncome?: boolean;
  type?: string;
  label?: string | null;
  icon?: string;
  onClick?: () => void;
  className?: string;
}

export function TransactionRow({
  title,
  subtitle,
  date,
  amount,
  isIncome = false,
  type,
  label,
  icon,
  onClick,
  className = "",
}: TransactionRowProps) {
  const { isMasked, locked, openUnlockSheet } = useMoney();
  const amt = type !== undefined ? transactionAmount(type, label, amount) : null;
  const isPos = amt ? amt.tone === "in" : isIncome;
  const defaultIcon = isPos ? "deposit" : "withdrawal";
  const iconName = icon || defaultIcon;

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between py-3.5 px-3 rounded-xl transition-colors duration-150 ${
        onClick ? "hover:bg-[var(--surface-soft)] cursor-pointer" : ""
      } ${className}`.trim()}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isPos
              ? "bg-[var(--success-soft)] text-[var(--success-text)]"
              : "bg-[var(--surface-soft)] text-[var(--primary-text)]"
          }`}
        >
          <AppIcon name={iconName} size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--ink)] truncate leading-snug">
            {title}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-0.5">
            {date && <span>{date}</span>}
            {date && subtitle && <span>·</span>}
            {subtitle && <span className="truncate">{subtitle}</span>}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0 ml-3">
        <span
          className={`text-sm font-bold tabular-nums block leading-snug ${
            (amt ? amt.tone === "out" : !isIncome) ? "text-[var(--ink)]" : "text-[var(--success-text)]"
          }`}
          aria-label={isMasked ? "Amount hidden" : undefined}
          onClick={locked ? (e) => { e.stopPropagation(); openUnlockSheet(); } : undefined}
          style={locked ? { cursor: "pointer" } : undefined}
        >
          {isMasked
            ? MASKED_AMOUNT
            : amt
              ? amt.text
              : formatRM(isIncome ? Math.abs(amount) : -Math.abs(amount), { sign: true })}
        </span>
      </div>
    </div>
  );
}
