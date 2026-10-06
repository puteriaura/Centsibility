import { useEffect, useState } from "react";
import { getDailyQuote } from "@/data/quotes";
import { Card } from "@/components/ui/card";

// A quiet closing panel: no tint, no icon, the words carry it.
export function QuoteCard({ variant: _variant = "kid" }: { variant?: "kid" | "parent" }) {
  const [q, setQ] = useState(() => getDailyQuote());
  useEffect(() => {
    const id = setInterval(() => setQ(getDailyQuote()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="p-5">
      <p className="section-title__heading m-0 mb-2">
        Reflection for {new Date().toLocaleDateString(undefined, { weekday: "long" })}
      </p>
      <blockquote className="m-0 text-base leading-relaxed text-[var(--ink)]">“{q.text}”</blockquote>
      {q.source && <p className="m-0 mt-2 text-xs font-semibold text-[var(--text-2)]">{q.source}</p>}
    </Card>
  );
}
