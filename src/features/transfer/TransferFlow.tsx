import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppIcon } from "@/components/ui/app-icon";
import { AvatarBubble } from "@/components/AvatarBubble";
import { NumericKeypad, PIN_KEYPAD_KEYS } from "@/components/ui/numeric-keypad";
import { SuccessState } from "@/components/SuccessState";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoneyAction } from "@/hooks/use-money-action";
import { usePinStatus } from "@/hooks/use-pin-status";
import { useAuth } from "@/providers/auth";
import { getKidSession } from "@/lib/kid-session";
import { formatRM } from "@/lib/format";
import { Money } from "@/features/privacy";
import { sfx } from "@/lib/sounds";
import { toast } from "sonner";
import {
  edgeKidTransferRecipients,
  edgeKidTransfer,
  edgeParentTransfer,
  TransferRecipientSibling,
  TransferRecipientParent,
} from "@/lib/edge";
import {
  validateTransferAmount,
  validateTransferNote,
} from "@/features/transfer/validate";
import { parentDisplayName } from "@/lib/display-name";

export interface TransferFlowProps {
  mode: "kid" | "parent";
  preselectedKidId?: string;
  onDone?: () => void;
  kid?: {
    name?: string;
    comfort_name?: string | null;
    balance?: number;
  } | null;
  onRefreshKid?: () => void;
  parentKids?: Array<{
    id: string;
    name: string;
    comfort_name?: string | null;
    avatar?: string | null;
    balance?: number;
  }>;
  onRefreshParent?: () => void;
}

