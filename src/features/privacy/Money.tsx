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
    (amount: number, options?: { sign?: boolean }): string => {
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
  amount: number;
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
        className={className}
        aria-label="Amount hidden"
        onClick={locked ? handleClick : onClick}
        style={locked ? { cursor: "pointer" } : undefined}
      >
        {MASKED_AMOUNT}
      </span>
    );
  }

  return (
    <span className={className} onClick={onClick}>
      {formatRM(amount, { sign })}
    </span>
  );
}

export function LogInToView({
  label = "Log in to view",
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

export function EyeToggle({
  className = "",
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  const { locked, hidden, toggleHidden, openUnlockSheet } = usePrivacy();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (locked) {
      openUnlockSheet();
    } else {
      toggleHidden();
    }
  };

  const isDark = variant === "dark";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        locked
          ? "Unlock to see amounts"
          : hidden
            ? "Show amounts"
            : "Hide amounts"
      }
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-full transition-colors ${
        isDark
          ? "text-white/80 hover:text-white hover:bg-white/10"
          : "text-[var(--text-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-soft)]"
      } ${className}`.trim()}
    >
      <AppIcon name={hidden || locked ? "show" : "hide"} size={18} />
    </button>
  );
}
