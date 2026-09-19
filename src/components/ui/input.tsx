import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, helperText, error, leftIcon, rightIcon, id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full mb-3">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-[var(--ink)] mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full min-h-[48px] px-4 py-3 text-sm text-[var(--text-primary)] bg-white border rounded-[var(--radius-sm)] transition-all duration-150 outline-none
              ${leftIcon ? "pl-10" : ""}
              ${rightIcon ? "pr-10" : ""}
              ${
                error
                  ? "border-[var(--error)] focus:ring-2 focus:ring-[var(--error)]/20"
                  : "border-[var(--border)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              }
              ${disabled ? "bg-[var(--surface-soft)] text-[var(--text-muted)] cursor-not-allowed" : ""}
              ${className}
            `.trim()}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-[var(--text-muted)]">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-[var(--error)] font-medium" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-[var(--text-muted)]">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
