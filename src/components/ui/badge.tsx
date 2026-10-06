import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

// Badges label state; they never compete with buttons, so none are solid fills.
const badgeVariants = cva(
  "inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap select-none",
  {
    variants: {
      variant: {
        default: "bg-[var(--surface-sunken)] text-[var(--text-2)]",
        brand: "bg-[var(--action-tint)] text-[var(--action-text)]",
        soft: "bg-[var(--action-tint)] text-[var(--action-text)]",
        success: "bg-[var(--pos-bg)] text-[var(--pos)]",
        warning: "bg-[var(--warn-bg)] text-[var(--warn)]",
        error: "bg-[var(--neg-bg)] text-[var(--neg)]",
        outline: "bg-transparent text-[var(--text-2)] border border-[var(--line)]",
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
