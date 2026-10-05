// supabase/functions/parent-finance/index.ts
// Handles: all parent-initiated actions
// Runs server-side with access to the Service Role Key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";
import { isValidPinFormat, hashPin, verifyStoredPin } from "./pin.ts";
import { verifyKidOwnership, OwnershipError } from "./ownership.ts";
import { mytRange, StatementError } from "./statement.ts";
import {
  buildPennyRequest,
  callPenny,
  PennyError,
  parentSystemPrompt,
  buildParentCoachContext,
  getMytDateInfo,
  isSpendingTransaction,
  categoryKey,
  categoryLabel,
  DEFAULT_PENNY_DAILY_LIMIT,
  MAX_MESSAGE_CHARS,
  PennyChatMessage,
  ParentCoachKidData,
} from "../_shared/deepseek.ts";

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

    if (PIN_GATED_ACTIONS.has(action)) {
      const pinGateError = await requirePinSession(adminClient, parentId, params.pinSession);
      if (pinGateError) return pinGateError;
    }

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
      case "verify-pin":
        return await handleVerifyPin(adminClient, parentId, params);
      case "clear-pin":
        return await handleClearPin(adminClient, parentId, params);
      case "set-hibah":
        return await handleSetHibah(adminClient, parentId, params);
      case "set-invest-rate":
        return await handleSetInvestRate(adminClient, parentId, params);
      case "mark-notifications-read":
        return await handleMarkNotificationsRead(adminClient, parentId);
      case "set-avatar":
        return await handleSetAvatar(adminClient, parentId, params);
      case "reset-kid-pin":
        return await handleResetKidPin(adminClient, parentId, params);
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
      case "set-kid-card-controls":
        return await handleSetKidCardControls(adminClient, parentId, params);
      case "transfer":
        return await handleTransfer(adminClient, parentId, params, user);
      case "penny-chat":
        return await handlePennyChat(adminClient, parentId, params, user);
      default:
        return jsonError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    console.error("parent-finance error:", err);
    if (err instanceof OwnershipError || err instanceof StatementError) {
      return jsonError(err.message, err.status);
    }
    return jsonError(err instanceof Error ? err.message : "Internal server error", 500);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Handlers take the service-role client; derive its type from a real call so
// generic defaults do not collapse the schema to `never`.
const makeAdmin = (url: string, key: string) => createClient(url, key);
type Admin = ReturnType<typeof makeAdmin>;

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
}
function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
}

const PIN_GATED_ACTIONS = new Set([
  "deposit",
  "approve-request",
  "resolve-reward",
  "delete-kid",
  "create-kid",
  "update-kid",
  "generate-creation-key",
  "set-hibah",
  "set-invest-rate",
  "create-scheduled-hibah",
  "deactivate-scheduled-hibah",
  "set-kid-card-controls",
  "reset-kid-pin",
  "penny-chat",
]);

async function issuePinSession(admin: Admin, parentId: string): Promise<{ pinSession: string; pinSessionExpiresAt: string }> {
  const token = randomHex(32);
  const tokenHash = await sha256(token);
  const { data: expiresAt, error } = await admin.rpc("parent_pin_session_create", {
    p_parent_id: parentId,
    p_token_hash: tokenHash,
    p_ttl_minutes: 30,
  });
  if (error) {
    throw new Error(`Failed to create PIN session: ${error.message}`);
  }
  return {
    pinSession: token,
    pinSessionExpiresAt: String(expiresAt),
  };
}

