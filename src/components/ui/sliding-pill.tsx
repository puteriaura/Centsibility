import { motion } from "framer-motion";
import { spring } from "@/lib/motion";
import { useTheme } from "@/lib/theme";

export function SlidingPill({ layoutId }: { layoutId: string }) {
  const { reduced } = useTheme();
  return <motion.span aria-hidden="true" className="sliding-pill" layoutId={reduced ? undefined : layoutId}
    initial={false} transition={reduced ? { duration: 0 } : spring} />;
}
