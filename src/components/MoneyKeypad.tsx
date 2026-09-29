import { useState, useCallback } from "react";
import { NumericKeypad } from "@/components/ui/numeric-keypad";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";
import { formatRM } from "@/lib/format";

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
  if (digits.length === 0) return "RM0.00";
  const padded = digits.padStart(3, "0");
  const cents = padded.slice(-2);
  const ringgit = padded.slice(0, padded.length - 2);
  const num = parseInt(ringgit, 10);
  return `RM${num.toLocaleString("en-MY")}.${cents}`;
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
      <div className="space-y-4">
        {/* Amount display */}
        <div className="p-4 rounded-2xl bg-[var(--surface-soft)] border border-[var(--border)] text-center">
          <div className="text-3xl font-extrabold text-[var(--ink)] tabular-nums">
            {display}
          </div>

          {tooLow && (
            <p className="text-xs text-[var(--error-text)] mt-1 font-medium">
              Minimum is {formatRM(min)}
            </p>
          )}
          {tooHigh && (
            <p className="text-xs text-[var(--error-text)] mt-1 font-medium">
              Maximum is RM{max.toLocaleString("en-MY")}
            </p>
          )}
          {!tooLow && !tooHigh && amount > 0 && (
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Tap Next when ready
            </p>
          )}
        </div>

        {/* Keypad grid */}
        <NumericKeypad onKeyPress={press} variant="pin" />

        {/* Action row */}
        <div className="flex items-center gap-3 pt-2">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel} className="flex-1 justify-center">
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            onClick={handleNext}
            disabled={!valid}
            className="flex-1 justify-center font-bold"
          >
            {showReference ? "Next →" : confirmLabel}
          </Button>
        </div>
      </div>
    );
  }

  // ── Reference screen ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Amount recap */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--surface-soft)] border border-[var(--border)]">
        <button
          type="button"
          onClick={() => setStep("amount")}
          aria-label="Back to amount"
          className="p-2 rounded-xl hover:bg-white text-[var(--ink)] transition-colors"
        >
          <AppIcon name="back" size={20} />
        </button>
        <div className="text-2xl font-extrabold text-[var(--ink)] tabular-nums">
          {display}
        </div>
        <small className="text-xs text-[var(--text-muted)]">(edit)</small>
      </div>

      {/* Reference options */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider block">
          Transmission Purpose
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {REFERENCE_OPTIONS.map((opt) => (
            <Button
              key={opt}
              type="button"
              variant={reference === opt ? "primary" : "secondary"}
              size="sm"
              onClick={() => setReference(opt)}
              className="justify-center text-xs"
            >
              {opt}
            </Button>
          ))}
        </div>

        {reference === "Others" && (
          <input
            value={customRef}
            onChange={(e) => setCustomRef(e.target.value)}
            placeholder="Log details..."
            maxLength={100}
            className="w-full h-11 px-3 mt-2 rounded-xl border border-[var(--border)] bg-white text-base font-medium text-[var(--ink)] focus:border-[var(--primary)] outline-none"
          />
        )}
      </div>

      {/* Fee breakdown or extra content slot */}
      {extraContent}

      {/* Confirm */}
      <div className="flex items-center gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1 justify-center">
            Cancel
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          onClick={doConfirm}
          disabled={confirming || busy || (reference === "Others" && !customRef.trim())}
          className="flex-1 justify-center font-bold"
        >
          {confirming ? "Processing…" : confirmLabel}
        </Button>
      </div>
    </div>
  );
}
