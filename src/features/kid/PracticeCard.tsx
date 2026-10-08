import { useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";

export function PracticeCardHeader({ onHelp }: { onHelp: () => void }) {
  return <header className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 px-6 py-5">
    <span aria-hidden="true" />
    <h1 className="m-0 text-center text-xl font-bold text-[var(--ink)]">Practice card</h1>
    <button type="button" onClick={onHelp} aria-label="Ask Penny about practice cards" className="min-h-11 min-w-11 rounded-full text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]">
      <AppIcon name="messagecircle" size={24} />
    </button>
  </header>;
}

export function PracticeCardHero({ name, revealed, locked }: { name: string; revealed: boolean; locked: boolean }) {
  return <section aria-label="Practice card" className="relative isolate flex aspect-[1.586] min-h-52 w-full max-w-[420px] flex-col justify-between overflow-hidden rounded-2xl bg-[var(--navy-dark)] p-5 text-white mx-auto">
    <div aria-hidden="true" className="absolute -right-10 -top-12 -z-10 h-52 w-52 rounded-full border-[24px] border-white/5" />
    <div className="flex justify-between items-start gap-3">
      <span className="text-xs font-bold tracking-wide">CENTSIBILITY</span>
      <div className="flex gap-3 text-xs tabular-nums">
        <div><span className="block text-white/80">CVV</span><strong>{revealed ? "428" : "•••"}</strong></div>
        <div><span className="block text-white/80">EXP</span><strong>{revealed ? "10/29" : "••/••"}</strong></div>
      </div>
    </div>
    <div className="flex items-center gap-3 py-5">
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10"><AppIcon name="penny" size={32} aria-label="Penny" /></span>
      <p className="m-0 text-base sm:text-xl font-mono font-bold tracking-wide tabular-nums" aria-label={revealed ? "Sample card number 4556 7812 9034 6553" : "Card number hidden, ending 6553"}>{revealed ? "4556 7812 9034 6553" : "•••• •••• •••• 6553"}</p>
    </div>
    <div className="flex justify-between items-end gap-3">
      <div className="min-w-0"><span className="block text-[10px] text-white/80">CARDHOLDER</span><strong className="block break-words text-sm">{name}</strong></div>
      <div className="shrink-0 text-right"><span className="rounded-md bg-white/15 px-2 py-1 text-[10px] font-bold">Practice card</span>{locked && <span className="mt-2 block text-xs font-bold">Locked</span>}</div>
    </div>
  </section>;
}

const TIPS = [
  { title: "Set a daily limit", text: "Choose how much you can give or ask to withdraw in a day. Your parent can see your limit.", action: "Open settings" },
  { title: "What is a PIN?", text: "Your PIN protects your account. Keep it secret, even from friends. These card details are samples.", action: "Read card help" },
  { title: "Ask a parent to unlock", text: "If your parent manages the controls, ask them before making the settings less strict.", action: "Read card help" },
] as const;

export function PracticeCardTips({ onSettings, onHelp }: { onSettings: () => void; onHelp: () => void }) {
  const list = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  function goTo(next: number) {
    const root = list.current;
    if (!root || !root.firstElementChild) return;
    const bounded = Math.max(0, Math.min(TIPS.length - 1, next));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.scrollTo({ left: bounded * (root.firstElementChild.clientWidth + 12), behavior: reduced ? "instant" : "smooth" });
  }
  return <section className="space-y-3" aria-label="Penny card tips">
    <h2 className="m-0 text-base font-bold text-[var(--ink)]">Penny's tips</h2>
    <div ref={list} role="region" aria-roledescription="carousel" aria-label="Swipe or use arrow keys for Penny tips" tabIndex={0}
      className="flex gap-3 overflow-x-auto overscroll-x-contain snap-x snap-mandatory rounded-2xl pb-2 focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
      onScroll={() => { const root = list.current; if (root?.firstElementChild) setIndex(Math.max(0, Math.min(TIPS.length - 1, Math.round(root.scrollLeft / (root.firstElementChild.clientWidth + 12))))); }}
      onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); goTo(index + (event.key === "ArrowRight" ? 1 : -1)); } }}>
      {TIPS.map((tip, number) => <article key={tip.title} role="group" aria-roledescription="slide" aria-label={`Tip ${number + 1} of ${TIPS.length}`} className="flex min-w-0 shrink-0 basis-[90%] snap-start items-center gap-3 rounded-2xl bg-[var(--surface-soft)] p-5 last:basis-full">
        <div className="min-w-0 flex-1"><h3 className="m-0 text-base font-bold text-[var(--ink)]">{tip.title}</h3><p className="my-2 text-xs leading-relaxed text-[var(--text-secondary)]">{tip.text}</p><button type="button" onClick={number === 0 ? onSettings : onHelp} className="min-h-11 rounded-full bg-[var(--primary)] px-4 text-xs font-bold text-white">{tip.action}</button></div>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white"><AppIcon name="penny" size={42} aria-label="Penny" /></div>
      </article>)}
    </div>
    <div className="flex justify-center" role="group" aria-label="Choose a Penny tip">{TIPS.map((tip, number) => <button key={tip.title} type="button" aria-label={`Show tip ${number + 1}: ${tip.title}`} aria-pressed={index === number} onClick={() => goTo(number)} className="inline-flex h-11 w-11 items-center justify-center"><span aria-hidden="true" className={index === number ? "h-2 w-6 rounded-full bg-[var(--primary)]" : "h-2 w-2 rounded-full bg-[var(--border)]"} /></button>)}</div>
    <p role="status" className="sr-only">Tip {index + 1} of {TIPS.length}</p>
  </section>;
}

export function PracticeCardHelp() {
  return <section id="practice-card-help" tabIndex={-1} className="rounded-2xl bg-[var(--surface)] p-5 space-y-2" aria-labelledby="practice-card-help-title">
    <h2 id="practice-card-help-title" className="m-0 text-base font-bold text-[var(--ink)]">What this practice card can do</h2>
    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">This is a practice card for learning. The number, CVV and expiry are samples. It cannot pay in shops, online or at an ATM.</p>
    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">Lock and daily limits control sadaqah and cash withdrawal requests in Centsibility. They do not control a bank card. Your parent approves cash requests.</p>
    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">To reset your account PIN or unlock parent-managed settings, ask your parent in their app. There is no separate card PIN or lost-card report service.</p>
  </section>;
}
