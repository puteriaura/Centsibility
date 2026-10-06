import { createFileRoute } from "@tanstack/react-router";
import { PennyChat } from "@/features/penny";

export const Route = createFileRoute("/parent/penny")({
  head: () => ({ meta: [{ title: "Penny | Centsibility" }] }),
  component: ParentPennyRoute,
});

function ParentPennyRoute() {
  return <PennyChat inDrawer={false} mode="parent" />;
}
