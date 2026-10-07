// supabase/functions/kid-finance/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import bcrypt from "npm:bcryptjs";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";
import { checkKidPin } from "./pin.ts";
import {
  buildPennyRequest,
  callPenny,
  PennyError,
  kidSystemPrompt,
  buildKidCoachContext,
  DEFAULT_PENNY_DAILY_LIMIT,
  MAX_MESSAGE_CHARS,
  PennyChatMessage,
  validateBirthdayUpdate,
} from "../_shared/deepseek.ts";
import {
  getQuote,
  getDailyCloses,
  getCuratedSymbols,
} from "../_shared/market.ts";
import {
  currentInvestmentValues,
  formatInvestmentList,
} from "../_shared/investments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Response helpers (Fixed - always include CORS headers)
// ---------------------------------------------------------------------------
function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function jsonError(message: string, status = 400, detail?: unknown): Response {
  const body: Record<string, unknown> = { error: message };
  if (detail !== undefined) body.detail = String(detail);

  console.error(`[kid-finance] ${status}: ${message}`, detail ?? "");

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// ---------------------------------------------------------------------------
// Database client & error mapping
// ---------------------------------------------------------------------------
const makeAdmin = (url: string, key: string) => createClient(url, key);
type Admin = ReturnType<typeof makeAdmin>;

const RESOLVE_ERRORS: Record<string, [string, number]> = {
  not_found: ["Not found", 404],
  already_resolved: ["Already resolved", 409],
  insufficient_balance: ["Insufficient balance", 400],
  insufficient_coins: ["Kid doesn't have enough coins", 400],
  insufficient_invested: ["Insufficient invested balance", 400],
  invalid_amount: ["Invalid amount", 400],
  invalid_option: ["Pick an investment tier, frequency, and length from the options.", 400],
  limit_reached: ["You have reached the limit for open investments. Wait for one to finish.", 403],
  invalid_cause: ["Pick a cause from the list.", 400],
  invalid_type: ["Invalid type", 400],
  invalid_limit: ["Invalid limit", 400],
  missing_loan_terms: ["Loan terms missing", 400],
  unknown_kind: ["Unknown request type", 400],
  loan_closed: ["This loan is already repaid", 400],
  goal_complete: ["This Tabung is already full.", 400],
  invalid_goal: [
    "Check the Tabung name (1 to 40 characters) and target (RM1 to RM100,000). Up to 10 Tabung.",
    400,
  ],
  card_frozen: ["Your card is frozen. Unfreeze it on the Card page to continue.", 403],
  card_limit_exceeded: ["That is over your daily card limit.", 403],
  card_locked: ["Your parent manages these card settings. You can still make them stricter.", 403],
  quota_exceeded: ["Penny needs a rest. Try again tomorrow.", 429],
  self_transfer: ["You can't send money to yourself.", 400],
  not_family: ["You can only send money to your family.", 400],
  transfer_limit_exceeded: ["That's over today's transfer limit.", 403],
  invalid_note: ["Keep the note under 40 characters.", 400],
  quest_locked: ["Finish the quest before this one first.", 403],
  attempt_finished: ["This quest round is over. Start it again.", 409],
  already_answered: ["You already answered that one.", 409],
  invalid_choice: ["Pick one of the answers.", 400],
  wrong_kid: ["Forbidden.", 403],
  market_off: ["Market Tracker is switched off. Ask a parent to switch it on.", 403],
  invalid_symbol: ["Pick a symbol from the curated list.", 400],
  stale_quote: ["Market price is refreshing. Please try again in a moment.", 409],
};

function handleRpcError(error: { message: string }) {
  const known = RESOLVE_ERRORS[error.message];
  return known ? jsonError(known[0], known[1]) : jsonError(error.message, 500);
}

// ---------------------------------------------------------------------------
// Safe body parser
// ---------------------------------------------------------------------------
async function safeParseBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text || text.trim() === "") return {};
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Actions that do NOT require a session token (pre-auth only)
// ---------------------------------------------------------------------------
const PRE_AUTH_ACTIONS = new Set(["login", "login-by-code", "register", "verify-access-code", "set-initial-pin"]);

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req: Request) => {
  const requestId = crypto.randomUUID().slice(0, 8);

  // ✅ ALWAYS handle CORS preflight first
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  // ❌ Block non-POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: corsHeaders,
      }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError("Server misconfiguration: missing environment variables", 500);
  }

  const body = await safeParseBody(req);
  const action = typeof body.action === "string" ? body.action : undefined;

  const logBody = { ...body };
  if ("pin" in logBody) logBody.pin = "[REDACTED]";
  if ("signature" in logBody) logBody.signature = "[TRUNCATED]";
  if ("base64Image" in logBody) logBody.base64Image = "[TRUNCATED]";
  if ("message" in logBody) logBody.message = "[REDACTED]";
  if ("history" in logBody) logBody.history = "[REDACTED]";

  console.log(`[kid-finance][${requestId}] action="${action ?? "MISSING"}"`, 
    JSON.stringify(logBody).slice(0, 300));

  if (!action) return jsonError('Missing required field: "action"', 400);

  const admin = makeAdmin(supabaseUrl, serviceRoleKey);
  const params = { ...body } as Record<string, unknown>;
  delete params.action;

  // ── Security gate ────────────────────────────────────────────────────────
  if (!PRE_AUTH_ACTIONS.has(action)) {
    const token = typeof params.code === "string" ? params.code.trim() : "";
    if (!token) {
      console.warn(`[kid-finance][${requestId}] Rejected action="${action}": missing session token`);
      return jsonError("Unauthorized: missing session token", 401);
    }

    const { data: exists, error: gateErr } = await admin
      .from("kids")
      .select("id")
      .eq("session_token", token)
      .maybeSingle();

    if (gateErr) {
      return jsonError(`Auth check failed: ${gateErr.message}`, 500);
    }

    if (!exists) {
      console.warn(`[kid-finance][${requestId}] Rejected action="${action}": invalid token`);
      return jsonError("Unauthorized: invalid or expired session", 401);
    }
  }

  try {
    switch (action) {
      case "login":            return await handleLogin(admin, params, requestId);
      case "login-by-code":    return await handleLoginByCode(admin, params, requestId);
      case "verify-access-code": return await handleVerifyAccessCode(admin, params, requestId);
      case "set-initial-pin":  return await handleSetInitialPin(admin, params, requestId);
      case "register":         return await handleRegister(admin, params, requestId);
      case "get-state":        return await handleGetState(admin, params, requestId);
      case "get-history":      return await handleGetHistory(admin, params, requestId);
      case "mark-notifications-read": return await handleMarkNotificationsRead(admin, params, requestId);
      case "sadaqah":          return await handleSadaqah(admin, params, requestId);
      case "loan-repay":       return await handleLoanRepay(admin, params, requestId);
      case "create-goal":      return await handleCreateGoal(admin, params, requestId);
      case "update-goal":      return await handleUpdateGoal(admin, params, requestId);
      case "delete-goal":      return await handleDeleteGoal(admin, params, requestId);
      case "contribute-goal":  return await handleContributeGoal(admin, params, requestId);
      case "claim-coins":      return await handleClaimCoins(admin, params, requestId);
      case "quest-board":      return await handleQuestBoard(admin, params, requestId);
      case "quest-start":      return await handleQuestStart(admin, params, requestId);
      case "quest-answer":     return await handleQuestAnswer(admin, params, requestId);
      case "invest-options":   return await handleInvestOptions(admin, params, requestId);
      case "invest-preview":   return await handleInvestPreview(admin, params, requestId);
      case "invest-list":      return await handleInvestList(admin, params, requestId);
      case "invest-open":      return await handleInvestOpen(admin, params, requestId);
      case "invest-close":     return await handleInvestClose(admin, params, requestId);
      case "market-symbols":   return await handleMarketSymbols(admin, params, requestId);
      case "market-symbol":    return await handleMarketSymbol(admin, params, requestId);
      case "market-open":      return await handleMarketOpen(admin, params, requestId);
      case "market-sell":      return await handleMarketSell(admin, params, requestId);
      case "request-approval": return await handleRequestApproval(admin, params, requestId);
      case "request-loan":     return await handleRequestLoan(admin, params, requestId);
      case "request-reward":   return await handleRequestReward(admin, params, requestId);
      case "set-card-controls": return await handleSetCardControls(admin, params, requestId);
      case "update-profile":   return await handleUpdateProfile(admin, params, requestId);
      case "upload-avatar":    return await handleUploadAvatar(admin, params, requestId);
      case "penny-chat":       return await handlePennyChat(admin, params, requestId);
      case "transfer-recipients": return await handleTransferRecipients(admin, params, requestId);
      case "transfer":         return await handleTransfer(admin, params, requestId);
      case "unlock":           return await handleUnlock(admin, params, requestId);
      case "pin-status": {
        const kid = await getKid(admin, params.code, requestId);
        const { data, error } = await admin.rpc("pin_account_status", { p_mode: "kid", p_id: kid.id });
        return error ? handleRpcError(error) : jsonOk(data);
      }
      default:
        return jsonError(`Unknown action: "${action}"`, 400);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[kid-finance][${requestId}] Unhandled error in action="${action}":`, msg, stack ?? "");
    return jsonError(`Internal error in "${action}": ${msg}`, 500);
  }
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return encodeHex(array);
}

async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  return encodeHex(new Uint8Array(hashBuffer));
}

async function getKid(admin: Admin, token: unknown, requestId: string) {
  if (!token || typeof token !== "string" || token.trim() === "") {
    throw new Error("Missing or invalid session code");
  }
  const { data, error } = await admin
    .from("kids").select("*").eq("session_token", token).maybeSingle();

  if (error) {
    throw new Error(`DB error: ${error.message}`);
  }
  if (!data) throw new Error("Invalid or expired session");

  console.log(`[kid-finance][${requestId}] getKid: id=${data.id} name="${data.name}"`);
  return data;
}

async function notifyParent(
  admin: Admin,
  parentId: string, kidId: string, kind: string, message: string, link?: string,
) {
  const resolvedLink = link ?? (["WITHDRAWAL","DEPOSIT","QARD","REWARD"].includes(kind) ? "/parent/approvals" : "/parent");
  const { error } = await admin.from("notifications").insert({ parent_id: parentId, kid_id: kidId, kind, message, link: resolvedLink });
  if (error) console.warn(`[kid-finance] notifyParent failed (non-fatal): ${error.message}`);
}

// ---------------------------------------------------------------------------
// Auth handlers (pre-auth)
// ---------------------------------------------------------------------------

async function handleLogin(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const username = typeof params.username === "string" ? params.username.trim() : "";
  const pin = typeof params.pin === "string" ? params.pin.trim() : "";
  if (!username || !pin) return jsonError("Missing username or PIN", 400);
  if (pin.length < 6 || !/^\d{6}$/.test(pin)) {
    return jsonError("PINs are now 6 digits. Ask your parent to tap Reset PIN for a new access code.", 400);
  }
  console.log(`[kid-finance][${requestId}] handleLogin username="${username}"`);

  const { data: kid, error: kidErr } = await admin.from("kids").select("*").eq("username", username).maybeSingle();
  if (kidErr) return jsonError(`DB error: ${kidErr.message}`, 500);
  if (!kid) return jsonError("Invalid username or PIN", 400);

  if (!kid.hashed_pin) {
    return jsonError("Account setup incomplete. Please enter your one-time access code to set your 6-digit PIN.", 400);
  }

  const pinCheck = await checkKidPin(admin, kid, pin);
  if (!pinCheck.ok) return jsonError(pinCheck.error || "Invalid username or PIN", pinCheck.status || 400);

  const sessionToken = randomHex(32);
  await admin.from("kids").update({ session_token: sessionToken }).eq("id", kid.id);
  console.log(`[kid-finance][${requestId}] handleLogin success kid id=${kid.id}`);
  return jsonOk({ kidId: kid.id, name: kid.comfort_name || kid.name, code: sessionToken });
}

async function handleLoginByCode(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const loginCode = typeof params.loginCode === "string" ? params.loginCode.trim().toUpperCase() : "";
  if (!loginCode) return jsonError("Missing loginCode", 400);

  const { data: kid, error: kidErr } = await admin.from("kids").select("*").eq("login_code", loginCode).maybeSingle();
  if (kidErr) return jsonError(`DB error: ${kidErr.message}`, 500);
  if (!kid) return jsonError("Invalid access code. Please check and try again.", 400);

  if (kid.hashed_pin) {
    return jsonError("This access code has already been redeemed. Please sign in with your 6-digit PIN.", 400);
  }

  console.log(`[kid-finance][${requestId}] handleLoginByCode success kidId=${kid.id}`);
  return jsonOk({ needsPinSetup: true, kidId: kid.id, username: kid.username, name: kid.comfort_name || kid.name });
}

async function handleVerifyAccessCode(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const loginCode = typeof params.loginCode === "string" ? params.loginCode.trim().toUpperCase() : "";
  if (!loginCode) return jsonError("Missing access code", 400);

  const { data: kid, error: kidErr } = await admin
    .from("kids")
    .select("id, name, comfort_name, username, hashed_pin, login_code, birth_date, birth_year")
    .eq("login_code", loginCode)
    .maybeSingle();
  if (kidErr) return jsonError(`DB error: ${kidErr.message}`, 500);
  if (!kid) return jsonError("Invalid access code. Please check and try again.", 400);

  if (kid.hashed_pin) {
    return jsonError("This access code has already been used. Please log in with your username and 6-digit PIN.", 400);
  }

  console.log(`[kid-finance][${requestId}] handleVerifyAccessCode success kidId=${kid.id}`);
  return jsonOk({
    ok: true,
    kidId: kid.id,
    username: kid.username,
    name: kid.comfort_name || kid.name,
    needsBirthday: !kid.birth_date && !kid.birth_year,
  });
}

async function handleSetInitialPin(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const loginCode = typeof params.loginCode === "string" ? params.loginCode.trim().toUpperCase() : "";
  const pin = typeof params.pin === "string" ? params.pin.trim() : "";
  const comfortNameRaw = typeof params.comfortName === "string" ? params.comfortName.trim() : undefined;
  const birthDateRaw = typeof params.birthDate === "string" ? params.birthDate.trim() : undefined;

  if (!loginCode || !pin) return jsonError("Missing access code or PIN", 400);
  if (pin.length < 6 || !/^\d{6}$/.test(pin)) {
    return jsonError("PIN must be exactly 6 digits", 400);
  }

  let comfortName: string | null = null;
  if (comfortNameRaw !== undefined && comfortNameRaw !== "") {
    if (comfortNameRaw.length < 1 || comfortNameRaw.length > 30 || !/^[A-Za-z0-9 '\-]+$/.test(comfortNameRaw)) {
      return jsonError("Comfort name must be 1-30 characters (letters, digits, spaces, ' and - only)", 400);
    }
    comfortName = comfortNameRaw;
  }

  let birthDate: string | null = null;
  let birthYear: number | null = null;
  if (birthDateRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateRaw)) {
      return jsonError("Birth date must be in YYYY-MM-DD format.", 400);
    }
    const parsedDate = new Date(birthDateRaw + "T00:00:00Z");
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
    birthDate = birthDateRaw;
    birthYear = parsedDate.getUTCFullYear();
  }

  const { data: kid, error: kidErr } = await admin
    .from("kids")
    .select("id, name, username, hashed_pin, login_code, birth_date, birth_year")
    .eq("login_code", loginCode)
    .maybeSingle();
  if (kidErr) return jsonError(`DB error: ${kidErr.message}`, 500);
  if (!kid) return jsonError("Invalid access code.", 400);

  if (kid.hashed_pin) {
    return jsonError("This code was just used. Sign in with your PIN.", 409);
  }

  let hashedPin: string;
  try {
    hashedPin = await bcrypt.hash(pin, 10);
  } catch (e) {
    return jsonError("Failed to hash PIN", 500, e);
  }

  const sessionToken = randomHex(32);
  const updateData: Record<string, unknown> = {
    hashed_pin: hashedPin,
    login_code: null,
    session_token: sessionToken,
    failed_login_attempts: 0,
    locked_until: null,
  };
  if (comfortName) {
    updateData.comfort_name = comfortName;
  }
  if (birthDate && !kid.birth_date && !kid.birth_year) {
    updateData.birth_date = birthDate;
    updateData.birth_year = birthYear;
  }

  const { data: updatedRows, error: updateErr } = await admin
    .from("kids")
    .update(updateData)
    .eq("id", kid.id)
    .is("hashed_pin", null)
    .select("id, name, comfort_name");

  if (updateErr) return jsonError(`DB error: ${updateErr.message}`, 500);
  if (!updatedRows || updatedRows.length === 0) {
    return jsonError("This code was just used. Sign in with your PIN.", 409);
  }

  const updatedKid = updatedRows[0];
  console.log(`[kid-finance][${requestId}] handleSetInitialPin success kidId=${kid.id}`);
  return jsonOk({ ok: true, kidId: kid.id, name: updatedKid.comfort_name || updatedKid.name, code: sessionToken });
}

async function handleRegister(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const setupCode = typeof params.setupCode === "string" ? params.setupCode.trim() : "";
  const name = typeof params.name === "string" ? params.name.trim() : "";
  const username = typeof params.username === "string" ? params.username.trim() : "";
  const pin = typeof params.pin === "string" ? params.pin : "";
  if (!setupCode || !name || !username || !pin) return jsonError("Missing required fields: setupCode, name, username, pin", 400);
  if (!/^\d{6}$/.test(pin)) return jsonError("PIN must be exactly 6 digits", 400);
  console.log(`[kid-finance][${requestId}] handleRegister username="${username}"`);

  const parts = setupCode.split("_");
  if (parts.length !== 2) return jsonError("Invalid setup code format", 400);
  const [id, rawKey] = parts;

  const { data: keyData, error: keyErr } = await admin.from("child_creation_keys").select("*").eq("id", id).maybeSingle();
  if (keyErr) return jsonError(`DB error: ${keyErr.message}`, 500);
  if (!keyData) return jsonError("Setup code not found", 400);
  if (keyData.used) return jsonError("Setup code already used", 400);
  if (new Date() > new Date(keyData.expires_at)) return jsonError("Setup code expired", 400);

  const expectedHash = await sha256(rawKey + keyData.salt);
  if (expectedHash !== keyData.hashed_key) return jsonError("Invalid setup code", 400);

  const { data: existingUser } = await admin.from("kids").select("id").eq("username", username).maybeSingle();
  if (existingUser) return jsonError("Username already taken", 400);

  let hashedPin: string;
  try { hashedPin = await bcrypt.hash(pin, 10); }
  catch (e) { return jsonError("Failed to hash PIN", 500, e); }

  const loginCode = randomHex(3).toUpperCase();
  const sessionToken = randomHex(32);

  const { data: kid, error: insertErr } = await admin.from("kids").insert({
    parent_id: keyData.parent_id, name, username,
    hashed_pin: hashedPin, bridge_key_hash: keyData.hashed_key,
    login_code: loginCode, session_token: sessionToken,
  }).select().single();
  if (insertErr) return jsonError(`Failed to create account: ${insertErr.message}`, 500);

  await admin.from("child_creation_keys").update({ used: true }).eq("id", id);
  await admin.from("goals").insert({ kid_id: kid.id, name: "My first Tabung", emoji: "🎯", target: 100 });

  console.log(`[kid-finance][${requestId}] handleRegister created kid id=${kid.id}`);
  return jsonOk({ ok: true, kidId: kid.id, code: sessionToken });
}

// ---------------------------------------------------------------------------
// Remaining handlers (unchanged except they now use fixed jsonOk/jsonError)
// ---------------------------------------------------------------------------

async function handleGetState(admin: Admin, params: Record<string, unknown>, requestId: string) {
  let kid = await getKid(admin, params.code, requestId);
  const today = new Date().toISOString().slice(0, 10);
  const lastLogin = kid.last_login_date ?? null;
  if (lastLogin !== today) {
    let newStreak = 1;
    if (lastLogin) {
      const diffDays = Math.round((new Date(today).getTime() - new Date(lastLogin as string).getTime()) / 86400000);
      if (diffDays === 1) newStreak = (Number(kid.streak) || 0) + 1;
    }
    const { error } = await admin.from("kids").update({ streak: newStreak, last_login_date: today }).eq("id", kid.id);
    if (error) console.warn(`[kid-finance][${requestId}] streak update failed: ${error.message}`);
    kid = { ...kid, streak: newStreak, last_login_date: today };
  }

  // Settle investments first and refresh kid's balance
  await admin.rpc("kid_investments_settle", { p_kid_id: kid.id });
  const { data: refKid } = await admin.from("kids").select("balance").eq("id", kid.id).maybeSingle();
  if (refKid) kid.balance = refKid.balance;

  const [goalsRes, txsRes, rewardsRes, loansRes, approvalsRes, parentRes, notificationsRes, unreadRes, completionsRes, ageGroupRes, investRes] = await Promise.all([
    admin.from("goals").select("*").eq("kid_id", kid.id).order("created_at"),
    admin.from("transactions").select("*").eq("kid_id", kid.id).order("created_at", { ascending: false }).limit(100),
    admin.from("rewards").select("*").eq("kid_id", kid.id).order("created_at", { ascending: false }),
    admin.from("loans").select("*").eq("kid_id", kid.id).order("created_at", { ascending: false }),
    admin.from("approvals").select("*").eq("kid_id", kid.id).order("created_at", { ascending: false }).limit(20),
    admin.from("profiles").select("display_name, email").eq("id", kid.parent_id as string).maybeSingle(),
    admin.from("kid_notifications").select("*").eq("kid_id", kid.id).order("created_at", { ascending: false }).limit(20),
    admin.from("kid_notifications").select("id", { count: "exact", head: true }).eq("kid_id", kid.id).eq("read", false),
    admin.from("quest_completions").select("id", { count: "exact", head: true }).eq("kid_id", kid.id),
    admin.rpc("kid_age_group", { p_kid_id: kid.id }),
    currentInvestmentValues(admin, kid.id),
  ]);

  const investmentsValue = investRes.totalValue;

  const safeKid = { ...kid };
  delete safeKid.hashed_pin;
  delete safeKid.session_token;
  delete safeKid.login_code;
  delete safeKid.bridge_key_hash;

  return jsonOk({
    kid: safeKid,
    ageGroup: ageGroupRes.data ?? "10-12",
    questsCompleted: completionsRes.count ?? 0,
    goals: goalsRes.data ?? [],
    txs: txsRes.data ?? [],
    rewards: rewardsRes.data ?? [],
    loans: loansRes.data ?? [],
    approvals: approvalsRes.data ?? [],
    attempts: [],
    parent: parentRes.data ?? null,
    notifications: notificationsRes.data ?? [],
    unreadNotifications: unreadRes.count ?? 0,
    investmentsValue: investmentsValue === null ? null : Number(investmentsValue.toFixed(2)),
  });
}

async function handleGetHistory(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const days = Number(params.days);
  if (![7, 30, 90].includes(days)) {
    return jsonError("Invalid period", 400);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await admin
    .from("transactions")
    .select("id, type, amount, label, created_at")
    .eq("kid_id", kid.id)
    .gte("created_at", cutoff.toISOString())
    .neq("type", "INVEST_GAIN")
    .neq("type", "INVEST_LOSS")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error(`[kid-finance][${requestId}] handleGetHistory failed: ${error.message}`);
    return jsonError(`Failed to fetch history: ${error.message}`, 500);
  }

  return jsonOk({ txs: data ?? [] });
}

async function handleClaimCoins(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_claim_coins", {
    p_kid_id: kid.id,
  });
  if (error) return handleRpcError(error);
  return jsonOk({ claimed: Number(data ?? 0) });
}

async function handleQuestBoard(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_quest_board", {
    p_kid_id: kid.id,
  });
  if (error) return handleRpcError(error);
  return jsonOk(data);
}

async function handleQuestStart(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const questId = typeof params.questId === "string" ? params.questId.trim() : "";
  if (!questId) return jsonError("Missing questId", 400);
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_quest_start", {
    p_kid_id: kid.id,
    p_quest_id: questId,
  });
  if (error) return handleRpcError(error);
  return jsonOk(data);
}

async function handleQuestAnswer(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const attemptId = typeof params.attemptId === "string" ? params.attemptId.trim() : "";
  const questionId = typeof params.questionId === "string" ? params.questionId.trim() : "";
  const selectedIndex = typeof params.selectedIndex === "number" ? params.selectedIndex : (params.selectedIndex !== undefined ? Number(params.selectedIndex) : NaN);

  if (!attemptId || !questionId) return jsonError("Missing attemptId or questionId", 400);
  if (isNaN(selectedIndex) || selectedIndex < 0) return jsonError("Pick one of the answers.", 400);

  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_quest_answer", {
    p_kid_id: kid.id,
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_choice: selectedIndex,
  });
  if (error) return handleRpcError(error);
  return jsonOk(data);
}

async function handleInvestOptions(admin: Admin, _params: Record<string, unknown>, _requestId: string) {
  const { data, error } = await admin.rpc("investment_fund_options");
  if (error) return handleRpcError(error);
  return jsonOk(data);
}

async function handleInvestPreview(admin: Admin, params: Record<string, unknown>, _requestId: string) {
  const tier = typeof params.tier === "string" ? params.tier.toLowerCase() : "";
  const frequency = typeof params.frequency === "string" ? params.frequency.toLowerCase() : "";
  const lockTicks = Number(params.lockTicks);
  const amount = Number(params.amount);

  if (!tier || !frequency || isNaN(lockTicks) || lockTicks <= 0 || isNaN(amount) || amount <= 0) {
    return jsonError("Pick an investment tier, frequency, and length from the options.", 400);
  }

  const rates: Record<string, [number, number]> = {
    low: [-0.005, 0.005],
    medium: [-0.010, 0.010],
    high: [-0.020, 0.020],
  };

  const range = rates[tier];
  if (!range) {
    return jsonError("Pick an investment tier, frequency, and length from the options.", 400);
  }

  const [lo, hi] = range;
  const minVal = amount * Math.pow(1 + lo, lockTicks);
  const maxVal = amount * Math.pow(1 + hi, lockTicks);

  const intervalMs = frequency === "minute" ? 60000 : frequency === "day" ? 86400000 : 7 * 86400000;
  const endsAt = new Date(Date.now() + lockTicks * intervalMs).toISOString();

  return jsonOk({
    minValue: Number(minVal.toFixed(2)),
    maxValue: Number(maxVal.toFixed(2)),
    endsAt,
  });
}

async function handleInvestList(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  await admin.rpc("kid_investments_settle", { p_kid_id: kid.id });

  const { data: invs, error } = await admin
    .from("investments")
    .select("*")
    .eq("kid_id", kid.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return jsonError(error.message, 500);

  const formattedList = await formatInvestmentList(admin, invs || []);

  return jsonOk({ investments: formattedList });
}

async function handleMarketSymbols(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const symbols = await getCuratedSymbols(admin);
  const { data: ageGroup } = await admin.rpc("kid_age_group", { p_kid_id: kid.id });
  let enabled = kid.market_tracker_enabled;
  if (enabled === null || enabled === undefined) {
    enabled = ageGroup === "13-17";
  }
  return jsonOk({ symbols, enabled: Boolean(enabled), ageGroup: ageGroup || "10-12" });
}

async function handleMarketSymbol(admin: Admin, params: Record<string, unknown>, requestId: string) {
  await getKid(admin, params.code, requestId);
  const symbol = typeof params.symbol === "string" ? params.symbol.trim().toUpperCase() : "";
  if (!symbol) return jsonError("Missing symbol", 400);

  const quoteRes = await getQuote(admin, symbol);
  const closesRes = await getDailyCloses(admin, symbol);

  return jsonOk({
    symbol,
    quote: quoteRes.quote,
    available: quoteRes.available,
    stale: quoteRes.stale,
    dailyCloses: closesRes.closes,
  });
}

async function handleMarketOpen(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const symbol = typeof params.symbol === "string" ? params.symbol.trim().toUpperCase() : "";
  const amount = Number(params.amount);
  const clientRequestId = typeof params.clientRequestId === "string" && params.clientRequestId.trim() ? params.clientRequestId.trim() : null;

  if (!symbol) return jsonError("Missing symbol", 400);
  if (isNaN(amount) || amount < 1.00) return jsonError("Invalid amount", 400);

  // Refresh quote if stale
  await getQuote(admin, symbol);

  const { data, error } = await admin.rpc("kid_market_open", {
    p_kid_id: kid.id,
    p_symbol: symbol,
    p_amount: amount,
    p_client_request_id: clientRequestId,
  });

  if (error) return handleRpcError(error);
  return jsonOk(data);
}

async function handleMarketSell(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const investmentId = typeof params.investmentId === "string" ? params.investmentId.trim() : "";
  if (!investmentId) return jsonError("Missing investmentId", 400);

  const { data: inv } = await admin
    .from("investments")
    .select("symbol")
    .eq("id", investmentId)
    .eq("kid_id", kid.id)
    .maybeSingle();

  if (!inv) return jsonError("Not found", 404);

  if (inv.symbol) {
    await getQuote(admin, inv.symbol);
  }

  const { data, error } = await admin.rpc("kid_investment_close", {
    p_kid_id: kid.id,
    p_investment_id: investmentId,
  });

  if (error) return handleRpcError(error);
  return jsonOk(data);
}

async function handleInvestOpen(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const tier = typeof params.tier === "string" ? params.tier.toLowerCase() : "";
  const frequency = typeof params.frequency === "string" ? params.frequency.toLowerCase() : "";
  const lockTicks = Number(params.lockTicks);
  const amount = Number(params.amount);
  const clientRequestId = typeof params.clientRequestId === "string" && params.clientRequestId.trim() ? params.clientRequestId.trim() : null;

  const { data, error } = await admin.rpc("kid_investment_open", {
    p_kid_id: kid.id,
    p_tier: tier,
    p_frequency: frequency,
    p_lock_ticks: lockTicks,
    p_amount: amount,
    p_client_request_id: clientRequestId,
  });

  if (error) return handleRpcError(error);
  return jsonOk(data);
}

async function handleInvestClose(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const investmentId = typeof params.investmentId === "string" ? params.investmentId.trim() : "";
  if (!investmentId) return jsonError("Missing investmentId", 400);

  const { data, error } = await admin.rpc("kid_investment_close", {
    p_kid_id: kid.id,
    p_investment_id: investmentId,
  });

  if (error) return handleRpcError(error);
  return jsonOk(data);
}

async function handleRequestApproval(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kind = typeof params.kind === "string" ? params.kind : "";
  const amount = Number(params.amount);
  const reason = typeof params.reason === "string" ? params.reason.trim() : "";
  if (!kind || !amount || !reason) return jsonError("Missing required fields: kind, amount, reason", 400);
  if (!["WITHDRAWAL", "DEPOSIT"].includes(kind)) return jsonError(`Invalid kind "${kind}"`, 400);
  const kid = await getKid(admin, params.code, requestId);

  if (kind === "WITHDRAWAL") {
    const { error } = await admin.rpc("kid_request_withdrawal", {
      p_kid_id: kid.id,
      p_amount: amount,
      p_reason: reason,
    });
    if (error) return handleRpcError(error);
  } else {
    const { error } = await admin.from("approvals").insert({ kid_id: kid.id, kind, amount, reason });
    if (error) return jsonError(`Failed to create approval: ${error.message}`, 500);
  }

  const actionWord = kind === "DEPOSIT" ? "deposit" : "withdrawal";
  await notifyParent(
    admin,
    kid.parent_id as string,
    kid.id as string,
    kind,
    `${kid.name} asked for a ${actionWord} of RM${amount.toFixed(2)}: ${reason}`,
  );
  return jsonOk({ ok: true });
}

async function handleRequestLoan(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const amount = Number(params.amount);
  const reason = typeof params.reason === "string" ? params.reason.trim() : "";
  const signature = typeof params.signature === "string" ? params.signature : "";
  const dueDays = Number(params.dueDays) || 14;
  if (params.amount === undefined || params.amount === null || !reason || !signature) {
    return jsonError("Missing required fields: amount, reason, signature", 400);
  }
  if (typeof amount !== "number" || isNaN(amount) || amount < 10 || amount > 500) {
    return jsonError("Loan amount must be between RM10.00 and RM500.00", 400);
  }
  const kid = await getKid(admin, params.code, requestId);
  const { error } = await admin.from("approvals").insert({
    kid_id: kid.id, kind: "QARD", amount,
    reason: `${reason} (due ${dueDays}d) :: SIG::${signature}`,
  });
  if (error) return jsonError(`Failed to create loan request: ${error.message}`, 500);
  await notifyParent(admin, kid.parent_id as string, kid.id as string, "QARD",
    `${kid.name} requested a Qard loan of RM${amount}`);
  return jsonOk({ ok: true });
}

async function handleRequestReward(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const name = typeof params.name === "string" ? params.name.trim() : "";
  const cost = Number(params.cost);
  if (!name || !cost || cost < 1) return jsonError("Missing required fields: name, cost", 400);
  const kid = await getKid(admin, params.code, requestId);
  if (cost > Number(kid.coins)) return jsonError(`Not enough coins (have ${kid.coins}, need ${cost})`, 400);
  const { error } = await admin.from("rewards").insert({ kid_id: kid.id, name, cost, status: "requested" });
  if (error) return jsonError(`Failed to create reward request: ${error.message}`, 500);
  await notifyParent(admin, kid.parent_id as string, kid.id as string, "REWARD",
    `${kid.name} wants "${name}" (${cost} 🪙)`);
  return jsonOk({ ok: true });
}

async function handleLoanRepay(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const loanId = typeof params.loanId === "string" ? params.loanId : "";
  const amount = Number(params.amount);
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_repay_loan", {
    p_kid_id: kid.id,
    p_loan_id: loanId,
    p_amount: amount,
  });
  if (error) return handleRpcError(error);
  return jsonOk({
    ok: true,
    paid: Number(data?.paid ?? amount),
    fullyRepaid: Boolean(data?.fullyRepaid),
    trustDelta: Number(data?.trustDelta ?? 0),
  });
}

async function handleSadaqah(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const amount = Number(params.amount);
  const cause = typeof params.cause === "string" ? params.cause.trim() : null;
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_give_sadaqah", {
    p_kid_id: kid.id,
    p_amount: amount,
    p_cause: cause || null,
  });
  if (error) return handleRpcError(error);
  return jsonOk({ ok: true, ...(data ?? {}) });
}

async function handleMarkNotificationsRead(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const { error } = await admin
    .from("kid_notifications")
    .update({ read: true })
    .eq("kid_id", kid.id)
    .eq("read", false);

  if (error) {
    console.error(`[kid-finance][${requestId}] mark-notifications-read failed: ${error.message}`);
    return jsonError(`Failed to mark notifications read: ${error.message}`, 500);
  }

  return jsonOk({ ok: true });
}

async function handleContributeGoal(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const goalId = typeof params.goalId === "string" ? params.goalId : "";
  const amount = Number(params.amount);
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_contribute_goal", {
    p_kid_id: kid.id,
    p_goal_id: goalId,
    p_amount: amount,
  });
  if (error) return handleRpcError(error);
  return jsonOk({
    ok: true,
    added: Number(data?.added ?? amount),
    saved: Number(data?.saved ?? 0),
  });
}

async function handleCreateGoal(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const name = typeof params.name === "string" ? params.name : "";
  const emoji = typeof params.emoji === "string" ? params.emoji : "🎯";
  const target = Number(params.target);
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_create_goal", {
    p_kid_id: kid.id,
    p_name: name,
    p_emoji: emoji,
    p_target: target,
  });
  if (error) return handleRpcError(error);
  return jsonOk({ ok: true, goalId: data });
}

async function handleUpdateGoal(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const goalId = typeof params.goalId === "string" ? params.goalId : "";
  const name = typeof params.name === "string" ? params.name : "";
  const emoji = typeof params.emoji === "string" ? params.emoji : "🎯";
  const target = Number(params.target);
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_update_goal", {
    p_kid_id: kid.id,
    p_goal_id: goalId,
    p_name: name,
    p_emoji: emoji,
    p_target: target,
  });
  if (error) return handleRpcError(error);
  return jsonOk({ ok: true, ...(data ?? {}) });
}

async function handleDeleteGoal(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const goalId = typeof params.goalId === "string" ? params.goalId : "";
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_delete_goal", {
    p_kid_id: kid.id,
    p_goal_id: goalId,
  });
  if (error) return handleRpcError(error);
  return jsonOk({ ok: true, ...(data ?? {}) });
}

async function handleSetCardControls(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  if (params.frozen !== undefined && typeof params.frozen !== "boolean") {
    return jsonError("Field 'frozen' must be a boolean", 400);
  }
  if (params.dailyLimit !== undefined && typeof params.dailyLimit !== "number") {
    return jsonError("Field 'dailyLimit' must be a number", 400);
  }
  if (params.onlineEnabled !== undefined && typeof params.onlineEnabled !== "boolean") {
    return jsonError("Field 'onlineEnabled' must be a boolean", 400);
  }

  const { data, error } = await admin.rpc("kid_set_card_controls", {
    p_kid_id: kid.id,
    p_frozen: params.frozen !== undefined ? params.frozen : null,
    p_daily_limit: params.dailyLimit !== undefined ? params.dailyLimit : null,
    p_online_enabled: params.onlineEnabled !== undefined ? params.onlineEnabled : null,
  });
  if (error) return handleRpcError(error);
  return jsonOk(data);
}

async function handleUpdateProfile(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const updates: Record<string, unknown> = {};

  const check = validateBirthdayUpdate(kid as any, params);
  if (!check.allowed) {
    return jsonError(check.error || "Invalid birthday", 400);
  }
  if (check.updates && Object.keys(check.updates).length > 0) {
    Object.assign(updates, check.updates);
  }

  if (params.bio !== undefined) updates.bio = typeof params.bio === "string" ? params.bio.slice(0, 150) : null;
  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from("kids").update(updates).eq("id", kid.id);
    if (error) return jsonError(`Failed to update profile: ${error.message}`, 500);
  }
  return jsonOk({ ok: true });
}

async function handleUploadAvatar(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const base64Image = typeof params.base64Image === "string" ? params.base64Image : "";
  if (!base64Image) return jsonError("Missing base64Image", 400);
  const kid = await getKid(admin, params.code, requestId);
  const matches = base64Image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return jsonError("Invalid base64 image format", 400);
  const contentType = matches[1];
  const base64Data = matches[2];
  let bytes: Uint8Array;
  try {
    const binaryString = atob(base64Data);
    bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  } catch (e) { return jsonError("Failed to decode base64 image", 400, e); }
  const path = `${kid.id}-${Date.now()}.webp`;
  const { error: uploadError } = await admin.storage.from("avatars").upload(path, bytes, { contentType, upsert: true });
  if (uploadError) return jsonError(`Storage upload failed: ${uploadError.message}`, 500);
  const { data: publicUrlData } = admin.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = publicUrlData?.publicUrl;
  if (!avatarUrl) return jsonError("Failed to get public URL after upload", 500);
  const { error: updateErr } = await admin.from("kids").update({ avatar: avatarUrl }).eq("id", kid.id);
  if (updateErr) return jsonError(`Failed to save avatar URL: ${updateErr.message}`, 500);
  console.log(`[kid-finance][${requestId}] handleUploadAvatar success url=${avatarUrl}`);
  return jsonOk({ avatarUrl });
}

async function handlePennyChat(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);

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

  // 2. Fetch context data
  // keep in sync with tests/sql/penny-context-columns.test.mjs
  const cutoff = new Date(Date.now() - 35 * 86400 * 1000).toISOString();
  const [ageGroupRes, goalsRes, loansRes, txsRes, completionsRes, questBoardRes, invsInfo] = await Promise.all([
    admin.rpc("kid_age_group", { p_kid_id: kid.id }),
    admin.from("goals").select("name, target, saved").eq("kid_id", kid.id).limit(10),
    admin.from("loans").select("amount, repaid, status, due_date").eq("kid_id", kid.id).limit(5),
    admin.from("transactions").select("type, amount, label, created_at").eq("kid_id", kid.id).gte("created_at", cutoff).order("created_at", { ascending: false }).limit(300),
    admin.from("quest_completions").select("completed_at, quests(title)").eq("kid_id", kid.id).order("completed_at", { ascending: false }).limit(5),
    admin.rpc("kid_quest_board", { p_kid_id: kid.id }),
    currentInvestmentValues(admin, kid.id),
  ]);

  const ageGroup = (ageGroupRes.data as string) || "10-12";

  const goals = (goalsRes.data ?? []).map((g: any) => ({
    name: String(g.name || "Goal"),
    target: Number(g.target) || 0,
    saved: Number(g.saved) || 0,
  }));

  const loans = (loansRes.data ?? []).map((l: any) => ({
    amount: Number(l.amount) || 0,
    repaid: Number(l.repaid) || 0,
    status: String(l.status || "active"),
  }));

  const txs = (txsRes.data ?? []).map((t: any) => ({
    type: String(t.type || ""),
    amount: Number(t.amount) || 0,
    label: String(t.label || ""),
    created_at: String(t.created_at || ""),
  }));

  const questCompletions = (completionsRes.data ?? []).map((c: any) => ({
    title: String(c.quests?.title || "Quest"),
    completedAt: String(c.completed_at || "").slice(0, 10),
  }));

  const { count: questsCompletedCount } = await admin
    .from("quest_completions")
    .select("quest_id", { count: "exact", head: true })
    .eq("kid_id", kid.id);

  let nextQuestTitle: string | null = null;
  if (Array.isArray(questBoardRes.data)) {
    const nextOpen = questBoardRes.data.find((q: any) => q.status === "open");
    if (nextOpen?.title) nextQuestTitle = String(nextOpen.title);
  }

  // Privacy: comfort_name only
  const pennyName = typeof kid.comfort_name === "string" && kid.comfort_name.trim() !== ""
    ? kid.comfort_name.trim()
    : undefined;

  const kidCoachInput = {
    ageGroup,
    name: pennyName,
    balance: Number(kid.balance) || 0,
    investBalance: invsInfo.totalValue,
    investmentsValue: invsInfo.totalValue,
    investments: invsInfo.investments,
    coins: Number(kid.coins) || 0,
    streakDays: Number(kid.streak) || 0,
    goals,
    loans,
    transactions: txs,
    questCompletions,
    questsCompletedCount: questsCompletedCount ?? 0,
    nextQuestTitle,
  };

  const isThinking = params.thinking !== false;
  const contextLines = buildKidCoachContext(kidCoachInput);
  const system = `${kidSystemPrompt(ageGroup)}\n\nChild's data:\n${contextLines.join("\n")}`;

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

  // 3. Consume quota atomically in DB
  const { data: remaining, error: quotaErr } = await admin.rpc("kid_consume_penny_quota", {
    p_kid_id: kid.id,
    p_limit: dailyLimit,
  });
  if (quotaErr) {
    return handleRpcError(quotaErr);
  }

  console.log(`[kid-finance][${requestId}] handlePennyChat kidId=${kid.id} ageGroup=${ageGroup} model=${requestParams.model} thinking=${isThinking}`);

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

// ---------------------------------------------------------------------------
// Family Transfer Handlers
// ---------------------------------------------------------------------------


async function resolveParentInfo(admin: Admin, parentId: string): Promise<{ id: string; name: string; avatar: string }> {
  let comfortName: string | null = null;
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(parentId);
    if (authUser?.user?.user_metadata?.comfort_name) {
      comfortName = String(authUser.user.user_metadata.comfort_name).trim();
    }
  } catch (_e) {}

  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name, avatar")
    .eq("id", parentId)
    .maybeSingle();

  const name = comfortName || profile?.display_name || "Parent";
  const avatar = profile?.avatar || "👨‍👩‍👧";
  return { id: parentId, name, avatar };
}

export async function handleUnlock(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const pinCheck = await checkKidPin(admin, kid, params.pin);
  if (!pinCheck.ok) {
    return jsonError(pinCheck.error || "PIN verification failed", pinCheck.status || 400);
  }
  console.log(`[kid-finance][${requestId}] handleUnlock kid=${kid.id}`);
  return jsonOk({ ok: true });
}

async function handleTransferRecipients(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);

  const { data: siblings, error: sibErr } = await admin
    .from("kids")
    .select("id, name, comfort_name, avatar")
    .eq("parent_id", kid.parent_id)
    .neq("id", kid.id)
    .order("name");

  if (sibErr) return jsonError(`DB error: ${sibErr.message}`, 500);

  const parent = kid.parent_id ? await resolveParentInfo(admin, kid.parent_id as string) : null;

  const { data: usedToday, error: usedErr } = await admin.rpc("kid_transfer_out_today", {
    p_kid_id: kid.id,
  });

  if (usedErr) return jsonError(`DB error: ${usedErr.message}`, 500);

  console.log(`[kid-finance][${requestId}] handleTransferRecipients kid=${kid.id} siblings=${siblings?.length ?? 0}`);

  return jsonOk({
    siblings: siblings ?? [],
    parent,
    balance: Number(kid.balance || 0),
    dailyLimit: 50,
    usedToday: Number(usedToday || 0),
  });
}

