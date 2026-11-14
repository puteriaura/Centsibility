import { useEffect, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";

export function OfflineBanner() {
  const [offline, setOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-[var(--ink)] px-4 py-2.5 text-white shadow-md"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AppIcon name="shieldalert" size={16} color="#FDE68A" />
        <span>You're offline</span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => window.location.reload()}
      >
        Retry
      </Button>
    </div>
  );
}
