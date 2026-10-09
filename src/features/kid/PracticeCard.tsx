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

export function PracticeCardTips({ onSettings }: { onSettings: () => void; onHelp: () => void }) {
  return <section aria-label="Penny card tip" className="rounded-2xl bg-[var(--surface)] p-5">
    <h2 className="m-0 text-base font-bold text-[var(--ink)]">Penny's tip</h2>
    <div className="mt-3 flex items-center gap-3">
      <div className="min-w-0 flex-1"><h3 className="m-0 text-sm font-bold text-[var(--ink)]">Set a daily limit</h3>
        <p className="my-2 text-sm leading-relaxed text-[var(--text-secondary)]">Choose how much you can give or ask to withdraw in a day. Your parent can see your limit.</p>
        <button type="button" onClick={onSettings} className="min-h-11 rounded-full bg-[var(--primary)] px-4 text-sm font-bold text-white">Open settings</button>
      </div>
      <span className="shrink-0"><AppIcon name="penny" size={42} aria-label="Penny" /></span>
    </div>
  </section>;
}

export function PracticeCardHelp() {
  return <section id="practice-card-help" tabIndex={-1} className="rounded-2xl bg-[var(--surface)] p-5 space-y-2" aria-labelledby="practice-card-help-title">
    <h2 id="practice-card-help-title" className="m-0 text-base font-bold text-[var(--ink)]">What this practice card can do</h2>
    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">This is a practice card for learning. The number, CVV and expiry are samples. It cannot pay in shops, online or at an ATM.</p>
    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">Lock and daily limits control sadaqah and cash withdrawal requests in Centsibility. They do not control a bank card. Your parent approves cash requests.</p>
    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">Your PIN protects your account. Keep it secret, even from friends.</p>
    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">To reset your account PIN or unlock parent-managed settings, ask your parent in their app. There is no separate card PIN or lost-card report service.</p>
  </section>;
}
