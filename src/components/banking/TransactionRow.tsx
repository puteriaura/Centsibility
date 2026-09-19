import * as React from "react";
import { AppIcon } from "@/components/ui/app-icon";

export interface TransactionRowProps {
  id?: string;
  title: string;
  subtitle?: string;
  date?: string;
  amount: number;
  currency?: string;
  isIncome?: boolean;
  icon?: string;
  onClick?: () => void;
  className?: string;
}

export function TransactionRow({
  title,
  subtitle,
  date,
  amount,
  currency = "RM",
  isIncome = false,
  icon,
  onClick,
  className = "",
}: TransactionRowProps) {
  const defaultIcon = isIncome ? "deposit" : "withdrawal";
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
            isIncome
              ? "bg-[var(--success-soft)] text-[var(--success)]"
              : "bg-[var(--surface-soft)] text-[var(--primary)]"
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
            isIncome ? "text-[var(--success)]" : "text-[var(--ink)]"
          }`}
        >
          {isIncome ? "+" : "-"}
          {currency} {Math.abs(amount).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
