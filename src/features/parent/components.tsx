import { useState } from "react";
import { Card } from "@/components/AppShell";
import { AvatarBubble } from "@/components/AvatarBubble";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { format } from "date-fns";
import type { Kid, Transaction, ScheduledHibah } from "@/hooks/use-parent-data";
import { sfx } from "@/lib/sounds";
import { toast } from "sonner";
import {
  edgeParentUpdateKid,
  edgeParentCreateScheduledHibah,
  edgeParentDeactivateScheduledHibah,
  edgeParentDeposit,
} from "@/lib/edge";

interface CrewMemberCardProps {
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
  const [editData, setEditData] = useState({
    name: kid.name,
    username: kid.username || "",
    birthDate: kid.birth_date || "",
    birthYear: kid.birth_year ? String(kid.birth_year) : "",
  });

  const [isActing, setIsActing] = useState(false);
  const [actionType, setActionType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");

  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleData, setScheduleData] = useState<{
    amount: string;
    frequency: "weekly" | "daily" | "bi-weekly" | "monthly" | "quarterly" | "annually";
    startDate: Date | undefined;
    endDate: Date | undefined;
  }>({
    amount: "10",
    frequency: "weekly",
    startDate: new Date(),
    endDate: undefined,
  });

  const total = Number(kid.balance) + Number(kid.invest_balance ?? 0);

  const handleUpdateKid = async () => {
    if (!editData.name.trim()) return;
    try {
      await edgeParentUpdateKid({
        kidId: kid.id,
        name: editData.name.trim(),
        username: editData.username.trim() || undefined,
        birth_date: editData.birthDate || undefined,
        birth_year: editData.birthYear ? parseInt(editData.birthYear) : undefined,
      });
      toast.success("Child profile updated");
      setIsEditing(false);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

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
      setIsActing(false);
      onRefresh();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const handleScheduleHibah = async () => {
    if (!scheduleData.startDate || !scheduleData.amount) return;
    try {
      await edgeParentCreateScheduledHibah({
        kidId: kid.id,
        amount: parseFloat(scheduleData.amount),
        frequency: scheduleData.frequency,
        startDate: scheduleData.startDate.toISOString(),
        endDate: scheduleData.endDate ? scheduleData.endDate.toISOString() : undefined,
      });
      toast.success("Auto-Hibah scheduled successfully");
      setIsScheduling(false);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const handleDeactivateHibah = async (hibahId: string) => {
    try {
      await edgeParentDeactivateScheduledHibah({ hibahId });
      toast.success("Schedule cancelled");
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    }
  };

  return (
    <Card className="wireframe-card">
      <div className="wireframe-space-between">
        <div className="wireframe-row">
          <AvatarBubble emoji={kid.avatar ?? "phosphor:Smiley"} size={52} />
          <div>
            {isEditing ? (
              <div className="wireframe-col" style={{ marginTop: "0.5rem" }}>
                <input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  placeholder="Name"
                />
                <input
                  value={editData.username}
                  onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                  placeholder="Username"
                />
                <div className="wireframe-row">
                  <input
                    type="date"
                    value={editData.birthDate}
                    onChange={(e) => setEditData({ ...editData, birthDate: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="YYYY"
                    value={editData.birthYear}
                    onChange={(e) => setEditData({ ...editData, birthYear: e.target.value })}
                    style={{ width: "80px" }}
                  />
                </div>
                <div className="wireframe-row">
                  <button type="button" onClick={handleUpdateKid}>
                    Save
                  </button>
                  <button type="button" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <strong>{kid.name}</strong>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setEditData({
                      name: kid.name,
                      username: kid.username || "",
                      birthDate: kid.birth_date || "",
                      birthYear: kid.birth_year ? String(kid.birth_year) : "",
                    });
                  }}
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
            onCancel={() => setIsActing(false)}
          />
        </div>
      )}

      {isScheduling && (
        <div className="wireframe-box" style={{ marginTop: "1rem" }}>
          <div>
            <strong>[icon: schedule] Schedule Auto-Hibah for {kid.name}</strong>
          </div>
          <div className="wireframe-col" style={{ marginTop: "0.5rem" }}>
            <div className="wireframe-grid-2">
              <div>
                <label>Amount (RM)</label>
                <input
                  type="number"
                  step="0.5"
                  value={scheduleData.amount}
                  onChange={(e) => setScheduleData({ ...scheduleData, amount: e.target.value })}
                />
              </div>
              <div>
                <label>Frequency</label>
                <select
                  value={scheduleData.frequency}
                  onChange={(e) =>
                    setScheduleData({
                      ...scheduleData,
                      frequency: e.target.value as
                        | "daily"
                        | "weekly"
                        | "bi-weekly"
                        | "monthly"
                        | "quarterly"
                        | "annually",
                    })
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
            </div>
            <div>
              <label>Start Date</label>
              <input
                type="date"
                value={scheduleData.startDate ? format(scheduleData.startDate, "yyyy-MM-dd") : ""}
                onChange={(e) =>
                  setScheduleData({
                    ...scheduleData,
                    startDate: e.target.value ? new Date(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="wireframe-row">
              <button type="button" onClick={() => setIsScheduling(false)}>
                Cancel
              </button>
              <button type="button" onClick={handleScheduleHibah}>
                Schedule
              </button>
            </div>
          </div>
          {scheduledHibahs && scheduledHibahs.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <div>
                <strong>Active Schedules</strong>
              </div>
              <ul>
                {scheduledHibahs.map((h) => (
                  <li key={h.id} className="wireframe-space-between wireframe-box">
                    <div>
                      <strong>
                        RM {Number(h.amount).toFixed(2)} {h.frequency}
                      </strong>
                      <div>
                        <small>Next: {format(new Date(h.next_run_at), "PP")}</small>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeactivateHibah(h.id)}
                      title="Cancel this schedule"
                    >
                      [icon: cancel] Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="wireframe-box" style={{ marginTop: "1rem" }}>
          <div>
            <strong>Flight Log</strong>
          </div>
          {kidTxs.length === 0 ? (
            <p>No transactions yet</p>
          ) : (
            <ul>
              {kidTxs.slice(0, 30).map((t) => (
                <li key={t.id} className="wireframe-space-between">
                  <span>{t.label}</span>
                  <small>{new Date(t.created_at).toLocaleDateString()}</small>
                  <strong>
                    {["WITHDRAWAL", "SADAQAH", "INVEST_IN"].includes(t.type) ||
                    (t.type === "QARD" && t.label === "Loan repayment")
                      ? "-"
                      : "+"}
                    RM {Number(t.amount).toFixed(2)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
