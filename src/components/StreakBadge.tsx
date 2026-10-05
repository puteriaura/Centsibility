import * as React from "react";

export interface StreakBadgeProps {
  count: number;
  className?: string;
}

export function StreakBadge({ count, className = "" }: StreakBadgeProps) {
  const n = Number(count) || 0;
  if (n <= 0) return null;

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--surface-soft)] text-[var(--ink)] border border-[var(--border)] tabular-nums shadow-2xs ${className}`.trim()}
      role="status"
      aria-label={`${n} day streak`}
    >
      {`${n}🔥`}
    </span>
  );
}
