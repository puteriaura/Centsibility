import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvatarBubble } from "@/components/AvatarBubble";
import { AppIcon } from "@/components/ui/app-icon";
import { resolveAvatar } from "@/lib/avatar";
import type { Kid, Transaction, ScheduledHibah } from "@/hooks/use-parent-data";
import { sfx } from "@/lib/sounds";
import { toast } from "sonner";
import { edgeParentSetKidCardControls } from "@/lib/edge";
import { EditKidForm } from "./EditKidForm";
import { TransferFundsSection } from "./TransferFundsSection";
import { ScheduleHibahSection } from "./ScheduleHibahSection";
import { FlightLogSection } from "./FlightLogSection";
import { formatRM } from "@/lib/format";

export interface CrewMemberCardProps {
  kid: Kid;
  kidTxs: Transaction[];
  scheduledHibahs: ScheduledHibah[];
  onDeleteInitiate: (kidId: string) => void;
  onRefresh: () => void;
  /** Start expanded (e.g. single-child households). */
  defaultOpen?: boolean;
}

export function CrewMemberCard({
  kid,
  kidTxs,
  scheduledHibahs,
  onDeleteInitiate,
  onRefresh,
  defaultOpen = false,
}: CrewMemberCardProps) {
  const [hideBalance, setHideBalance] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [logOpen, setLogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [actType, setActType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [isScheduling, setIsScheduling] = useState(false);

  // Card controls state
  const [cardOpen, setCardOpen] = useState(false);
  const [cardFrozen, setCardFrozen] = useState(() => Boolean(kid.card_frozen));
  const [dailyLimit, setDailyLimit] = useState(() => Number(kid.card_daily_limit ?? 50));
  const [sliderLimit, setSliderLimit] = useState(() => Number(kid.card_daily_limit ?? 50));
  const [onlineEnabled, setOnlineEnabled] = useState(() =>
    kid.card_online_enabled !== undefined ? Boolean(kid.card_online_enabled) : true,
  );
  const [controlsLocked, setControlsLocked] = useState(() => Boolean(kid.card_controls_locked));
  const [savingLimit, setSavingLimit] = useState(false);
  const [savingFrozen, setSavingFrozen] = useState(false);
  const [savingOnline, setSavingOnline] = useState(false);
  const [savingLock, setSavingLock] = useState(false);

  useEffect(() => {
    setCardFrozen(Boolean(kid.card_frozen));
    setDailyLimit(Number(kid.card_daily_limit ?? 50));
    setSliderLimit(Number(kid.card_daily_limit ?? 50));
    setOnlineEnabled(
      kid.card_online_enabled !== undefined ? Boolean(kid.card_online_enabled) : true,
    );
    setControlsLocked(Boolean(kid.card_controls_locked));
  }, [
    kid.card_frozen,
    kid.card_daily_limit,
    kid.card_online_enabled,
    kid.card_controls_locked,
  ]);

  const handleToggleFreeze = async () => {
    sfx.pop();
    const prev = cardFrozen;
    const next = !prev;
    setCardFrozen(next);
    setSavingFrozen(true);
    try {
      await edgeParentSetKidCardControls({ kidId: kid.id, frozen: next });
      toast.success(next ? "Card frozen" : "Card unfrozen");
      onRefresh();
    } catch (e: unknown) {
      setCardFrozen(prev);
      const msg = e instanceof Error ? e.message : "Failed to update card status";
      toast.error(msg);
    } finally {
      setSavingFrozen(false);
    }
  };

  const handleSaveLimit = async () => {
    sfx.tap();
    const prev = dailyLimit;
    setDailyLimit(sliderLimit);
    setSavingLimit(true);
    try {
      await edgeParentSetKidCardControls({ kidId: kid.id, dailyLimit: sliderLimit });
      toast.success(`Daily limit saved: ${formatRM(sliderLimit)}`);
      onRefresh();
    } catch (e: unknown) {
      setDailyLimit(prev);
      setSliderLimit(prev);
      const msg = e instanceof Error ? e.message : "Failed to save daily limit";
      toast.error(msg);
    } finally {
      setSavingLimit(false);
    }
  };

  const handleToggleOnline = async () => {
    sfx.pop();
    const prev = onlineEnabled;
    const next = !prev;
    setOnlineEnabled(next);
    setSavingOnline(true);
    try {
      await edgeParentSetKidCardControls({ kidId: kid.id, onlineEnabled: next });
      toast.success(next ? "Online purchases enabled" : "Online purchases disabled");
      onRefresh();
    } catch (e: unknown) {
      setOnlineEnabled(prev);
      const msg = e instanceof Error ? e.message : "Failed to update online purchases";
      toast.error(msg);
    } finally {
      setSavingOnline(false);
    }
  };

  const handleToggleLock = async () => {
    sfx.pop();
    const prev = controlsLocked;
    const next = !prev;
    setControlsLocked(next);
    setSavingLock(true);
    try {
      await edgeParentSetKidCardControls({ kidId: kid.id, locked: next });
      toast.success(next ? "Card controls locked" : "Card controls unlocked");
      onRefresh();
    } catch (e: unknown) {
      setControlsLocked(prev);
      const msg = e instanceof Error ? e.message : "Failed to update lock status";
      toast.error(msg);
    } finally {
      setSavingLock(false);
    }
  };

  const total = Number(kid.balance) + Number(kid.invest_balance ?? 0);
  const avatar = resolveAvatar(kid.avatar, "kid");

  return (
    <Card variant="default" className="crew-card border border-[var(--border)] shadow-xs m-0">
      <button
        type="button"
        className="crew-card__summary"
        aria-expanded={open}
        onClick={() => {
          sfx.tap();
          setOpen((v) => !v);
        }}
      >
        <AvatarBubble emoji={avatar} size={44} ring />
        <div className="crew-card__meta min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5 flex-wrap">
            <strong className="crew-card__name truncate">{kid.name}</strong>
            <Badge
              variant={cardFrozen ? "error" : "default"}
              className="text-[11px] px-2 py-0.5 font-medium"
            >
              {cardFrozen ? "Card frozen" : `Card limit RM${dailyLimit}/day`}
              {controlsLocked && " 🔒"}
            </Badge>
          </div>
          <span className="crew-card__sub truncate">
            {kid.username ? `@${kid.username}` : "Child account"}
            {" · "}
            Trust {kid.trust_score}
          </span>
        </div>
        <div className="crew-card__balance text-right shrink-0">
          <span className="tabular-nums font-extrabold text-[var(--ink)]">
            {hideBalance ? "RM •••" : `${formatRM(total)}`}
          </span>
          <span className={`crew-card__chevron${open ? " is-open" : ""}`} aria-hidden="true">
            <AppIcon name="chevron" size={18} />
          </span>
        </div>
      </button>

      {open && (
        <div className="crew-card__body space-y-3">
          <div className="flex items-center justify-between gap-2">
            {isEditing ? (
              <EditKidForm
                kid={kid}
                onCancel={() => setIsEditing(false)}
                onSuccess={() => {
                  setIsEditing(false);
                  onRefresh();
                }}
              />
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="p-1 min-h-[40px]"
                  onClick={() => setIsEditing(true)}
                  aria-label={`Edit ${kid.name}`}
                >
                  <AppIcon name="edit" size={15} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="p-1 min-h-[40px] text-[var(--error-text)]"
                  onClick={() => onDeleteInitiate(kid.id)}
                  aria-label={`Delete ${kid.name}`}
                >
                  <AppIcon name="delete" size={15} color="var(--error)" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="p-1 min-h-[40px]"
                  onClick={() => setHideBalance((h) => !h)}
                  aria-label={hideBalance ? "Show balance" : "Hide balance"}
                >
                  <AppIcon name={hideBalance ? "show" : "hide"} size={16} />
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 p-2.5 bg-[var(--surface-soft)] rounded-xl border border-[var(--border)]">
            <div className="text-center">
              <div className="text-sm font-bold text-[var(--ink)] tabular-nums">
                {hideBalance ? "•••" : `${formatRM(Number(kid.balance))}`}
              </div>
              <small className="text-[11px] text-[var(--text-secondary)]">Core</small>
            </div>
            <div className="text-center border-x border-[var(--border)]">
              <div className="text-sm font-bold text-[var(--ink)] tabular-nums">
                {hideBalance ? "•••" : `${formatRM(Number(kid.invest_balance ?? 0))}`}
              </div>
              <small className="text-[11px] text-[var(--text-secondary)]">Growth</small>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-[var(--primary-text)] tabular-nums">
                {hideBalance ? "•••" : Math.round(Number(kid.coins)).toLocaleString()}
              </div>
              <small className="text-[11px] text-[var(--text-secondary)]">Points</small>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full justify-center text-xs font-semibold"
            aria-expanded={cardOpen}
            aria-controls={`card-controls-panel-${kid.id}`}
            onClick={() => {
              sfx.tap();
              setCardOpen((v) => !v);
            }}
          >
            <AppIcon name="creditcard" size={14} />
            {cardOpen ? "Hide card controls" : "Card controls"}
          </Button>

          {cardOpen && (
            <div
              id={`card-controls-panel-${kid.id}`}
              className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] space-y-3 text-xs"
              aria-label={`Card controls for ${kid.name}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
                  <AppIcon name="creditcard" size={16} />
                  <span>Card Controls</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCardOpen(false)}
                  className="text-[11px] font-semibold text-[var(--primary-text)] hover:underline"
                  aria-label="Close card controls"
                >
                  Done
                </button>
              </div>

              {/* Freeze Toggle */}
              <div className="flex items-center justify-between gap-3 pt-1 border-t border-[var(--border)]">
                <div>
                  <label htmlFor={`freeze-toggle-${kid.id}`} className="font-semibold text-[var(--ink)] block">
                    Freeze card
                  </label>
                  <span className="text-[11px] text-[var(--text-secondary)] block">
                    Temporarily block all card transactions and requests.
                  </span>
                </div>
                <input
                  id={`freeze-toggle-${kid.id}`}
                  type="checkbox"
                  aria-label={`Freeze card for ${kid.name}`}
                  checked={cardFrozen}
                  disabled={savingFrozen}
                  onChange={handleToggleFreeze}
                  className="toggle-switch accent-[var(--primary)] shrink-0"
                />
              </div>

              {/* Limit Slider */}
              <div className="pt-2 border-t border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor={`daily-limit-${kid.id}`} className="font-semibold text-[var(--ink)] block">
                      Daily spending limit
                    </label>
                    <span className="text-[11px] text-[var(--text-secondary)] block">
                      Max sadaqah or withdrawal per day (RM10–RM200).
                    </span>
                  </div>
                  <strong className="text-xs text-[var(--primary-text)] tabular-nums font-bold">
                    {formatRM(sliderLimit)}
                  </strong>
                </div>
                <input
                  id={`daily-limit-${kid.id}`}
                  type="range"
                  min={10}
                  max={200}
                  step={10}
                  value={sliderLimit}
                  onChange={(e) => setSliderLimit(Number(e.target.value))}
                  aria-label={`Daily spending limit for ${kid.name}`}
                  className="w-full accent-[var(--primary)]"
                />
                <div className="flex justify-end pt-0.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={savingLimit || sliderLimit === dailyLimit}
                    loading={savingLimit}
                    onClick={handleSaveLimit}
                    className="text-[11px] min-h-[32px] px-3"
                    aria-label={`Save daily limit for ${kid.name}`}
                  >
                    Save limit
                  </Button>
                </div>
              </div>

              {/* Online Purchases Toggle */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
                <div>
                  <label htmlFor={`online-toggle-${kid.id}`} className="font-semibold text-[var(--ink)] block">
                    Online purchases
                  </label>
                  <span className="text-[11px] text-[var(--text-secondary)] block">
                    Allow online transactions on the practice card.
                  </span>
                </div>
                <input
                  id={`online-toggle-${kid.id}`}
                  type="checkbox"
                  aria-label={`Allow online purchases for ${kid.name}`}
                  checked={onlineEnabled}
                  disabled={savingOnline}
                  onChange={handleToggleOnline}
                  className="toggle-switch accent-[var(--primary)] shrink-0"
                />
              </div>

              {/* Lock Controls Toggle */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
                <div>
                  <label htmlFor={`lock-controls-${kid.id}`} className="font-semibold text-[var(--ink)] block">
                    Lock these settings
                  </label>
                  <span className="text-[11px] text-[var(--text-secondary)] block">
                    Your child can make them stricter but not looser.
                  </span>
                </div>
                <input
                  id={`lock-controls-${kid.id}`}
                  type="checkbox"
                  aria-label={`Lock card controls for ${kid.name}`}
                  checked={controlsLocked}
                  disabled={savingLock}
                  onChange={handleToggleLock}
                  className="toggle-switch accent-[var(--primary)] shrink-0"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={isActing && actType === "DEPOSIT" ? "primary" : "outline"}
              size="sm"
              className="justify-center text-xs font-semibold"
              onClick={() => {
                sfx.pop();
                setIsActing(isActing && actType === "DEPOSIT" ? false : true);
                setActType("DEPOSIT");
              }}
            >
              <AppIcon name="plus" size={14} /> Transfer
            </Button>
            <Button
              type="button"
              variant={isActing && actType === "WITHDRAWAL" ? "primary" : "outline"}
              size="sm"
              className="justify-center text-xs font-semibold"
              onClick={() => {
                sfx.pop();
                setIsActing(isActing && actType === "WITHDRAWAL" ? false : true);
                setActType("WITHDRAWAL");
              }}
            >
              <AppIcon name="minus" size={14} /> Recall
            </Button>
            <Button
              type="button"
              variant={logOpen ? "primary" : "outline"}
              size="sm"
              className="justify-center text-xs font-semibold"
              onClick={() => {
                sfx.tap();
                setLogOpen(!logOpen);
              }}
            >
              <AppIcon name="chart" size={14} /> Activity
            </Button>
            <Button
              type="button"
              variant={isScheduling ? "primary" : "outline"}
              size="sm"
              className="justify-center text-xs font-semibold"
              onClick={() => {
                sfx.tap();
                setIsScheduling(!isScheduling);
              }}
            >
              <AppIcon name="sparkles" size={14} /> Hibah
            </Button>
          </div>

          {isActing && (
            <TransferFundsSection
              kid={kid}
              actionType={actType}
              onClose={() => setIsActing(false)}
              onSuccess={() => {
                setIsActing(false);
                onRefresh();
              }}
            />
          )}

          {isScheduling && (
            <ScheduleHibahSection
              kid={kid}
              scheduledHibahs={scheduledHibahs}
              onClose={() => setIsScheduling(false)}
              onRefresh={onRefresh}
            />
          )}

          {logOpen && <FlightLogSection kidTxs={kidTxs} />}
        </div>
      )}
    </Card>
  );
}
