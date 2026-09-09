import { useEffect, useState } from "react";
import { getDailyQuote } from "@/lib/quotes";
import { BookOpen } from "@phosphor-icons/react";

export function QuoteCard({ variant = "kid" }: { variant?: "kid" | "parent" }) {
  const [q, setQ] = useState(() => getDailyQuote());
  useEffect(() => {
    // Re-roll if user crosses midnight while app open
    const id = setInterval(() => setQ(getDailyQuote()), 60_000);
    return () => clearInterval(id);
  }, []);

  const isKid = variant === "kid";
  return (
    <div
      className={`relative overflow-hidden rounded-[2.5rem] p-6 glass-panel border ${
        isKid
          ? "border-neon-mint/30 shadow-neon bg-void/50 text-starlight"
          : "border-starlight/20 bg-void/50 text-starlight shadow-soft"
      }`}
    >
      <div
        className="absolute inset-0 border border-white/10 rounded-[2.5rem] pointer-events-none"
        style={{ mixBlendMode: "overlay" }}
      ></div>
      <div
        className={`absolute -top-6 -right-4 text-[120px] leading-none opacity-10 select-none ${isKid ? "text-neon-mint" : "text-starlight"}`}
      >
        ❝
      </div>
      <div
        className={`font-kid text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${isKid ? "text-neon-mint" : "text-starlight/60"}`}
      >
        <BookOpen weight="duotone" className="w-4 h-4" /> Stellar Wisdom ·{" "}
        {new Date().toLocaleDateString(undefined, { weekday: "long" })}
      </div>
      <p className={`mt-3 font-arabic text-base leading-snug drop-shadow-sm`}>“{q.text}”</p>
      {q.source && (
        <p className={`mt-3 font-body text-[11px] font-medium opacity-70`}>— {q.source}</p>
      )}
    </div>
  );
}
