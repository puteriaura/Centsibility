// supabase/functions/parent-finance/index.ts
// Handles: all parent-initiated actions
// Runs server-side with access to the Service Role Key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Some actions might be public/cron, like execute-scheduled-hibahs
    const body = await req.json();
    const { action, ...params } = body;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === "execute-scheduled-hibahs") {
      return await handleExecuteScheduledHibahs(adminClient);
    }

    // --- Authenticate the calling parent ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Missing Authorization header", 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonError("Unauthorized", 401);
    const parentId = user.id;

    switch (action) {
      case "deposit":
        return await handleDeposit(adminClient, parentId, params);
      case "get-statement":
        return await handleGetStatement(adminClient, parentId, params);
      case "get-profile":
        return await handleGetProfile(adminClient, parentId);
      case "create-kid":
        return await handleCreateKid(adminClient, parentId, params);
      case "generate-creation-key":
        return await handleGenerateCreationKey(adminClient, parentId);
      case "delete-kid":
        return await handleDeleteKid(adminClient, parentId, params);
      case "update-kid":
        return await handleUpdateKid(adminClient, parentId, params);
      case "approve-request":
        return await handleApproveRequest(adminClient, parentId, params);
      case "resolve-reward":
        return await handleResolveReward(adminClient, parentId, params);
      case "set-pin":
        return await handleSetPin(adminClient, parentId, params);
      case "get-pin":
        return await handleGetPin(adminClient, parentId);
      case "set-hibah":
        return await handleSetHibah(adminClient, parentId, params);
      case "set-invest-rate":
        return await handleSetInvestRate(adminClient, parentId, params);
      case "mark-notifications-read":
        return await handleMarkNotificationsRead(adminClient, parentId);
      case "set-avatar":
        return await handleSetAvatar(adminClient, parentId, params);
      case "set-self-avatar":
        return await handleSetSelfAvatar(adminClient, parentId, params);
      case "get-self-avatar":
        return await handleGetSelfAvatar(adminClient, parentId);
      case "create-scheduled-hibah":
        return await handleCreateScheduledHibah(adminClient, parentId, params);
      case "get-scheduled-hibahs":
        return await handleGetScheduledHibahs(adminClient, parentId);
      case "deactivate-scheduled-hibah":
        return await handleDeactivateScheduledHibah(adminClient, parentId, params);
      default:
        return jsonError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    console.error("parent-finance error:", err);
    return jsonError(err.message || "Internal server error", 500);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function verifyKidOwnership(client: ReturnType<typeof createClient>, kidId: string, parentId: string, select = "*") {
  const { data: kid, error } = await client.from("kids").select(select).eq("id", kidId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!kid || kid.parent_id !== parentId) throw new Error("Not found or not your child");
  return kid;
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
}
function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
}
function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function randomHex(bytes: number) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return encodeHex(array);
}
async function sha256(text: string) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return encodeHex(new Uint8Array(hashBuffer));
}

// ---------------------------------------------------------------------------
// Action Handlers
// ---------------------------------------------------------------------------

async function handleGetProfile(admin: ReturnType<typeof createClient>, parentId: string) {
  const { data } = await admin.from("profiles").select("id, email").eq("id", parentId).maybeSingle();
  return jsonOk(data ?? null);
}

async function handleCreateKid(admin: ReturnType<typeof createClient>, parentId: string, params: { name: string; username: string }) {
  const { data: existingName } = await admin.from("kids").select("id").eq("parent_id", parentId).ilike("name", params.name.trim()).maybeSingle();
  if (existingName) return jsonError("A child with this name already exists", 400);

  let code = genCode();
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await admin.from("kids").select("id").eq("login_code", code).maybeSingle();
    if (!existing) break;
    code = genCode();
  }

  const { data: existingUser } = await admin.from("kids").select("id").eq("username", params.username.trim().toLowerCase()).maybeSingle();
  if (existingUser) return jsonError("Username already taken", 400);

  const { data: kid, error } = await admin.from("kids").insert({
    parent_id: parentId, name: params.name.trim(), username: params.username.trim().toLowerCase(), login_code: code,
  }).select().single();
  if (error) return jsonError(error.message, 500);

  await admin.from("goals").insert({ kid_id: kid.id, name: "First Goal", emoji: "🎯", target: 100 });
  return jsonOk({ kid });
}

async function handleGenerateCreationKey(admin: ReturnType<typeof createClient>, parentId: string) {
  const rawKey = randomHex(4);
  const salt = randomHex(4);
  const hashedKey = await sha256(rawKey + salt);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin.from("child_creation_keys").insert({
    parent_id: parentId, hashed_key: hashedKey, salt, expires_at: expiresAt,
  }).select("id").single();
  
  if (error) return jsonError(error.message, 500);
  return jsonOk({ setupCode: `${data.id}_${rawKey}` });
}

