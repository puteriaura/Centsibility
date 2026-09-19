import * as React from "react";
import { Card } from "@/components/ui/card";
import { AppIcon } from "@/components/ui/app-icon";

export interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  icon,
  iconColor = "var(--primary)",
  actionText,
  onAction,
  className = "",
}: StatCardProps) {
  return (
    <Card
      variant="default"
      className={`p-4 rounded-2xl border border-[var(--border)] flex flex-col justify-between ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
        {icon && (
          <div className="text-[var(--primary)]" style={{ color: iconColor }}>
            <AppIcon name={icon} size={18} />
          </div>
        )}
      </div>

      <div className="my-1">
        <div className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] tabular-nums leading-tight">
          {value}
        </div>
        {subtitle && (
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
            {subtitle}
          </p>
        )}
      </div>

      {actionText && onAction && (
        <div className="mt-2 pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onAction}
            className="text-xs font-semibold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
          >
            {actionText}
          </button>
        </div>
      )}
    </Card>
  );
}
