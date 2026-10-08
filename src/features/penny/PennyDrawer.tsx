import { Drawer } from "vaul";
import { Link } from "@tanstack/react-router";
import { usePenny } from "./PennyProvider";
import { PennyChat } from "./PennyChat";
import { AppIcon } from "@/components/ui/app-icon";
import { sfx } from "@/lib/sounds";

export function PennyDrawer() {
  const { isOpen, closePenny, mode } = usePenny();

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closePenny();
      }}
      shouldScaleBackground={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="penny-drawer__overlay" />
        <Drawer.Content
          className="penny-drawer__content"
          aria-describedby={undefined}
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
              <Link
                to={mode === "kid" ? "/kid/chat" : "/parent/penny"}
                className="penny-drawer__full-link"
                onClick={() => {
                  sfx.tap();
                  closePenny();
                }}
              >
                Open full chat ↗
              </Link>
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
