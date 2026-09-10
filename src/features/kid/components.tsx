import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppIcon } from "@/components/ui/app-icon";

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
      <AppIcon name={icon} size={18} color="var(--lavender-purple)" />
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
        <AppIcon name={icon} size={22} color="var(--indigo-velvet)" />
      </span>
      <strong className="action-tile__title">{title}</strong>
      <small className="action-tile__sub">{sub}</small>
    </Link>
  );
}

/** Points keypad for reward requests — counts integer points */
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
    <div className="wireframe-col">
      <div className="stat-chip" style={{ padding: "1rem" }}>
        <div className="text-balance" style={{ fontSize: "2rem" }}>
          {coins}{" "}
          <AppIcon name="star" size={22} color="var(--lavender-purple)" />
        </div>
        {coins > 0 && <small className="text-secondary">of {maxPoints} pts available</small>}
      </div>
      <div className="wireframe-grid-3">
        {Keys.flat().map((k) => (
          <button
            key={k}
            type="button"
            data-variant="secondary"
            onClick={() => press(k)}
            style={{ fontSize: "1.25rem", fontWeight: 700 }}
          >
            {k}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onConfirm(coins)} disabled={!valid || !rewardName.trim()}>
        Request for {coins} pts
      </button>
      <button type="button" data-variant="ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

const TX_ICON_MAP: Record<string, string> = {
  DEPOSIT: "deposit",
  WITHDRAWAL: "withdrawal",
  HIBAH: "hibah",
  SADAQAH: "sadaqah",
  QARD: "loan",
  INVEST_IN: "investin",
  INVEST_OUT: "investreturn",
};

export function txEmoji(t: string) {
  return (
    <span className="tx-icon" aria-hidden>
      <AppIcon name={TX_ICON_MAP[t] ?? "transaction"} size={18} color="var(--indigo-velvet)" />
    </span>
  );
}
