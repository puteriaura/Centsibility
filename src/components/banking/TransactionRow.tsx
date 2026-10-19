import * as React from "react";
import { AppIcon } from "@/components/ui/app-icon";
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

// One row of a statement. Icons stay neutral; only the amount carries
// direction: money in is green with a plus, money out is ink with a minus.
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
  const { isMasked, locked, openUnlockSheet, format } = useMoney();
  const amt =
    type !== undefined ? transactionAmount(type, label, amount) : null;
  const isPos = amt ? amt.tone === "in" : isIncome;
  const iconName = icon || (isPos ? "deposit" : "withdrawal");

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 px-2 ${
        onClick
          ? "cursor-pointer rounded-xl hover:bg-[var(--surface-hover)]"
          : ""
      } ${className}`.trim()}
    >
      <div className="flex min-w-0 flex-[1_1_12rem] items-center gap-3">
        <div className="tx-icon" aria-hidden="true">
          <AppIcon name={iconName} size={20} />
        </div>
        <div className="min-w-0">
          <p className="m-0 text-sm font-semibold leading-snug text-[var(--ink)]">
            {title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-3)]">
            {date && <span>{date}</span>}
            {date && subtitle && <span aria-hidden="true">·</span>}
            {subtitle && <span>{subtitle}</span>}
          </div>
        </div>
      </div>

      <span
        className={`shrink-0 text-sm font-bold tabular-nums ${
          isPos ? "text-[var(--pos)]" : "text-[var(--ink)]"
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
        {isMasked
          ? MASKED_AMOUNT
          : amt
            ? amt.text
            : format(isIncome ? Math.abs(amount) : -Math.abs(amount), {
                sign: true,
              })}
      </span>
    </div>
  );
}
