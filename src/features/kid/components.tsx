import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { PennyMascot } from "@/components/PennyMascot";

export function StatChip({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
  bg?: string;
}) {
  return (
    <div className="stat-chip">
      <AppIcon name={icon} size={18} color="var(--primary)" />
      <div className="stat-chip__value">{value}</div>
      <small className="stat-chip__label">{label}</small>
    </div>
  );
}

export function ActionTile({
  to,
  icon,
  title,
  sub,
}: {
  to: string;
  icon: string;
  title: string;
  sub: string;
  bg?: string;
  text?: string;
}) {
  return (
    <Link to={to} className="action-tile">
      <span className="action-tile__icon" aria-hidden>
        <AppIcon name={icon} size={22} color="var(--primary)" />
      </span>
      <strong className="action-tile__title">{title}</strong>
      <small className="action-tile__sub">{sub}</small>
    </Link>
  );
}

/** Shown when the kid's account could not be loaded and there is no earlier data to show. */
export function KidLoadError({ onRetry }: { onRetry: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      role="alert"
      className="ui-card p-6 flex flex-col items-center gap-3 text-center"
    >
      <PennyMascot state={busy ? "loading" : "unavailable"} size={96} />
      <h2 className="text-base font-bold text-[var(--text-primary)] m-0">
        We couldn't load your account
      </h2>
      <p className="text-sm text-[var(--text-secondary)] m-0">
        Check your internet connection and try again.
      </p>
      <Button
        type="button"
        variant="primary"
        onClick={retry}
        disabled={busy}
        className="justify-center"
      >
        {busy ? "Trying again…" : "Try again"}
      </Button>
    </div>
  );
}

/** Points keypad for reward requests: counts integer points */
export function RewardCoinPicker({
  maxPoints,
  onConfirm,
  onCancel,
  rewardName,
}: {
  maxPoints: number;
  onConfirm: (cost: number) => void;
  onCancel: () => void;
  rewardName: string;
}) {
  const [raw, setRaw] = useState("");
  const coins = Math.min(parseInt(raw || "0", 10), maxPoints);
  const valid = coins >= 1;

  const press = (k: string) => {
    if (k === "⌫") {
      setRaw((r) => r.slice(0, -1));
      return;
    }
    setRaw((r) => {
      const next = r + k;
      const val = parseInt(next, 10);
      if (val > maxPoints) return r;
      return next.slice(0, 6);
    });
  };

  const Keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["00", "0", "⌫"],
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="p-4 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] text-center">
        <div className="text-2xl sm:text-3xl font-extrabold text-[var(--primary-text)] flex items-center justify-center gap-1.5 tabular-nums">
          {coins} <AppIcon name="star" size={22} color="var(--primary)" />
        </div>
        {coins > 0 && (
          <small className="text-xs text-[var(--text-secondary)] mt-1 block">
            of {maxPoints.toLocaleString()} pts available
          </small>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Keys.flat().map((k) => (
          <Button
            key={k}
            type="button"
            variant="secondary"
            onClick={() => press(k)}
            className="text-base font-bold min-h-[44px] justify-center"
          >
            {k}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="flex-1 justify-center"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => onConfirm(coins)}
          disabled={!valid || !rewardName.trim()}
          className="flex-1 justify-center"
        >
          Request ({coins} pts)
        </Button>
      </div>
    </div>
  );
}

export const TX_ICON_MAP: Record<string, string> = {
  DEPOSIT: "deposit",
  WITHDRAWAL: "withdrawal",
  HIBAH: "hibah",
  SADAQAH: "sadaqah",
  QARD: "loan",
  INVEST_IN: "investin",
  INVEST_OUT: "investreturn",
  CHORE: "gift",
};

export function txEmoji(t: string) {
  return (
    <span className="tx-icon" aria-hidden>
      <AppIcon
        name={TX_ICON_MAP[t] ?? "transaction"}
        size={18}
        color="var(--primary)"
      />
    </span>
  );
}
