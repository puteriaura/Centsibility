import { MoneyKeypad } from "@/components/MoneyKeypad";
import type { Kid } from "@/hooks/use-parent-data";
import { edgeParentDeposit } from "@/lib/edge";
import { sfx } from "@/lib/sounds";
import { toast } from "sonner";

interface TransferFundsSectionProps {
  kid: Kid;
  actionType: "DEPOSIT" | "WITHDRAWAL";
  onClose: () => void;
  onSuccess: () => void;
}

export function TransferFundsSection({
  kid,
  actionType,
  onClose,
  onSuccess,
}: TransferFundsSectionProps) {
  const submitAction = async (amount: number, reference?: string) => {
    try {
      await edgeParentDeposit({
        kidId: kid.id,
        amount,
        label: reference || actionType,
        type: actionType,
      });
      sfx.success();
      toast.success(
        `${actionType === "DEPOSIT" ? "Deposited" : "Withdrew"} RM ${amount.toFixed(2)}`,
      );
      onSuccess();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  return (
    <div className="wireframe-box" style={{ marginTop: "1rem" }}>
      <div>
        <strong>
          {actionType === "DEPOSIT" ? "[icon: deposit] Transmit Funds" : "[icon: withdrawal] Recall Funds"} for {kid.name}
        </strong>
      </div>
      <MoneyKeypad
        min={0.5}
        max={actionType === "WITHDRAWAL" ? Number(kid.balance) : 100000}
        showReference
        confirmLabel={actionType === "DEPOSIT" ? "Confirm Transmission" : "Confirm Recall"}
        onConfirm={submitAction}
        onCancel={onClose}
      />
    </div>
  );
}
