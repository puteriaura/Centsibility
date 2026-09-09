export interface NumericKeypadProps {
  onKeyPress: (key: string) => void;
  keys?: string[][];
  disabled?: boolean;
  className?: string;
}

export const DEFAULT_KEYPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["00", "0", "⌫"],
];

export const PIN_KEYPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["clear", "0", "delete"],
];

export function NumericKeypad({
  onKeyPress,
  keys = DEFAULT_KEYPAD_KEYS,
  disabled = false,
  className = "wireframe-grid-3",
}: NumericKeypadProps) {
  return (
    <div className={className} style={{ margin: "0.5rem 0" }}>
      {keys.flat().map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => onKeyPress(key)}
          aria-label={
            key === "⌫" || key === "delete"
              ? "Delete"
              : key === "clear"
                ? "Clear"
                : `Key ${key}`
          }
          style={{ padding: "0.75rem", fontSize: "1.25rem", fontWeight: "bold" }}
        >
          {key}
        </button>
      ))}
    </div>
  );
}
