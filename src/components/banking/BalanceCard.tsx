import * as React from "react";
import { Card } from "@/components/ui/card";
import { AppIcon } from "@/components/ui/app-icon";

export interface BalanceCardProps {
  title?: string;
  balance: number;
  currency?: string;
  subtitle?: string;
  hideBalance?: boolean;
  onToggleHide?: () => void;
  metadata?: Array<{ label: string; value?: string }>;
  secondaryBalance?: { label: string; amount: number };
  onArrowClick?: () => void;
  actions?: React.ReactNode;
  variant?: "brand" | "navy" | "default";
  className?: string;
  showDots?: boolean;
}

export function BalanceCard({
  title = "Spending balance",
  balance,
  currency = "RM",
  subtitle,
  hideBalance = false,
  onToggleHide,
  metadata,
  secondaryBalance,
  onArrowClick,
  actions,
  variant = "brand",
  className = "",
  showDots = false,
}: BalanceCardProps) {
  const isDark = variant === "brand" || variant === "navy";

  return (
    <div className="w-full">
      <Card
        variant={variant}
        className={`relative overflow-hidden p-5 sm:p-6 rounded-2xl shadow-md ${className}`.trim()}
      >
        <div className="flex items-center justify-between relative z-10">
          <span
            className={`text-xs font-semibold tracking-wide ${
              isDark ? "text-white/85" : "text-[var(--text-secondary)]"
            }`}
          >
            {title}
          </span>
          {onToggleHide && (
            <button
              type="button"
              onClick={onToggleHide}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 rounded-full transition-colors ${
                isDark
                  ? "text-white/85 hover:text-white hover:bg-white/10"
                  : "text-[var(--text-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-soft)]"
              }`}
              aria-label={hideBalance ? "Show balance" : "Hide balance"}
            >
              <AppIcon name={hideBalance ? "show" : "hide"} size={18} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 my-2 relative z-10">
          <div>
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${
                isDark ? "text-white" : "text-[var(--ink)]"
              }`}
            >
              {hideBalance ? `${currency}******` : `${currency} ${balance.toFixed(2)}`}
            </div>

            {secondaryBalance ? (
              <div
                className={`text-xs mt-1.5 flex items-center gap-1 font-medium ${
                  isDark ? "text-white/85" : "text-[var(--text-secondary)]"
                }`}
              >
                <span>{secondaryBalance.label}</span>
                <span className="opacity-75">ⓘ</span>
                <strong className={`tabular-nums ${isDark ? "text-white" : "text-[var(--ink)]"}`}>
                  {hideBalance ? `${currency}******` : `${currency} ${secondaryBalance.amount.toFixed(2)}`}
                </strong>
              </div>
            ) : subtitle ? (
              <p
                className={`text-xs mt-1 ${
                  isDark ? "text-white/70" : "text-[var(--text-secondary)]"
                }`}
              >
                {subtitle}
              </p>
            ) : null}
          </div>

          {onArrowClick && (
            <button
              type="button"
              onClick={onArrowClick}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-transform hover:scale-105 shrink-0"
              aria-label="View balance details"
            >
              <AppIcon name="forward" size={18} />
            </button>
          )}
        </div>

        {(metadata || actions) && (
          <div
            className={`mt-4 pt-3 flex flex-wrap items-center justify-between gap-3 border-t relative z-10 ${
              isDark ? "border-white/15" : "border-[var(--border)]"
            }`}
          >
            {metadata && metadata.length > 0 ? (
              <div className="flex items-center gap-3 text-xs">
                {metadata.map((item, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1 font-medium ${
                      isDark ? "text-white/85" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.value && (
                      <strong className={isDark ? "text-white" : "text-[var(--ink)]"}>
                        {item.value}
                      </strong>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <div />
            )}

            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}
      </Card>

      {showDots && (
        <div className="aeon-dots" aria-hidden="true">
          <span className="aeon-dot-active" />
          <span className="aeon-dot-inactive" />
          <span className="aeon-dot-inactive" />
        </div>
      )}
    </div>
  );
}