async function handleDeleteKid(admin: ReturnType<typeof createClient>, parentId: string, params: { kidId: string }) {
  await verifyKidOwnership(admin, params.kidId, parentId, "id");
  await Promise.all([
    admin.from("goals").delete().eq("kid_id", params.kidId),
    admin.from("transactions").delete().eq("kid_id", params.kidId),
    admin.from("approvals").delete().eq("kid_id", params.kidId),
    admin.from("rewards").delete().eq("kid_id", params.kidId),
    admin.from("loans").delete().eq("kid_id", params.kidId),
    admin.from("quiz_attempts").delete().eq("kid_id", params.kidId),
    admin.from("notifications").delete().eq("kid_id", params.kidId),
    admin.from("scheduled_hibahs").delete().eq("kid_id", params.kidId),
  ]);
  await admin.from("kids").delete().eq("id", params.kidId);
  return jsonOk({ ok: true });
}

async function handleUpdateKid(admin: ReturnType<typeof createClient>, parentId: string, params: { kidId: string; name: string; username?: string; birth_date?: string; birth_year?: number }) {
  const kid = await verifyKidOwnership(admin, params.kidId, parentId, "username");
  if (params.username && params.username !== kid.username) {
    const { data: existing } = await admin.from("kids").select("id").eq("username", params.username).maybeSingle();
    if (existing) return jsonError("Username already taken", 400);
  }
  await admin.from("kids").update({
    name: params.name, username: params.username, birth_date: params.birth_date, birth_year: params.birth_year,
  }).eq("id", params.kidId);
  return jsonOk({ ok: true });
}

async function handleApproveRequest(admin: ReturnType<typeof createClient>, parentId: string, params: { approvalId: string; decision: "approve" | "decline" }) {
  const { data: ap } = await admin.from("approvals").select("*, kids!inner(id,parent_id,balance)").eq("id", params.approvalId).maybeSingle();
  if (!ap) return jsonError("Not found", 404);
  const kid = ap.kids as unknown as { id: string; parent_id: string; balance: number };
  if (kid.parent_id !== parentId) return jsonError("Not found", 404);
  if (ap.status !== "pending") return jsonError("Already resolved", 400);
  const amount = Number(ap.amount);

  const SERVICE_FEE = 3.0; const PROCESSING_FEE = 2.5; const TOTAL_FEES = SERVICE_FEE + PROCESSING_FEE;

  if (params.decision === "approve") {
    if (ap.kind === "WITHDRAWAL") {
      if (amount > Number(kid.balance)) return jsonError("Insufficient balance", 400);
      await admin.from("kids").update({ balance: Number(kid.balance) - amount }).eq("id", kid.id);
      await admin.from("transactions").insert({ kid_id: kid.id, type: "WITHDRAWAL", amount, label: ap.reason });
    } else if (ap.kind === "DEPOSIT") {
      await admin.from("kids").update({ balance: Number(kid.balance) + amount }).eq("id", kid.id);
      await admin.from("transactions").insert({ kid_id: kid.id, type: "DEPOSIT", amount, label: ap.reason });
    } else if (ap.kind === "QARD") {
      const fullReason: string = ap.reason || "";
      const [reasonPart, sigPart] = fullReason.split(" :: SIG::");
      const dueMatch = reasonPart.match(/\(due (\d+)d\)/);
      const dueDays = dueMatch ? parseInt(dueMatch[1]) : 14;
      const cleanReason = reasonPart.replace(/\(due \d+d\)$/, "").trim();
      const due = new Date(Date.now() + dueDays * 86400000).toISOString().slice(0, 10);
      const netCredit = Math.max(0, amount - TOTAL_FEES);

      await admin.from("loans").insert({ kid_id: kid.id, amount, due_date: due, reason: cleanReason, signature_data_url: sigPart || null, signed_at: new Date().toISOString() });
      await admin.from("kids").update({ balance: Number(kid.balance) + netCredit }).eq("id", kid.id);
      await admin.from("transactions").insert({ kid_id: kid.id, type: "QARD", amount: netCredit, label: `Qard approved: ${cleanReason}` });
      await admin.from("transactions").insert({ kid_id: kid.id, type: "WITHDRAWAL", amount: SERVICE_FEE, label: "Loan service fee" });
      await admin.from("transactions").insert({ kid_id: kid.id, type: "WITHDRAWAL", amount: PROCESSING_FEE, label: "Loan processing fee" });
    }
  }
  await admin.from("approvals").update({ status: params.decision === "approve" ? "approved" : "declined", resolved_at: new Date().toISOString() }).eq("id", ap.id);
  return jsonOk({ ok: true });
}

