import { useState, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type KeypadRef =
  | "Allowance"
  | "Emergency"
  | "Eid Money"
  | "Birthday"
  | "School Fees"
  | "Others";

const REFERENCE_OPTIONS: KeypadRef[] = [
  "Allowance",
  "Emergency",
  "Eid Money",
  "Birthday",
  "School Fees",
  "Others",
];

interface MoneyKeypadProps {
  /** Minimum valid amount in RM (default 0.50) */
  min?: number;
  /** Maximum valid amount in RM (default 100 000) */
  max?: number;
  /** Label for the confirm button */
  confirmLabel?: string;
  /** Called when the user hits "Next" then confirms */
  onConfirm: (amount: number, reference?: string) => void | Promise<void>;
  /** If provided, shows a reference dropdown step */
  showReference?: boolean;
  /** Show a cancel button */
  onCancel?: () => void;
  /** Extra content to render between reference and confirm button (e.g. fee breakdown) */
  extraContent?: React.ReactNode;
  /** Colour of the confirm button background (ignored in wireframe) */
  confirmBg?: string;
  /** Whether the keypad is busy (disable confirm) */
  busy?: boolean;
  /** Override initial raw digits (for reopening) */
  initialRaw?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert raw digit string (no decimal) → display string "RM X.XX" */
function rawToDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "RM 0.00";
  const padded = digits.padStart(3, "0");
  const cents = padded.slice(-2);
  const ringgit = padded.slice(0, padded.length - 2);
  const num = parseInt(ringgit, 10);
  return `RM ${num.toLocaleString("en-MY")}.${cents}`;
}

/** Raw digits → actual number value */
function rawToNumber(raw: string): number {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (!digits) return 0;
  return parseInt(digits.padStart(3, "0"), 10) / 100;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MoneyKeypad({
  min = 0.5,
  max = 100_000,
  confirmLabel = "Confirm",
  onConfirm,
  showReference = false,
  onCancel,
  extraContent,
  confirmBg: _confirmBg,
  busy = false,
  initialRaw = "",
}: MoneyKeypadProps) {
  const [step, setStep] = useState<"amount" | "reference">("amount");
  const [raw, setRaw] = useState(initialRaw);
  const [reference, setReference] = useState<KeypadRef>("Allowance");
  const [customRef, setCustomRef] = useState("");
  const [confirming, setConfirming] = useState(false);

  const amount = rawToNumber(raw);
  const display = rawToDisplay(raw);
  const tooLow = amount > 0 && amount < min;
  const tooHigh = amount > max;
  const valid = amount >= min && !tooHigh;

  const press = useCallback((key: string) => {
    if (key === "⌫") {
      setRaw((r) => r.slice(0, -1));
    } else if (key === "00") {
      setRaw((r) => {
        const next = r + "00";
        return next.slice(0, 8);
      });
    } else {
      setRaw((r) => {
        const next = r + key;
        return next.slice(0, 8);
      });
    }
  }, []);

  const handleNext = () => {
    if (!valid) return;
    if (showReference) {
      setStep("reference");
    } else {
      void doConfirm();
    }
  };

  const doConfirm = async () => {
    if (confirming || busy) return;
    setConfirming(true);
    try {
      const ref = showReference
        ? reference === "Others"
          ? customRef.trim() || "Others"
          : reference
        : undefined;
      await onConfirm(amount, ref);
    } finally {
      setConfirming(false);
    }
  };

  const Keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["00", "0", "⌫"],
  ];

  // ── Amount screen ──────────────────────────────────────────────────────────
  if (step === "amount") {
    return (
      <div className="wireframe-col">
        {/* Amount display */}
        <div className="wireframe-box" style={{ textAlign: "center", padding: "1rem" }}>
          <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
            {display}
          </div>

          {tooLow && (
            <p style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>
              Minimum is RM {min.toFixed(2)}
            </p>
          )}
          {tooHigh && (
            <p style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>
              Maximum is RM {max.toLocaleString("en-MY")}
            </p>
          )}
          {!tooLow && !tooHigh && amount > 0 && (
            <p style={{ margin: "0.25rem 0", fontSize: "0.8rem", color: "#666" }}>
              Tap Next when ready
            </p>
          )}
        </div>

        {/* Keypad grid */}
        <div className="wireframe-grid-3">
          {Keys.flat().map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              style={{ padding: "0.75rem", fontSize: "1.25rem", fontWeight: "bold" }}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Action row */}
        <div className="wireframe-row">
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={!valid}
            style={{ flex: 1 }}
          >
            {showReference ? "Next →" : confirmLabel}
          </button>
        </div>
      </div>
    );
  }

  // ── Reference screen ───────────────────────────────────────────────────────
  return (
    <div className="wireframe-col">
      {/* Amount recap */}
      <div className="wireframe-space-between wireframe-box">
        <button
          type="button"
          onClick={() => setStep("amount")}
          aria-label="Back to amount"
        >
          [icon: back]
        </button>
        <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
          {display}
        </div>
        <small>(tap back to edit)</small>
      </div>

      {/* Reference options */}
      <fieldset>
        <legend>Transmission Log Code</legend>
        <div className="wireframe-grid-2">
          {REFERENCE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setReference(opt)}
              style={{
                border: reference === opt ? "2px solid #000" : "1px solid #ccc",
                fontWeight: reference === opt ? "bold" : "normal",
              }}
            >
              {opt}
            </button>
          ))}
        </div>

        {reference === "Others" && (
          <input
            value={customRef}
            onChange={(e) => setCustomRef(e.target.value)}
            placeholder="Log details..."
            maxLength={100}
            style={{ marginTop: "0.5rem" }}
          />
        )}
      </fieldset>

      {/* Fee breakdown or extra content slot */}
      {extraContent}

      {/* Confirm */}
      <div className="wireframe-row">
        <button
          type="button"
          onClick={doConfirm}
          disabled={confirming || busy || (reference === "Others" && !customRef.trim())}
          style={{ flex: 1 }}
        >
          {confirming ? "Processing…" : confirmLabel}
        </button>

        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
