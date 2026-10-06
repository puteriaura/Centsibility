import { useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";

export interface ParentLoadErrorProps {
  variant?: "page" | "banner";
  message?: string;
  onRetry: () => void | Promise<void>;
  lastLoadedAt?: Date | null;
  className?: string;
}

export function ParentLoadError({
  variant = "page",
  message,
  onRetry,
  lastLoadedAt,
  className = "",
}: ParentLoadErrorProps) {
  const [busy, setBusy] = useState(false);

  const handleRetry = async () => {
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  };

  if (variant === "banner") {
    const timeStr = lastLoadedAt
      ? lastLoadedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : null;
    const bannerText =
      message ||
      (timeStr
        ? `Couldn't refresh. Showing what we had at ${timeStr}.`
        : "Couldn't refresh. Showing earlier data.");

    return (
      <div
        role="alert"
        className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[var(--error-soft)] border border-[var(--error)]/30 text-sm text-[var(--ink)] mb-4 ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 flex items-center text-[var(--error-strong-hover)]" aria-hidden="true">
            <AppIcon name="info" size={18} color="var(--error-strong-hover)" />
          </span>
          <span className="font-medium truncate text-[var(--ink)]">{bannerText}</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleRetry}
          disabled={busy}
          loading={busy}
          className="shrink-0 text-xs font-semibold"
        >
          {busy ? "Retrying…" : "Try again"}
        </Button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`ui-card p-6 sm:p-8 flex flex-col items-center gap-3 text-center ${className}`}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--error-soft)] border border-[var(--error)]/30 text-[var(--error-strong-hover)]"
        aria-hidden="true"
      >
        <AppIcon name="info" size={24} color="var(--error-strong-hover)" />
      </div>
      <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] m-0">
        We couldn't load your account
      </h2>
      <p className="text-sm text-[var(--text-secondary)] m-0 max-w-sm">
        {message || "Check your internet connection and try again."}
      </p>
      <Button
        type="button"
        variant="primary"
        onClick={handleRetry}
        disabled={busy}
        loading={busy}
        className="justify-center mt-2"
      >
        {busy ? "Trying again…" : "Try again"}
      </Button>
    </div>
  );
}