async function handleResolveReward(admin: ReturnType<typeof createClient>, parentId: string, params: { rewardId: string; decision: "approve" | "decline" }) {
  const { data: r } = await admin.from("rewards").select("*, kids!inner(id,parent_id,coins)").eq("id", params.rewardId).maybeSingle();
  if (!r) return jsonError("Not found", 404);
  const kid = r.kids as unknown as { id: string; parent_id: string; coins: number };
  if (kid.parent_id !== parentId) return jsonError("Not found", 404);

  if (params.decision === "approve") {
    if (r.cost > Number(kid.coins)) return jsonError("Kid doesn't have enough coins", 400);
    await admin.from("kids").update({ coins: Number(kid.coins) - r.cost }).eq("id", kid.id);
    await admin.from("rewards").update({ status: "approved" }).eq("id", r.id);
  } else {
    await admin.from("rewards").update({ status: "declined" }).eq("id", r.id);
  }
  return jsonOk({ ok: true });
}

async function handleSetPin(admin: ReturnType<typeof createClient>, parentId: string, params: { pin_hash: string }) {
  const { data: profile } = await admin.from("profiles").select("id").eq("id", parentId).maybeSingle();
  if (!profile) return jsonError("Profile not found", 404);
  await admin.from("commander_pins").upsert({ parent_id: parentId, pin_hash: params.pin_hash }, { onConflict: "parent_id" });
  return jsonOk({ ok: true });
}

async function handleGetPin(admin: ReturnType<typeof createClient>, parentId: string) {
  const { data } = await admin.from("commander_pins").select("pin_hash").eq("parent_id", parentId).maybeSingle();
  return jsonOk({ pin_hash: data?.pin_hash ?? null });
}

async function handleSetHibah(admin: ReturnType<typeof createClient>, parentId: string, params: { kidId: string; rate: number }) {
  await verifyKidOwnership(admin, params.kidId, parentId, "id");
  await admin.from("kids").update({ hibah_rate: params.rate }).eq("id", params.kidId);
  return jsonOk({ ok: true });
}

async function handleSetInvestRate(admin: ReturnType<typeof createClient>, parentId: string, params: { kidId: string; rate: number }) {
  await verifyKidOwnership(admin, params.kidId, parentId, "id");
  await admin.from("kids").update({ invest_rate: params.rate }).eq("id", params.kidId);
  return jsonOk({ ok: true });
}

async function handleMarkNotificationsRead(admin: ReturnType<typeof createClient>, parentId: string) {
  await admin.from("notifications").update({ read: true }).eq("parent_id", parentId).eq("read", false);
  return jsonOk({ ok: true });
}

async function handleSetAvatar(admin: ReturnType<typeof createClient>, parentId: string, params: { kidId: string; avatar: string }) {
  await verifyKidOwnership(admin, params.kidId, parentId, "id");
  await admin.from("kids").update({ avatar: params.avatar }).eq("id", params.kidId);
  return jsonOk({ ok: true });
}

async function handleSetSelfAvatar(admin: ReturnType<typeof createClient>, parentId: string, params: { avatar: string }) {
  await admin.from("profiles").update({ avatar: params.avatar }).eq("id", parentId);
  return jsonOk({ ok: true });
}

async function handleGetSelfAvatar(admin: ReturnType<typeof createClient>, parentId: string) {
  const { data } = await admin.from("profiles").select("avatar").eq("id", parentId).maybeSingle();
  return jsonOk({ avatar: data?.avatar ?? null });
}

async function handleCreateScheduledHibah(admin: ReturnType<typeof createClient>, parentId: string, params: { kidId: string; amount: number; frequency: string; startDate: string; endDate?: string }) {
  await verifyKidOwnership(admin, params.kidId, parentId, "id");
  const { data: hibah, error } = await admin.from("scheduled_hibahs").insert({
    parent_id: parentId, kid_id: params.kidId, amount: params.amount, frequency: params.frequency,
    start_date: new Date(params.startDate).toISOString(), end_date: params.endDate ? new Date(params.endDate).toISOString() : null,
    next_run_at: new Date(params.startDate).toISOString(), is_active: true,
  }).select().single();
  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true, hibah });
}

async function handleGetScheduledHibahs(admin: ReturnType<typeof createClient>, parentId: string) {
  const { data } = await admin.from("scheduled_hibahs").select("*").eq("parent_id", parentId).eq("is_active", true).order("next_run_at", { ascending: true });
  return jsonOk({ scheduledHibahs: data ?? [] });
}

