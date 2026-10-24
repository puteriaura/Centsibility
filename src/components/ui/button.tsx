import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

// Primary actions use a chunky mustard button. Secondary uses a bordered
// surface, outline is neutral, and ghost is for inline text actions.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold select-none cursor-pointer rounded-full transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] min-h-[44px] min-w-[44px]",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--sun)] text-[var(--on-sun)] font-display font-extrabold rounded-[18px]",
        secondary:
          "bg-[var(--surface)] border-2 border-[var(--blue-200)] text-[var(--action-text)]",
        outline:
          "bg-[var(--surface)] text-[var(--ink)] border border-[var(--line-strong)] hover:bg-[var(--surface-hover)]",
        ghost:
          "bg-transparent text-[var(--action-text)] hover:bg-[var(--action-tint)]",
        danger:
          "bg-[var(--neg)] text-white hover:bg-[var(--red-800)]",
        brand:
          "bg-[var(--sun)] text-[var(--on-sun)] font-display font-extrabold rounded-[18px]",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={buttonVariants({ variant, size, className })}
        data-variant={variant ?? "primary"}
        {...props}
      >
        {loading && (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
