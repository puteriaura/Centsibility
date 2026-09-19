import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 select-none cursor-pointer focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] min-h-[44px] min-w-[44px]",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2",
        secondary:
          "bg-white text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--surface-soft)] hover:border-[var(--primary-soft)] hover:text-[var(--primary)] shadow-sm",
        outline:
          "bg-transparent text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--primary-pale)] hover:border-[var(--primary)] hover:text-[var(--primary)]",
        ghost:
          "bg-transparent text-[var(--primary)] hover:bg-[var(--primary-pale)] border-transparent",
        danger:
          "bg-[var(--error)] text-white hover:opacity-90 shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--error)]",
        brand:
          "bg-[var(--primary)] text-white shadow-md hover:bg-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
      },
      size: {
        sm: "h-11 px-3.5 text-xs rounded-full min-h-[44px] min-w-[44px]",
        md: "h-11 px-5 text-sm rounded-full min-h-[44px]",
        lg: "h-13 px-6 text-base rounded-full min-h-[48px]",
        icon: "h-11 w-11 rounded-full min-h-[44px] min-w-[44px] p-0 flex items-center justify-center",
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
        className={buttonVariants({ variant, size, className })}
        data-variant={variant}
        {...props}
      >
        {loading && (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
