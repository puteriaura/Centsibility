import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme";
export function ShiningText({ text }: { text: string }) {
  const { reduced } = useTheme();
  if (reduced) return <span role="status" className="text-base font-regular text-[var(--ink)]">{text}</span>;
  return <motion.span role="status" className="bg-[linear-gradient(110deg,#404040,35%,#fff,50%,#404040,75%,#404040)] bg-[length:200%_100%] bg-clip-text text-base font-regular text-transparent" initial={{ backgroundPosition: "200% 0" }} animate={{ backgroundPosition: "-200% 0" }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>{text}</motion.span>;
}
