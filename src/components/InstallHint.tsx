import { useState } from "react";
import { Button } from "@/components/ui/button";

const dismissedKey = "centsibility.install-hint-dismissed";

export function InstallHint() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
    const iosSafari = /iPhone|iPad|iPod/.test(navigator.userAgent) &&
      /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
    return iosSafari && !standalone && !matchMedia("(display-mode: standalone)").matches &&
      !localStorage.getItem(dismissedKey);
  });
  if (!visible) return null;

  return (
    <aside className="rounded-2xl bg-[var(--surface)] p-4">
      <h2 className="text-base font-semibold">Add to Home Screen</h2>
      <p className="text-sm text-[var(--text-2)]">In Safari, tap Share, then Add to Home Screen.</p>
      <Button variant="ghost" onClick={() => {
        localStorage.setItem(dismissedKey, "1");
        setVisible(false);
      }}>Got it</Button>
    </aside>
  );
}
