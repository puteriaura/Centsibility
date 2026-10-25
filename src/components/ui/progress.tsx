import * as React from "react";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  max?: number;
  height?: number | string;
  indicatorColor?: string;
  showLabel?: boolean;
  label?: string;
}

export function Progress({
  value,
  max = 100,
  height = 8,
  indicatorColor,
  showLabel = false,
  label,
  className = "",
  ...props
}: ProgressProps) {
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100);
  const ariaLabel = props["aria-label"] || label || "Progress";

  return (
    <div className={`w-full ${className}`} {...props}>
      <div
        className="w-full bg-[var(--primary-soft)] rounded-full overflow-hidden"
        style={{ height }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={ariaLabel}
      >
        <div
          className="motion-fill h-full rounded-full"
          style={{
            width: "100%",
            "--progress": percentage / 100,
            backgroundColor: indicatorColor || "var(--primary)",
          } as React.CSSProperties}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between items-center text-xs text-[var(--text-muted)] mt-1.5 font-medium">
          <span>{percentage.toFixed(0)}%</span>
          <span>
            {value} / {max}
          </span>
        </div>
      )}
    </div>
  );
}
