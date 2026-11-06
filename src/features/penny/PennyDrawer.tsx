import { Drawer } from "vaul";
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { usePenny } from "./PennyProvider";
import { PennyChat } from "./PennyChat";
import { AppIcon } from "@/components/ui/app-icon";
import { sfx } from "@/lib/sounds";

export function PennyDrawer() {
  const { isOpen, closePenny, mode } = usePenny();
  const navigate = useNavigate();
  const returnFocus = useRef<HTMLElement | null>(null);
  const target = useRef<"/kid/chat" | "/parent/penny" | null>(null);

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closePenny();
      }}
      onAnimationEnd={(open) => {
        if (!open && target.current) {
          const to = target.current;
          target.current = null;
          void navigate({ to });
        }
      }}
      shouldScaleBackground={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="penny-drawer__overlay" />
        <Drawer.Content
          className="penny-drawer__content"
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            if (!target.current && returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          {/* Hidden title for screen reader accessibility */}
          <Drawer.Title className="sr-only">Penny</Drawer.Title>

          {/* Grab handle */}
          <div className="penny-drawer__handle-bar" aria-hidden="true">
            <div className="penny-drawer__handle" />
          </div>

          {/* Drawer header */}
          <header className="penny-drawer__header">
            <div className="penny-drawer__title-group">
              <AppIcon name="penny" size={32} />
              <span className="penny-drawer__title-text">Penny</span>
              <span className="penny-chat__beta">Beta</span>
            </div>
            <div className="penny-drawer__header-actions">
              <Drawer.Close asChild>
              <button
                type="button"
                data-vaul-no-drag
                className="penny-drawer__full-link"
                onClick={() => {
                  target.current = mode === "kid" ? "/kid/chat" : "/parent/penny";
                  sfx.tap();
                  closePenny();
                }}
              >
                Open full chat ↗
              </button>
              </Drawer.Close>
              <Drawer.Close asChild>
                <button
                  type="button"
                  className="shell-icon-btn min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
                  aria-label="Close Penny"
                  onClick={() => {
                    sfx.tap();
                    closePenny();
                  }}
                >
                  <AppIcon name="close" size={20} />
                </button>
              </Drawer.Close>
            </div>
          </header>

          {/* Drawer body */}
          <div className="penny-drawer__body">
            <PennyChat inDrawer={true} mode={mode} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
