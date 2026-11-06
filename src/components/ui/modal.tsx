import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { spring } from "@/lib/motion";
import { useTheme } from "@/lib/theme";
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
  const { reduced } = useTheme();
  const returnFocus = React.useRef<HTMLElement | null>(null);
  const resting = { opacity: 1, y: 0, scale: 1 };
  const hidden = reduced ? { opacity: 0 } : variant === "sheet"
    ? { opacity: 0, y: "100%" } : { opacity: 0, scale: 0.97 };
  return <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal forceMount>
      <AnimatePresence>
      {isOpen && <Dialog.Overlay forceMount asChild key="scrim"><motion.div className="app-dialog-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.12 : 0.15 }} /></Dialog.Overlay>}
      {isOpen && <Dialog.Content forceMount asChild key="content" aria-describedby={undefined}
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (returnFocus.current?.isConnected) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}>
        <motion.div className={variant === "sheet" ? "app-dialog app-dialog--sheet" : "app-dialog"} style={{ maxWidth }}
          initial={hidden} animate={reduced ? { opacity: 1 } : resting} exit={hidden}
          transition={reduced ? { duration: 0.12 } : { ...spring, opacity: { duration: 0.15 } }}>
        {variant === "sheet" && <div className="app-dialog__grabber" aria-hidden="true" />}
        <header className="app-dialog__header">
          <div className="min-w-0">
            <Dialog.Title className={title ? "m-0 text-lg font-bold text-[var(--ink)] leading-tight" : "sr-only"}>{title || "Dialog"}</Dialog.Title>
            {description && <p className="m-0 mt-1 text-sm text-[var(--text-2)]">{description}</p>}
          </div>
          <Dialog.Close asChild><button type="button" aria-label={variant === "sheet" ? "Close sheet" : "Close dialog"} className="h-11 w-11 shrink-0 rounded-full text-[var(--text-2)] hover:bg-[var(--surface-sunken)]"><AppIcon name="close" size={20} /></button></Dialog.Close>
        </header>
        <div className="app-dialog__body">{children}</div>
        {footer && <footer className="app-dialog__footer">{footer}</footer>}
        </motion.div>
      </Dialog.Content>}
      </AnimatePresence>
    </Dialog.Portal>
  </Dialog.Root>;
}
