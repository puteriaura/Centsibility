import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold select-none transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--surface-soft)] text-[var(--ink)] border border-[var(--border)]",
        brand: "bg-[var(--primary)] text-white",
        soft: "bg-[var(--primary-soft)] text-[var(--primary)]",
        success: "bg-[var(--success-soft)] text-[var(--success)]",
        warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
        error: "bg-[var(--error-soft)] text-[var(--error)]",
        outline: "bg-transparent text-[var(--text-secondary)] border border-[var(--border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
}

export function Badge({ className = "", variant, icon, children, ...props }: BadgeProps) {
  return (
    <span className={badgeVariants({ variant, className })} {...props}>
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
