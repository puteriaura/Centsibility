import { useEffect, useState } from "react";
import { getDailyQuote } from "@/data/quotes";

export function QuoteCard({ variant: _variant = "kid" }: { variant?: "kid" | "parent" }) {
  const [q, setQ] = useState(() => getDailyQuote());
  useEffect(() => {
    // Re-roll if user crosses midnight while app open
    const id = setInterval(() => setQ(getDailyQuote()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="wireframe-card">
      <div>
        <span className="wireframe-icon">[icon: book]</span>
        <strong>Stellar Wisdom · {new Date().toLocaleDateString(undefined, { weekday: "long" })}</strong>
      </div>
      <p style={{ margin: "0.5rem 0" }}>“{q.text}”</p>
      {q.source && <small>— {q.source}</small>}
    </section>
  );
}
