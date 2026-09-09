import { useState } from "react";
import { Card } from "@/components/ui/card";
import { AvatarBubble } from "@/components/AvatarBubble";
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
}

export function CrewMemberCard({
  kid,
  kidTxs,
  scheduledHibahs,
  onDeleteInitiate,
  onRefresh,
}: CrewMemberCardProps) {
  const [hideBalance, setHideBalance] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [actionType, setActionType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [isScheduling, setIsScheduling] = useState(false);

  const total = Number(kid.balance) + Number(kid.invest_balance ?? 0);

  return (
    <Card className="wireframe-card">
      <div className="wireframe-space-between">
        <div className="wireframe-row">
          <AvatarBubble emoji={kid.avatar ?? "phosphor:Smiley"} size={52} />
          <div>
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
              <div>
                <strong>{kid.name}</strong>{" "}
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  title="Edit child"
                  aria-label={`Edit ${kid.name}'s profile`}
                >
                  [icon: edit]
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteInitiate(kid.id)}
                  title="Delete child"
                  aria-label={`Delete ${kid.name}'s profile`}
                >
                  [icon: delete]
                </button>
                <div>
                  <small>
                    {kid.username ? `@${kid.username}` : ""}{" "}
                    {kid.birth_year ? `• Class of ${kid.birth_year}` : ""}
                  </small>
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>
            <strong>{hideBalance ? "RM •••" : `RM ${total.toFixed(2)}`}</strong>{" "}
            <button
              type="button"
              onClick={() => setHideBalance(!hideBalance)}
              aria-label={hideBalance ? "Show balance" : "Hide balance"}
            >
              {hideBalance ? "[icon: show]" : "[icon: hide]"}
            </button>
          </div>
          <small>
            Total [icon: trust] {kid.trust_score}
          </small>
        </div>
      </div>

      <div className="wireframe-grid-3" style={{ margin: "0.75rem 0", textAlign: "center" }}>
        <div className="wireframe-box">
          <div>
            <strong>{hideBalance ? "RM •••" : `RM ${Number(kid.balance).toFixed(2)}`}</strong>
          </div>
          <small>[icon: wallet] Core</small>
        </div>
        <div className="wireframe-box">
          <div>
            <strong>{hideBalance ? "RM •••" : `RM ${Number(kid.invest_balance ?? 0).toFixed(2)}`}</strong>
          </div>
          <small>[icon: invest] Growth</small>
        </div>
        <div className="wireframe-box">
          <div>
            <strong>{hideBalance ? "•••" : Math.round(Number(kid.coins)).toLocaleString()}</strong>
          </div>
          <small>[icon: star] Stardust</small>
        </div>
      </div>

      <div className="wireframe-grid-4">
        <button
          type="button"
          onClick={() => {
            sfx.pop();
            setIsActing(isActing && actionType === "DEPOSIT" ? false : true);
            setActionType("DEPOSIT");
          }}
        >
          [icon: plus] Transmit
        </button>
        <button
          type="button"
          onClick={() => {
            sfx.pop();
            setIsActing(isActing && actionType === "WITHDRAWAL" ? false : true);
            setActionType("WITHDRAWAL");
          }}
        >
          [icon: minus] Recall
        </button>
        <button
          type="button"
          onClick={() => {
            sfx.tap();
            setExpanded(!expanded);
          }}
        >
          {expanded ? "Hide Log" : "Flight Log"}
        </button>
        <button
          type="button"
          onClick={() => {
            sfx.tap();
            setIsScheduling(!isScheduling);
          }}
        >
          Auto-Hibah
        </button>
      </div>

      {isActing && (
        <TransferFundsSection
          kid={kid}
          actionType={actionType}
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

      {expanded && <FlightLogSection kidTxs={kidTxs} />}
    </Card>
  );
}
