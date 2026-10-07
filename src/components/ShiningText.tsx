import { motion, useReducedMotion } from "framer-motion";
export function ShiningText({ text }: { text: string }) {
  const reducedMotion = useReducedMotion();
  return <motion.span role="status" className="text-base text-[var(--text-secondary)]" style={reducedMotion ? undefined : { backgroundImage: "linear-gradient(110deg, var(--text-secondary) 35%, var(--primary) 50%, var(--text-secondary) 75%)", backgroundSize: "200% 100%", backgroundClip: "text", color: "transparent" }} initial={false} animate={reducedMotion ? undefined : { backgroundPosition: ["200% 0", "-200% 0"] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>{text}</motion.span>;
}
