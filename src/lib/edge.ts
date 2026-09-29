// Typed helpers for invoking Supabase Edge Functions.
// These replace the old client-side "server function" calls
// for financial operations that must run server-side.

import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isParentBypassed, isKidBypassed } from "@/lib/admin-bypass";
import { DEMO_IDENTITY, DEMO_KID_STATE } from "@/lib/demo-data";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

function getMockEdgeResponse<T>(functionName: string, body: Record<string, unknown>): T {
  const action = String(body.action || "");
  switch (action) {
    case "get-profile":
      return { id: "demo-parent-id", email: DEMO_IDENTITY.parentEmail } as T;
    case "get-pin":
      return { hasPin: false } as T;
    case "verify-pin":
      return { valid: true } as T;
    case "set-pin":
    case "clear-pin":
      return { ok: true } as T;
    case "login":
    case "login-by-code":
      return { kidId: DEMO_IDENTITY.kidId, name: "Aiman", code: DEMO_IDENTITY.kidCode } as T;
    case "get-state":
      return DEMO_KID_STATE as T;
    case "claim-coins":
      return { claimed: 10 } as T;
    case "deposit":
      return { newBalance: 150 } as T;
    case "create-kid":
      return { kid: { id: "demo-kid-" + Date.now(), name: body.name } } as T;
    case "get-statement":
      return {
        kid: { id: DEMO_IDENTITY.kidId, name: "Aiman", balance: 142.5 },
        transactions: [],
        period: { from: body.from, to: body.to },
      } as T;
    case "get-scheduled-hibahs":
      return { scheduledHibahs: [] } as T;
    case "quiz-state":
      return {
        date: new Date().toISOString().slice(0, 10),
        correct: 3,
        wrong: 0,
        index: 1,
        maxPerDay: 5,
        maxWrong: 2,
      } as T;
    case "quiz-answer":
      return {
        correct: 4,
        wrong: 0,
        index: 2,
        cycled: false,
        doneForToday: false,
      } as T;
    case "invest-settle":
      return { paid: 1.0 } as T;
    case "loan-repay":
      return { ok: true, paid: Number(body.amount) || 0, fullyRepaid: false, trustDelta: 0 } as T;
    case "contribute-goal":
      return { ok: true, added: Number(body.amount) || 0, saved: Number(body.amount) || 0 } as T;
    case "create-goal":
      return { ok: true, goalId: "demo-goal-" + Date.now() } as T;
    case "update-goal":
      return { ok: true, saved: Number(body.target) || 0, refunded: 0 } as T;
    case "delete-goal":
      return { ok: true, refunded: 0 } as T;
    case "set-card-controls":
      return {
        card_frozen: body.frozen ?? false,
        card_daily_limit: body.dailyLimit ?? 50,
        card_online_enabled: body.onlineEnabled ?? true,
      } as T;
    case "set-kid-card-controls":
      return {
        card_frozen: body.frozen ?? false,
        card_daily_limit: body.dailyLimit ?? 50,
        card_online_enabled: body.onlineEnabled ?? true,
        card_controls_locked: body.locked ?? false,
      } as T;
    case "penny-chat":
      return {
        reply: "Salam! I am Penny, your Islamic finance companion. Always remember to save first, spend wisely, and give Sadaqah!",
        model: (body.model as string) || "deepseek-flash",
        thinking: body.thinking !== false,
        remaining: 29,
      } as T;
    default:
      return { ok: true } as T;
  }
}

// ---------------------------------------------------------------------------
// Single invoke helper — works for both parent-finance and kid-finance.
//
// How auth works per function:
//
//  parent-finance  → verify_jwt = true  (default)
//    supabase.functions.invoke() automatically attaches the parent's live
//    session JWT. The gateway verifies it before the function runs.
//
//  kid-finance     → verify_jwt = false  (set in supabase/config.toml)
//    The gateway skips JWT verification entirely. supabase.functions.invoke()
//    still sends "Authorization: Bearer <anon-key>" which satisfies the
//    gateway's minimum header requirement. The function itself validates
//    kids via session_token / login_code in every handler.
//
// No second client, no manual headers, no complexity needed.
// ---------------------------------------------------------------------------
/**
 * Extract human-readable error message from an edge function invocation error.
 * For FunctionsHttpError, attempts to parse response body JSON and extract .error.
 * Falls back to error.message, then "Edge function call failed".
 */
