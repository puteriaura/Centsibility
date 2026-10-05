import * as React from "react";
import { Card } from "@/components/ui/card";
import { AppIcon } from "@/components/ui/app-icon";
import { formatRM } from "@/lib/format";

export interface BalanceCardProps {
  title?: string;
  balance: number;
  subtitle?: string;
  hideBalance?: boolean;
  onToggleHide?: () => void;
  metadata?: Array<{ label: string; value?: string }>;
  secondaryBalance?: { label: string; amount: number };
  onArrowClick?: () => void;
  actions?: React.ReactNode;
  variant?: "brand" | "navy" | "default";
  className?: string;
  breakdown?: Array<{ label: string; amount: number }>;
  footnote?: string;
  isExpanded?: boolean;
  onToggleExpanded?: (expanded: boolean) => void;
}

const HIDDEN = "RM*****";

export function BalanceCard({
  title = "Spending balance",
  balance,
  subtitle,
  hideBalance = false,
  onToggleHide,
  metadata,
  secondaryBalance,
  onArrowClick,
  actions,
  variant = "brand",
  className = "",
  breakdown,
  footnote,
  isExpanded,
  onToggleExpanded,
}: BalanceCardProps) {
  const [internalExpanded, setInternalExpanded] = React.useState(false);
  const isExpandedControlled = typeof isExpanded === "boolean";
  const expanded = isExpandedControlled ? isExpanded : internalExpanded;

  const handleToggleExpanded = () => {
    const next = !expanded;
    if (!isExpandedControlled) {
      setInternalExpanded(next);
    }
    onToggleExpanded?.(next);
  };

  const isDark = variant === "brand" || variant === "navy";
  // White text on raspberry is 4.62:1; tinted white (white/85) dropped it to 3.7:1.
  const soft = isDark ? "text-white" : "text-[var(--text-secondary)]";
  const strong = isDark ? "text-white" : "text-[var(--ink)]";

  return (
    <div className={`w-full ${className}`.trim()}>
      <Card variant={variant} className="relative overflow-hidden px-5 py-4 sm:p-6 rounded-2xl">
        <div className="flex items-center justify-between relative z-10">
          <span className={`text-sm font-medium ${soft}`}>{title}</span>
          {onToggleHide && (
            <button
              type="button"
              onClick={onToggleHide}
              className={`min-w-[44px] min-h-[44px] -my-2.5 -mr-2.5 flex items-center justify-center p-1.5 rounded-full transition-colors ${
                isDark
                  ? "text-white hover:bg-white/10"
                  : "text-[var(--text-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-soft)]"
              }`}
              aria-label={hideBalance ? "Show balance" : "Hide balance"}
            >
              <AppIcon name={hideBalance ? "show" : "hide"} size={18} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 my-1 relative z-10">
          <div>
            <div
              className={`text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ${strong}`}
              aria-label={hideBalance ? "Amount hidden" : undefined}
            >
              {hideBalance ? HIDDEN : formatRM(balance)}
            </div>

            {secondaryBalance ? (
              breakdown && breakdown.length > 0 ? (
                <button
                  type="button"
                  id="balance-breakdown-trigger"
                  aria-expanded={expanded}
                  aria-controls="balance-breakdown-details"
                  onClick={handleToggleExpanded}
                  className={`text-sm mt-1.5 flex items-center gap-1.5 font-medium text-left transition-opacity hover:opacity-90 ${soft}`}
                >
                  <span>{secondaryBalance.label}</span>
                  <strong
                    className={`tabular-nums ${strong}`}
                    aria-label={hideBalance ? "Amount hidden" : undefined}
                  >
                    {hideBalance ? HIDDEN : formatRM(secondaryBalance.amount)}
                  </strong>
                  <AppIcon
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    className="ml-0.5"
                  />
                </button>
              ) : (
                <div className={`text-sm mt-1.5 flex items-center gap-1 font-medium ${soft}`}>
                  <span>{secondaryBalance.label}</span>
                  <strong className={`tabular-nums ${strong}`}>
                    {hideBalance ? HIDDEN : formatRM(secondaryBalance.amount)}
                  </strong>
                </div>
              )
            ) : subtitle ? (
              <p className={`text-sm mt-1 ${soft}`}>{subtitle}</p>
            ) : null}
          </div>

          {onArrowClick && (
            <button
              type="button"
              onClick={onArrowClick}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white/25 hover:bg-white/35 text-white flex items-center justify-center shrink-0"
              aria-label="View balance details"
            >
              <AppIcon name="forward" size={18} />
            </button>
          )}
        </div>

        {expanded && breakdown && breakdown.length > 0 && (
          <div
            id="balance-breakdown-details"
            role="region"
            aria-labelledby="balance-breakdown-trigger"
            className={`mt-3 pt-3 border-t space-y-2 text-xs relative z-10 ${
              isDark ? "border-white/20 text-white" : "border-[var(--border)] text-[var(--ink)]"
            }`}
          >
            {breakdown.map((row, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className={soft}>{row.label}</span>
                <strong
                  className={`tabular-nums font-bold ${strong}`}
                  aria-label={hideBalance ? "Amount hidden" : undefined}
                >
                  {hideBalance ? HIDDEN : formatRM(row.amount)}
                </strong>
              </div>
            ))}
            {footnote && (
              <p
                className={`text-[11px] pt-1.5 mt-1 border-t ${
                  isDark ? "border-white/10 text-white" : "border-[var(--border)] text-[var(--text-muted)]"
                }`}
              >
                {footnote}
              </p>
            )}
          </div>
        )}

        {(metadata || actions) && (
          <div
            className={`mt-3 pt-2.5 flex flex-wrap items-center justify-between gap-3 border-t relative z-10 ${
              isDark ? "border-white/20" : "border-[var(--border)]"
            }`}
          >
            {metadata && metadata.length > 0 ? (
              <div className="flex items-center gap-3 text-sm">
                {metadata.map((item, idx) => (
                  <span key={idx} className={`inline-flex items-center gap-1 font-medium ${soft}`}>
                    <span>{item.label}</span>
                    {item.value && <strong className={strong}>{item.value}</strong>}
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
    </div>
  );
}
