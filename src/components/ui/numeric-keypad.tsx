import * as React from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { sfx } from "@/lib/sounds";

export interface NumericKeypadProps {
  onKeyPress: (key: string) => void;
  keys?: string[][];
  disabled?: boolean;
  variant?: "default" | "pin";
  className?: string;
}

export const DEFAULT_KEYPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["00", "0", "⌫"],
];

// Bottom-left is empty: browsers can't do Face ID, so no fake biometric key.
export const PIN_KEYPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "delete"],
];

export function NumericKeypad({
  onKeyPress,
  keys = DEFAULT_KEYPAD_KEYS,
  disabled = false,
  variant = "pin",
  className = "",
}: NumericKeypadProps) {
  const isPinStyle = variant === "pin";

  const handlePress = (key: string) => {
    if (disabled) return;
    sfx.tap();
    onKeyPress(key);
  };

  return (
    <div
      className={
        isPinStyle
          ? `pin-grid ${className}`.trim()
          : `grid grid-cols-3 gap-2.5 ${className}`.trim()
      }

      style={isPinStyle ? undefined : { margin: "0.5rem 0" }}
    >
      {keys.flat().map((key, idx) => {
        const isDelete = key === "⌫" || key === "delete";
        const isClear = key === "clear";

        if (key === "") return <span key={`blank-${idx}`} aria-hidden="true" />;

        if (isPinStyle) {
          return (
            <button
              key={`${key}-${idx}`}
              type="button"
              disabled={disabled}
              onClick={() => handlePress(key)}
              aria-label={
                isDelete
                  ? "Backspace"
                  : isClear
                    ? "Clear"
                    : `Key ${key}`
              }
              className="pin-btn min-w-[48px] min-h-[48px]"
            >
              {isDelete ? (
                <span className="pin-backspace" aria-hidden="true">
                  <AppIcon name="backspace" size={20} />
                </span>
              ) : isClear ? (
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-secondary)" }}>
                  C
                </span>
              ) : (
                key
              )}
            </button>
          );
        }

        return (
          <button
            key={`${key}-${idx}`}
            type="button"
            disabled={disabled}
            onClick={() => handlePress(key)}
            aria-label={
              isDelete
                ? "Delete"
                : isClear
                  ? "Clear"
                  : `Key ${key}`
            }
            className="min-w-[48px] min-h-[48px]"
            style={{ padding: "0.75rem", fontSize: "1.25rem", fontWeight: "bold" }}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}
