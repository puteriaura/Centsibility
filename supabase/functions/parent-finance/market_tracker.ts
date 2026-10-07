import { verifyKidOwnership } from "./ownership.ts";

export async function setMarketTracker(
  admin: any,
  parentId: string,
  params: Record<string, unknown>
): Promise<{ ok: boolean; status: number; error?: string; data?: { ok: boolean; kidId: string; enabled: boolean } }> {
  if (typeof params.kidId !== "string" || !params.kidId.trim()) {
    return { ok: false, status: 400, error: "kidId is required" };
  }
  if (typeof params.enabled !== "boolean") {
    return { ok: false, status: 400, error: "enabled must be a boolean" };
  }

  await verifyKidOwnership(admin, params.kidId, parentId);

  const { error } = await admin
    .from("kids")
    .update({ market_tracker_enabled: params.enabled })
    .eq("id", params.kidId);

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  return { ok: true, status: 200, data: { ok: true, kidId: params.kidId, enabled: params.enabled } };
}
