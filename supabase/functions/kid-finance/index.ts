// supabase/functions/kid-finance/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import bcrypt from "npm:bcryptjs";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

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

  console.log(`[kid-finance][${requestId}] action="${action ?? "MISSING"}"`, 
    JSON.stringify(logBody).slice(0, 300));

  if (!action) return jsonError('Missing required field: "action"', 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);
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
      case "update-profile":   return await handleUpdateProfile(admin, params, requestId);
      case "upload-avatar":    return await handleUploadAvatar(admin, params, requestId);
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

async function getKid(admin: ReturnType<typeof createClient>, token: unknown, requestId: string) {
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
  admin: ReturnType<typeof createClient>,
  parentId: string, kidId: string, kind: string, message: string, link?: string,
) {
  const resolvedLink = link ?? (["WITHDRAWAL","DEPOSIT","QARD","REWARD"].includes(kind) ? "/parent/approvals" : "/parent");
  const { error } = await admin.from("notifications").insert({ parent_id: parentId, kid_id: kidId, kind, message, link: resolvedLink });
  if (error) console.warn(`[kid-finance] notifyParent failed (non-fatal): ${error.message}`);
}

async function normalizeQuizState(admin: ReturnType<typeof createClient>, kid: Record<string, unknown>, requestId: string) {
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

async function handleLogin(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
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

async function handleLoginByCode(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
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

async function handleRegister(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
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

async function handleGetState(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
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

async function handleClaimCoins(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const unclaimed = Number(kid.unclaimed_coins) || 0;
  if (unclaimed <= 0) return jsonOk({ claimed: 0 });
  const { error } = await admin.from("kids").update({
    coins: (Number(kid.coins) || 0) + unclaimed, unclaimed_coins: 0,
  }).eq("id", kid.id);
  if (error) return jsonError(`Failed to claim coins: ${error.message}`, 500);
  return jsonOk({ claimed: unclaimed });
}

async function handleQuizState(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
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

async function handleQuizAnswer(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
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

async function handleInvestDeposit(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
  const amount = Number(params.amount);
  if (!amount || amount < 0.5 || amount > 100000) return jsonError("Invalid amount", 400);
  const kid = await getKid(admin, params.code, requestId);
  if (amount > Number(kid.balance)) return jsonError(`Insufficient balance (have ${kid.balance})`, 400);
  const { error } = await admin.from("kids").update({
    balance: Number(kid.balance) - amount,
    invest_balance: (Number(kid.invest_balance) || 0) + amount,
  }).eq("id", kid.id);
  if (error) return jsonError(`Failed to update balances: ${error.message}`, 500);
  await admin.from("transactions").insert({ kid_id: kid.id, type: "INVEST_IN", amount, label: "Invested" });
  return jsonOk({ ok: true });
}

async function handleInvestWithdraw(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
  const amount = Number(params.amount);
  if (!amount || amount < 0.5 || amount > 100000) return jsonError("Invalid amount", 400);
  const kid = await getKid(admin, params.code, requestId);
  const investBal = Number(kid.invest_balance) || 0;
  if (amount > investBal) return jsonError(`Insufficient invested balance (have ${investBal})`, 400);
  const { error } = await admin.from("kids").update({
    balance: Number(kid.balance) + amount,
    invest_balance: investBal - amount,
  }).eq("id", kid.id);
  if (error) return jsonError(`Failed to update balances: ${error.message}`, 500);
  await admin.from("transactions").insert({ kid_id: kid.id, type: "INVEST_OUT", amount, label: "Withdrew investment" });
  return jsonOk({ ok: true });
}

async function handleSetInvestRisk(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
  const riskAppetite = typeof params.riskAppetite === "string" ? params.riskAppetite : "";
  const rateMap: Record<string, number> = { very_low: 0.0005, low: 0.001, medium: 0.002, high: 0.003, very_high: 0.004 };
  if (!rateMap[riskAppetite]) return jsonError(`Invalid riskAppetite "${riskAppetite}"`, 400);
  const kid = await getKid(admin, params.code, requestId);
  const { error } = await admin.from("kids").update({ risk_appetite: riskAppetite, invest_rate: rateMap[riskAppetite] }).eq("id", kid.id);
  if (error) return jsonError(`Failed to set risk: ${error.message}`, 500);
  return jsonOk({ ok: true });
}

async function handleSetInvestFrequency(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
  const frequency = typeof params.frequency === "string" ? params.frequency : "";
  const valid = ["minute", "hourly", "daily", "weekly", "monthly"];
  if (!valid.includes(frequency)) return jsonError(`Invalid frequency "${frequency}"`, 400);
  const kid = await getKid(admin, params.code, requestId);
  const { error } = await admin.from("kids").update({ invest_frequency: frequency }).eq("id", kid.id);
  if (error) return jsonError(`Failed to set frequency: ${error.message}`, 500);
  return jsonOk({ ok: true });
}

function calculateInvestmentGrowth(principal: number, rate: number, weeks: number) {
  if (weeks <= 0 || principal <= 0 || rate <= 0) return { grown: principal, gain: 0 };
  let minReturn = 0, maxReturn = rate;
  if (rate === 0.001) { minReturn = -0.01; maxReturn = 0.03; }
  else if (rate === 0.002) { minReturn = -0.05; maxReturn = 0.08; }
  else if (rate === 0.003) { minReturn = -0.15; maxReturn = 0.2; }
  else if (rate === 0.004) { minReturn = -0.3; maxReturn = 0.5; }
  let grown = principal;
  for (let i = 0; i < weeks; i++) grown *= (1 + minReturn + Math.random() * (maxReturn - minReturn));
  grown = Math.max(0, Math.min(grown, principal * 2));
  return { grown, gain: grown - principal };
}

async function handleInvestSettle(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const last = kid.invest_last_paid ? new Date(kid.invest_last_paid as string) : null;
  if (!last) return jsonOk({ paid: 0 });
  const weeks = Math.floor((Date.now() - last.getTime()) / (7 * 86400 * 1000));
  if (weeks <= 0) return jsonOk({ paid: 0 });
  const rate = Number(kid.invest_rate) || 0;
  const principal = Number(kid.invest_balance) || 0;
  const newLast = new Date(last.getTime() + weeks * 7 * 86400 * 1000).toISOString();
  if (principal <= 0 || rate <= 0) {
    await admin.from("kids").update({ invest_last_paid: newLast }).eq("id", kid.id);
    return jsonOk({ paid: 0 });
  }
  const { grown, gain } = calculateInvestmentGrowth(principal, rate, weeks);
  const { error } = await admin.from("kids").update({ invest_balance: grown, invest_last_paid: newLast }).eq("id", kid.id);
  if (error) return jsonError(`Failed to settle investment: ${error.message}`, 500);
  if (Math.abs(gain) > 0.01) {
    await admin.from("transactions").insert({
      kid_id: kid.id, type: gain > 0 ? "HIBAH" : "INVEST_OUT",
      amount: Math.abs(gain), label: `Investment ${gain > 0 ? "growth" : "loss"} (${weeks}w)`,
    });
  }
  return jsonOk({ paid: gain });
}

async function handleRequestApproval(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
  const kind = typeof params.kind === "string" ? params.kind : "";
  const amount = Number(params.amount);
  const reason = typeof params.reason === "string" ? params.reason.trim() : "";
  if (!kind || !amount || !reason) return jsonError("Missing required fields: kind, amount, reason", 400);
  if (!["WITHDRAWAL", "DEPOSIT"].includes(kind)) return jsonError(`Invalid kind "${kind}"`, 400);
  const kid = await getKid(admin, params.code, requestId);
  const { error } = await admin.from("approvals").insert({ kid_id: kid.id, kind, amount, reason });
  if (error) return jsonError(`Failed to create approval: ${error.message}`, 500);
  await notifyParent(admin, kid.parent_id as string, kid.id as string, kind,
    `${kid.name} requested ${kind.toLowerCase()} of RM${amount} (${reason})`);
  return jsonOk({ ok: true });
}

async function handleRequestLoan(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
  const amount = Number(params.amount);
  const reason = typeof params.reason === "string" ? params.reason.trim() : "";
  const signature = typeof params.signature === "string" ? params.signature : "";
  const dueDays = Number(params.dueDays) || 14;
  if (!amount || amount < 1 || !reason || !signature) return jsonError("Missing required fields: amount, reason, signature", 400);
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

async function handleRequestReward(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
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

function calculateLoanRepayment(loanAmount: number, currentRepaid: number, paymentAmount: number) {
  const newRepaid = Math.min(loanAmount, currentRepaid + paymentAmount);
  const fullyRepaid = Math.abs(loanAmount - newRepaid) < 0.001;
  return { newRepaid, fullyRepaid };
}

async function handleLoanRepay(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
  const loanId = typeof params.loanId === "string" ? params.loanId : "";
  const amount = Number(params.amount);
  if (!loanId || !amount || amount < 0.5) return jsonError("Missing required fields: loanId, amount", 400);
  const kid = await getKid(admin, params.code, requestId);
  if (amount > Number(kid.balance)) return jsonError(`Insufficient balance (have ${kid.balance})`, 400);
  const { data: loan, error: loanErr } = await admin.from("loans").select("*").eq("id", loanId).eq("kid_id", kid.id).maybeSingle();
  if (loanErr) return jsonError(`DB error: ${loanErr.message}`, 500);
  if (!loan) return jsonError("Loan not found", 404);
  const { newRepaid, fullyRepaid } = calculateLoanRepayment(Number(loan.amount), Number(loan.repaid) || 0, amount);
  const onTime = new Date() <= new Date(loan.due_date as string);
  let trustDelta = 0;
  let status = loan.status;
  if (fullyRepaid) { status = "repaid"; trustDelta = onTime ? 25 : -50; }
  const { error: loanUpdateErr } = await admin.from("loans").update({ repaid: newRepaid, status }).eq("id", loan.id);
  if (loanUpdateErr) return jsonError(`Failed to update loan: ${loanUpdateErr.message}`, 500);
  const { error: balErr } = await admin.rpc("adjust_kid_balance", { p_kid_id: kid.id, p_delta: -amount });
  if (balErr) return jsonError(`Failed to adjust balance: ${balErr.message}`, 500);
  if (trustDelta !== 0) {
    const newTrust = Math.max(300, Math.min(900, (Number(kid.trust_score) || 500) + trustDelta));
    await admin.from("kids").update({ trust_score: newTrust }).eq("id", kid.id);
  }
  await admin.from("transactions").insert({ kid_id: kid.id, type: "QARD", amount, label: "Loan repayment" });
  return jsonOk({ ok: true, fullyRepaid, trustDelta });
}

async function handleSadaqah(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
  const amount = Number(params.amount);
  if (!amount || amount < 0.5 || amount > 10000) return jsonError("Invalid amount (min 0.50, max 10000)", 400);
  const kid = await getKid(admin, params.code, requestId);
  if (amount > Number(kid.balance)) return jsonError(`Insufficient balance (have ${kid.balance})`, 400);
  const { error: balErr } = await admin.rpc("adjust_kid_balance", { p_kid_id: kid.id, p_delta: -amount });
  if (balErr) return jsonError(`Failed to deduct balance: ${balErr.message}`, 500);
  const coinDelta = Math.floor(amount * 2);
  const { error: coinErr } = await admin.rpc("adjust_kid_coins", { p_kid_id: kid.id, p_delta: coinDelta });
  if (coinErr) console.warn(`[kid-finance] coin award failed (non-fatal): ${coinErr.message}`);
  await admin.from("transactions").insert({ kid_id: kid.id, type: "SADAQAH", amount, label: "Sadaqah given" });
  return jsonOk({ ok: true });
}

async function handleContributeGoal(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
  const goalId = typeof params.goalId === "string" ? params.goalId : "";
  const amount = Number(params.amount);
  if (!goalId || !amount || amount < 0.5 || amount > 10000) return jsonError("Missing or invalid fields: goalId, amount", 400);
  const kid = await getKid(admin, params.code, requestId);
  if (amount > Number(kid.balance)) return jsonError(`Insufficient balance (have ${kid.balance})`, 400);
  const { data: goal, error: goalErr } = await admin.from("goals").select("*").eq("id", goalId).eq("kid_id", kid.id).maybeSingle();
  if (goalErr) return jsonError(`DB error: ${goalErr.message}`, 500);
  if (!goal) return jsonError("Goal not found", 404);
  const newSaved = Math.min(Number(goal.target), (Number(goal.saved) || 0) + amount);
  const { error: goalUpdateErr } = await admin.from("goals").update({ saved: newSaved }).eq("id", goal.id);
  if (goalUpdateErr) return jsonError(`Failed to update goal: ${goalUpdateErr.message}`, 500);
  const { error: balErr } = await admin.rpc("adjust_kid_balance", { p_kid_id: kid.id, p_delta: -amount });
  if (balErr) return jsonError(`Failed to adjust balance: ${balErr.message}`, 500);
  await admin.from("transactions").insert({ kid_id: kid.id, type: "DEPOSIT", amount, label: `Saved to ${goal.name}` });
  return jsonOk({ ok: true });
}

async function handleUpdateProfile(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
  const kid = await getKid(admin, params.code, requestId);
  const updates: Record<string, unknown> = {};
  if (params.birth_date !== undefined) updates.birth_date = params.birth_date ?? null;
  if (params.birth_year !== undefined) updates.birth_year = params.birth_year ? Number(params.birth_year) : null;
  if (params.bio !== undefined) updates.bio = typeof params.bio === "string" ? params.bio.slice(0, 150) : null;
  const { error } = await admin.from("kids").update(updates).eq("id", kid.id);
  if (error) return jsonError(`Failed to update profile: ${error.message}`, 500);
  return jsonOk({ ok: true });
}

async function handleUploadAvatar(admin: ReturnType<typeof createClient>, params: Record<string, unknown>, requestId: string) {
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