async function handleTransfer(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);

  const pinCheck = await checkKidPin(admin, kid, params.pin);
  if (!pinCheck.ok) {
    return jsonError(pinCheck.error || "PIN verification failed", pinCheck.status || 403);
  }

  const recipientKind = typeof params.recipientKind === "string" ? params.recipientKind : "";
  const recipientId = typeof params.recipientId === "string" ? params.recipientId : "";
  const amount = Number(params.amount);
  const note = typeof params.note === "string" ? params.note.trim() : null;

  if (isNaN(amount) || amount < 1.00) {
    return jsonError("Invalid amount", 400);
  }

  console.log(`[kid-finance][${requestId}] handleTransfer kid=${kid.id} kind=${recipientKind} recipient=${recipientId} amount=${amount}`);

  if (recipientKind === "kid") {
    if (!recipientId) return jsonError("Missing recipient ID", 400);
    const { data, error } = await admin.rpc("kid_send_to_sibling", {
      p_kid_id: kid.id,
      p_to_kid_id: recipientId,
      p_amount: amount,
      p_note: note,
    });
    if (error) return handleRpcError(error);
    return jsonOk({ ok: true, balance: data?.balance, status: "completed" });
  } else if (recipientKind === "parent") {
    if (recipientId && recipientId !== kid.parent_id) {
      return jsonError("You can only send money to your family.", 400);
    }
    const parentInfo = await resolveParentInfo(admin, kid.parent_id as string);
    const { data, error } = await admin.rpc("kid_send_to_parent", {
      p_kid_id: kid.id,
      p_amount: amount,
      p_note: note,
      p_parent_label: parentInfo.name,
    });
    if (error) return handleRpcError(error);
    return jsonOk({ ok: true, balance: data?.balance, status: "completed" });
  } else {
    return jsonError("Invalid recipient type", 400);
  }
}