async function handleDeactivateScheduledHibah(admin: ReturnType<typeof createClient>, parentId: string, params: { hibahId: string }) {
  const { data: hibah } = await admin.from("scheduled_hibahs").select("*").eq("id", params.hibahId).eq("parent_id", parentId).maybeSingle();
  if (!hibah) return jsonError("Not found", 404);
  await admin.from("scheduled_hibahs").update({ is_active: false }).eq("id", params.hibahId);
  return jsonOk({ ok: true });
}

async function handleExecuteScheduledHibahs(admin: ReturnType<typeof createClient>) {
  const now = new Date().toISOString();
  const { data: dueHibahs } = await admin.from("scheduled_hibahs").select("*, kids!inner(id, balance, parent_id, name)").eq("is_active", true).lte("next_run_at", now);
  if (!dueHibahs || dueHibahs.length === 0) return jsonOk({ processed: 0 });

  let processed = 0;
  for (const hibah of dueHibahs) {
    const amount = Number(hibah.amount);
    const kid = hibah.kids as unknown as { id: string; balance: number; parent_id: string; name: string };

    const newBal = Number(kid.balance) + amount;
    await admin.from("kids").update({ balance: newBal }).eq("id", kid.id);
    await admin.from("transactions").insert({ kid_id: kid.id, type: "HIBAH", amount, label: `Scheduled Auto-Hibah (${hibah.frequency})` });
    await admin.from("notifications").insert({ parent_id: kid.parent_id, kid_id: kid.id, kind: "HIBAH", message: `You received RM ${amount.toFixed(2)} from your scheduled Hibah!`, link: "/kid" });

    const nextRunDate = new Date(hibah.next_run_at);
    switch (hibah.frequency) {
      case "daily": nextRunDate.setDate(nextRunDate.getDate() + 1); break;
      case "weekly": nextRunDate.setDate(nextRunDate.getDate() + 7); break;
      case "bi-weekly": nextRunDate.setDate(nextRunDate.getDate() + 14); break;
      case "monthly": nextRunDate.setMonth(nextRunDate.getMonth() + 1); break;
      case "quarterly": nextRunDate.setMonth(nextRunDate.getMonth() + 3); break;
      case "annually": nextRunDate.setFullYear(nextRunDate.getFullYear() + 1); break;
      default: nextRunDate.setMonth(nextRunDate.getMonth() + 1); break;
    }

    let isActive = true;
    if (hibah.end_date && nextRunDate > new Date(hibah.end_date)) isActive = false;

    await admin.from("scheduled_hibahs").update({ next_run_at: nextRunDate.toISOString(), is_active: isActive }).eq("id", hibah.id);
    processed++;
  }
  return jsonOk({ processed });
}

// ---------------------------------------------------------------------------
// Original Deposit/Withdraw and GetStatement
// ---------------------------------------------------------------------------
async function handleDeposit(admin: ReturnType<typeof createClient>, parentId: string, params: { kidId: string; amount: number; label?: string; type: "DEPOSIT" | "WITHDRAWAL" }) {
  const { kidId, amount, label, type } = params;
  if (!kidId || typeof amount !== "number" || amount < 0.5 || amount > 100000) return jsonError("Invalid input", 400);
  const kid = await verifyKidOwnership(admin, kidId, parentId);
  const delta = type === "DEPOSIT" ? amount : -amount;
  if (type === "WITHDRAWAL" && Number(kid.balance) < amount) return jsonError("Insufficient balance", 400);
  const { data: newBalance, error: rpcError } = await admin.rpc("adjust_kid_balance", { p_kid_id: kidId, p_delta: delta });
  if (rpcError) return jsonError(rpcError.message, 500);
  await admin.from("transactions").insert({ kid_id: kidId, type, amount, label: label || type });
  return jsonOk({ newBalance });
}

async function handleGetStatement(admin: ReturnType<typeof createClient>, parentId: string, params: { kidId: string; from: string; to: string }) {
  const { kidId, from, to } = params;
  const kid = await verifyKidOwnership(admin, kidId, parentId, "id, name, balance");
  const fromDate = new Date(from); fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(to); toDate.setHours(23, 59, 59, 999);
  const { data: txs, error } = await admin.from("transactions").select("*").eq("kid_id", kidId).gte("created_at", fromDate.toISOString()).lte("created_at", toDate.toISOString()).order("created_at", { ascending: false });
  if (error) return jsonError(error.message, 500);
  return jsonOk({ kid: { id: kid.id, name: kid.name, balance: kid.balance }, transactions: txs ?? [], period: { from, to } });
}
