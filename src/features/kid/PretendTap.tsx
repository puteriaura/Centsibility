import { useState } from "react";
import { motion } from "framer-motion";
import { AppIcon } from "@/components/ui/app-icon";
import { maskAmounts, useMoney } from "@/features/privacy";
import { pretendTap } from "@/lib/pretend-tap";
import { spring } from "@/lib/motion";
import { useTheme } from "@/lib/theme";

export function PretendTap({ locked, limit }: { locked: boolean; limit: number }) {
  const [attempt, setAttempt] = useState<{ price: number; id: number; text: string; approved: boolean } | null>(null);
  const { reduced } = useTheme();
  const { isMasked } = useMoney();
  return <section className="ui-card pretend-tap" aria-label="Try a pretend tap">
    <h2>Try a pretend tap</h2>
    <div className="pretend-tap__chips">{[{ name: "Ice cream", price: 3, icon: "icecream" }, { name: "Book", price: 12, icon: "bookclosed" }, { name: "Robot", price: 60, icon: "robot" }].map(item =>
      <button key={item.name} type="button" aria-label={`${item.name} RM${item.price}`} aria-pressed={attempt?.price === item.price} onClick={() => {
        const text = pretendTap(item.price, { locked, limit });
        setAttempt(previous => ({ price: item.price, id: (previous?.id ?? 0) + 1, text, approved: !locked && item.price <= limit }));
      }}><AppIcon name={item.icon} size={24} /><span>RM{item.price}</span>{!reduced && attempt?.price === item.price && <span key={attempt.id} className="pretend-tap__ripple" aria-hidden="true" />}</button>)}</div>
    {attempt && <motion.div key={attempt.id} className={`pretend-tap__result ${attempt.approved ? "pretend-tap__result--paid" : "pretend-tap__result--declined"}`} role={attempt.approved ? "status" : "alert"}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, x: attempt.approved ? 0 : [0, -7, 7, -7, 7, -7, 7, 0] }} transition={reduced ? { duration: 0.12 } : { ...spring, x: { duration: 0.32 } }}>
      {attempt.approved && <svg className="pretend-tap__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg>}
      <span>{maskAmounts(attempt.text, isMasked)}</span>
    </motion.div>}
    <p>Pretend only. No money moves.</p>
  </section>;
}
