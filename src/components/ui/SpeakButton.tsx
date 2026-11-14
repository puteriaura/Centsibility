import { useEffect, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { useTheme } from "@/lib/theme";

interface SpeakButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function SpeakButton({ text, label, className = "" }: SpeakButtonProps) {
  const { lang } = useTheme();
  const [speaking, setSpeaking] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined";

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  if (!supported || !text.trim()) return null;

  function handleSpeak() {
    if (!supported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === "ms" ? "ms-MY" : "en-MY";
    utter.rate = 0.95;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  }

  const textLabel = label ?? (lang === "ms" ? (speaking ? "Henti" : "Dengar") : (speaking ? "Stop" : "Speak"));

  return (
    <button
      type="button"
      onClick={handleSpeak}
      aria-label={textLabel}
      aria-pressed={speaking}
      style={{ color: "var(--ink)" }}
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)] ${className}`}
    >
      <AppIcon name={speaking ? "volume-x" : "volume-2"} className="h-4 w-4 text-[var(--action-text)]" />
      <span style={{ color: "var(--ink)" }}>{textLabel}</span>
    </button>
  );
}
