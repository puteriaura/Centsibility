// supabase/functions/kid-finance/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import bcrypt from "npm:bcryptjs";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";
import {
  buildPennyRequest,
  createClient as createDeepSeekClient,
  extractReplyText,
  DEFAULT_PENNY_DAILY_LIMIT,
  DEFAULT_PENNY_MAX_TOKENS,
  MAX_MESSAGE_CHARS,
  PennyChatMessage,
} from "../_shared/deepseek.ts";

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
  invalid_type: ["Invalid type", 400],
  invalid_limit: ["Invalid limit", 400],
  missing_loan_terms: ["Loan terms missing", 400],
  unknown_kind: ["Unknown request type", 400],
  loan_closed: ["This loan is already repaid", 400],
  goal_complete: ["This goal is already complete", 400],
  invalid_goal: [
    "Check the goal name (1–40 characters) and target (RM1–RM100,000). Up to 10 goals.",
    400,
  ],
  card_frozen: ["Your card is frozen. Unfreeze it on the Card page to continue.", 403],
  card_limit_exceeded: ["That is over your daily card limit.", 403],
  card_locked: ["Your parent manages these card settings. You can still make them stricter.", 403],
  quota_exceeded: ["Penny needs a rest. Try again tomorrow.", 429],
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
const PRE_AUTH_ACTIONS = new Set(["login", "login-by-code", "register"]);

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

    if (gateErr && gateErr.code !== "42703") {
      return jsonError(`Auth check failed: ${gateErr.message}`, 500);
    }

    if (!exists) {
      if (gateErr?.code === "42703") {
        const { data: fallback } = await admin
          .from("kids").select("id").eq("login_code", token).maybeSingle();
        if (!fallback) {
          console.warn(`[kid-finance][${requestId}] Rejected action="${action}": invalid token`);
          return jsonError("Unauthorized: invalid or expired session", 401);
        }
      } else {
        console.warn(`[kid-finance][${requestId}] Rejected action="${action}": invalid token`);
        return jsonError("Unauthorized: invalid or expired session", 401);
      }
    }
  }

  try {
    switch (action) {
      case "login":            return await handleLogin(admin, params, requestId);
      case "login-by-code":    return await handleLoginByCode(admin, params, requestId);
      case "register":         return await handleRegister(admin, params, requestId);
      case "get-state":        return await handleGetState(admin, params, requestId);
      case "sadaqah":          return await handleSadaqah(admin, params, requestId);
      case "loan-repay":       return await handleLoanRepay(admin, params, requestId);
      case "invest-settle":    return await handleInvestSettle(admin, params, requestId);
      case "create-goal":      return await handleCreateGoal(admin, params, requestId);
      case "update-goal":      return await handleUpdateGoal(admin, params, requestId);
      case "delete-goal":      return await handleDeleteGoal(admin, params, requestId);
      case "contribute-goal":  return await handleContributeGoal(admin, params, requestId);
      case "claim-coins":      return await handleClaimCoins(admin, params, requestId);
      case "quiz-state":       return await handleQuizState(admin, params, requestId);
      case "quiz-answer":      return await handleQuizAnswer(admin, params, requestId);
      case "invest-deposit":   return await handleInvestDeposit(admin, params, requestId);
      case "invest-withdraw":  return await handleInvestWithdraw(admin, params, requestId);
      case "set-invest-risk":  return await handleSetInvestRisk(admin, params, requestId);
      case "set-invest-frequency": return await handleSetInvestFrequency(admin, params, requestId);
      case "request-approval": return await handleRequestApproval(admin, params, requestId);
      case "request-loan":     return await handleRequestLoan(admin, params, requestId);
      case "request-reward":   return await handleRequestReward(admin, params, requestId);
      case "set-card-controls": return await handleSetCardControls(admin, params, requestId);
      case "update-profile":   return await handleUpdateProfile(admin, params, requestId);
      case "upload-avatar":    return await handleUploadAvatar(admin, params, requestId);
      case "penny-chat":       return await handlePennyChat(admin, params, requestId);
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
    if (error.code === "42703") {
      const { data: fallback, error: fbErr } = await admin
        .from("kids").select("*").eq("login_code", token).maybeSingle();
      if (fbErr) throw new Error(`DB error: ${fbErr.message}`);
      if (!fallback) throw new Error("Invalid or expired session");
      return fallback;
    }
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

async function normalizeQuizState(admin: Admin, kid: Record<string, unknown>, requestId: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (kid.quiz_date !== today) {
    const { error } = await admin.from("kids").update({ quiz_date: today, quiz_correct: 0, quiz_wrong: 0 }).eq("id", kid.id);
    if (error) console.warn(`[kid-finance][${requestId}] normalizeQuizState failed: ${error.message}`);
    return { ...kid, quiz_date: today, quiz_correct: 0, quiz_wrong: 0 };
  }
  return kid;
}

const QUIZ_QUESTION_COUNT = 200;

// ---------------------------------------------------------------------------
// Auth handlers (pre-auth)
// ---------------------------------------------------------------------------

async function handleLogin(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const username = typeof params.username === "string" ? params.username.trim() : "";
  const pin = typeof params.pin === "string" ? params.pin.trim() : "";
  if (!username || !pin) return jsonError("Missing username or PIN", 400);
  console.log(`[kid-finance][${requestId}] handleLogin username="${username}"`);

  const { data: kid, error: kidErr } = await admin.from("kids").select("*").eq("username", username).maybeSingle();
  if (kidErr) return jsonError(`DB error: ${kidErr.message}`, 500);
  if (!kid) return jsonError("Invalid username or PIN", 400);

  if (kid.locked_until && new Date() < new Date(kid.locked_until)) {
    const mins = Math.ceil((new Date(kid.locked_until).getTime() - Date.now()) / 60000);
    return jsonError(`Account locked. Try again in ${mins} minutes.`, 403);
  }

  let isValid = false;
  try {
    isValid = await bcrypt.compare(pin, kid.hashed_pin || "");
  } catch (e) {
    return jsonError("PIN verification failed", 500, e);
  }

  if (!isValid) {
    const attempts = (Number(kid.failed_login_attempts) || 0) + 1;
    const locked_until = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await admin.from("kids").update({ failed_login_attempts: attempts, locked_until }).eq("id", kid.id);
    return jsonError("Invalid username or PIN", 400);
  }

  if ((kid.failed_login_attempts && kid.failed_login_attempts > 0) || kid.locked_until) {
    await admin.from("kids").update({ failed_login_attempts: 0, locked_until: null }).eq("id", kid.id);
  }

  const sessionToken = randomHex(32);
  await admin.from("kids").update({ session_token: sessionToken }).eq("id", kid.id);
  console.log(`[kid-finance][${requestId}] handleLogin success kid id=${kid.id}`);
  return jsonOk({ kidId: kid.id, name: kid.name, code: sessionToken });
}

async function handleLoginByCode(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const loginCode = typeof params.loginCode === "string" ? params.loginCode.trim().toUpperCase() : "";
  if (!loginCode) return jsonError("Missing loginCode", 400);
  console.log(`[kid-finance][${requestId}] handleLoginByCode code="${loginCode}"`);

  const { data: kid, error: kidErr } = await admin.from("kids").select("*").eq("login_code", loginCode).maybeSingle();
  if (kidErr) return jsonError(`DB error: ${kidErr.message}`, 500);
  if (!kid) return jsonError("Invalid login code. Please check and try again.", 400);

  let sessionToken = kid.login_code as string;
  try {
    sessionToken = randomHex(32);
    const { error } = await admin.from("kids").update({ session_token: sessionToken }).eq("id", kid.id);
    if (error) { sessionToken = kid.login_code; }
  } catch { sessionToken = kid.login_code; }

  console.log(`[kid-finance][${requestId}] handleLoginByCode success kid id=${kid.id}`);
  return jsonOk({ kidId: kid.id, name: kid.name, code: sessionToken });
}

async function handleRegister(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const setupCode = typeof params.setupCode === "string" ? params.setupCode.trim() : "";
  const name = typeof params.name === "string" ? params.name.trim() : "";
  const username = typeof params.username === "string" ? params.username.trim() : "";
  const pin = typeof params.pin === "string" ? params.pin : "";
  if (!setupCode || !name || !username || !pin) return jsonError("Missing required fields: setupCode, name, username, pin", 400);
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
  await admin.from("goals").insert({ kid_id: kid.id, name: "First Goal", emoji: "🎯", target: 100 });

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

  const [goalsRes, txsRes, rewardsRes, loansRes, approvalsRes, attemptsRes, parentRes] = await Promise.all([
    admin.from("goals").select("*").eq("kid_id", kid.id).order("created_at"),
    admin.from("transactions").select("*").eq("kid_id", kid.id).order("created_at", { ascending: false }).limit(100),
    admin.from("rewards").select("*").eq("kid_id", kid.id).order("created_at", { ascending: false }),
    admin.from("loans").select("*").eq("kid_id", kid.id).order("created_at", { ascending: false }),
    admin.from("approvals").select("*").eq("kid_id", kid.id).order("created_at", { ascending: false }).limit(20),
    admin.from("quiz_attempts").select("*").eq("kid_id", kid.id).order("created_at", { ascending: false }).limit(50),
    admin.from("profiles").select("display_name, email").eq("id", kid.parent_id as string).maybeSingle(),
  ]);

  return jsonOk({
    kid,
    goals: goalsRes.data ?? [],
    txs: txsRes.data ?? [],
    rewards: rewardsRes.data ?? [],
    loans: loansRes.data ?? [],
    approvals: approvalsRes.data ?? [],
    attempts: attemptsRes.data ?? [],
    parent: parentRes.data ?? null,
  });
}

async function handleClaimCoins(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_claim_coins", {
    p_kid_id: kid.id,
  });
  if (error) return handleRpcError(error);
  return jsonOk({ claimed: Number(data ?? 0) });
}

