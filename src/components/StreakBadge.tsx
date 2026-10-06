import * as React from "react";
import { AppIcon } from "@/components/ui/app-icon";

export interface StreakBadgeProps {
  count: number;
  className?: string;
}

export function StreakBadge({ count, className = "" }: StreakBadgeProps) {
  const n = Number(count) || 0;
  if (n <= 0) return null;

  return (
    <span
      className={`inline-flex h-8 items-center gap-1 rounded-full bg-[var(--surface)] pl-2 pr-3 text-sm font-bold tabular-nums text-[var(--ink)] ${className}`.trim()}
      role="status"
      aria-label={`${n} day streak`}
    >
      <AppIcon name="flame" size={16} color="var(--warn)" />
      {n}
    </span>
  );
}