export async function extractEdgeErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const res =
        typeof error.context.clone === "function" ? error.context.clone() : error.context;
      const body = await res.json();
      if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
        return (body as { error: string }).error;
      }
    } catch {
      // JSON parse failure must never throw out of the helper
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  return "Edge function call failed";
}

const PIN_SESSION_KEY = "centsibility.parent.pinSession";

export interface ParentPinSession {
  token: string;
  expiresAt: string;
}

export function setParentPinSession(token: string, expiresAt: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.setItem(
    PIN_SESSION_KEY,
    JSON.stringify({ token, expiresAt })
  );
}

export function getParentPinSession(): ParentPinSession | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  const raw = window.sessionStorage.getItem(PIN_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.token !== "string" || typeof parsed.expiresAt !== "string") {
      clearParentPinSession();
      return null;
    }
    if (new Date(parsed.expiresAt) <= new Date()) {
      clearParentPinSession();
      return null;
    }
    return parsed;
  } catch {
    clearParentPinSession();
    return null;
  }
}

export function clearParentPinSession(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.removeItem(PIN_SESSION_KEY);
}

async function invoke<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const requestBody = { ...body };
  if (functionName === "parent-finance" && !requestBody.pinSession) {
    const session = getParentPinSession();
    if (session?.token) {
      requestBody.pinSession = session.token;
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body: requestBody });
    if (error) {
      if (isParentBypassed() || isKidBypassed()) {
        console.warn(`Edge function [${functionName}:${body.action}] failed, using mock response`);
        return getMockEdgeResponse<T>(functionName, body);
      }
      const message = await extractEdgeErrorMessage(error);
      if (message === "PIN required") {
        clearParentPinSession();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("centsibility:pin-required"));
        }
      }
      throw new Error(message);
    }
    if (data?.error) {
      if (isParentBypassed() || isKidBypassed()) {
        return getMockEdgeResponse<T>(functionName, body);
      }
      const msg = typeof data.error === "string" ? data.error : "Edge function returned error";
      if (msg === "PIN required") {
        clearParentPinSession();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("centsibility:pin-required"));
        }
      }
      throw new Error(msg);
    }
    return data as T;
  } catch (err) {
    if (isParentBypassed() || isKidBypassed()) {
      console.warn(
        `Edge function [${functionName}:${body.action}] threw error, using mock response:`,
        err,
      );
      return getMockEdgeResponse<T>(functionName, body);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Parent Finance Edge Functions — gateway verifies parent's Supabase JWT
// ---------------------------------------------------------------------------

export async function edgeParentDeposit(params: { kidId: string; amount: number; label?: string; type: "DEPOSIT" | "WITHDRAWAL"; }) {
  return invoke<{ newBalance: number }>("parent-finance", { action: "deposit", ...params });
}

export async function edgeParentGetStatement(params: { kidId: string; from: string; to: string; }) {
  return invoke<{ kid: { id: string; name: string; balance: number }; transactions: TransactionRow[]; period: { from: string; to: string }; }>("parent-finance", { action: "get-statement", ...params });
}

export async function edgeParentGetProfile() {
  return invoke<{ id: string; email: string } | null>("parent-finance", { action: "get-profile" });
}

export async function edgeParentCreateKid(params: { name: string; username: string }) {
  return invoke<{ kid: any }>("parent-finance", { action: "create-kid", ...params });
}


export async function edgeParentDeleteKid(params: { kidId: string }) {
  return invoke<{ ok: boolean }>("parent-finance", { action: "delete-kid", ...params });
}

export async function edgeParentUpdateKid(params: { kidId: string; name: string; username?: string; birth_date?: string; birth_year?: number }) {
  return invoke<{ ok: boolean }>("parent-finance", { action: "update-kid", ...params });
}

export async function edgeParentApproveRequest(params: { approvalId: string; decision: "approve" | "decline" }) {
  return invoke<{ ok: boolean }>("parent-finance", { action: "approve-request", ...params });
}

export async function edgeParentResolveReward(params: { rewardId: string; decision: "approve" | "decline" }) {
  return invoke<{ ok: boolean }>("parent-finance", { action: "resolve-reward", ...params });
}

export async function edgeParentSetPin(params: { pin: string; currentPin?: string }) {
  const res = await invoke<{ ok: boolean; pinSession?: string; pinSessionExpiresAt?: string }>(
    "parent-finance",
    { action: "set-pin", ...params }
  );
  if (res.pinSession && res.pinSessionExpiresAt) {
    setParentPinSession(res.pinSession, res.pinSessionExpiresAt);
  }
  return res;
}

export async function edgeParentGetPin() {
  return invoke<{ hasPin: boolean }>("parent-finance", { action: "get-pin" });
}

export async function edgeParentVerifyPin(params: { pin: string }) {
  const res = await invoke<{ valid: boolean; attemptsLeft?: number; pinSession?: string; pinSessionExpiresAt?: string }>(
    "parent-finance",
    { action: "verify-pin", ...params }
  );
  if (res.valid && res.pinSession && res.pinSessionExpiresAt) {
    setParentPinSession(res.pinSession, res.pinSessionExpiresAt);
  }
  return res;
}

export async function edgeParentClearPin(params: { currentPin: string }) {
  const res = await invoke<{ ok: boolean }>("parent-finance", { action: "clear-pin", ...params });
  clearParentPinSession();
  return res;
}

export async function edgeParentSetHibah(params: { kidId: string; rate: number }) {
  return invoke<{ ok: boolean }>("parent-finance", { action: "set-hibah", ...params });
}


export async function edgeParentMarkNotificationsRead() {
  return invoke<{ ok: boolean }>("parent-finance", { action: "mark-notifications-read" });
}

export async function edgeParentSetAvatar(params: { kidId: string; avatar: string }) {
  return invoke<{ ok: boolean }>("parent-finance", { action: "set-avatar", ...params });
}

export async function edgeParentSetSelfAvatar(params: { avatar: string }) {
  return invoke<{ ok: boolean }>("parent-finance", { action: "set-self-avatar", ...params });
}

export async function edgeParentGetSelfAvatar() {
  return invoke<{ avatar: string | null }>("parent-finance", { action: "get-self-avatar" });
}

export async function edgeParentCreateScheduledHibah(params: { kidId: string; amount: number; frequency: string; startDate: string; endDate?: string }) {
  return invoke<{ ok: boolean; hibah: any }>("parent-finance", { action: "create-scheduled-hibah", ...params });
}

export async function edgeParentGetScheduledHibahs() {
  return invoke<{ scheduledHibahs: any[] }>("parent-finance", { action: "get-scheduled-hibahs" });
}

export async function edgeParentDeactivateScheduledHibah(params: { hibahId: string }) {
  return invoke<{ ok: boolean }>("parent-finance", { action: "deactivate-scheduled-hibah", ...params });
}

export async function edgeParentSetKidCardControls(params: {
  kidId: string;
  frozen?: boolean;
  dailyLimit?: number;
  onlineEnabled?: boolean;
  locked?: boolean;
}) {
  return invoke<{
    card_frozen: boolean;
    card_daily_limit: number;
    card_online_enabled: boolean;
    card_controls_locked: boolean;
  }>("parent-finance", { action: "set-kid-card-controls", ...params });
}

export async function edgeExecuteScheduledHibahs() {
  // Cron trigger — no user session needed, parent-finance handles this action
  // before the JWT check so it works with just the anon key.
  return invoke<{ processed: number }>("parent-finance", { action: "execute-scheduled-hibahs" });
}


// ---------------------------------------------------------------------------
// Kid Finance Edge Functions — verify_jwt=false, anon key only
// ---------------------------------------------------------------------------

export async function edgeKidSadaqah(params: { code: string; amount: number }) {
  return invoke<{ ok: boolean }>("kid-finance", { action: "sadaqah", ...params });
}

export async function edgeKidRepayLoan(params: { code: string; loanId: string; amount: number }) {
  return invoke<{ ok: boolean; paid: number; fullyRepaid: boolean; trustDelta: number }>("kid-finance", { action: "loan-repay", ...params });
}

export async function edgeKidInvestSettle(params: { code: string }) {
  return invoke<{ paid: number }>("kid-finance", { action: "invest-settle", ...params });
}

export async function edgeKidContributeGoal(params: { code: string; goalId: string; amount: number }) {
  return invoke<{ ok: boolean; added: number; saved: number }>("kid-finance", { action: "contribute-goal", ...params });
}

export async function edgeKidCreateGoal(params: {
  code: string;
  name: string;
  emoji?: string;
  target: number;
}) {
  return invoke<{ ok: boolean; goalId: string }>("kid-finance", { action: "create-goal", ...params });
}

export async function edgeKidUpdateGoal(params: {
  code: string;
  goalId: string;
  name: string;
  emoji?: string;
  target: number;
}) {
  return invoke<{ ok: boolean; saved: number; refunded: number }>("kid-finance", { action: "update-goal", ...params });
}

export async function edgeKidDeleteGoal(params: {
  code: string;
  goalId: string;
}) {
  return invoke<{ ok: boolean; refunded: number }>("kid-finance", { action: "delete-goal", ...params });
}

export async function edgeKidSetCardControls(params: {
  code: string;
  frozen?: boolean;
  dailyLimit?: number;
  onlineEnabled?: boolean;
}) {
  return invoke<{
    card_frozen: boolean;
    card_daily_limit: number;
    card_online_enabled: boolean;
  }>("kid-finance", { action: "set-card-controls", ...params });
}

export async function edgeKidLogin(params: { username: string; pin: string }) {
  return invoke<{ kidId: string; name: string; code: string }>("kid-finance", { action: "login", ...params });
}

export async function edgeKidLoginByCode(params: { loginCode: string }) {
  return invoke<{ kidId: string; name: string; code: string }>("kid-finance", { action: "login-by-code", ...params });
}

export async function edgeKidRegister(params: { setupCode: string; name: string; username: string; pin: string }) {
  return invoke<{ ok: boolean; kidId: string; code: string }>("kid-finance", { action: "register", ...params });
}

export async function edgeKidGetState(params: { code: string }) {
  return invoke<{ kid: any; goals: any[]; txs: any[]; rewards: any[]; loans: any[]; approvals: any[]; attempts: any[]; parent: any }>("kid-finance", { action: "get-state", ...params });
}

export async function edgeKidClaimCoins(params: { code: string }) {
  return invoke<{ claimed: number }>("kid-finance", { action: "claim-coins", ...params });
}

export async function edgeKidQuizState(params: { code: string }) {
  return invoke<{ date: string; correct: number; wrong: number; index: number; maxPerDay: number; maxWrong: number }>("kid-finance", { action: "quiz-state", ...params });
}

export async function edgeKidQuizAnswer(params: { code: string; correct: boolean }) {
  return invoke<{ correct: number; wrong: number; index: number; cycled: boolean; doneForToday: boolean }>("kid-finance", { action: "quiz-answer", ...params });
}

export async function edgeKidInvestDeposit(params: { code: string; amount: number }) {
  return invoke<{ ok: boolean }>("kid-finance", { action: "invest-deposit", ...params });
}

export async function edgeKidInvestWithdraw(params: { code: string; amount: number }) {
  return invoke<{ ok: boolean }>("kid-finance", { action: "invest-withdraw", ...params });
}

export async function edgeKidSetInvestRisk(params: { code: string; riskAppetite: string }) {
  return invoke<{ ok: boolean }>("kid-finance", { action: "set-invest-risk", ...params });
}

export async function edgeKidSetInvestFrequency(params: { code: string; frequency: string }) {
  return invoke<{ ok: boolean }>("kid-finance", { action: "set-invest-frequency", ...params });
}

export async function edgeKidRequestApproval(params: { code: string; kind: "WITHDRAWAL" | "DEPOSIT"; amount: number; reason: string }) {
  return invoke<{ ok: boolean }>("kid-finance", { action: "request-approval", ...params });
}

export async function edgeKidRequestLoan(params: { code: string; amount: number; reason: string; signature: string; dueDays: number }) {
  return invoke<{ ok: boolean }>("kid-finance", { action: "request-loan", ...params });
}

export async function edgeKidRequestReward(params: { code: string; name: string; cost: number }) {
  return invoke<{ ok: boolean }>("kid-finance", { action: "request-reward", ...params });
}

export async function edgeKidUpdateProfile(params: { code: string; birth_date?: string | null; birth_year?: number | null; bio?: string | null }) {
  return invoke<{ ok: boolean }>("kid-finance", { action: "update-profile", ...params });
}

export async function edgeKidUploadAvatar(params: { code: string; base64Image: string }) {
  return invoke<{ avatarUrl: string }>("kid-finance", { action: "upload-avatar", ...params });
}

export interface PennyChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function edgeKidPennyChat(params: {
  code: string;
  message: string;
  history?: PennyChatMessage[];
  thinking?: boolean;
  model?: string;
}) {
  return invoke<{
    reply: string;
    model: string;
    thinking: boolean;
    remaining: number;
  }>("kid-finance", { action: "penny-chat", ...params });
}

