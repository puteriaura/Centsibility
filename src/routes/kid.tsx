import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/kid")({
  component: KidLayout,
});

function KidLayout() {
  return (
    <AppShell mode="kid">
      <Outlet />
    </AppShell>
  );
}
