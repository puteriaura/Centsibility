import * as React from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { NumericKeypad, PIN_KEYPAD_KEYS } from "@/components/ui/numeric-keypad";
import { sfx } from "@/lib/sounds";
import { edgeKidUnlock, edgeParentVerifyPin } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { toast } from "sonner";

export interface PrivacyUnlockSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode?: "kid" | "parent";
}

export function PrivacyUnlockSheet({
  isOpen,
  onClose,
  onSuccess,
  mode = "kid",
}: PrivacyUnlockSheetProps) {
  const [pin, setPin] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setPin("");
      setErrorMsg(null);
      setBusy(false);
    }
  }, [isOpen]);

  const handleKeyPress = async (key: string) => {
    if (busy) return;
    setErrorMsg(null);

    if (key === "delete" || key === "⌫") {
      setPin((prev) => prev.slice(0, -1));
      return;
    }

    if (!/^\d$/.test(key)) return;

    if (pin.length < 6) {
      const nextPin = pin + key;
      setPin(nextPin);

      if (nextPin.length === 6) {
        setBusy(true);
        try {
          if (mode === "kid") {
            const session = getKidSession();
            if (!session?.code) {
              setErrorMsg("Session missing. Please log in again.");
              sfx.error();
              setBusy(false);
              return;
            }

            const res = await edgeKidUnlock({
              code: session.code,
              pin: nextPin,
            });
            if (res.ok) {
              sfx.success();
              onSuccess();
              onClose();
            } else {
              setErrorMsg("PIN verification failed");
              sfx.error();
              setPin("");
            }
          } else {
            // Parent mode
            const res = await edgeParentVerifyPin({ pin: nextPin });
            if (res.valid) {
              sfx.success();
              onSuccess();
              onClose();
            } else {
              const attemptsMsg =
                res.attemptsLeft !== undefined
                  ? `Incorrect PIN. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? "" : "s"} left`
                  : "That PIN isn't right.";
              setErrorMsg(attemptsMsg);
              sfx.error();
              setPin("");
            }
          }
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "PIN verification failed";
          setErrorMsg(msg);
          sfx.error();
          setPin("");
        } finally {
          setBusy(false);
        }
      }
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Enter your PIN to see your money"
      description="Keep your balance and figures private."
    >
      <div className="flex flex-col items-center py-4 px-2 space-y-4">
        {/* 6 PIN dots */}
        <div
          className="flex justify-center items-center gap-3 my-2"
          role="status"
          aria-label={`${pin.length} of 6 digits entered`}
        >
          {Array.from({ length: 6 }).map((_, i) => {
            const filled = i < pin.length;
            return (
              <span
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  filled
                    ? "bg-[var(--primary)] scale-110 shadow-xs"
                    : "bg-[var(--border)]"
                }`}
              />
            );
          })}
        </div>

        {errorMsg && (
          <p
            className="text-xs font-semibold text-[var(--error-text)] text-center max-w-xs animate-shake"
            role="alert"
          >
            {errorMsg}
          </p>
        )}

        <div className="w-full max-w-xs mx-auto">
          <NumericKeypad
            variant="pin"
            keys={PIN_KEYPAD_KEYS}
            disabled={busy}
            onKeyPress={handleKeyPress}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--ink)] py-2 min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
}
