import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { kidLevel, levelNameFor } from "@/lib/kid-level";
import { useTheme } from "@/lib/theme";
import { AppIcon } from "@/components/ui/app-icon";

const WEEK_DAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export function malaysiaWeekdayIndex(date: Date = new Date()): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[short] ?? 0;
}

const POP_SPRING = { type: "spring" as const, stiffness: 195, damping: 20.1, mass: 1 };

export function StreakLevelCard({
  streak,
  xp,
  level: explicitLevel,
  hasFreeze = false,
  className = "",
}: {
  streak: number;
  xp: number;
  level?: number;
  hasFreeze?: boolean;
  className?: string;
}) {
  const { reduced } = useTheme();
  const info = kidLevel({ xp, level: explicitLevel });
  const levelName = levelNameFor(info.level);
  const todayIdx = malaysiaWeekdayIndex();
  const [displayXp, setDisplayXp] = useState(xp);
  const [leveledUp, setLeveledUp] = useState(false);
  const prevLevelRef = useRef(info.level);
  const prevXpRef = useRef(xp);

  // Points count-up ticker over 600ms (points only, never ringgit).
  useEffect(() => {
    const start = prevXpRef.current;
    prevXpRef.current = xp;
    if (reduced || start === xp) {
      setDisplayXp(xp);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 600);
      setDisplayXp(Math.round(start + (xp - start) * p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [xp, reduced]);

  // Level-up celebration + haptic pulse.
  useEffect(() => {
    if (info.level > prevLevelRef.current) {
      setLeveledUp(true);
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([10, 40, 18]);
      }
      const timer = window.setTimeout(() => setLeveledUp(false), 3500);
      prevLevelRef.current = info.level;
      return () => window.clearTimeout(timer);
    }
    prevLevelRef.current = info.level;
  }, [info.level]);

  const progress = Math.max(0, Math.min(100, info.progress ?? (xp % 100)));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Streak week dots */}
      <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <motion.span
              animate={reduced ? undefined : { scale: [1, 1.18, 1], rotate: [0, 6, 0] }}
              transition={{ duration: 0.54, ease: "easeOut" }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF1CC] text-[#7A4B00]"
            >
              <AppIcon name="flame" size={18} />
            </motion.span>
            <div>
              <p className="font-display text-lg font-extrabold text-[var(--ink)]">
                {streak} {streak === 1 ? "day" : "days"}
              </p>
              <p className="text-xs text-[var(--text-2)]">
                {hasFreeze ? "Weekly freeze ready (earned by quest)" : "Complete a quest for a weekly freeze"}
              </p>
            </div>
          </div>
          {hasFreeze && (
            <span className="rounded-full bg-[#E2E7F4] px-2.5 py-1 text-[11px] font-bold text-[#22355B]">
              Freeze ready
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1.5 text-center" aria-label="Malaysia week streak">
          {WEEK_DAYS.map((day, idx) => {
            const filled = idx <= todayIdx && idx > todayIdx - Math.min(7, streak);
            const isToday = idx === todayIdx;
            return (
              <div key={`${day}-${idx}`} className="flex flex-col items-center gap-1">
                <motion.span
                  initial={isToday && !reduced ? { scale: 0.7 } : false}
                  animate={{ scale: 1 }}
                  transition={POP_SPRING}
                  className={`h-7 w-7 rounded-full border-2 ${
                    filled
                      ? "border-[#A6930E] bg-[#DDC518]"
                      : "border-[var(--line)] bg-[var(--surface-sunken)]"
                  } ${isToday ? "ring-2 ring-[var(--action)] ring-offset-2 ring-offset-[var(--surface)]" : ""}`}
                />
                <span className="text-[11px] font-semibold text-[var(--text-2)]">{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Level ring + named level + points ticker */}
      <div className="flex items-center gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
          <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="var(--surface-sunken)"
              strokeWidth="7"
            />
            <motion.circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="var(--action)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={reduced ? false : { strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={reduced ? { duration: 0.12 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <div className="absolute text-center">
            <span className="block text-[10px] font-semibold uppercase text-[var(--text-2)]">Lvl</span>
            <span className="font-display text-lg font-extrabold leading-none text-[var(--ink)]">
              {info.level}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-extrabold text-[var(--ink)]">
            {levelName}
          </p>
          <p className="text-xs text-[var(--text-2)]">
            <span className="font-bold text-[var(--ink)]">{displayXp}</span> points · {100 - progress} to next level
          </p>
        </div>
      </div>

      <AnimatePresence>
        {leveledUp && (
          <motion.div
            role="status"
            onClick={() => setLeveledUp(false)}
            initial={reduced ? { opacity: 0 } : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: 24, opacity: 0 }}
            transition={reduced ? { duration: 0.12 } : POP_SPRING}
            className="relative overflow-hidden rounded-2xl bg-[#151E31] px-4 py-3 text-white"
          >
            <p className="text-sm font-bold">Level up: {levelName}!</p>
            <p className="text-xs text-white/80">Keep watering your sprout.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