async function requirePinSession(admin: Admin, parentId: string, token: unknown): Promise<Response | null> {
  const { data: pinRow, error: pinErr } = await admin
    .from("commander_pins")
    .select("pin_hash")
    .eq("parent_id", parentId)
    .maybeSingle();

  if (pinErr) return jsonError(pinErr.message, 500);

  // If no PIN row or pin_hash is null, allow the call (no PIN configured)
  if (!pinRow || !pinRow.pin_hash) {
    return null;
  }

  if (typeof token !== "string" || !token.trim()) {
    return jsonError("PIN required", 403);
  }

  const tokenHash = await sha256(token.trim());
  const { data: isValid, error: valErr } = await admin.rpc("parent_pin_session_valid", {
    p_parent_id: parentId,
    p_token_hash: tokenHash,
  });

  if (valErr) return jsonError(valErr.message, 500);
  if (!isValid) {
    return jsonError("PIN required", 403);
  }

  return null;
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

async function handleGetProfile(admin: Admin, parentId: string) {
  const { data } = await admin.from("profiles").select("id, email").eq("id", parentId).maybeSingle();
  return jsonOk(data ?? null);
}

async function handleCreateKid(admin: Admin, parentId: string, params: { name: string; username: string; birth_date?: string }) {
  const { data: existingName } = await admin.from("kids").select("id").eq("parent_id", parentId).ilike("name", params.name.trim()).maybeSingle();
  if (existingName) return jsonError("A child with this name already exists", 400);

  let birthDate: string | null = null;
  let birthYear: number | null = null;
  if (params.birth_date) {
    const bDate = params.birth_date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bDate)) {
      return jsonError("Birth date must be in YYYY-MM-DD format.", 400);
    }
    const parsedDate = new Date(bDate + "T00:00:00Z");
    if (isNaN(parsedDate.getTime())) {
      return jsonError("Invalid birth date.", 400);
    }
    const today = new Date();
    let age = today.getUTCFullYear() - parsedDate.getUTCFullYear();
    const m = today.getUTCMonth() - parsedDate.getUTCMonth();
    if (m < 0 || (m === 0 && today.getUTCDate() < parsedDate.getUTCDate())) {
      age--;
    }
    if (age < 4 || age > 18) {
      return jsonError("Age must be between 4 and 18.", 400);
    }
    birthDate = bDate;
    birthYear = parsedDate.getUTCFullYear();
  }

  let code = genCode();
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await admin.from("kids").select("id").eq("login_code", code).maybeSingle();
    if (!existing) break;
    code = genCode();
  }

  const { data: existingUser } = await admin.from("kids").select("id").eq("username", params.username.trim().toLowerCase()).maybeSingle();
  if (existingUser) return jsonError("Username already taken", 400);

  const insertData: Record<string, unknown> = {
    parent_id: parentId,
    name: params.name.trim(),
    username: params.username.trim().toLowerCase(),
    login_code: code,
  };
  if (birthDate) {
    insertData.birth_date = birthDate;
    insertData.birth_year = birthYear;
  }

  const { data: kid, error } = await admin.from("kids").insert(insertData).select().single();
  if (error) return jsonError(error.message, 500);

  await admin.from("goals").insert({ kid_id: kid.id, name: "My first Tabung", emoji: "🎯", target: 100 });
  return jsonOk({ kid });
}

async function handleGenerateCreationKey(admin: Admin, parentId: string) {
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

async function handleDeleteKid(admin: Admin, parentId: string, params: { kidId: string }) {
  if (!params.kidId) return jsonError("kidId is required", 400);
  const { error } = await admin.rpc("delete_kid", {
    p_kid_id: params.kidId,
    p_parent_id: parentId,
  });
  if (error) return resolveError(error);
  return jsonOk({ ok: true });
}

async function handleUpdateKid(
  admin: Admin,
  parentId: string,
  params: {
    kidId: string;
    name: string;
    username?: string;
    birth_date?: string;
    birth_year?: number;
    age_group_override?: string | null;
  }
) {
  const kid = await verifyKidOwnership(admin, params.kidId, parentId, "username");
  if (params.username && params.username !== kid.username) {
    const { data: existing } = await admin.from("kids").select("id").eq("username", params.username).maybeSingle();
    if (existing) return jsonError("Username already taken", 400);
  }

  const updates: Record<string, unknown> = {
    name: params.name,
    username: params.username,
    birth_date: params.birth_date,
    birth_year: params.birth_year,
  };

  if (params.age_group_override !== undefined) {
    if (params.age_group_override === null || params.age_group_override === "") {
      updates.age_group_override = null;
    } else if (["6-9", "10-12", "13-17"].includes(params.age_group_override)) {
      updates.age_group_override = params.age_group_override;
    } else {
      return jsonError("Age group override must be '6-9', '10-12', '13-17', or empty.", 400);
    }
  }

  const { error } = await admin.from("kids").update(updates).eq("id", params.kidId);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true });
}

