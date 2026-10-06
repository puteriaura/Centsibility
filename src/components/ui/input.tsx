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
    const autoId = React.useId();
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : autoId);
    const messageId = error || helperText ? `${inputId}-message` : undefined;

    return (
      <div className="w-full mb-3">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-[var(--ink)] mb-1.5">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[var(--text-3)]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={props.type || "text"}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={messageId}
            className={[
              "w-full min-h-[48px] px-4 py-3 text-base text-[var(--ink)] bg-[var(--surface)] border rounded-xl outline-none",
              "focus:border-[var(--action)] focus:shadow-[var(--focus-ring)]",
              leftIcon ? "pl-10" : "",
              rightIcon ? "pr-10" : "",
              error
                ? "border-[var(--neg)] focus:border-[var(--neg)]"
                : "border-[var(--line-strong)]",
              disabled
                ? "bg-[var(--surface-sunken)] border-[var(--line)] text-[var(--text-2)] cursor-not-allowed"
                : "",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-[var(--text-3)]">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p id={messageId} className="mt-1.5 mb-0 text-xs font-semibold text-[var(--neg)]" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={messageId} className="mt-1.5 mb-0 text-xs text-[var(--text-3)]">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
