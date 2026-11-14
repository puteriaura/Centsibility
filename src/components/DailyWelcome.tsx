import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { PennyMascot } from "@/components/PennyMascot";
import { StreakBadge } from "@/components/StreakBadge";
import { Button } from "@/components/ui/button";
import { Money } from "@/features/privacy";
import { claimDailyWelcome } from "@/lib/daily-welcome";
import { mytDay } from "@/lib/insight-period";
import { spring, springPop } from "@/lib/motion";
import { sfx } from "@/lib/sounds";
import { useTheme } from "@/lib/theme";

export function DailyWelcome({ kidId, streak, incoming }: { kidId: string; streak: number; incoming: number }) {
  const [open, setOpen] = useState(false);
  const sounded = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { reduced } = useTheme();
  const today = mytDay(new Date());
  useEffect(() => {
    if (claimDailyWelcome(kidId)) { sounded.current = false; setOpen(true); }
  }, [kidId, today]);
  const close = () => setOpen(false);
  return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal forceMount><AnimatePresence>
    {open && <Dialog.Overlay forceMount asChild key="scrim"><motion.div className="daily-welcome__scrim" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} /></Dialog.Overlay>}
    {open && <Dialog.Content forceMount asChild key="welcome" aria-describedby="daily-welcome-description" onOpenAutoFocus={event => { event.preventDefault(); contentRef.current?.focus({ preventScroll: true }); }}><motion.div ref={contentRef} tabIndex={-1} className="daily-welcome outline-none" onClick={close}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 70 }} animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: 70 }} transition={reduced ? { duration: 0.12 } : spring}>
      {!reduced && Array.from({ length: 16 }, (_, i) => <motion.i key={i} aria-hidden="true" className="daily-welcome__confetti" style={{ background: ["var(--sun)", "var(--blue-300)", "var(--action-text)"][i % 3] }}
        initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(i * Math.PI / 8) * (160 + i % 3 * 20), y: Math.sin(i * Math.PI / 8) * 140 - 120, rotate: i * 73, opacity: [1, 1, 0] }} transition={{ duration: 1.1, ease: "easeOut" }} />)}
      <motion.div className="daily-welcome__penny" initial={reduced ? { opacity: 0 } : { scale: 0.6 }} animate={reduced ? { opacity: 1 } : { scale: 1 }} transition={reduced ? { duration: 0.12 } : springPop}
        onAnimationStart={() => { if (!sounded.current) { sounded.current = true; sfx.success(); } }}><PennyMascot state="celebrate" size={112} /></motion.div>
      <Dialog.Title>{streak >= 2 ? `Day ${streak}!` : "Let's save!"}</Dialog.Title>
      <Dialog.Description id="daily-welcome-description">{streak >= 2 ? "Your streak is on fire." : "Every coin counts."}</Dialog.Description>
      <div className="daily-welcome__badges"><StreakBadge count={streak} />{incoming > 0 && <span className="balance-hero__tag"><Money amount={incoming} sign /> this week</span>}</div>
      <Button className="w-full" onClick={close}>Let's go</Button>
    </motion.div></Dialog.Content>}
  </AnimatePresence></Dialog.Portal></Dialog.Root>;
}