async function handleResetKidPin(admin: Admin, parentId: string, params: { kidId?: string }) {
  if (!params.kidId) return jsonError("kidId is required", 400);
  const { data: kid, error: kidErr } = await admin
    .from("kids")
    .select("id, name, username")
    .eq("id", params.kidId)
    .eq("parent_id", parentId)
    .maybeSingle();
  if (kidErr) return jsonError(kidErr.message, 500);
  if (!kid) return jsonError("Child account not found", 404);

  let code = genCode();
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await admin.from("kids").select("id").eq("login_code", code).maybeSingle();
    if (!existing) break;
    code = genCode();
  }

  const { error: updateErr } = await admin
    .from("kids")
    .update({
      login_code: code,
      hashed_pin: null,
      session_token: null,
      failed_login_attempts: 0,
      locked_until: null,
    })
    .eq("id", kid.id);
  if (updateErr) return jsonError(updateErr.message, 500);

  return jsonOk({ ok: true, kidId: kid.id, name: kid.name, loginCode: code });
}

// Approvals and rewards resolve inside one database transaction (see
// migrations/20260927000000_atomic_approvals.sql). The SQL functions lock the
// request row, refuse anything already resolved, and roll back on any error.
const RESOLVE_ERRORS: Record<string, [string, number]> = {
  not_found: ["Not found", 404],
  already_resolved: ["Already resolved", 409],
  insufficient_balance: ["Insufficient balance", 400],
  insufficient_coins: ["Kid doesn't have enough coins", 400],
  missing_loan_terms: ["Loan terms missing", 400],
  unknown_kind: ["Unknown request type", 400],
  invalid_amount: ["Invalid amount", 400],
  invalid_type: ["Invalid type", 400],
  invalid_limit: ["Invalid limit", 400],
  invalid_note: ["Keep the note under 40 characters.", 400],
  self_transfer: ["You can't send money to yourself.", 400],
  not_family: ["You can only send money to your family.", 400],
  transfer_limit_exceeded: ["That's over today's transfer limit.", 403],
};

function resolveError(error: { message: string }) {
  const known = RESOLVE_ERRORS[error.message];
  return known ? jsonError(known[0], known[1]) : jsonError(error.message, 500);
}

// Loan requests carry their terms in the reason text: "<reason> (due 14d) :: SIG::<data url>".
function parseLoanTerms(reason: string) {
  const [reasonPart, sigPart] = reason.split(" :: SIG::");
  const dueMatch = reasonPart.match(/\(due (\d+)d\)/);
  const dueDays = dueMatch ? parseInt(dueMatch[1]) : 14;
  return {
    p_loan_due_date: new Date(Date.now() + dueDays * 86400000).toISOString().slice(0, 10),
    p_loan_reason: reasonPart.replace(/\(due \d+d\)$/, "").trim(),
    p_loan_signature: sigPart || null,
  };
}

async function handleApproveRequest(admin: Admin, parentId: string, params: { approvalId: string; decision: "approve" | "decline" }) {
  const approve = params.decision === "approve";
  let loanTerms = {};
  if (approve) {
    const { data: ap, error } = await admin.from("approvals").select("kind, reason").eq("id", params.approvalId).maybeSingle();
    if (error) return jsonError(error.message, 500);
    if (!ap) return jsonError("Not found", 404);
    if (ap.kind === "QARD") loanTerms = parseLoanTerms(ap.reason || "");
  }
  const { data, error } = await admin.rpc("resolve_approval", {
    p_approval_id: params.approvalId,
    p_parent_id: parentId,
    p_approve: approve,
    ...loanTerms,
  });
  if (error) return resolveError(error);
  return jsonOk(data ?? { ok: true });
}

async function handleResolveReward(admin: Admin, parentId: string, params: { rewardId: string; decision: "approve" | "decline" }) {
  const { error } = await admin.rpc("resolve_reward", {
    p_reward_id: params.rewardId,
    p_parent_id: parentId,
    p_approve: params.decision === "approve",
  });
  if (error) return resolveError(error);
  return jsonOk({ ok: true });
}

async function handleGetPin(admin: Admin, parentId: string) {
  const { data } = await admin.from("commander_pins").select("parent_id").eq("parent_id", parentId).maybeSingle();
  return jsonOk({ hasPin: !!data });
}

async function handleVerifyPin(admin: Admin, parentId: string, params: { pin?: string }) {
  const result = await checkParentPin(admin, parentId, params.pin);
  if (!result.ok) {
    if (result.status === 403 && result.attemptsLeft !== undefined) {
      return jsonOk({ valid: false, attemptsLeft: result.attemptsLeft });
    }
    return jsonError(result.error || "PIN verification failed", result.status || 400);
  }
  return jsonOk({ valid: true, ...result.session });
}

