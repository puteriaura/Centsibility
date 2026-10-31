import * as React from "react";
import { formatRM } from "@/lib/format";
import { usePrivacy } from "./PrivacyContext";
import { AppIcon } from "@/components/ui/app-icon";

export const MASKED_AMOUNT = "RM*****";

export function maskAmounts(text: string, masked: boolean): string {
  if (!masked || !text) return text;
  return text.replace(/RM\s?[\d,]+(?:\.\d{2})?/g, MASKED_AMOUNT);
}

export function useMoney() {
  const privacy = usePrivacy();

  const format = React.useCallback(
    (amount: number | null, options?: { sign?: boolean }): string => {
      if (privacy.isMasked) {
        return MASKED_AMOUNT;
      }
      return formatRM(amount, options);
    },
    [privacy.isMasked],
  );

  return {
    ...privacy,
    format,
  };
}

export interface MoneyProps {
  amount: number | null;
  sign?: boolean;
  className?: string;
  onClick?: () => void;
}

export function Money({
  amount,
  sign = false,
  className = "",
  onClick,
}: MoneyProps) {
  const { isMasked, locked, openUnlockSheet } = usePrivacy();

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
      return;
    }
    if (locked) {
      e.stopPropagation();
      openUnlockSheet();
    }
  };

  if (isMasked) {
    return (
      <span
        className={`tabular-nums ${className}`.trim()}
        aria-label="Amount hidden"
        onClick={locked ? handleClick : onClick}
        style={locked ? { cursor: "pointer" } : undefined}
      >
        {MASKED_AMOUNT}
      </span>
    );
  }

  return (
    <span className={`tabular-nums ${className}`.trim()} onClick={onClick}>
      {formatRM(amount, { sign })}
    </span>
  );
}

export function LogInToView({
  label = "Unlock to view",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const { locked, openUnlockSheet } = usePrivacy();
  if (!locked) return null;

  return (
    <button
      type="button"
      onClick={openUnlockSheet}
      className={`inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer ${className}`.trim()}
    >
      <AppIcon name="lock" size={14} />
      <span>{label}</span>
    </button>
  );
}

export function HideAmountsButton({
  className = "",
  variant = "light",
  masked,
  onToggleHide,
}: {
  className?: string;
  variant?: "light" | "dark";
  masked?: boolean;
  onToggleHide?: () => void;
}) {
  const { locked, hidden, toggleHidden, openUnlockSheet } = usePrivacy();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleHide) {
      onToggleHide();
    } else if (locked) {
      openUnlockSheet();
    } else {
      toggleHidden();
    }
  };

  const isDark = variant === "dark";
  const isMasked = masked ?? (hidden || locked);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        locked
          ? "Unlock to see amounts"
          : isMasked
            ? "Show amounts"
            : "Hide amounts"
      }
      aria-pressed={isMasked}
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-full transition-colors ${
        isDark
          ? "text-[var(--on-brand-card)] hover:bg-white/15"
          : "text-[var(--text-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-soft)]"
      } ${className}`.trim()}
    >
      <AppIcon name={isMasked ? "show" : "hide"} size={18} />
    </button>
  );
}
