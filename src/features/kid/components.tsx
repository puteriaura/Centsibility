import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Star,
  CurrencyCircleDollar,
  HandWithdraw,
  Gift as GiftIcon,
  Heart,
  Plant,
  ArrowUUpLeft,
  Handshake as HandshakeIcon,
} from "@phosphor-icons/react";

export function StatChip({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
}) {
  return (
    <div className={`rounded-3xl ${bg} p-3 text-center flex flex-col items-center justify-center`}>
      <div className="text-xl mb-1">{icon}</div>
      <div className="font-mono font-bold text-sm text-starlight">{value}</div>
      <div className="font-kid text-[10px] font-bold uppercase tracking-wider text-neon-mint">
        {label}
      </div>
    </div>
  );
}

export function ActionTile({
  to,
  icon,
  title,
  sub,
  bg,
  text,
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
      className={`btn-press rounded-[2rem] ${bg} ${text} p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-white/10`}
    >
      <div className="mb-2">{icon}</div>
      <div className="mt-1 font-kid font-bold text-sm tracking-wide">{title}</div>
      <div className="font-body text-[11px] opacity-80">{sub}</div>
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center rounded-3xl bg-gradient-to-b from-sunny/20 to-void/50 border border-white/10 px-6 py-4 shadow-inner">
        <div className={`font-mono text-4xl font-extrabold text-starlight flex items-center gap-2`}>
          {coins} <Star weight="fill" className="w-8 h-8 text-gold-nur drop-shadow-sm" />
        </div>
        {coins > 0 && (
          <p className="mt-1 font-body text-[11px] text-starlight/70">
            of {maxPoints} pts available
          </p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Keys.flat().map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className={`rounded-2xl py-4 font-mono text-xl font-bold transition active:scale-90 ${
              k === "⌫"
                ? "bg-white/10 text-coral text-2xl border border-white/10"
                : "glass-panel text-starlight shadow-soft hover:bg-white/10 border border-white/10"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onConfirm(coins)}
        disabled={!valid || !rewardName.trim()}
        className="btn-press w-full rounded-2xl bg-bubblegum py-3.5 font-kid font-bold text-white disabled:opacity-30 shadow-soft flex items-center justify-center gap-1.5"
      >
        Request for {coins} <Star weight="fill" className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-2xl bg-white/10 py-3 font-kid font-bold text-starlight hover:bg-white/20 transition"
      >
        Cancel
      </button>
    </div>
  );
}

const TX_EMOJI_MAP: Record<string, React.ReactNode> = {
  DEPOSIT: <CurrencyCircleDollar weight="duotone" className="w-6 h-6" />,
  WITHDRAWAL: <HandWithdraw weight="duotone" className="w-6 h-6" />,
  HIBAH: <GiftIcon weight="duotone" className="w-6 h-6" />,
  SADAQAH: <Heart weight="duotone" className="w-6 h-6" />,
  QARD: <HandshakeIcon weight="duotone" className="w-6 h-6" />,
  INVEST_IN: <Plant weight="duotone" className="w-6 h-6" />,
  INVEST_OUT: <ArrowUUpLeft weight="duotone" className="w-6 h-6" />,
};

export function txEmoji(t: string) {
  return TX_EMOJI_MAP[t] ?? <div className="w-2 h-2 rounded-full bg-charcoal" />;
}

const TX_EMOJI_BG_MAP: Record<string, string> = {
  DEPOSIT: "bg-mint/40",
  WITHDRAWAL: "bg-coral/30",
  HIBAH: "bg-sunny/50",
  SADAQAH: "bg-emerald-halal/20",
  QARD: "bg-sky/30",
  INVEST_IN: "bg-teal-amanah/20",
  INVEST_OUT: "bg-cream",
};

export function txEmojiBg(t: string) {
  return TX_EMOJI_BG_MAP[t] ?? "bg-cream";
}