async function handleSetPin(admin: Admin, parentId: string, params: { pin?: string; currentPin?: string; pin_hash?: string }) {
  if ("pin_hash" in params) {
    return jsonError("Please refresh the app and try again", 400);
  }
  const pin = params.pin;
  if (!pin || !isValidPinFormat(pin)) {
    return jsonError("Invalid PIN format", 400);
  }

  const { data: existing, error: existErr } = await admin
    .from("commander_pins")
    .select("parent_id")
    .eq("parent_id", parentId)
    .maybeSingle();
  if (existErr) return jsonError(existErr.message, 500);

  if (!existing) {
    const newHash = await hashPin(pin);
    const { error: insErr } = await admin.from("commander_pins").upsert({
      parent_id: parentId,
      pin_hash: newHash,
      failed_attempts: 0,
      locked_until: null,
    }, { onConflict: "parent_id" });
    if (insErr) return jsonError(insErr.message, 500);
    const session = await issuePinSession(admin, parentId);
    return jsonOk({ ok: true, ...session });
  }

  if (!params.currentPin) {
    return jsonError("Current PIN required", 403);
  }

  const { data: attemptData, error: attemptErr } = await admin.rpc("parent_pin_begin_attempt", {
    p_parent_id: parentId,
  });
  if (attemptErr) return jsonError(attemptErr.message, 500);

  const status = attemptData?.status;
  if (status === "locked") {
    const secs = Number(attemptData.retry_after_seconds) || 900;
    const mins = Math.max(1, Math.ceil(secs / 60));
    return jsonError(`Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`, 429);
  }
  if (status === "no_pin") {
    return jsonError("No PIN set", 404);
  }

  const storedHash = String(attemptData.pin_hash || "");
  const { valid } = await verifyStoredPin(params.currentPin, storedHash);
  if (!valid) {
    const attempt = Number(attemptData.attempt) || 1;
    const attemptsLeft = Math.max(0, 5 - attempt);
    return jsonError(`Incorrect current PIN. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left.`, 403);
  }

  const newHash = await hashPin(pin);
  const { error: succErr } = await admin.rpc("parent_pin_attempt_succeeded", {
    p_parent_id: parentId,
    p_new_hash: newHash,
  });
  if (succErr) return jsonError(succErr.message, 500);
  await admin.rpc("parent_pin_sessions_clear", { p_parent_id: parentId });
  const session = await issuePinSession(admin, parentId);
  return jsonOk({ ok: true, ...session });
}

async function handleClearPin(admin: Admin, parentId: string, params: { currentPin?: string }) {
  if (!params.currentPin) {
    return jsonError("Current PIN required", 403);
  }

  const { data: attemptData, error: attemptErr } = await admin.rpc("parent_pin_begin_attempt", {
    p_parent_id: parentId,
  });
  if (attemptErr) return jsonError(attemptErr.message, 500);

  const status = attemptData?.status;
  if (status === "locked") {
    const secs = Number(attemptData.retry_after_seconds) || 900;
    const mins = Math.max(1, Math.ceil(secs / 60));
    return jsonError(`Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`, 429);
  }
  if (status === "no_pin") {
    return jsonError("No PIN set", 404);
  }

  const storedHash = String(attemptData.pin_hash || "");
  const { valid } = await verifyStoredPin(params.currentPin, storedHash);
  if (!valid) {
    const attempt = Number(attemptData.attempt) || 1;
    const attemptsLeft = Math.max(0, 5 - attempt);
    return jsonError(`Incorrect current PIN. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left.`, 403);
  }

  const { error: delErr } = await admin.from("commander_pins").delete().eq("parent_id", parentId);
  if (delErr) return jsonError(delErr.message, 500);
  await admin.rpc("parent_pin_sessions_clear", { p_parent_id: parentId });
  return jsonOk({ ok: true });
}

async function handleSetHibah(admin: Admin, parentId: string, params: { kidId: string; rate: number }) {
  await verifyKidOwnership(admin, params.kidId, parentId, "id");
  await admin.from("kids").update({ hibah_rate: params.rate }).eq("id", params.kidId);
  return jsonOk({ ok: true });
}

