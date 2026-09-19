import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarBubble } from "@/components/AvatarBubble";
import { AppIcon } from "@/components/ui/app-icon";
import { resolveAvatar } from "@/lib/avatar";
import type { Kid, Transaction, ScheduledHibah } from "@/hooks/use-parent-data";
import { sfx } from "@/lib/sounds";
import { EditKidForm } from "./EditKidForm";
import { TransferFundsSection } from "./TransferFundsSection";
import { ScheduleHibahSection } from "./ScheduleHibahSection";
import { FlightLogSection } from "./FlightLogSection";

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
          <strong className="crew-card__name truncate">{kid.name}</strong>
          <span className="crew-card__sub truncate">
            {kid.username ? `@${kid.username}` : "Child account"}
            {" · "}
            Trust {kid.trust_score}
          </span>
        </div>
        <div className="crew-card__balance text-right shrink-0">
          <span className="tabular-nums font-extrabold text-[var(--ink)]">
            {hideBalance ? "RM •••" : `RM ${total.toFixed(2)}`}
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
                  className="p-1 min-h-[40px] text-[var(--error)]"
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
                {hideBalance ? "•••" : `RM ${Number(kid.balance).toFixed(2)}`}
              </div>
              <small className="text-[10px] text-[var(--text-secondary)]">Core</small>
            </div>
            <div className="text-center border-x border-[var(--border)]">
              <div className="text-sm font-bold text-[var(--ink)] tabular-nums">
                {hideBalance ? "•••" : `RM ${Number(kid.invest_balance ?? 0).toFixed(2)}`}
              </div>
              <small className="text-[10px] text-[var(--text-secondary)]">Growth</small>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-[var(--primary)] tabular-nums">
                {hideBalance ? "•••" : Math.round(Number(kid.coins)).toLocaleString()}
              </div>
              <small className="text-[10px] text-[var(--text-secondary)]">Points</small>
            </div>
          </div>

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
