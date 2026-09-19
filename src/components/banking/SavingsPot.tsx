import * as React from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AppIcon } from "@/components/ui/app-icon";

export interface SavingsPotProps {
  id?: string;
  name: string;
  target: number;
  current: number;
  currency?: string;
  category?: string;
  targetDate?: string;
  icon?: string;
  onAddFunds?: () => void;
  onClick?: () => void;
  className?: string;
}

export function SavingsPot({
  name,
  target,
  current,
  currency = "RM",
  category,
  targetDate,
  icon = "target",
  onAddFunds,
  onClick,
  className = "",
}: SavingsPotProps) {
  const percentage = Math.min(Math.round((current / (target || 1)) * 100), 100);
  const isCompleted = current >= target;

  return (
    <Card
      variant="default"
      onClick={onClick}
      className={`p-4 sm:p-5 rounded-2xl border border-[var(--border)] transition-all duration-200 hover:shadow-md ${
        onClick ? "cursor-pointer" : ""
      } ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <AppIcon name={icon} size={22} />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-[var(--ink)] leading-snug">
              {name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
              {category && <span>{category}</span>}
              {category && targetDate && <span>·</span>}
              {targetDate && <span>Due {targetDate}</span>}
            </div>
          </div>
        </div>

        {isCompleted && (
          <span className="inline-flex items-center gap-1 bg-[var(--success-soft)] text-[var(--success)] text-xs font-semibold px-2.5 py-0.5 rounded-full">
            <AppIcon name="approve" size={14} />
            Completed
          </span>
        )}
      </div>

      <div className="my-3">
        <div className="flex items-baseline justify-between text-xs mb-1.5 font-medium">
          <span className="text-[var(--text-primary)] font-bold tabular-nums text-sm">
            {currency} {current.toFixed(2)}
          </span>
          <span className="text-[var(--text-muted)] tabular-nums">
            of {currency} {target.toFixed(2)} ({percentage}%)
          </span>
        </div>
        <Progress value={current} max={target} height={8} />
      </div>

      {onAddFunds && !isCompleted && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] flex justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddFunds();
            }}
            className="text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] inline-flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-[var(--primary-pale)] transition-colors"
          >
            <AppIcon name="plus" size={14} />
            Add Funds
          </button>
        </div>
      )}
    </Card>
  );
}
