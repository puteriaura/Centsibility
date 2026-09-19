import { useEffect, useState } from "react";
import { getDailyQuote } from "@/data/quotes";
import { AppIcon } from "@/components/ui/app-icon";
import { Card } from "@/components/ui/card";

export function QuoteCard({ variant: _variant = "kid" }: { variant?: "kid" | "parent" }) {
  const [q, setQ] = useState(() => getDailyQuote());
  useEffect(() => {
    const id = setInterval(() => setQ(getDailyQuote()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card variant="soft" className="p-4 sm:p-5 border border-[var(--border)]">
      <div className="flex items-center gap-2 mb-2 text-xs font-bold text-[var(--ink)]">
        <AppIcon name="book" size={18} color="var(--primary)" aria-hidden />
        <span>
          Daily Reflection ·{" "}
          {new Date().toLocaleDateString(undefined, { weekday: "long" })}
        </span>
      </div>
      <p className="text-xs sm:text-sm text-[var(--ink)] italic leading-relaxed my-1.5">“{q.text}”</p>
      {q.source && <small className="text-xs text-[var(--text-secondary)] block font-semibold mt-1">— {q.source}</small>}
    </Card>
  );
}

