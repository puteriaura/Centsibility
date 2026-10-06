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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgb(14_23_38/0.45)]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full bg-[var(--surface)] rounded-3xl shadow-2xl overflow-hidden"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
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
              className="-mr-2 -mt-2 h-11 w-11 shrink-0 rounded-full text-[var(--text-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-sunken)]"
              aria-label="Close dialog"
            >
              <AppIcon name="close" size={20} />
            </button>
          </div>
        )}
        <div className="px-5 pb-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--line)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