async function handleSetInvestRate(admin: Admin, parentId: string, params: { kidId: string; rate: number }) {
  await verifyKidOwnership(admin, params.kidId, parentId, "id");
  await admin.from("kids").update({ invest_rate: params.rate }).eq("id", params.kidId);
  return jsonOk({ ok: true });
}

async function handleMarkNotificationsRead(admin: Admin, parentId: string) {
  await admin.from("notifications").update({ read: true }).eq("parent_id", parentId).eq("read", false);
  return jsonOk({ ok: true });
}

async function handleSetAvatar(admin: Admin, parentId: string, params: { kidId: string; avatar: string }) {
  await verifyKidOwnership(admin, params.kidId, parentId, "id");
  await admin.from("kids").update({ avatar: params.avatar }).eq("id", params.kidId);
  return jsonOk({ ok: true });
}

async function handleSetSelfAvatar(admin: Admin, parentId: string, params: { avatar: string }) {
  await admin.from("profiles").update({ avatar: params.avatar }).eq("id", parentId);
  return jsonOk({ ok: true });
}

async function handleGetSelfAvatar(admin: Admin, parentId: string) {
  const { data } = await admin.from("profiles").select("avatar").eq("id", parentId).maybeSingle();
  return jsonOk({ avatar: data?.avatar ?? null });
}

async function handleCreateScheduledHibah(admin: Admin, parentId: string, params: { kidId: string; amount: number; frequency: string; startDate: string; endDate?: string }) {
  await verifyKidOwnership(admin, params.kidId, parentId, "id");
  const { data: hibah, error } = await admin.from("scheduled_hibahs").insert({
    parent_id: parentId, kid_id: params.kidId, amount: params.amount, frequency: params.frequency,
    start_date: new Date(params.startDate).toISOString(), end_date: params.endDate ? new Date(params.endDate).toISOString() : null,
    next_run_at: new Date(params.startDate).toISOString(), is_active: true,
  }).select().single();
  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true, hibah });
}

async function handleGetScheduledHibahs(admin: Admin, parentId: string) {
  const { data } = await admin.from("scheduled_hibahs").select("*").eq("parent_id", parentId).eq("is_active", true).order("next_run_at", { ascending: true });
  return jsonOk({ scheduledHibahs: data ?? [] });
}

async function handleDeactivateScheduledHibah(admin: Admin, parentId: string, params: { hibahId: string }) {
  const { data: hibah } = await admin.from("scheduled_hibahs").select("*").eq("id", params.hibahId).eq("parent_id", parentId).maybeSingle();
  if (!hibah) return jsonError("Not found", 404);
  await admin.from("scheduled_hibahs").update({ is_active: false }).eq("id", params.hibahId);
  return jsonOk({ ok: true });
}

async function handleExecuteScheduledHibahs(admin: Admin) {
  const { data: processed, error } = await admin.rpc("execute_due_hibahs");
  if (error) return resolveError(error);
  return jsonOk({ processed: processed ?? 0 });
}

// ---------------------------------------------------------------------------
// Original Deposit/Withdraw and GetStatement
// ---------------------------------------------------------------------------
async function handleDeposit(admin: Admin, parentId: string, params: { kidId: string; amount: number; label?: string; type: "DEPOSIT" | "WITHDRAWAL" }) {
  const { kidId, amount, label, type } = params;
  if (!kidId || typeof amount !== "number") return jsonError("Invalid input", 400);
  const { data: newBalance, error } = await admin.rpc("parent_move_money", {
    p_kid_id: kidId,
    p_parent_id: parentId,
    p_type: type,
    p_amount: amount,
    p_label: label,
  });
  if (error) return resolveError(error);
  return jsonOk({ newBalance });
}

async function handleGetStatement(admin: Admin, parentId: string, params: { kidId: string; from: string; to: string }) {
  const { kidId, from, to } = params;
  const kid = await verifyKidOwnership(admin, kidId, parentId, "id, name, balance");
  const { startIso, endIso } = mytRange(from, to);
  const { data: txs, error } = await admin
    .from("transactions")
    .select("*")
    .eq("kid_id", kidId)
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: false });
  if (error) return jsonError(error.message, 500);
  return jsonOk({ kid: { id: kid.id, name: kid.name, balance: kid.balance }, transactions: txs ?? [], period: { from, to } });
}

