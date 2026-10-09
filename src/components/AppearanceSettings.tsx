import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";
import { Modal } from "@/components/ui/modal";

export function AppearanceSettings() {
  const { preference, setPreference, motionPreference, setMotionPreference, reduced } = useTheme();
  return <section className="space-y-4" aria-label="Appearance settings">
    <fieldset className="space-y-2"><legend className="text-base font-bold text-[var(--ink)]">Appearance</legend>
      <div className="grid grid-cols-3 gap-2">{(["light", "dark", "system"] as const).map(option => <label key={option} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--ink)]">
        <input type="radio" name="appearance" value={option} checked={preference === option} onChange={() => setPreference(option)} />
        {option === "light" ? "Light" : option === "dark" ? "Dark" : "System"}
      </label>)}</div>
      <p className="text-xs text-[var(--text-secondary)]">Saved on this device. System follows your device's appearance.</p>
    </fieldset>
    <label className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>Reduce animations</span><input type="checkbox" checked={motionPreference} onChange={event => setMotionPreference(event.target.checked)} /></label>
    <p className="text-xs text-[var(--text-secondary)]">{reduced ? "Reduced motion is active. Your device's reduced-motion preference always takes priority." : "Brief movement and Penny celebrations are enabled."}</p>
  </section>;
}

export function AppearanceDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("centsibility:open-appearance", show);
    return () => window.removeEventListener("centsibility:open-appearance", show);
  }, []);
  return <Modal isOpen={open} onClose={() => setOpen(false)} title="Settings"><AppearanceSettings /></Modal>;
}