async function handleQuizState(admin: Admin, params: Record<string, unknown>, requestId: string) {
  let kid = await getKid(admin, params.code, requestId);
  kid = await normalizeQuizState(admin, kid, requestId);
  return jsonOk({
    date: kid.quiz_date,
    correct: Number(kid.quiz_correct) || 0,
    wrong: Number(kid.quiz_wrong) || 0,
    index: Number(kid.quiz_index) || 0,
    maxPerDay: 5,
    maxWrong: 2,
  });
}

async function handleQuizAnswer(admin: Admin, params: Record<string, unknown>, requestId: string) {
  if (typeof params.correct !== "boolean") return jsonError("Field 'correct' must be boolean", 400);
  let kid = await getKid(admin, params.code, requestId);
  kid = await normalizeQuizState(admin, kid, requestId);

  const qd = kid.quiz_date as string;
  let qc = Number(kid.quiz_correct) || 0;
  let qw = Number(kid.quiz_wrong) || 0;
  let qi = Number(kid.quiz_index) || 0;

  const { error: attemptErr } = await admin.from("quiz_attempts").insert({
    kid_id: kid.id, question_index: qi,
    question_text: `Question #${qi + 1}`,
    correct: params.correct,
  });
  if (attemptErr) console.warn(`[kid-finance][${requestId}] quiz_attempts insert failed: ${attemptErr.message}`);

  if (params.correct) qc += 1; else qw += 1;
  qi = (qi + 1) % QUIZ_QUESTION_COUNT;

  let coins = Number(kid.coins) || 0;
  let xp = Number(kid.xp) || 0;
  let level = Number(kid.level) || 1;
  if (params.correct) {
    coins += 100; xp += 5;
    while (xp >= 100) { xp -= 100; level += 1; }
  }

  let cycled = false;
  if (qw >= 2) { qc = 0; qw = 0; cycled = true; }

  const { error } = await admin.from("kids").update({
    quiz_date: qd, quiz_correct: qc, quiz_wrong: qw, quiz_index: qi, coins, xp, level,
    // Increment lifetime total — also handled by DB trigger, this is a safety net
    ...(params.correct ? { quiz_total_correct: (Number(kid.quiz_total_correct) || 0) + 1 } : {}),
  }).eq("id", kid.id);
  if (error) return jsonError(`Failed to save quiz result: ${error.message}`, 500);

  return jsonOk({ correct: qc, wrong: qw, index: qi, cycled, doneForToday: false });
}

