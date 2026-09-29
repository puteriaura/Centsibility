import { useState } from "react";
import { format } from "date-fns";
import type { Kid, ScheduledHibah } from "@/hooks/use-parent-data";
import {
  edgeParentCreateScheduledHibah,
  edgeParentDeactivateScheduledHibah,
} from "@/lib/edge";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppIcon } from "@/components/ui/app-icon";
import { formatRM } from "@/lib/format";

interface ScheduleHibahSectionProps {
  kid: Kid;
  scheduledHibahs: ScheduledHibah[];
  onClose: () => void;
  onRefresh: () => void;
}

export function ScheduleHibahSection({
  kid,
  scheduledHibahs,
  onClose,
  onRefresh,
}: ScheduleHibahSectionProps) {
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
  const [busy, setBusy] = useState(false);

  const handleScheduleHibah = async () => {
    const amt = parseFloat(scheduleData.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!scheduleData.startDate) {
      toast.error("Please select a start date");
      return;
    }

    setBusy(true);
    try {
      await edgeParentCreateScheduledHibah({
        kidId: kid.id,
        amount: amt,
        frequency: scheduleData.frequency,
        startDate: scheduleData.startDate.toISOString(),
        endDate: scheduleData.endDate?.toISOString(),
      });
      toast.success("Auto-Hibah scheduled successfully");
      onRefresh();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivateHibah = async (scheduleId: string) => {
    try {
      await edgeParentDeactivateScheduledHibah({ hibahId: scheduleId });
      toast.success("Schedule deactivated");
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  return (
    <Card variant="default" className="p-5 mt-4 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[var(--primary-soft)] text-[var(--primary-text)] flex items-center justify-center">
          <AppIcon name="gift" size={18} />
        </div>
        <strong className="text-sm font-bold text-[var(--ink)]">
          Schedule Auto-Hibah for {kid.name}
        </strong>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Amount (RM)"
            id="hibah-amount"
            type="number"
            step="0.5"
            inputMode="decimal"
            value={scheduleData.amount}
            onChange={(e) => setScheduleData({ ...scheduleData, amount: e.target.value })}
          />

          <div>
            <label htmlFor="hibah-frequency" className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Frequency
            </label>
            <select
              id="hibah-frequency"
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
              className="w-full min-h-[48px] px-3 rounded-xl border border-[var(--border)] bg-white text-base font-medium text-[var(--ink)] focus:border-[var(--primary)] outline-none"
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
          <label htmlFor="hibah-start-date" className="block text-xs font-semibold text-[var(--ink)] mb-1">
            Start Date
          </label>
          <input
            id="hibah-start-date"
            type="date"
            value={scheduleData.startDate ? format(scheduleData.startDate, "yyyy-MM-dd") : ""}
            onChange={(e) =>
              setScheduleData({
                ...scheduleData,
                startDate: e.target.value ? new Date(e.target.value) : undefined,
              })
            }
            className="w-full min-h-[48px] px-3 rounded-xl border border-[var(--border)] bg-white text-base font-medium text-[var(--ink)] focus:border-[var(--primary)] outline-none"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} className="flex-1 justify-center">
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleScheduleHibah}
            disabled={busy}
            className="flex-1 justify-center font-bold"
          >
            {busy ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      </div>

      {scheduledHibahs && scheduledHibahs.length > 0 && (
        <div className="pt-4 border-t border-[var(--border)] space-y-2">
          <strong className="text-xs font-bold text-[var(--ink)] block uppercase tracking-wider">
            Active Schedules
          </strong>
          <ul className="space-y-2">
            {scheduledHibahs.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)]"
              >
                <div>
                  <strong className="text-xs font-bold text-[var(--ink)] block tabular-nums">
                    {formatRM(Number(h.amount))} ({h.frequency})
                  </strong>
                  <small className="text-[11px] text-[var(--text-muted)]">
                    Next: {format(new Date(h.next_run_at), "PP")}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeactivateHibah(h.id)}
                  className="text-xs font-semibold text-[var(--error-text)] hover:underline inline-flex items-center gap-1"
                  title="Cancel this schedule"
                >
                  <AppIcon name="close" size={12} />
                  <span>Cancel</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
