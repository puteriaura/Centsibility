import { useEffect, useState } from "react";
import { KID_CARD_THEMES, useTheme } from "@/lib/theme";
import { Modal } from "@/components/ui/modal";

export function AppearanceSettings() {
  const {
    preference,
    setPreference,
    motionPreference,
    setMotionPreference,
    reduced,
    kidTheme,
    setKidTheme,
    lang,
    setLang,
    seasonPreview,
    setSeasonPreview,
  } = useTheme();
  const activeCard = KID_CARD_THEMES.find((t) => t.id === kidTheme) ?? KID_CARD_THEMES[0];
  return <section className="space-y-4" aria-label="Appearance settings">
    <fieldset className="space-y-2"><legend className="text-base font-bold text-[var(--ink)]">Appearance</legend>
      <div className="grid grid-cols-3 gap-2">{(["light", "dark", "system"] as const).map(option => <label key={option} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--ink)]">
        <input type="radio" name="appearance" value={option} checked={preference === option} onChange={() => setPreference(option)} />
        {option === "light" ? "Light" : option === "dark" ? "Dark" : "System"}
      </label>)}</div>
      <p className="text-xs text-[var(--text-secondary)]">Saved on this device. System follows your device's appearance.</p>
    </fieldset>
    <fieldset className="space-y-2">
      <legend className="text-base font-bold text-[var(--ink)]">Card colour</legend>
      <div className="grid grid-cols-3 gap-2">
        {KID_CARD_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setKidTheme(t.id)}
            aria-pressed={kidTheme === t.id}
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition-transform active:scale-95 ${
              kidTheme === t.id
                ? "border-[var(--ink)] ring-2 ring-[var(--ink)] bg-[var(--surface)] text-[var(--ink)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]"
            }`}
          >
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-black/15"
              style={{ backgroundColor: t.card }}
              aria-hidden="true"
            />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        {activeCard.label}: contrast {activeCard.ratio} (AA needs 4.5:1).
      </p>
    </fieldset>
    <fieldset className="space-y-2">
      <legend className="text-base font-bold text-[var(--ink)]">Language</legend>
      <div className="grid grid-cols-2 gap-2">
        {([
          { id: "en", label: "English" },
          { id: "ms", label: "Bahasa Melayu" },
        ] as const).map((opt) => (
          <label
            key={opt.id}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--ink)]"
          >
            <input
              type="radio"
              name="language"
              value={opt.id}
              checked={lang === opt.id}
              onChange={() => setLang(opt.id)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
    <fieldset className="space-y-2">
      <legend className="text-base font-bold text-[var(--ink)]">Seasonal theme</legend>
      <div className="grid grid-cols-3 gap-2">
        {([
          { id: "auto", label: "Auto" },
          { id: "ramadan", label: "Ramadan" },
          { id: "raya", label: "Raya" },
        ] as const).map((opt) => (
          <label
            key={opt.id}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--ink)]"
          >
            <input
              type="radio"
              name="season-preview"
              value={opt.id}
              checked={seasonPreview === opt.id}
              onChange={() => setSeasonPreview(opt.id)}
            />
            {opt.label}
          </label>
        ))}
      </div>
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
