import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PrivacyProvider } from "@/features/privacy";
import { PennyProvider } from "@/features/penny";

export const Route = createFileRoute("/kid")({
  component: KidLayout,
});

function KidLayout() {
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
