import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme";

export interface SproutStageInfo {
  stage: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
}

export function getSproutStage(pct: number): SproutStageInfo {
  if (!Number.isFinite(pct) || pct <= 0) return { stage: 0, label: "Seed" };
  const clamped = Math.max(0, Math.min(100, pct));
  if (clamped < 25) return { stage: 1, label: "Shoot" };
  if (clamped < 50) return { stage: 2, label: "Two leaves" };
  if (clamped < 75) return { stage: 3, label: "Three leaves" };
  if (clamped < 100) return { stage: 4, label: "Bud" };
  return { stage: 5, label: "Bloom" };
}

const POP_SPRING = { type: "spring" as const, stiffness: 195, damping: 20.1, mass: 1 };
const SETTLE_SPRING = { type: "spring" as const, stiffness: 247, damping: 31.4, mass: 1 };

export function SproutIllustration({
  pct,
  celebrate = false,
  size = 112,
  className = "",
}: {
  pct: number;
  celebrate?: boolean;
  size?: number;
  className?: string;
}) {
  const { reduced } = useTheme();
  const { stage, label } = getSproutStage(pct);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Tabung sprout stage: ${label} (${Math.round(pct)}%)`}
    >
      {celebrate && !reduced && (
        <>
          <motion.span
            initial={{ scale: 0.75, opacity: 0.85 }}
            animate={{ scale: 1.32, opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 rounded-full border-4 border-[#0E7A4E]"
            aria-hidden="true"
          />
          <motion.span
            initial={{ y: -90, opacity: 1, scale: 1 }}
            animate={{ y: 0, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.38, ease: "easeIn" }}
            className="pointer-events-none absolute top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#A6930E] bg-[#DDC518] text-[9px] font-extrabold text-[#262101]"
            aria-hidden="true"
          >
            RM
          </motion.span>
        </>
      )}

      <motion.svg
        key={stage}
        initial={reduced ? { opacity: 0 } : { scale: 0.92, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0.12 } : SETTLE_SPRING}
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Pot & soil */}
        <path d="M36 92H84L79 110H41L36 92Z" fill="#C7D0EA" stroke="#22355B" strokeWidth="2.5" strokeLinejoin="round" />
        <ellipse cx="60" cy="92" rx="25" ry="5" fill="#6F4E37" stroke="#22355B" strokeWidth="2" />

        {/* Stage 0: Seed */}
        {stage === 0 && (
          <motion.ellipse
            cx="60"
            cy="88"
            rx="7"
            ry="5"
            fill="#DDC518"
            stroke="#22355B"
            strokeWidth="2"
            initial={reduced ? { opacity: 0 } : { scale: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduced ? { duration: 0.12 } : POP_SPRING}
            style={{ transformOrigin: "60px 88px" }}
          />
        )}

        {/* Stage 1+: Stem */}
        {stage >= 1 && (
          <motion.path
            d={stage >= 3 ? "M60 91C60 72 60 55 60 40" : "M60 91C60 80 60 70 60 60"}
            stroke="#0E7A4E"
            strokeWidth="5"
            strokeLinecap="round"
            initial={reduced ? { opacity: 0 } : { pathLength: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={reduced ? { duration: 0.12 } : SETTLE_SPRING}
          />
        )}

        {/* Stage 1: Tiny shoot */}
        {stage === 1 && (
          <motion.path
            d="M60 60C60 51 67 48 70 53C72 57 65 61 60 60Z"
            fill="#2EB67D"
            stroke="#0E7A4E"
            strokeWidth="2"
            initial={reduced ? { opacity: 0 } : { scale: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduced ? { duration: 0.12 } : POP_SPRING}
            style={{ transformOrigin: "60px 60px" }}
          />
        )}

        {/* Stage 2+: Two lower leaves */}
        {stage >= 2 && (
          <>
            <motion.path
              d="M60 72C49 72 41 64 43 56C51 55 58 62 60 72Z"
              fill="#2EB67D"
              stroke="#0E7A4E"
              strokeWidth="2"
              initial={reduced ? { opacity: 0 } : { scale: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reduced ? { duration: 0.12 } : POP_SPRING}
              style={{ transformOrigin: "60px 72px" }}
            />
            <motion.path
              d="M60 66C71 66 79 58 77 50C69 49 62 56 60 66Z"
              fill="#2EB67D"
              stroke="#0E7A4E"
              strokeWidth="2"
              initial={reduced ? { opacity: 0 } : { scale: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reduced ? { duration: 0.12 } : POP_SPRING}
              style={{ transformOrigin: "60px 66px" }}
            />
          </>
        )}

        {/* Stage 3+: Third upper leaf */}
        {stage >= 3 && (
          <motion.path
            d="M60 50C50 48 44 39 48 32C55 34 60 41 60 50Z"
            fill="#3ECF8E"
            stroke="#0E7A4E"
            strokeWidth="2"
            initial={reduced ? { opacity: 0 } : { scale: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduced ? { duration: 0.12 } : POP_SPRING}
            style={{ transformOrigin: "60px 50px" }}
          />
        )}

        {/* Stage 4: Flower bud */}
        {stage === 4 && (
          <motion.path
            d="M60 40C53 34 53 24 60 20C67 24 67 34 60 40Z"
            fill="#DDC518"
            stroke="#7A4B00"
            strokeWidth="2"
            initial={reduced ? { opacity: 0 } : { scale: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduced ? { duration: 0.12 } : POP_SPRING}
            style={{ transformOrigin: "60px 40px" }}
          />
        )}

        {/* Stage 5: Full bloom */}
        {stage === 5 && (
          <motion.g
            initial={reduced ? { opacity: 0 } : { scale: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduced ? { duration: 0.12 } : POP_SPRING}
            style={{ transformOrigin: "60px 30px" }}
          >
            <circle cx="60" cy="20" r="8" fill="#F4B8A0" stroke="#22355B" strokeWidth="2" />
            <circle cx="70" cy="28" r="8" fill="#F4B8A0" stroke="#22355B" strokeWidth="2" />
            <circle cx="50" cy="28" r="8" fill="#F4B8A0" stroke="#22355B" strokeWidth="2" />
            <circle cx="66" cy="38" r="8" fill="#F4B8A0" stroke="#22355B" strokeWidth="2" />
            <circle cx="54" cy="38" r="8" fill="#F4B8A0" stroke="#22355B" strokeWidth="2" />
            <circle cx="60" cy="30" r="8" fill="#DDC518" stroke="#262101" strokeWidth="2" />
          </motion.g>
        )}
      </motion.svg>
    </div>
  );
}
