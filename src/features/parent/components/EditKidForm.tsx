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
  });
  const [busy, setBusy] = useState(false);

  const handleUpdateKid = async () => {
    if (!editData.name.trim()) return;
    setBusy(true);
    try {
      await edgeParentUpdateKid({
        kidId: kid.id,
        name: editData.name.trim(),
        username: editData.username.trim() || undefined,
        birth_date: editData.birthDate || undefined,
        birth_year: editData.birthYear ? parseInt(editData.birthYear) : undefined,
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
          onChange={(e) => setEditData({ ...editData, birthDate: e.target.value })}
        />
        <Input
          label="Birth Year"
          type="number"
          value={editData.birthYear}
          onChange={(e) => setEditData({ ...editData, birthYear: e.target.value })}
          placeholder="YYYY"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={handleUpdateKid} disabled={busy} loading={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

