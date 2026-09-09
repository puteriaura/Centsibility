import { useState } from "react";
import type { Kid } from "@/hooks/use-parent-data";
import { edgeParentUpdateKid } from "@/lib/edge";
import { toast } from "sonner";

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
          value={editData.birthYear}
          onChange={(e) => setEditData({ ...editData, birthYear: e.target.value })}
          placeholder="Birth year (YYYY)"
        />
      </div>
      <div className="wireframe-row">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={handleUpdateKid} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
