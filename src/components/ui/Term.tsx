import { useId, useState } from "react";
import { GLOSSARY_TERMS, type GlossaryKey } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

interface TermProps {
  termKey: GlossaryKey;
  children?: React.ReactNode;
}

export function Term({ termKey, children }: TermProps) {
  const [open, setOpen] = useState(false);
  const { lang } = useTheme();
  const panelId = useId();
  const entry = GLOSSARY_TERMS[termKey];
  if (!entry) return <>{children ?? termKey}</>;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline cursor-pointer border-0 bg-transparent p-0 font-semibold text-inherit underline decoration-dotted decoration-[var(--action-text)] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)]"
      >
        {children ?? entry.term}
      </button>
      {open && (
        <span
          id={panelId}
          role="region"
          aria-label={entry.term}
          className="mt-2 block rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 text-left text-xs leading-relaxed text-[var(--ink)] shadow-sm"
        >
          <span className="flex items-center justify-between gap-2 font-bold">
            <span>{entry.term}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--text-2)] hover:bg-[var(--surface-sunken)]"
              aria-label={`Close ${entry.term} explanation`}
            >
              {lang === "ms" ? "Tutup" : "Close"}
            </button>
          </span>
          <span className="mt-1 block text-[var(--text)]">{entry.en}</span>
          <span className="mt-1 block text-[var(--text-2)]">{entry.ms}</span>
        </span>
      )}
    </span>
  );
}