export function TransferFlow({
  mode,
  preselectedKidId,
  onDone,
  kid,
  onRefreshKid,
  parentKids = [],
  onRefreshParent,
}: TransferFlowProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { busy, run } = useMoneyAction();

  // Compose, review, then PIN authorization. Composition never moves money.
  const [step, setStep] = useState<1 | 3 | 4>(1);
  const attemptStatus = usePinStatus(mode, step === 4);
  const [isSuccess, setIsSuccess] = useState(false);

  // Recipient selection state
  const [recipientKind, setRecipientKind] = useState<"kid" | "parent">("kid");
  const [recipientId, setRecipientId] = useState<string>("");
  const [recipientName, setRecipientName] = useState<string>("");

  // Kid recipients data (loaded from kid-finance)
  const [kidRecipientsLoading, setKidRecipientsLoading] = useState(
    mode === "kid",
  );
  const [siblings, setSiblings] = useState<TransferRecipientSibling[]>([]);
  const [parentRecipient, setParentRecipient] =
    useState<TransferRecipientParent | null>(null);
  const [kidBalance, setKidBalance] = useState<number | null>(null);
  const [kidUsedToday, setKidUsedToday] = useState<number>(0);

  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientError, setRecipientError] = useState(false);

  // Amount & Note state
  const [rawAmount, setRawAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // PIN state
  const [pin, setPin] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);
  const pinSubmittingRef = useRef(false);

  // Load kid transfer recipients
  useEffect(() => {
    if (mode !== "kid") return;
    const session = getKidSession();
    if (!session?.code) {
      setKidRecipientsLoading(false);
      return;
    }

    edgeKidTransferRecipients({ code: session.code })
      .then((res) => {
        setSiblings(res.siblings || []);
        setParentRecipient(res.parent || null);
        setKidBalance(res.balance || 0);
        setKidUsedToday(res.usedToday || 0);
      })
      .catch((err) => {
        setRecipientError(true);
      })
      .finally(() => {
        setKidRecipientsLoading(false);
      });
  }, [mode]);

  // Handle preselected kid in parent mode
  useEffect(() => {
    if (mode === "parent" && preselectedKidId && parentKids.length > 0) {
      const match = parentKids.find((k) => k.id === preselectedKidId);
      if (match) {
        setRecipientKind("kid");
        setRecipientId(match.id);
        setRecipientName(match.comfort_name || match.name);
      }
    }
  }, [mode, preselectedKidId, parentKids]);

  // Daily transfer limits for kid
  const dailyLimit = 50.0;
  const dailyRemaining = Math.max(0, dailyLimit - kidUsedToday);

  // Sender details
  const senderName = useMemo(() => {
    if (mode === "kid") {
      return kid?.comfort_name || kid?.name || "Me";
    }
    return parentDisplayName(user);
  }, [mode, kid, user]);

  // Validation
  const currentBalance =
    mode === "kid" ? (kidBalance ?? Number(kid?.balance || 0)) : 1000;
  const amountValidation = useMemo(() => {
    if (mode === "kid") {
      return validateTransferAmount(rawAmount, {
        min: 1.0,
        balance: currentBalance,
        dailyLeft: dailyRemaining,
      });
    }
    return validateTransferAmount(rawAmount, {
      min: 1.0,
      max: 1000.0,
    });
  }, [mode, rawAmount, currentBalance, dailyRemaining]);

  const noteValidation = useMemo(() => {
    return validateTransferNote(note);
  }, [note]);

  // Stepper navigation
  const goToStep = (nextStep: 1 | 3 | 4) => {
    sfx.tap();
    setStep(nextStep);
  };

  // PIN Keypress handler
  const handlePinPress = (key: string) => {
    if (busy || pinSubmittingRef.current || attemptStatus.locked) return;
    if (pinError) setPinError(null);

    if (key === "delete" || key === "⌫") {
      setPin((prev) => prev.slice(0, -1));
      return;
    }

    if (!/^\d$/.test(key)) return;
    if (pin.length >= 6) return;

    const nextPin = pin + key;
    setPin(nextPin);

    if (nextPin.length === 6) {
      void submitTransfer(nextPin);
    }
  };

  // Submit transfer
  const submitTransfer = async (pinToUse: string) => {
    if (pinSubmittingRef.current || busy) return;
    pinSubmittingRef.current = true;
    setPinError(null);

    const amountNum = amountValidation.amount || Number(rawAmount);

    if (mode === "kid") {
      const session = getKidSession();
      if (!session?.code) {
        toast.error("Session expired. Please sign in again.");
        pinSubmittingRef.current = false;
        return;
      }

      await run(
        async () => {
          return await edgeKidTransfer({
            code: session.code,
            pin: pinToUse,
            recipientKind,
            recipientId,
            amount: amountNum,
            note: noteValidation.note,
          });
        },
        {
          retry: false,
          success: `RM${amountNum.toFixed(2)} sent to ${recipientName}!`,
          failure: "Transfer failed",
          onSuccess: () => {
            setIsSuccess(true);
            onRefreshKid?.();
          },
          onError: (err) => {
            setPin("");
            setPinError(
              (err.message || "Incorrect PIN").replace(
                /\s*\d+ (?:tries|try|attempts?) (?:left|remaining)\.?/gi,
                "",
              ),
            );
            pinSubmittingRef.current = false;
          },
        },
      );
    } else {
      await run(
        async () => {
          return await edgeParentTransfer({
            kidId: recipientId,
            amount: amountNum,
            note: noteValidation.note,
            pin: pinToUse,
          });
        },
        {
          retry: false,
          success: `RM${amountNum.toFixed(2)} transferred to ${recipientName}!`,
          failure: "Transfer failed",
          onSuccess: () => {
            setIsSuccess(true);
            onRefreshParent?.();
          },
          onError: (err) => {
            setPin("");
            setPinError(
              (err.message || "Incorrect PIN").replace(
                /\s*\d+ (?:tries|try|attempts?) (?:left|remaining)\.?/gi,
                "",
              ),
            );
            pinSubmittingRef.current = false;
          },
        },
      );
    }

    pinSubmittingRef.current = false;
  };

  const typedAmount = amountValidation.amount || Number(rawAmount);
  const amountText = formatRM(typedAmount); // privacy-ok: typing

  const handleFinish = () => {
    sfx.tap();
    if (onDone) {
      onDone();
    } else {
      navigate({ to: mode === "kid" ? "/kid" : "/parent" });
    }
  };

  const handleSendAnother = () => {
    sfx.tap();
    setIsSuccess(false);
    setStep(1);
    setRawAmount("");
    setNote("");
    setPin("");
    setPinError(null);
  };

  // Success view
  if (isSuccess) {
    const amountNum = amountValidation.amount || Number(rawAmount) || 0;

    return (
      <div className="py-6 px-4 max-w-md mx-auto space-y-3">
        <SuccessState
          title="Transfer sent!"
          detail={`RM${amountNum.toFixed(2)} is now in ${recipientName}'s account.`}
          buttonText="Done"
          onAction={handleFinish}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center"
          onClick={handleSendAnother}
        >
          Send another
        </Button>
      </div>
    );
  }

  const recipients =
    mode === "kid"
      ? [
          ...(parentRecipient
            ? [
                {
                  id: parentRecipient.id,
                  name: parentRecipient.name || "Parent",
                  avatar: parentRecipient.avatar,
                  kind: "parent" as const,
                },
              ]
            : []),
          ...siblings.map((s) => ({
            id: s.id,
            name: s.comfort_name || s.name,
            avatar: s.avatar,
            kind: "kid" as const,
          })),
        ]
      : parentKids.map((k) => ({
          id: k.id,
          name: k.comfort_name || k.name,
          avatar: k.avatar,
          kind: "kid" as const,
        }));
  const matchingRecipients = recipients.filter((r) =>
    r.name
      .toLocaleLowerCase()
      .includes(recipientSearch.toLocaleLowerCase().trim()),
  );

  return (
    <div className="transfer-flow max-w-lg mx-auto pb-12 space-y-5">
      {step === 1 && (
        <Card className="p-4 flex items-center gap-3">
          <span className="account-icon">
            <AppIcon name="wallet" size={24} />
          </span>
          <div className="min-w-0">
            <span className="text-sm text-[var(--text-2)]">From</span>
            <strong className="block">{senderName}</strong>
            <span className="text-sm">
              {mode === "kid" ? (
                <Money amount={currentBalance} />
              ) : (
                "Parent funding"
              )}
            </span>
          </div>
        </Card>
      )}
      {/* STEP 1: Recipient Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title__heading shrink-0 whitespace-nowrap">
              To
            </h2>
            {mode === "kid" && (
              <span className="text-xs text-[var(--text-secondary)]">
                <Money amount={dailyRemaining} /> daily limit remaining
              </span>
            )}
          </div>

          <label className="block">
            <span className="sr-only">Search family recipients</span>
            <input
              type="search"
              value={recipientSearch}
              onChange={(e) => setRecipientSearch(e.target.value)}
              placeholder="Search family"
              className="w-full p-3 rounded-xl bg-[var(--surface)] border border-[var(--line)]"
            />
          </label>
          {kidRecipientsLoading ? (
            <Skeleton style={{ height: 96, borderRadius: 14 }} />
          ) : (
            <div className="recipient-list" aria-label="Family recipients">
              {matchingRecipients.map((r) => (
                <button
                  key={r.kind + r.id}
                  type="button"
                  className="recipient-chip"
                  aria-pressed={
                    recipientId === r.id && recipientKind === r.kind
                  }
                  onClick={() => {
                    setRecipientKind(r.kind);
                    setRecipientId(r.id);
                    setRecipientName(r.name);
                    sfx.tap();
                  }}
                >
                  <AvatarBubble
                    emoji={
                      r.avatar || (r.kind === "parent" ? "family" : "smile")
                    }
                    size={44}
                    kind={r.kind}
                  />
                  <span>{r.name}</span>
                </button>
              ))}
              {matchingRecipients.length === 0 && (
                <p className="text-sm text-[var(--text-2)]" role="status">
                  {recipientError
                    ? "Could not load recipients. Reopen Transfer to retry."
                    : recipients.length === 0
                      ? "No permitted family recipients available."
                      : "No matching family recipient."}
                </p>
              )}
            </div>
          )}

          {/* Large Amount Input Card */}
          <Card variant="soft" className="p-4 space-y-3">
            <span className="text-xs font-bold text-[var(--text-muted)] block">
              Amount
            </span>
            <div className="flex items-center justify-center gap-1">
              <span className="shrink-0 text-2xl font-bold text-[var(--text-muted)]">
                RM
              </span>
              <input
                type="number"
                step="0.50"
                min="1.00"
                value={rawAmount}
                onChange={(e) => setRawAmount(e.target.value)}
                placeholder="0.00"
                aria-label="Transfer amount in RM"
                className="text-4xl font-extrabold text-[var(--ink)] text-center bg-transparent border-b-2 border-[var(--primary)] outline-hidden w-full min-w-0 tabular-nums"
              />
            </div>

            {!amountValidation.valid && rawAmount && (
              <p className="text-xs text-[var(--error-text)] font-semibold mt-2 mb-0">
                {amountValidation.error}
              </p>
            )}
          </Card>

          {/* Reason / Note Chips */}
          <div className="space-y-2">
            <label
              htmlFor="transfer-note"
              className="text-xs font-bold text-[var(--ink)] block"
            >
              Reason or Note (Optional)
            </label>
            <input
              id="transfer-note"
              type="text"
              maxLength={40}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="E.g. Lunch money, treat, homework helper…"
              className="w-full text-xs p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] outline-hidden focus:border-[var(--primary)]"
            />
            {!noteValidation.valid && (
              <p className="text-xs text-[var(--error-text)] font-medium mt-1">
                {noteValidation.error}
              </p>
            )}
          </div>

          {mode === "kid" && (
            <p className="text-sm text-[var(--text-2)]">
              Daily limit remaining: <Money amount={dailyRemaining} />
            </p>
          )}
          <Button
            type="button"
            variant="primary"
            className="w-full justify-center"
            disabled={
              !recipientId ||
              recipientError ||
              kidRecipientsLoading ||
              !amountValidation.valid ||
              !noteValidation.valid ||
              busy
            }
            onClick={() => goToStep(3)}
          >
            Continue
          </Button>
        </div>
      )}

      {/* STEP 3: Review Transfer Details */}
      {step === 3 && (
        <div className="space-y-4">
          <Card
            variant="default"
            className="p-5 border border-[var(--border)] space-y-4"
          >
            <h3 className="text-sm font-bold text-[var(--ink)] m-0">
              Transfer Summary
            </h3>

            <div className="space-y-2 text-xs divide-y divide-[var(--border)]">
              <div className="flex justify-between py-1.5">
                <span className="text-[var(--text-secondary)]">From</span>
                <span className="font-bold text-[var(--ink)]">
                  {senderName}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[var(--text-secondary)]">To</span>
                <span className="font-bold text-[var(--ink)]">
                  {recipientName} (
                  {recipientKind === "parent" ? "Parent" : "Child"})
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[var(--text-secondary)]">Amount</span>
                <span className="text-base font-extrabold text-[var(--ink)] tabular-nums">
                  {amountText}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[var(--text-secondary)]">Note</span>
                <span className="text-[var(--ink)] italic">
                  {noteValidation.note || "No note attached"}
                </span>
              </div>
            </div>

            {/* Transfer Policy Explainer */}
            <div className="p-3 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-1">
              <strong className="text-[var(--ink)] block">
                Instant Transfer
              </strong>
              <p className="m-0 leading-relaxed">
                {mode === "kid" && recipientKind === "kid"
                  ? `Funds will be transferred directly to ${recipientName} immediately.`
                  : mode === "kid" && recipientKind === "parent"
                    ? "Funds will be transferred directly to your parent immediately."
                    : "Funds will be deposited into your child's spending account right away."}
              </p>
            </div>
          </Card>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 justify-center"
              onClick={() => goToStep(1)}
            >
              Edit transfer
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-1 justify-center"
              onClick={() => {
                setPin("");
                setPinError(null);
                goToStep(4);
              }}
            >
              Enter PIN to Confirm
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: 6-digit PIN Confirmation */}
      {step === 4 && (
        <div className="space-y-4 text-center">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[var(--ink)] m-0">
              Enter 6-Digit PIN
            </h2>
            <p className="text-xs text-[var(--text-secondary)] m-0">
              Confirm transfer of <strong>{amountText}</strong> to{" "}
              {/* privacy-ok: typing */}
              <strong>{recipientName}</strong>
            </p>
          </div>

          {/* 6 PIN Indicator Dots */}
          <div className="flex justify-center gap-2 my-4" role="presentation">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const filled = i < pin.length;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-center font-bold border transition-all ${
                    filled
                      ? "border-[var(--primary)] bg-[var(--surface-pink)] text-[var(--primary-text)] shadow-xs"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]"
                  }`}
                  style={{
                    width: "44px",
                    height: "52px",
                    borderRadius: "14px",
                    fontSize: "22px",
                  }}
                  aria-hidden="true"
                >
                  {filled ? "●" : ""}
                </div>
              );
            })}
          </div>

          {/* Inline PIN error message */}
          {pinError && (
            <p
              className="text-xs text-[var(--error-text)] font-semibold mt-2 mb-0"
              role="alert"
            >
              {pinError}
            </p>
          )}

          {/* Keypad */}
          <p role="status" className="text-xs text-[var(--text-secondary)]">
            {attemptStatus.message}
          </p>
          <NumericKeypad
            keys={PIN_KEYPAD_KEYS}
            onKeyPress={handlePinPress}
            disabled={busy || attemptStatus.locked}
            variant="pin"
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-[var(--text-secondary)] mx-auto mt-2"
            disabled={busy}
            onClick={() => goToStep(3)}
          >
            ← Cancel and go back
          </Button>
        </div>
      )}
    </div>
  );
}
