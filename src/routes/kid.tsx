import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { PrivacyProvider } from "@/features/privacy";
import { PennyProvider } from "@/features/penny";
import { endParentUnlock } from "@/lib/admin-bypass";

export const Route = createFileRoute("/kid")({
  component: KidLayout,
});

function KidLayout() {
  useEffect(() => {
    endParentUnlock();
  }, []);

  return (
    <PrivacyProvider mode="kid">
      <PennyProvider mode="kid">
        <AppShell mode="kid">
          <Outlet />
        </AppShell>
      </PennyProvider>
    </PrivacyProvider>
  );
}
