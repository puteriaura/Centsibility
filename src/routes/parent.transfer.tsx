import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useParentData } from "@/hooks/use-parent-data";
import { TransferFlow } from "@/features/transfer/TransferFlow";

type ParentTransferSearch = { kid?: string };

export const Route = createFileRoute("/parent/transfer")({
  validateSearch: (s: Record<string, unknown>): ParentTransferSearch => ({
    kid: typeof s.kid === "string" ? s.kid : undefined,
  }),
  head: () => ({ meta: [{ title: "Send Money | Centsibility" }] }),
  component: ParentTransferPage,
});

function ParentTransferPage() {
  const navigate = useNavigate();
  const { kid } = Route.useSearch();
  const parentData = useParentData();

  return (
    <div className="py-2 px-1">
      <TransferFlow
        mode="parent"
        preselectedKidId={kid}
        parentKids={parentData.kids}
        onRefreshParent={parentData.refresh}
        onDone={() => navigate({ to: "/parent" })}
      />
    </div>
  );
}
