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
  kid?: { name?: string; comfort_name?: string | null; balance?: number } | null;
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

const KID_REASONS = ["Gift", "Pay back", "Share", "Birthday", "Lunch"];
const PARENT_REASONS = ["Allowance", "Reward", "Birthday", "Lunch", "Pocket money"];

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

  // Wizard state: 1 = Recipient, 2 = Amount & Note, 3 = Review, 4 = PIN
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const attemptStatus = usePinStatus(mode, step === 4);
  const [isSuccess, setIsSuccess] = useState(false);

  // Recipient selection state
  const [recipientKind, setRecipientKind] = useState<"kid" | "parent">("kid");
  const [recipientId, setRecipientId] = useState<string>("");
  const [recipientName, setRecipientName] = useState<string>("");

  // Kid recipients data (loaded from kid-finance)
  const [kidRecipientsLoading, setKidRecipientsLoading] = useState(mode === "kid");
  const [siblings, setSiblings] = useState<TransferRecipientSibling[]>([]);
  const [parentRecipient, setParentRecipient] = useState<TransferRecipientParent | null>(null);
  const [kidBalance, setKidBalance] = useState<number>(0);
  const [kidUsedToday, setKidUsedToday] = useState<number>(0);

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
        console.warn("Failed to load transfer recipients:", err);
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
  const currentBalance = mode === "kid" ? (kidBalance || Number(kid?.balance || 0)) : 1000;
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

  // Quick increment handler
  const addAmount = (delta: number) => {
    sfx.tap();
    const current = Number(rawAmount) || 0;
    const next = (current + delta).toFixed(2);
    setRawAmount(next);
  };

  // Stepper navigation
  const goToStep = (nextStep: 1 | 2 | 3 | 4) => {
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
        setPinError((err.message || "Incorrect PIN").replace(/\s*\d+ (?:tries|try|attempts?) (?:left|remaining)\.?/gi, ""));
            pinSubmittingRef.current = false;
          },
        }
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
        setPinError((err.message || "Incorrect PIN").replace(/\s*\d+ (?:tries|try|attempts?) (?:left|remaining)\.?/gi, ""));
            pinSubmittingRef.current = false;
          },
        }
      );
    }

    pinSubmittingRef.current = false;
  };

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

  const reasons = mode === "kid" ? KID_REASONS : PARENT_REASONS;

  return (
    <div className="transfer-flow max-w-lg mx-auto pb-12 space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-[var(--text-2)] m-0">
            {mode === "kid"
              ? "Send pocket money to your siblings or return to parents"
              : "Direct transfer into your child's spending account"}
          </p>
        </div>
        <Badge variant="brand" className="whitespace-nowrap shrink-0">
          Step {step} of 4
        </Badge>
      </div>

      {/* Progress Dots */}
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-[var(--action)]" : "bg-[var(--surface-sunken)]"
            }`}
          />
        ))}
      </div>

      {/* STEP 1: Recipient Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title__heading">
              Select Recipient
            </h2>
            {mode === "kid" && (
              <span className="text-xs text-[var(--text-secondary)]">
                RM{dailyRemaining.toFixed(2)} daily limit remaining
              </span>
            )}
          </div>

          {mode === "kid" ? (
            kidRecipientsLoading ? (
              <div className="space-y-3">
                <Skeleton style={{ height: "4.5rem", borderRadius: "16px" }} />
                <Skeleton style={{ height: "4.5rem", borderRadius: "16px" }} />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Parent Option */}
                {parentRecipient && (
                  <button
                    type="button"
                    aria-pressed={recipientKind === "parent" && recipientId === parentRecipient.id}
                    onClick={() => {
                      sfx.tap();
                      setRecipientKind("parent");
                      setRecipientId(parentRecipient.id);
                      setRecipientName(parentRecipient.name || "Parent");
                    }}
                    className={`w-full text-left p-4 rounded-2xl cursor-pointer transition-all border ${
                      recipientKind === "parent" && recipientId === parentRecipient.id
                        ? "border-[var(--primary)] bg-[var(--surface-pink)]"
                        : "border-[var(--border)] bg-white hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AvatarBubble
                        emoji={parentRecipient.avatar || "family"}
                        size={44}
                        ring={recipientKind === "parent"}
                        kind="parent"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[var(--ink)] truncate m-0">
                            {parentRecipient.name || "Parent"}
                          </h3>
                          <Badge variant="warning">Parent</Badge>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-0">
                          Arrives instantly
                        </p>
                      </div>
                      <AppIcon
                        name={
                          recipientKind === "parent" && recipientId === parentRecipient.id
                            ? "approve"
                            : "chevron"
                        }
                        size={20}
                        color={
                          recipientKind === "parent" && recipientId === parentRecipient.id
                            ? "var(--primary)"
                            : "var(--text-muted)"
                        }
                      />
                    </div>
                  </button>
                )}

                {/* Sibling Options */}
                <div className="pt-2">
                  <span className="text-xs font-semibold text-[var(--text-muted)] block mb-2">
                    Siblings ({siblings.length})
                  </span>
                  {siblings.length === 0 ? (
                    <Card variant="soft" className="p-4 text-center text-xs text-[var(--text-secondary)]">
                      No other children found in your family.
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {siblings.map((s) => {
                        const isSelected =
                          recipientKind === "kid" && recipientId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                              sfx.tap();
                              setRecipientKind("kid");
                              setRecipientId(s.id);
                              setRecipientName(s.comfort_name || s.name);
                            }}
                            className={`w-full text-left p-4 rounded-2xl cursor-pointer transition-all border ${
                              isSelected
                                ? "border-[var(--primary)] bg-[var(--surface-pink)]"
                                : "border-[var(--border)] bg-white hover:bg-[var(--surface-soft)]"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <AvatarBubble
                                emoji={s.avatar || "smile"}
                                size={44}
                                ring={isSelected}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-bold text-[var(--ink)] truncate m-0">
                                    {s.comfort_name || s.name}
                                  </h3>
                                  <Badge variant="soft">Sibling</Badge>
                                </div>
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-0">
                                  Arrives instantly
                                </p>
                              </div>
                              <AppIcon
                                name={isSelected ? "approve" : "chevron"}
                                size={20}
                                color={
                                  isSelected
                                    ? "var(--primary)"
                                    : "var(--text-muted)"
                                }
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            /* Parent Mode: Select child */
            <div className="space-y-2">
              {parentKids.map((k) => {
                const isSelected = recipientId === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      sfx.tap();
                      setRecipientKind("kid");
                      setRecipientId(k.id);
                      setRecipientName(k.comfort_name || k.name);
                    }}
                    className={`w-full text-left p-4 rounded-2xl cursor-pointer transition-all border ${
                      isSelected
                        ? "border-[var(--primary)] bg-[var(--surface-pink)]"
                        : "border-[var(--border)] bg-white hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AvatarBubble
                        emoji={k.avatar || "smile"}
                        size={44}
                        ring={isSelected}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-[var(--ink)] truncate m-0">
                          {k.comfort_name || k.name}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-0">
                          Balance: <Money amount={Number(k.balance || 0)} />
                        </p>
                      </div>
                      <AppIcon
                        name={isSelected ? "approve" : "chevron"}
                        size={20}
                        color={
                          isSelected
                            ? "var(--primary)"
                            : "var(--text-muted)"
                        }
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <Button
            type="button"
            variant="primary"
            className="w-full justify-center"
            disabled={!recipientId}
            onClick={() => goToStep(2)}
          >
            Continue
          </Button>
        </div>
      )}

      {/* STEP 2: Amount & Reason Note */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] font-medium">
              Recipient: <strong className="text-[var(--ink)]">{recipientName}</strong>
            </span>
            {mode === "kid" && (
              <span className="text-xs text-[var(--text-secondary)]">
                Available: <Money amount={currentBalance} />
              </span>
            )}
          </div>

          {/* Large Amount Input Card */}
          <Card variant="soft" className="p-6 text-center space-y-3">
            <span className="text-xs font-bold text-[var(--text-muted)] block">
              Enter amount
            </span>
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-[var(--text-muted)]">RM</span>
              <input
                type="number"
                step="0.50"
                min="1.00"
                value={rawAmount}
                onChange={(e) => setRawAmount(e.target.value)}
                placeholder="0.00"
                aria-label="Transfer amount in RM"
                className="text-4xl font-extrabold text-[var(--ink)] text-center bg-transparent border-b-2 border-[var(--primary)] outline-hidden w-48 tabular-nums"
                autoFocus
              />
            </div>

            {/* Quick Increment Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {(mode === "kid" ? [1, 2, 5, 10] : [5, 10, 20, 50]).map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => addAmount(amt)}
                  className="px-3 py-1 text-xs font-bold rounded-full bg-white border border-[var(--border)] text-[var(--ink)] hover:border-[var(--primary)] hover:bg-[var(--surface-pink)] transition-colors"
                >
                  +RM{amt}
                </button>
              ))}
              {rawAmount && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.tap();
                    setRawAmount("");
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-full text-[var(--error-text)] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {!amountValidation.valid && rawAmount && (
              <p className="text-xs text-[var(--error-text)] font-semibold mt-2 mb-0">
                {amountValidation.error}
              </p>
            )}
          </Card>

          {/* Reason / Note Chips */}
          <div className="space-y-2">
            <label htmlFor="transfer-note" className="text-xs font-bold text-[var(--ink)] block">
              Reason or Note (Optional)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    sfx.tap();
                    setNote(preset);
                  }}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    note === preset
                      ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                      : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              id="transfer-note"
              type="text"
              maxLength={40}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="E.g. Lunch money, treat, homework helper…"
              className="w-full text-xs p-3 rounded-xl border border-[var(--border)] bg-white text-[var(--ink)] outline-hidden focus:border-[var(--primary)]"
            />
            {!noteValidation.valid && (
              <p className="text-xs text-[var(--error-text)] font-medium mt-1">
                {noteValidation.error}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 justify-center"
              onClick={() => goToStep(1)}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-1 justify-center"
              disabled={!amountValidation.valid || !noteValidation.valid}
              onClick={() => goToStep(3)}
            >
              Review
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Review Transfer Details */}
      {step === 3 && (
        <div className="space-y-4">
          <Card variant="default" className="p-5 border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--ink)] m-0">
              Transfer Summary
            </h3>

            <div className="space-y-2 text-xs divide-y divide-[var(--border)]">
              <div className="flex justify-between py-1.5">
                <span className="text-[var(--text-secondary)]">From</span>
                <span className="font-bold text-[var(--ink)]">{senderName}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[var(--text-secondary)]">To</span>
                <span className="font-bold text-[var(--ink)]">
                  {recipientName} ({recipientKind === "parent" ? "Parent" : "Child"})
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[var(--text-secondary)]">Amount</span>
                <span className="text-base font-extrabold text-[var(--ink)] tabular-nums">
                  {formatRM(amountValidation.amount || Number(rawAmount))} {/* privacy-ok: typing */}
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
              onClick={() => goToStep(2)}
            >
              Edit Amount
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
              Confirm transfer of{" "}
              <strong>{formatRM(amountValidation.amount || Number(rawAmount))}</strong> to{" "} {/* privacy-ok: typing */}
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
                      : "border-[var(--border)] bg-white text-[var(--text-muted)]"
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
            <p className="text-xs text-[var(--error-text)] font-semibold mt-2 mb-0" role="alert">
              {pinError}
            </p>
          )}

          {/* Keypad */}
          <p role="status" className="text-xs text-[var(--text-secondary)]">{attemptStatus.message}</p>
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
            onClick={() => goToStep(3)}
          >
            ← Cancel and go back
          </Button>
        </div>
      )}
    </div>
  );
}
