import * as React from "react";
import { AppIcon } from "@/components/ui/app-icon";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
}: BottomSheetProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl bg-white rounded-t-3xl shadow-2xl border-t border-[var(--border)] max-h-[85vh] overflow-y-auto transform transition-transform duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 bg-[var(--border)] rounded-full" />
        </div>
        {(title || description) && (
          <div className="flex items-start justify-between px-6 pt-2 pb-4 border-b border-[var(--border)]">
            <div>
              {title && (
                <h3 className="text-lg font-bold text-[var(--ink)] leading-tight">{title}</h3>
              )}
              {description && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-soft)] transition-colors"
              aria-label="Close sheet"
            >
              <AppIcon name="close" size={20} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
