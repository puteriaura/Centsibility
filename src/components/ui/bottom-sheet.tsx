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
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(14_23_38/0.45)] transition-opacity duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl bg-[var(--surface)] rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-[var(--line-strong)] opacity-50 rounded-full" />
        </div>
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 px-5 pt-1 pb-3 border-b border-[var(--line)]">
            <div>
              {title && (
                <h3 className="m-0 text-lg font-bold text-[var(--ink)] leading-tight">{title}</h3>
              )}
              {description && (
                <p className="m-0 mt-1 text-sm text-[var(--text-2)]">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 -mt-1 h-11 w-11 shrink-0 rounded-full text-[var(--text-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-sunken)]"
              aria-label="Close sheet"
            >
              <AppIcon name="close" size={20} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
