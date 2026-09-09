import { useState } from "react";
import { Link } from "@tanstack/react-router";

export function StatChip({
  icon,
  label,
  value,
  bg: _bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
}) {
  return (
    <div className="wireframe-box" style={{ textAlign: "center" }}>
      <div>{icon}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{value}</div>
      <small style={{ textTransform: "uppercase" }}>{label}</small>
    </div>
  );
}

export function ActionTile({
  to,
  icon,
  title,
  sub,
  bg: _bg,
  text: _text,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  bg: string;
  text: string;
}) {
  return (
    <Link
      to={to}
      className="wireframe-card"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div>{icon}</div>
      <strong>{title}</strong>
      <div>
        <small>{sub}</small>
      </div>
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
      <div className="wireframe-box" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
          {coins} <span className="wireframe-icon">[icon: star]</span>
        </div>
        {coins > 0 && (
          <small>of {maxPoints} pts available</small>
        )}
      </div>
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
      <button
        type="button"
        onClick={() => onConfirm(coins)}
        disabled={!valid || !rewardName.trim()}
      >
        Request for {coins} [icon: star]
      </button>
      <button
        type="button"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}

const TX_LABEL_MAP: Record<string, string> = {
  DEPOSIT: "[icon: deposit]",
  WITHDRAWAL: "[icon: withdrawal]",
  HIBAH: "[icon: hibah]",
  SADAQAH: "[icon: sadaqah]",
  QARD: "[icon: loan]",
  INVEST_IN: "[icon: invest in]",
  INVEST_OUT: "[icon: invest return]",
};

export function txEmoji(t: string) {
  return <span className="wireframe-icon">{TX_LABEL_MAP[t] ?? "[icon: transaction]"}</span>;
}

