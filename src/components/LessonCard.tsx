import { useState } from "react";
import { motion } from "framer-motion";
import { LESSON_CARDS, type LessonKind } from "@/content/lessons";
import { SpeakButton } from "@/components/ui/SpeakButton";
import { useTheme } from "@/lib/theme";

export function LessonCard({
  kind,
  onDone,
  className = "",
}: {
  kind: LessonKind;
  onDone?: () => void;
  className?: string;
}) {
  const { reduced } = useTheme();
  const [flipped, setFlipped] = useState(true);
  const lesson = LESSON_CARDS[kind];

  const speakText = [
    lesson.title,
    lesson.text,
    lesson.source,
    lesson.pledge ?? "",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <motion.section
      aria-label={lesson.title}
      initial={reduced ? { opacity: 0 } : { rotateY: 180, opacity: 0.4 }}
      animate={reduced ? { opacity: 1 } : { rotateY: flipped ? 0 : 180, opacity: 1 }}
      transition={reduced ? { duration: 0.12 } : { duration: 0.64, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformStyle: "preserve-3d" }}
      className={`rounded-3xl border border-[var(--line)] bg-[#FFF8DC] p-5 text-[#262101] shadow-sm dark:border-[#3A4258] dark:bg-[#1B2447] dark:text-[#F6E7A8] ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">
            {lesson.title}
          </p>
          <p className="mt-2 font-display text-lg font-bold leading-snug">
            &ldquo;{lesson.text}&rdquo;
          </p>
          <p className="mt-1.5 text-xs font-semibold opacity-85">
            Source: {lesson.source}
          </p>
        </div>
        <SpeakButton text={speakText} className="shrink-0" />
      </div>

      {lesson.pledge && (
        <p className="mt-3 rounded-2xl border border-black/10 bg-white/70 px-3.5 py-2.5 text-xs font-semibold text-[#262101] dark:border-white/15 dark:bg-white/10 dark:text-[#F6E7A8]">
          {lesson.pledge}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="min-h-[44px] rounded-xl px-3 py-2 text-xs font-semibold underline underline-offset-4"
        >
          Turn card
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="min-h-[44px] rounded-xl bg-[#DDC518] px-4 py-2 text-xs font-bold text-[#262101]"
          >
            Continue
          </button>
        )}
      </div>
    </motion.section>
  );
}
