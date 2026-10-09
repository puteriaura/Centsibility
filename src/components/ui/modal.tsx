import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AppIcon } from "@/components/ui/app-icon";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  variant?: "dialog" | "sheet";
}

export function Modal({ isOpen, onClose, title, description, children, footer, maxWidth = "480px", variant = "dialog" }: ModalProps) {
  return <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="app-dialog-overlay" />
      <Dialog.Content aria-describedby={undefined} className={variant === "sheet" ? "app-dialog app-dialog--sheet" : "app-dialog"} style={{ maxWidth }}>
        <header className="app-dialog__header">
          <div className="min-w-0">
            <Dialog.Title className={title ? "m-0 text-lg font-bold text-[var(--ink)] leading-tight" : "sr-only"}>{title || "Dialog"}</Dialog.Title>
            {description && <p className="m-0 mt-1 text-sm text-[var(--text-2)]">{description}</p>}
          </div>
          <Dialog.Close asChild><button type="button" aria-label={variant === "sheet" ? "Close sheet" : "Close dialog"} className="h-11 w-11 shrink-0 rounded-full text-[var(--text-2)] hover:bg-[var(--surface-sunken)]"><AppIcon name="close" size={20} /></button></Dialog.Close>
        </header>
        <div className="app-dialog__body">{children}</div>
        {footer && <footer className="app-dialog__footer">{footer}</footer>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
