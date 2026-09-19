import * as React from "react";
import { AppIcon } from "@/components/ui/app-icon";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "480px",
}: ModalProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full bg-white rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="flex items-start justify-between p-5 border-b border-[var(--border)]">
            <div>
              {title && (
                <h3 className="text-lg font-bold text-[var(--ink)] leading-tight">{title}</h3>
              )}
              {description && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-soft)] transition-colors"
              aria-label="Close dialog"
            >
              <AppIcon name="close" size={20} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 p-4 bg-[var(--surface-soft)] border-t border-[var(--border)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