async function handleSetKidCardControls(
  admin: Admin,
  parentId: string,
  params: Record<string, unknown>
) {
  if (typeof params.kidId !== "string" || !params.kidId.trim()) {
    return jsonError("kidId is required", 400);
  }
  if (params.frozen !== undefined && typeof params.frozen !== "boolean") {
    return jsonError("Invalid frozen value", 400);
  }
  if (
    params.dailyLimit !== undefined &&
    (typeof params.dailyLimit !== "number" || isNaN(params.dailyLimit))
  ) {
    return jsonError("Invalid dailyLimit value", 400);
  }
  if (params.onlineEnabled !== undefined && typeof params.onlineEnabled !== "boolean") {
    return jsonError("Invalid onlineEnabled value", 400);
  }
  if (params.locked !== undefined && typeof params.locked !== "boolean") {
    return jsonError("Invalid locked value", 400);
  }

  const { data, error } = await admin.rpc("parent_set_card_controls", {
    p_kid_id: params.kidId,
    p_parent_id: parentId,
    p_frozen: params.frozen ?? null,
    p_daily_limit: params.dailyLimit ?? null,
    p_online_enabled: params.onlineEnabled ?? null,
    p_locked: params.locked ?? null,
  });

  if (error) return resolveError(error);
  return jsonOk(data);
}

// ---------------------------------------------------------------------------
// Family Transfer Handlers
// ---------------------------------------------------------------------------

