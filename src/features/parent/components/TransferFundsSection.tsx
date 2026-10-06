import { MoneyKeypad } from "@/components/MoneyKeypad";
import type { Kid } from "@/hooks/use-parent-data";
import { edgeParentDeposit } from "@/lib/edge";
import { sfx } from "@/lib/sounds";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { AppIcon } from "@/components/ui/app-icon";
import { formatRM } from "@/lib/format";

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
        label: reference || (actionType === "DEPOSIT" ? "From parent" : "Taken back by parent"),
        type: actionType,
      });
      sfx.success();
      toast.success(
        `${actionType === "DEPOSIT" ? "Deposited" : "Withdrew"} ${formatRM(amount)}`, // privacy-ok: toast
      );
      onSuccess();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const isDeposit = actionType === "DEPOSIT";

  return (
    <Card variant="default" className="p-5 mt-4 rounded-2xl border border-[var(--border)] shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDeposit ? "bg-[var(--success-soft)] text-[var(--success-text)]" : "bg-[var(--primary-soft)] text-[var(--primary-text)]"}`}>
          <AppIcon name={isDeposit ? "deposit" : "withdraw"} size={18} />
        </div>
        <strong className="text-sm font-bold text-[var(--ink)]">
          {isDeposit ? "Transmit Funds" : "Recall Funds"} for {kid.name}
        </strong>
      </div>
      <MoneyKeypad
        min={0.5}
        max={actionType === "WITHDRAWAL" ? Number(kid.balance) : 100000}
        showReference
        confirmLabel={isDeposit ? "Confirm Deposit" : "Confirm Recall"}
        onConfirm={submitAction}
        onCancel={onClose}
      />
    </Card>
  );
}
