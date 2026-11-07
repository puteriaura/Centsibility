import * as React from "react";
import { Card } from "@/components/ui/card";
import { AppIcon } from "@/components/ui/app-icon";
import { Money, HideAmountsButton } from "@/features/privacy";

export interface BalanceCardProps {
  title?: string;
  balance: number | null;
  confirmed?: boolean;
  subtitle?: React.ReactNode;
  hideBalance?: boolean;
  onToggleHide?: () => void;
  metadata?: Array<{ label: string; value?: string }>;
  secondaryBalance?: { label: string; amount: number | null };
  onArrowClick?: () => void;
  actions?: React.ReactNode;
  variant?: "brand" | "navy" | "default";
  className?: string;
  breakdown?: Array<{ label: string; amount: number | null }>;
  footnote?: string;
  tag?: React.ReactNode;
  isExpanded?: boolean;
  onToggleExpanded?: (expanded: boolean) => void;
}

const HIDDEN = "RM*****";

// The screen's periwinkle balance surface. Hierarchy: label, then the
// amount (largest type on the screen), then one supporting line.
export function BalanceCard({
  title = "Spending balance",
  balance,
  confirmed = false,
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
  tag,
  isExpanded,
  onToggleExpanded,
}: BalanceCardProps) {
  const [glow, setGlow] = React.useState(false);
  const previousBalance = React.useRef<number | null>(null);
  React.useEffect(() => {
    setGlow(false);
    if (!confirmed || balance === null) return;
    const changed = previousBalance.current !== null && previousBalance.current !== balance;
    previousBalance.current = balance;
    if (!changed) return;
    setGlow(true);
    const timer = window.setTimeout(() => setGlow(false), 700);
    return () => window.clearTimeout(timer);
  }, [balance, confirmed]);
  const [internalExpanded, setInternalExpanded] = React.useState(false);
  const isExpandedControlled = typeof isExpanded === "boolean";
  const expanded = isExpandedControlled ? isExpanded : internalExpanded;
  const breakdownId = React.useId();

  const handleToggleExpanded = () => {
    const next = !expanded;
    if (!isExpandedControlled) setInternalExpanded(next);
    onToggleExpanded?.(next);
  };

  const isDark = variant === "brand" || variant === "navy";
  // Navy text stays readable on the same brand surface in both themes.
  const soft = isDark ? "text-[var(--on-brand-card)]" : "text-[var(--text-2)]";
  const strong = isDark ? "text-[var(--on-brand-card)]" : "text-[var(--ink)]";
  const divider = isDark ? "border-white/25" : "border-[var(--line)]";

  return (
    <div className={`w-full ${className}`.trim()}>
      <Card variant={variant} className={`balance-hero${glow ? " balance-hero--glow" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`balance-hero__label ${soft}`}>{title}</span>
          <HideAmountsButton variant={isDark ? "dark" : "light"}
            masked={onToggleHide ? hideBalance : undefined} onToggleHide={onToggleHide}
            className="-my-2.5 -mr-2.5 shrink-0" />
        </div>

        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div
              className={`balance-hero__amount ${Math.abs(balance ?? 0) >= 1000000 ? "balance-hero__amount--long" : ""} ${strong}`}
              aria-label={hideBalance ? "Amount hidden" : undefined}
            >
              {hideBalance ? HIDDEN : <Money amount={balance} />}
            </div>

            {secondaryBalance ? (
              breakdown && breakdown.length > 0 ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={breakdownId}
                  onClick={handleToggleExpanded}
                  className={`mt-1 -ml-1 min-h-[36px] px-1 justify-start gap-1.5 rounded-lg text-sm font-medium ${soft} ${
                    isDark
                      ? "hover:bg-white/10"
                      : "hover:bg-[var(--surface-sunken)]"
                  }`}
                >
                  <span>{secondaryBalance.label}</span>
                  <strong
                    className={`whitespace-nowrap tabular-nums ${strong}`}
                  >
                    {hideBalance ? (
                      HIDDEN
                    ) : (
                      <Money amount={secondaryBalance.amount} />
                    )}
                  </strong>
                  <AppIcon
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={16}
                  />
                </button>
              ) : (
                <div
                  className={`mt-1 flex flex-wrap items-center gap-1.5 text-sm font-medium ${soft}`}
                >
                  <span>{secondaryBalance.label}</span>
                  <strong className={`tabular-nums ${strong}`}>
                    {hideBalance ? (
                      HIDDEN
                    ) : (
                      <Money amount={secondaryBalance.amount} />
                    )}
                  </strong>
                </div>
              )
            ) : subtitle ? (
              <p className={`mt-1 mb-0 text-sm ${soft}`}>{subtitle}</p>
            ) : null}
          </div>

          {onArrowClick && (
            <button
              type="button"
              onClick={onArrowClick}
              className={`h-11 w-11 shrink-0 rounded-full ${
                isDark
                  ? "bg-[var(--surface)] text-[var(--action-text)] hover:bg-[var(--blue-50)]"
                  : "bg-[var(--action)] text-white"
              }`}
              aria-label="Open wallet"
            >
              <AppIcon name="forward" size={20} />
            </button>
          )}
        </div>

        {expanded && breakdown && breakdown.length > 0 && (
          <div
            id={breakdownId}
            className={`mt-3 pt-3 border-t ${divider} space-y-1.5 text-sm`}
          >
            {breakdown.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between"
              >
                <span className={soft}>{row.label}</span>
                <strong
                  className={`tabular-nums font-semibold ${strong}`}
                  aria-label={hideBalance ? "Amount hidden" : undefined}
                >
                  {hideBalance ? HIDDEN : <Money amount={row.amount} />}
                </strong>
              </div>
            ))}
            {footnote && (
              <p className={`m-0 pt-1.5 text-xs ${soft}`}>{footnote}</p>
            )}
          </div>
        )}

        {(metadata?.length || actions) && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {metadata && metadata.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {metadata.map((item) => (
                  <span
                    key={item.label}
                    className={
                      isDark
                        ? "balance-hero__meta text-[var(--on-brand-card)]"
                        : "inline-flex h-[26px] items-center rounded-full bg-[var(--surface-sunken)] px-2.5 text-xs font-semibold text-[var(--text-2)]"
                    }
                  >
                    {item.label}
                    {item.value ? (
                      <strong className="ml-1">{item.value}</strong>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : (
              <span />
            )}
            {actions && (
              <div className="flex items-center gap-2">{actions}</div>
            )}
          </div>
        )}
        {tag && <div className="balance-hero__tag"><span>{tag}</span></div>}
      </Card>
    </div>
  );
}
