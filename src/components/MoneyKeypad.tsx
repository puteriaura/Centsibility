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
  /** Colour of the confirm button background (Tailwind class, default bg-emerald-halal) */
  confirmBg?: string;
  /** Whether the keypad is busy (disable confirm) */
  busy?: boolean;
  /** Override initial raw digits (for reopening) */
  initialRaw?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert raw digit string (no decimal) → display string "RM X.XX" */
function rawToDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8); // max 8 digits → 999999.99
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
  confirmBg = "bg-emerald-halal",
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
      <div className="flex flex-col gap-4">
        {/* Amount display */}
        <div className="relative flex flex-col items-center rounded-3xl glass-panel bg-void/50 px-6 py-6 shadow-inner border border-starlight/20">
          <div
            className={`font-mono text-5xl font-bold tracking-tight transition-colors drop-shadow-sm ${
              tooHigh
                ? "text-nova-red drop-shadow-[0_0_8px_var(--nova-red)]"
                : amount === 0
                  ? "text-starlight/30"
                  : "text-neon-mint drop-shadow-[0_0_10px_var(--neon-mint)]"
            }`}
          >
            {display}
          </div>

          {/* Validation hint */}
          {tooLow && (
            <p className="mt-2 font-kid text-xs font-bold text-nova-red animate-pulse uppercase tracking-wider">
              Minimum is RM {min.toFixed(2)}
            </p>
          )}
          {tooHigh && (
            <p className="mt-2 font-kid text-xs font-bold text-nova-red animate-pulse uppercase tracking-wider">
              Maximum is RM {max.toLocaleString("en-MY")}
            </p>
          )}
          {!tooLow && !tooHigh && amount > 0 && (
            <p className="mt-2 font-kid text-[10px] font-bold text-starlight/50 uppercase tracking-widest">
              Tap Next when ready
            </p>
          )}
        </div>

        {/* Keypad grid */}
        <div className="grid grid-cols-3 gap-3">
          {Keys.flat().map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className={`rounded-[1.25rem] py-4 font-mono text-2xl font-bold transition active:scale-90 shadow-sm border ${
                k === "⌫"
                  ? "bg-nova-red/10 border-nova-red/30 text-nova-red text-2xl hover:bg-nova-red/20"
                  : "glass-panel border-starlight/10 text-starlight hover:bg-white/10 hover:border-starlight/30"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Action row */}
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl bg-void border border-starlight/20 px-6 py-4 font-kid text-sm font-bold text-starlight uppercase tracking-wider hover:bg-white/10 transition shadow-sm"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={!valid}
            className={`btn-press flex-1 rounded-2xl py-4 font-kid text-sm font-bold text-void transition uppercase tracking-wider shadow-neon ${confirmBg} disabled:opacity-30 disabled:shadow-none hover:scale-[1.02]`}
          >
            {showReference ? "Next →" : confirmLabel}
          </button>
        </div>
      </div>
    );
  }

  // ── Reference screen ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Amount recap */}
      <div className="flex items-center gap-4 rounded-2xl glass-panel bg-void/30 border-starlight/20 px-5 py-4">
        <button
          type="button"
          onClick={() => setStep("amount")}
          className="text-starlight/50 text-2xl font-bold hover:text-starlight transition"
        >
          ←
        </button>
        <div className="font-mono text-3xl font-bold text-neon-mint drop-shadow-[0_0_5px_var(--neon-mint)]">
          {display}
        </div>
        <span className="ml-auto font-kid text-[10px] font-bold uppercase tracking-widest text-starlight/40">
          tap ← to edit
        </span>
      </div>

      {/* Reference dropdown */}
      <div>
        <label className="ml-2 font-kid text-[10px] font-bold uppercase tracking-widest text-starlight/60">
          Transmission Log Code
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {REFERENCE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setReference(opt)}
              className={`rounded-2xl px-4 py-3 font-kid text-xs font-bold transition active:scale-95 border ${
                reference === opt
                  ? "bg-cosmic-blue border-cosmic-blue text-white shadow-[0_0_15px_var(--cosmic-blue)]"
                  : "glass-panel border-starlight/20 text-starlight/80 hover:bg-white/10"
              }`}
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
            className="mt-3 w-full rounded-2xl border border-starlight/30 bg-void/50 px-5 py-4 font-kid text-sm text-starlight placeholder:text-starlight/30 shadow-inner focus:outline-none focus:border-neon-mint"
          />
        )}
      </div>

      {/* Fee breakdown or extra content slot */}
      {extraContent}

      {/* Confirm */}
      <button
        type="button"
        onClick={doConfirm}
        disabled={confirming || busy || (reference === "Others" && !customRef.trim())}
        className={`w-full rounded-2xl py-4 font-kid text-sm font-bold text-void transition shadow-neon uppercase tracking-wider hover:scale-[1.02] ${confirmBg} disabled:opacity-30 disabled:shadow-none`}
      >
        {confirming ? "Processing…" : confirmLabel}
      </button>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-2xl bg-void border border-starlight/20 py-4 font-kid text-sm font-bold text-starlight uppercase tracking-wider hover:bg-white/10 transition shadow-sm"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
