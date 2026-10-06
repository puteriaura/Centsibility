import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useKidData } from "@/hooks/use-kid-data";
import { TransferFlow } from "@/features/transfer/TransferFlow";

export const Route = createFileRoute("/kid/transfer")({
  head: () => ({ meta: [{ title: "Transfer Money | Centsibility" }] }),
  component: KidTransferPage,
});

function KidTransferPage() {
  const navigate = useNavigate();
  const kidData = useKidData();

  return (
    <div className="pt-2">
      <TransferFlow
        mode="kid"
        kid={kidData.data?.kid}
        onRefreshKid={kidData.refresh}
        onDone={() => navigate({ to: "/kid" })}
      />
    </div>
  );
}