async function checkParentPin(
  admin: Admin,
  parentId: string,
  pin?: unknown,
  options?: { allowNoPin?: boolean }
): Promise<{ ok: boolean; error?: string; status?: number; session?: Record<string, unknown>; attemptsLeft?: number }> {
  if (typeof pin !== "string" || !pin) {
    if (options?.allowNoPin) {
      const { data: pinRow, error: pinErr } = await admin
        .from("commander_pins")
        .select("pin_hash")
        .eq("parent_id", parentId)
        .maybeSingle();

      if (pinErr) return { ok: false, error: pinErr.message, status: 500 };
      if (!pinRow || !pinRow.pin_hash) {
        return { ok: true };
      }
    }
    return { ok: false, error: "PIN is required", status: 400 };
  }

  if (!isValidPinFormat(pin)) {
    return { ok: false, error: "PIN must be 6 digits", status: 400 };
  }

  const { data: attemptData, error: attemptErr } = await admin.rpc("parent_pin_begin_attempt", {
    p_parent_id: parentId,
  });
  if (attemptErr) return { ok: false, error: attemptErr.message, status: 500 };

  const status = attemptData?.status;
  if (status === "no_pin") {
    if (options?.allowNoPin) return { ok: true };
    return { ok: false, error: "No PIN set", status: 404 };
  }
  if (status === "locked") {
    const secs = Number(attemptData.retry_after_seconds) || 900;
    const mins = Math.max(1, Math.ceil(secs / 60));
    return { ok: false, error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`, status: 429 };
  }
  if (status === "ok") {
    const storedHash = String(attemptData.pin_hash || "");
    const { valid, needsRehash } = await verifyStoredPin(pin, storedHash);
    if (valid) {
      const newHash = needsRehash ? await hashPin(pin) : null;
      const { error: succErr } = await admin.rpc("parent_pin_attempt_succeeded", {
        p_parent_id: parentId,
        p_new_hash: newHash,
      });
      if (succErr) return { ok: false, error: succErr.message, status: 500 };
      const session = await issuePinSession(admin, parentId);
      return { ok: true, session };
    } else {
      const attempt = Number(attemptData.attempt) || 1;
      const attemptsLeft = Math.max(0, 5 - attempt);
      return {
        ok: false,
        error: attemptsLeft > 0 ? `Incorrect PIN. ${attemptsLeft} attempts remaining.` : "Incorrect PIN.",
        status: 403,
        attemptsLeft,
      };
    }
  }
  return { ok: false, error: "Unknown attempt status", status: 500 };
}

async function resolveParentNameFromUser(admin: Admin, user: any): Promise<string> {
  const metaComfort = user?.user_metadata?.comfort_name;
  if (typeof metaComfort === "string" && metaComfort.trim()) {
    return metaComfort.trim();
  }
  const { data: prof } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user?.id)
    .maybeSingle();
  if (prof?.display_name && typeof prof.display_name === "string" && prof.display_name.trim()) {
    return prof.display_name.trim();
  }
  return "Parent";
}

async function handleTransfer(
  admin: Admin,
  parentId: string,
  params: Record<string, unknown>,
  user: any
) {
  const kidId = typeof params.kidId === "string" ? params.kidId : typeof params.toKidId === "string" ? params.toKidId : "";
  if (!kidId) return jsonError("kidId is required", 400);

  const amount = Number(params.amount);
  if (isNaN(amount) || amount < 1.00 || amount > 1000.00) {
    return jsonError("Invalid amount", 400);
  }

  const pinCheck = await checkParentPin(admin, parentId, params.pin, { allowNoPin: true });
  if (!pinCheck.ok) {
    return jsonError(pinCheck.error || "PIN verification failed", pinCheck.status || 403);
  }

  const note = typeof params.note === "string" ? params.note.trim() : null;
  const parentName = await resolveParentNameFromUser(admin, user);

  const { data, error } = await admin.rpc("parent_send_to_kid", {
    p_parent_id: parentId,
    p_kid_id: kidId,
    p_amount: amount,
    p_note: note,
    p_parent_label: parentName,
  });

  if (error) return resolveError(error);
  return jsonOk(data ?? { ok: true });
}

async function handlePennyChat(
  admin: Admin,
  parentId: string,
  params: Record<string, unknown>,
  user: any
) {
  const message = typeof params.message === "string" ? params.message.trim() : "";
  if (!message) {
    return jsonError("Message cannot be empty", 400);
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return jsonError(`Message exceeds maximum length of ${MAX_MESSAGE_CHARS} characters`, 400);
  }

  const rawHistory = Array.isArray(params.history) ? (params.history as PennyChatMessage[]) : undefined;

  const rawDailyLimit = Deno.env.get("PENNY_DAILY_LIMIT");
  const dailyLimit = rawDailyLimit && !isNaN(Number(rawDailyLimit)) && Number(rawDailyLimit) > 0
    ? Number(rawDailyLimit)
    : DEFAULT_PENNY_DAILY_LIMIT;

  const rawMaxTokens = Deno.env.get("PENNY_MAX_TOKENS");
  const configuredMaxTokens = rawMaxTokens && !isNaN(Number(rawMaxTokens)) && Number(rawMaxTokens) > 0
    ? Number(rawMaxTokens)
    : undefined;

  const allowPro = Deno.env.get("DEEPSEEK_ALLOW_PRO") === "true";

  // 1. Check API key (503 if not set up; do not burn quota)
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey || apiKey.trim() === "") {
    return jsonError("Penny AI is not set up yet", 503);
  }

  // 2. Fetch up to 6 children and aggregate data
  const { data: kidsRows, error: kidsErr } = await admin
    .from("kids")
    .select("id, name, comfort_name, balance, invest_balance, birth_date, birth_year, age_group_override")
    .eq("parent_id", parentId)
    .order("name")
    .limit(6);

  if (kidsErr) {
    return jsonError(`Failed to load children data: ${kidsErr.message}`, 500);
  }

  const cutoff = new Date(Date.now() - 35 * 86400 * 1000).toISOString();
  const dateInfo = getMytDateInfo();
  const kidsCoachData: ParentCoachKidData[] = [];

  for (const kid of (kidsRows || [])) {
    const [ageGroupRes, goalsRes, txsRes, completionsRes, loansRes, approvalsRes] = await Promise.all([
      admin.rpc("kid_age_group", { p_kid_id: kid.id }),
      admin.from("goals").select("saved").eq("kid_id", kid.id),
      admin.from("transactions").select("type, amount, label, created_at").eq("kid_id", kid.id).gte("created_at", cutoff).order("created_at", { ascending: false }).limit(300),
      admin.from("quest_completions").select("quest_id", { count: "exact", head: true }).eq("kid_id", kid.id),
      admin.from("loans").select("status, due_date").eq("kid_id", kid.id),
      admin.from("approvals").select("id").eq("kid_id", kid.id).eq("status", "pending"),
    ]);

    const ageGroup = (ageGroupRes.data as string) || "10-12";
    const tabung = (goalsRes.data || []).reduce((acc: number, g: any) => acc + (Number(g.saved) || 0), 0);

    let spentThisWeek = 0;
    let spentLastWeek = 0;
    let savedThisWeek = 0;
    let sadaqahThisMonth = 0;
    const catTotals: Record<string, number> = {};

    for (const t of (txsRes.data || [])) {
      const tMs = new Date(t.created_at).getTime();
      const typeStr = String(t.type || "");
      const labelStr = String(t.label || "");
      const amt = Number(t.amount) || 0;

      const inThisWeek = tMs >= dateInfo.thisWeekStartMs && tMs <= dateInfo.nowMs;
      const inLastWeek = tMs >= dateInfo.lastWeekStartMs && tMs < dateInfo.lastWeekEndMs;
      const inThisMonth = tMs >= dateInfo.thisMonthStartMs && tMs <= dateInfo.nowMs;

      if (isSpendingTransaction(typeStr, labelStr)) {
        if (inThisWeek) {
          spentThisWeek += amt;
          const cKey = categoryKey(typeStr, labelStr);
          const cLabel = categoryLabel(cKey).replace(/_/g, " ");
          catTotals[cLabel] = (catTotals[cLabel] || 0) + amt;
        }
        if (inLastWeek) {
          spentLastWeek += amt;
        }
      }

      if (typeStr === "GOAL_IN" && inThisWeek) {
        savedThisWeek += amt;
      }

      if (typeStr === "SADAQAH" && inThisMonth) {
        sadaqahThisMonth += amt;
      }
    }

    const topCategoryEntry = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    const topCategoryThisWeek = topCategoryEntry ? topCategoryEntry[0] : null;

    const todayDateStr = new Date().toISOString().slice(0, 10);
    const loans = loansRes.data || [];
    const activeLoans = loans.filter((l: any) => l.status === "active");
    const overdueLoans = activeLoans.filter((l: any) => l.due_date && l.due_date < todayDateStr);

    kidsCoachData.push({
      comfortName: kid.comfort_name || null,
      ageGroup,
      spending: Number(kid.balance) || 0,
      tabung,
      growth: Number(kid.invest_balance) || 0,
      spentThisWeek,
      spentLastWeek,
      topCategoryThisWeek,
      savedThisWeek,
      sadaqahThisMonth,
      questsCompleted: completionsRes.count ?? 0,
      activeLoanCount: activeLoans.length,
      overdueLoanCount: overdueLoans.length,
      pendingRequestsCount: (approvalsRes.data || []).length,
    });
  }

  const parentComfortName = typeof user?.user_metadata?.comfort_name === "string" && user.user_metadata.comfort_name.trim() !== ""
    ? user.user_metadata.comfort_name.trim()
    : null;

  const contextLines = buildParentCoachContext({
    parentComfortName,
    kids: kidsCoachData,
  });

  const system = `${parentSystemPrompt()}\n\nFamily financial data:\n${contextLines.join("\n")}`;

  const isThinking = params.thinking !== false;
  let requestParams;
  try {
    requestParams = buildPennyRequest({
      model: typeof params.model === "string" ? params.model : undefined,
      thinking: isThinking,
      history: rawHistory,
      message,
      systemPrompt: system,
      context: params.context as any,
      maxTokens: configuredMaxTokens,
      allowPro,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 400);
  }

  console.log(`[parent-finance] handlePennyChat parentId=${parentId} model=${requestParams.model} thinking=${isThinking}`);

  // 3. Consume parent quota atomically in DB AFTER request is validated
  const { data: remaining, error: quotaErr } = await admin.rpc("parent_consume_penny_quota", {
    p_parent_id: parentId,
    p_limit: dailyLimit,
  });
  if (quotaErr) {
    if (quotaErr.message?.includes("quota_exceeded")) {
      return jsonError("Penny needs a rest. Try again tomorrow.", 429);
    }
    return jsonError(`Quota check failed: ${quotaErr.message}`, 500);
  }

  // 4. Call DeepSeek via shared callPenny
  try {
    const result = await callPenny(apiKey, requestParams);
    return jsonOk({
      reply: result.reply,
      model: result.model,
      thinking: result.thinking,
      remaining: typeof remaining === "number" ? remaining : 0,
    });
  } catch (err: unknown) {
    if (err instanceof PennyError) {
      return jsonError(err.message, err.status);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg || "Penny AI service error", 500);
  }
}

