import { useEffect, useState } from "react";
import { getDailyQuote } from "@/data/quotes";
import { AppIcon } from "@/components/ui/app-icon";

export function QuoteCard({ variant: _variant = "kid" }: { variant?: "kid" | "parent" }) {
  const [q, setQ] = useState(() => getDailyQuote());
  useEffect(() => {
    const id = setInterval(() => setQ(getDailyQuote()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="ui-card card-soft">
      <div className="wireframe-row" style={{ gap: "0.5rem", marginBottom: "0.5rem" }}>
        <AppIcon name="book" size={18} color="var(--indigo-velvet)" aria-hidden />
        <strong>
          Stellar Wisdom ·{" "}
          {new Date().toLocaleDateString(undefined, { weekday: "long" })}
        </strong>
      </div>
      <p style={{ margin: "0.5rem 0" }}>“{q.text}”</p>
      {q.source && <small className="text-secondary">— {q.source}</small>}
    </section>
  );
}