async function handleInvestDeposit(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const amount = Number(params.amount);
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_invest_transfer", {
    p_kid_id: kid.id,
    p_direction: "IN",
    p_amount: amount,
  });
  if (error) return handleRpcError(error);
  return jsonOk({ ok: true, ...(data ?? {}) });
}

async function handleInvestWithdraw(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const amount = Number(params.amount);
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_invest_transfer", {
    p_kid_id: kid.id,
    p_direction: "OUT",
    p_amount: amount,
  });
  if (error) return handleRpcError(error);
  return jsonOk({ ok: true, ...(data ?? {}) });
}

async function handleSetInvestRisk(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const riskAppetite = typeof params.riskAppetite === "string" ? params.riskAppetite : "";
  const rateMap: Record<string, number> = { very_low: 0.0005, low: 0.001, medium: 0.002, high: 0.003, very_high: 0.004 };
  if (!rateMap[riskAppetite]) return jsonError(`Invalid riskAppetite "${riskAppetite}"`, 400);
  const kid = await getKid(admin, params.code, requestId);
  const { error } = await admin.from("kids").update({ risk_appetite: riskAppetite, invest_rate: rateMap[riskAppetite] }).eq("id", kid.id);
  if (error) return jsonError(`Failed to set risk: ${error.message}`, 500);
  return jsonOk({ ok: true });
}

