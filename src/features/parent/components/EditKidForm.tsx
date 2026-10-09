import { useState } from "react";
import type { Kid } from "@/hooks/use-parent-data";
import { edgeParentUpdateKid } from "@/lib/edge";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface EditKidFormProps {
  kid: Kid;
  onCancel: () => void;
  onSuccess: () => void;
}

export function EditKidForm({ kid, onCancel, onSuccess }: EditKidFormProps) {
  const [editData, setEditData] = useState({
    name: kid.name,
    username: kid.username || "",
    birthDate: kid.birth_date || "",
    birthYear: kid.birth_year ? String(kid.birth_year) : "",
    ageGroupOverride: (kid as Record<string, unknown>).age_group_override
      ? String((kid as Record<string, unknown>).age_group_override)
      : "",
  });
  const [busy, setBusy] = useState(false);

  const kidAgeGroup = (() => {
    const override = (kid as Record<string, unknown>).age_group_override;
    if (override && ["6-9", "10-12", "13-17"].includes(String(override))) {
      return String(override);
    }
    if (kid.birth_date) {
      const bDate = new Date(kid.birth_date);
      const age = new Date().getFullYear() - bDate.getFullYear();
      if (age < 10) return "6-9";
      if (age <= 12) return "10-12";
      return "13-17";
    }
    return "10-12";
  })();

  const ageDefaultEnabled = kidAgeGroup === "13-17";
  const rawMarketSetting = (kid as Record<string, unknown>)
    .market_tracker_enabled;
  const isCustomized =
    rawMarketSetting !== null && rawMarketSetting !== undefined;
  const initialChecked = isCustomized
    ? Boolean(rawMarketSetting)
    : ageDefaultEnabled;

  const [marketEnabled, setMarketEnabled] = useState<boolean>(initialChecked);
  const [hasChangedMarket, setHasChangedMarket] = useState<boolean>(false);

  const handleUpdateKid = async () => {
    if (!editData.name.trim()) return;
    setBusy(true);
    try {
      await edgeParentUpdateKid({
        kidId: kid.id,
        name: editData.name.trim(),
        username: editData.username.trim() || undefined,
        birth_date: editData.birthDate || undefined,
        birth_year: editData.birthYear
          ? parseInt(editData.birthYear)
          : undefined,
        age_group_override: editData.ageGroupOverride || null,
        market_tracker_enabled:
          hasChangedMarket || isCustomized ? marketEnabled : null,
      });
      toast.success("Child profile updated");
      onSuccess();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 mt-2 p-3 bg-[var(--surface-soft)] rounded-xl border border-[var(--border)]">
      <Input
        label="Child Name"
        value={editData.name}
        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
        placeholder="Name"
      />
      <Input
        label="Username (@handle)"
        value={editData.username}
        onChange={(e) => setEditData({ ...editData, username: e.target.value })}
        placeholder="Username"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Birth Date"
          type="date"
          value={editData.birthDate}
          onChange={(e) =>
            setEditData({ ...editData, birthDate: e.target.value })
          }
        />
        <Input
          label="Birth Year"
          type="number"
          value={editData.birthYear}
          onChange={(e) =>
            setEditData({ ...editData, birthYear: e.target.value })
          }
          placeholder="YYYY"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="edit-quest-level"
          className="text-xs font-semibold text-[var(--text-secondary)]"
        >
          Quest Level
        </label>
        <select
          id="edit-quest-level"
          value={editData.ageGroupOverride}
          onChange={(e) =>
            setEditData({ ...editData, ageGroupOverride: e.target.value })
          }
          className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
        >
          <option value="">Auto by age</option>
          <option value="6-9">Ages 6-9 (Junior)</option>
          <option value="10-12">Ages 10-12 (Middle)</option>
          <option value="13-17">Ages 13-17 (Senior)</option>
        </select>
      </div>

      <div className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
        <div className="flex flex-col gap-0.5">
          <label
            htmlFor={`edit-market-tracker-${kid.id}`}
            className="text-sm font-semibold text-[var(--ink)]"
          >
            Market Tracker
          </label>
          <span className="text-xs text-[var(--text-secondary)]">
            {!hasChangedMarket && !isCustomized
              ? `Default (${ageDefaultEnabled ? "On for ages 13-17" : "Off for ages under 13"})`
              : marketEnabled
                ? "Switched on"
                : "Switched off"}
          </span>
        </div>
        <input
          id={`edit-market-tracker-${kid.id}`}
          type="checkbox"
          checked={marketEnabled}
          onChange={(e) => {
            setMarketEnabled(e.target.checked);
            setHasChangedMarket(true);
          }}
          className="toggle-switch accent-[var(--primary)] shrink-0 w-5 h-5 cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleUpdateKid}
          disabled={busy}
          loading={busy}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
