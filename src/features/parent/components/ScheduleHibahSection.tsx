import { useState } from "react";
import { format } from "date-fns";
import type { Kid, ScheduledHibah } from "@/hooks/use-parent-data";
import {
  edgeParentCreateScheduledHibah,
  edgeParentDeactivateScheduledHibah,
} from "@/lib/edge";
import { toast } from "sonner";

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
    if (!scheduleData.startDate || !scheduleData.amount) return;
    setBusy(true);
    try {
      await edgeParentCreateScheduledHibah({
        kidId: kid.id,
        amount: parseFloat(scheduleData.amount),
        frequency: scheduleData.frequency,
        startDate: scheduleData.startDate.toISOString(),
        endDate: scheduleData.endDate ? scheduleData.endDate.toISOString() : undefined,
      });
      toast.success("Auto-Hibah scheduled successfully");
      onClose();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setBusy(false);
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
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={handleScheduleHibah} disabled={busy}>
            {busy ? "Scheduling…" : "Schedule"}
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
  );
}