async function handleSetInvestFrequency(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const frequency = typeof params.frequency === "string" ? params.frequency : "";
  const valid = ["minute", "hourly", "daily", "weekly", "monthly"];
  if (!valid.includes(frequency)) return jsonError(`Invalid frequency "${frequency}"`, 400);
  const kid = await getKid(admin, params.code, requestId);
  const { error } = await admin.from("kids").update({ invest_frequency: frequency }).eq("id", kid.id);
  if (error) return jsonError(`Failed to set frequency: ${error.message}`, 500);
  return jsonOk({ ok: true });
}

async function handleInvestSettle(admin: Admin, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_invest_settle", {
    p_kid_id: kid.id,
  });
  if (error) return handleRpcError(error);
  const paid = typeof data?.paid === "number" ? data.paid : Number(data?.paid ?? 0);
  return jsonOk({ paid });
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

  await notifyParent(admin, kid.parent_id as string, kid.id as string, kind,
    `${kid.name} requested ${kind.toLowerCase()} of RM${amount} (${reason})`);
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
  const kid = await getKid(admin, params.code, requestId);
  const { data, error } = await admin.rpc("kid_give_sadaqah", {
    p_kid_id: kid.id,
    p_amount: amount,
  });
  if (error) return handleRpcError(error);
  return jsonOk({ ok: true, ...(data ?? {}) });
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
  if (params.birth_date !== undefined) updates.birth_date = params.birth_date ?? null;
  if (params.birth_year !== undefined) updates.birth_year = params.birth_year ? Number(params.birth_year) : null;
  if (params.bio !== undefined) updates.bio = typeof params.bio === "string" ? params.bio.slice(0, 150) : null;
  const { error } = await admin.from("kids").update(updates).eq("id", kid.id);
  if (error) return jsonError(`Failed to update profile: ${error.message}`, 500);
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

  // Fetch kid goals for context (if any)
  const { data: goals } = await admin
    .from("goals")
    .select("name")
    .eq("kid_id", kid.id)
    .limit(5);

  const kidContext = {
    balance: typeof kid.balance === "number" ? kid.balance : Number(kid.balance) || 0,
    goalNames: goals?.map((g: { name: string }) => g.name) ?? [],
  };

  const isThinking = params.thinking !== false;

  // 1. Validate and build the request first (do not burn quota if invalid)
  let requestParams;
  try {
    requestParams = buildPennyRequest({
      model: typeof params.model === "string" ? params.model : undefined,
      thinking: isThinking,
      history: rawHistory,
      message,
      kidContext,
      maxTokens: configuredMaxTokens,
      allowPro,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 400);
  }

  // 2. Check API key (503 if not set up; do not burn quota)
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey || apiKey.trim() === "") {
    return jsonError("Penny AI is not set up yet", 503);
  }

  // 3. Consume quota atomically in DB
  const { data: remaining, error: quotaErr } = await admin.rpc("kid_consume_penny_quota", {
    p_kid_id: kid.id,
    p_limit: dailyLimit,
  });
  if (quotaErr) {
    return handleRpcError(quotaErr);
  }

  console.log(`[kid-finance][${requestId}] handlePennyChat kidId=${kid.id} model=${requestParams.model} thinking=${isThinking}`);

  // 4. Call DeepSeek
  let response;
  try {
    const client = createDeepSeekClient(apiKey);
    response = await client.messages.create(
      requestParams as unknown as Parameters<typeof client.messages.create>[0],
      { timeout: 30000 }
    );
  } catch (err: unknown) {
    const errObj = err as { status?: number; name?: string; message?: string };
    if (errObj?.status === 401) {
      console.error(`[kid-finance][${requestId}] Penny AI is misconfigured (401 from provider)`);
      return jsonError("Penny AI is misconfigured", 502);
    }
    if (errObj?.status === 429) {
      console.warn(`[kid-finance][${requestId}] Penny AI rate limited (429 from provider)`);
      return jsonError("Penny is busy, try again soon", 503);
    }
    if (
      errObj?.name === "AbortError" ||
      errObj?.name === "APIConnectionTimeoutError" ||
      errObj?.message?.toLowerCase().includes("timeout")
    ) {
      console.warn(`[kid-finance][${requestId}] Penny AI request timed out`);
      return jsonError("Penny timed out, try again soon", 504);
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[kid-finance][${requestId}] DeepSeek call failed:`, msg);
    return jsonError("Penny AI service error", 500);
  }

  // 5. Extract reply and ensure non-empty
  const reply = extractReplyText(response as { content?: Array<{ type: string; text?: string }> });
  if (!reply || reply.trim() === "") {
    return jsonError("Penny couldn't finish that answer", 502);
  }

  return jsonOk({
    reply,
    model: requestParams.model,
    thinking: isThinking,
    remaining: typeof remaining === "number" ? remaining : 0,
  });
}