import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { PennyMarkdown } from "@/components/PennyMarkdown";
// Reveal the complete, server-checked reply. This is presentation, not network streaming.
export function StreamingPennyReply({ text, animate }: { text: string; animate: boolean }) {
  const reducedMotion = useReducedMotion();
  const words = useMemo(() => text.match(/\S+\s*/g) || [text], [text]);
  const [shown, setShown] = useState(animate ? 0 : words.length);
  useEffect(() => {
    if (!animate || reducedMotion) { setShown(words.length); return; }
    setShown(0);
    let count = 0;
    const timer = window.setInterval(() => { count = Math.min(count + 2, words.length); setShown(count); if (count === words.length) window.clearInterval(timer); }, 25);
    return () => window.clearInterval(timer);
  }, [text, animate, reducedMotion, words.length]);
  return <><span className="sr-only">{text}</span><div aria-hidden="true"><PennyMarkdown text={!animate || reducedMotion ? text : words.slice(0, shown).join("")} /></div></>;
}
