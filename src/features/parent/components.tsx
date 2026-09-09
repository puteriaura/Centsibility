import React, { useState } from "react";
import { Card } from "@/components/AppShell";
import { AvatarBubble } from "@/components/AvatarBubble";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import {
  Eye,
  EyeClosed,
  Leaf,
  Wallet,
  Star,
  CurrencyCircleDollar,
  HandWithdraw,
  Plus,
  Minus,
  ShieldCheck,
  PencilSimple,
  Trash,
  ArrowsClockwise,
  X,
} from "@phosphor-icons/react";
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
    <Card className="glass-panel hover:bg-white/5 transition-colors border-neon-mint/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <AvatarBubble emoji={kid.avatar ?? "phosphor:Smiley"} size={52} />
          <div className="min-w-0 w-full">
            {isEditing ? (
              <div className="flex flex-col gap-2 mt-2 w-full">
                <input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  placeholder="Name"
                  className="w-full border border-starlight/20 bg-void rounded-xl px-3 py-2 text-sm font-parent text-starlight placeholder:text-starlight/40"
                />
                <input
                  value={editData.username}
                  onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                  placeholder="Username"
                  className="w-full border border-starlight/20 bg-void rounded-xl px-3 py-2 text-sm font-parent text-starlight placeholder:text-starlight/40"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={editData.birthDate}
                    onChange={(e) => setEditData({ ...editData, birthDate: e.target.value })}
                    className="flex-1 border border-starlight/20 bg-void rounded-xl px-3 py-2 text-sm font-parent text-starlight"
                  />
                  <input
                    type="number"
                    placeholder="YYYY"
                    value={editData.birthYear}
                    onChange={(e) => setEditData({ ...editData, birthYear: e.target.value })}
                    className="w-20 border border-starlight/20 bg-void rounded-xl px-3 py-2 text-sm font-parent text-starlight placeholder:text-starlight/40"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateKid}
                    className="flex-1 text-xs bg-neon-mint text-void px-3 py-2 rounded-xl font-bold shadow-neon hover:bg-neon-mint/80 transition"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 text-xs bg-void border border-starlight/20 text-starlight px-3 py-2 rounded-xl font-bold hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="font-kid font-bold text-starlight truncate flex items-center">
                  {kid.name}
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditData({
                        name: kid.name,
                        username: kid.username || "",
                        birthDate: kid.birth_date || "",
                        birthYear: kid.birth_year ? String(kid.birth_year) : "",
                      });
                    }}
                    className="ml-2 text-starlight/60 hover:text-neon-mint transition inline-flex items-center"
                    title="Edit child"
                    aria-label={`Edit ${kid.name}'s profile`}
                  >
                    <PencilSimple weight="bold" className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteInitiate(kid.id)}
                    className="ml-2 text-nova-red hover:text-red-500 transition inline-flex items-center"
                    title="Delete child"
                    aria-label={`Delete ${kid.name}'s profile`}
                  >
                    <Trash weight="bold" className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="font-mono text-[11px] text-starlight/50 truncate tracking-wide">
                  {kid.username ? `@${kid.username}` : ""}{" "}
                  {kid.birth_year ? `• Class of ${kid.birth_year}` : ""}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono font-bold text-lg text-neon-mint flex items-center justify-end gap-2">
            {hideBalance ? "RM •••" : `RM ${total.toFixed(2)}`}
            <button
              onClick={() => setHideBalance(!hideBalance)}
              className="hover:text-starlight transition"
            >
              {hideBalance ? (
                <EyeClosed weight="bold" className="w-4 h-4 text-neon-mint" />
              ) : (
                <Eye weight="bold" className="w-4 h-4 text-neon-mint" />
              )}
            </button>
          </div>
          <div className="font-body text-[10px] text-starlight/60 flex items-center justify-end gap-1 tracking-wider uppercase">
            Total{" "}
            <ShieldCheck
              weight="fill"
              className="w-3.5 h-3.5 text-neon-mint drop-shadow-[0_0_5px_var(--neon-mint)]"
            />{" "}
            {kid.trust_score}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl glass-panel p-2 hover:bg-white/5 transition">
          <div className="font-mono text-sm font-bold text-neon-mint">
            {hideBalance ? "RM •••" : `RM ${Number(kid.balance).toFixed(2)}`}
          </div>
          <div className="font-kid text-[10px] text-starlight/60 flex items-center justify-center gap-1 mt-0.5 uppercase tracking-wider">
            <Wallet weight="duotone" className="w-3.5 h-3.5" /> Core
          </div>
        </div>
        <div className="rounded-2xl glass-panel p-2 hover:bg-white/5 transition">
          <div className="font-mono text-sm font-bold text-nebula-pink">
            {hideBalance ? "RM •••" : `RM ${Number(kid.invest_balance ?? 0).toFixed(2)}`}
          </div>
          <div className="font-kid text-[10px] text-starlight/60 flex items-center justify-center gap-1 mt-0.5 uppercase tracking-wider">
            <Leaf weight="duotone" className="w-3.5 h-3.5" /> Growth
          </div>
        </div>
        <div className="rounded-2xl glass-panel p-2 hover:bg-white/5 transition">
          <div className="font-mono text-sm font-bold text-starlight">
            {hideBalance ? "•••" : Math.round(Number(kid.coins)).toLocaleString()}
          </div>
          <div className="font-kid text-[10px] text-starlight/60 flex items-center justify-center gap-1 mt-0.5 uppercase tracking-wider">
            <Star weight="duotone" className="w-3.5 h-3.5 text-starlight" /> Stardust
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <button
          onClick={() => {
            sfx.pop();
            setIsActing(isActing && actionType === "DEPOSIT" ? false : true);
            setActionType("DEPOSIT");
          }}
          className="btn-press rounded-xl bg-neon-mint/20 border border-neon-mint/30 py-2 flex items-center justify-center gap-1 font-kid text-[10px] font-bold text-neon-mint uppercase tracking-wider hover:bg-neon-mint hover:text-void transition"
        >
          <Plus weight="bold" className="w-3 h-3" /> Transmit
        </button>
        <button
          onClick={() => {
            sfx.pop();
            setIsActing(isActing && actionType === "WITHDRAWAL" ? false : true);
            setActionType("WITHDRAWAL");
          }}
          className="btn-press rounded-xl bg-nova-red/20 border border-nova-red/30 py-2 flex items-center justify-center gap-1 font-kid text-[10px] font-bold text-nova-red uppercase tracking-wider hover:bg-nova-red hover:text-white transition"
        >
          <Minus weight="bold" className="w-3 h-3" /> Recall
        </button>
        <button
          onClick={() => {
            sfx.tap();
            setExpanded(!expanded);
          }}
          className="btn-press rounded-xl glass-panel py-2 flex items-center justify-center gap-1 font-kid text-[10px] font-bold text-starlight hover:bg-white/10 transition uppercase tracking-wider"
        >
          {expanded ? "Hide Log" : "Flight Log"}
        </button>
        <button
          onClick={() => {
            sfx.tap();
            setIsScheduling(!isScheduling);
          }}
          className="btn-press rounded-xl bg-cosmic-blue/30 border border-cosmic-blue/50 py-2 font-kid text-[10px] font-bold text-starlight hover:bg-cosmic-blue hover:text-white transition overflow-hidden text-ellipsis whitespace-nowrap px-1 uppercase tracking-wider"
        >
          Auto-Hibah
        </button>
      </div>

      {isActing && (
        <div className="mt-4 rounded-3xl glass-panel p-5 border border-neon-mint/30 shadow-neon bg-void/50">
          <div className="font-kid text-sm font-bold text-starlight mb-4 flex items-center gap-2 tracking-wide">
            {actionType === "DEPOSIT" ? (
              <CurrencyCircleDollar weight="duotone" className="w-5 h-5 text-neon-mint" />
            ) : (
              <HandWithdraw weight="duotone" className="w-5 h-5 text-nova-red" />
            )}
            {actionType === "DEPOSIT" ? "Transmit Funds" : "Recall Funds"} for {kid.name}
          </div>
          <MoneyKeypad
            min={0.5}
            max={actionType === "WITHDRAWAL" ? Number(kid.balance) : 100000}
            showReference
            confirmLabel={actionType === "DEPOSIT" ? "Confirm Transmission" : "Confirm Recall"}
            confirmBg={
              actionType === "DEPOSIT"
                ? "bg-neon-mint shadow-neon text-void font-kid"
                : "bg-nova-red text-white font-kid shadow-[0_0_15px_var(--nova-red)]"
            }
            onConfirm={submitAction}
            onCancel={() => setIsActing(false)}
          />
        </div>
      )}

      {isScheduling && (
        <div className="mt-3 rounded-2xl bg-mint/10 p-4 border border-mint/20 shadow-soft">
          <div className="font-kid text-sm font-bold text-starlight mb-3 flex items-center gap-2">
            <ArrowsClockwise weight="duotone" className="w-5 h-5 text-mint" />
            Schedule Auto-Hibah for {kid.name}
          </div>
          <div className="space-y-3 font-body text-sm">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] uppercase font-bold text-starlight/70 block mb-1">
                  Amount (RM)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={scheduleData.amount}
                  onChange={(e) => setScheduleData({ ...scheduleData, amount: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 border border-starlight/20 bg-void text-starlight"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase font-bold text-starlight/70 block mb-1">
                  Frequency
                </label>
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
                  className="w-full rounded-xl px-3 py-2 border border-starlight/20 bg-void text-starlight"
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
              <label className="text-[10px] uppercase font-bold text-starlight/70 block mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={scheduleData.startDate ? format(scheduleData.startDate, "yyyy-MM-dd") : ""}
                onChange={(e) =>
                  setScheduleData({
                    ...scheduleData,
                    startDate: e.target.value ? new Date(e.target.value) : undefined,
                  })
                }
                className="w-full rounded-xl px-3 py-2 border border-starlight/20 bg-void text-starlight"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setIsScheduling(false)}
                className="flex-1 py-2 rounded-xl bg-void border border-starlight/20 text-starlight font-bold text-xs hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleHibah}
                className="flex-1 py-2 rounded-xl bg-cosmic-blue text-white font-bold text-xs shadow-neon hover:bg-cosmic-blue/80 transition"
              >
                Schedule
              </button>
            </div>
          </div>
          {scheduledHibahs && scheduledHibahs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-mint/30">
              <div className="font-kid text-[11px] font-bold text-starlight/70 uppercase tracking-wider mb-2">
                Active Schedules
              </div>
              <ul className="space-y-2">
                {scheduledHibahs.map((h) => (
                  <li
                    key={h.id}
                    className="glass-panel rounded-xl p-3 border-starlight/20 text-[11px] flex justify-between items-center bg-void/50"
                  >
                    <div>
                      <div className="font-bold text-starlight">
                        RM {Number(h.amount).toFixed(2)} {h.frequency}
                      </div>
                      <div className="text-starlight/60 font-body">
                        Next: {format(new Date(h.next_run_at), "PP")}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeactivateHibah(h.id)}
                      className="btn-press text-coral bg-coral/10 px-2 py-1 rounded-full text-[10px] font-bold hover:bg-coral/20 flex items-center gap-1"
                      title="Cancel this schedule"
                    >
                      <X weight="bold" className="w-3 h-3" /> Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="mt-4 rounded-3xl glass-panel bg-void/30 p-4 border border-starlight/20">
          <div className="font-kid text-xs font-bold uppercase tracking-wider text-starlight/50 mb-3">
            Flight Log
          </div>
          {kidTxs.length === 0 ? (
            <div className="font-body text-xs text-starlight/70 text-center py-2">
              No transactions yet
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto">
              {kidTxs.slice(0, 30).map((t) => (
                <li key={t.id} className="flex items-center justify-between text-[11px]">
                  <span className="font-body text-starlight truncate flex-1">{t.label}</span>
                  <span className="font-body text-starlight/50 mx-2">
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                  <span
                    className={`font-mono font-bold ${["WITHDRAWAL", "SADAQAH", "INVEST_IN"].includes(t.type) || (t.type === "QARD" && t.label === "Loan repayment") ? "text-nova-red" : "text-neon-mint"}`}
                  >
                    {["WITHDRAWAL", "SADAQAH", "INVEST_IN"].includes(t.type) ||
                    (t.type === "QARD" && t.label === "Loan repayment")
                      ? "-"
                      : "+"}
                    RM {Number(t.amount).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
