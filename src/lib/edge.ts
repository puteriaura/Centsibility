// Typed helpers for invoking Supabase Edge Functions.
// These replace the old client-side "server function" calls
// for financial operations that must run server-side.

import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isParentBypassed, isKidBypassed, ADMIN_BYPASS } from "@/lib/admin-bypass";
import { DEMO_IDENTITY, DEMO_KID_STATE, DEMO_TRANSACTIONS, DEMO_KIDS } from "@/lib/demo-data";
import { sanitizeDisplayText } from "@/lib/labels";

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
    case "unlock":
      return { ok: true } as T;
    case "login":
    case "login-by-code":
      return { kidId: DEMO_IDENTITY.kidId, name: "Aiman", code: DEMO_IDENTITY.kidCode } as T;
    case "get-state":
      return DEMO_KID_STATE as T;
    case "get-history":
      return { txs: DEMO_TRANSACTIONS } as T;
    case "claim-coins":
      return { claimed: 10 } as T;
    case "deposit":
      return { newBalance: 150 } as T;
    case "create-kid":
      return { kid: { id: "demo-kid-" + Date.now(), name: body.name } } as T;
    case "get-statement": {
      const kidId = String(body.kidId || "");
      const kid = DEMO_KIDS.find((k) => k.id === kidId);
      if (!kid) {
        throw new Error("Not found or not your child");
      }
      const from = String(body.from || "");
      const to = String(body.to || "");
      const startDate = new Date(`${from}T00:00:00+08:00`);
      const endDate = new Date(`${to}T23:59:59.999+08:00`);
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      const txs = DEMO_TRANSACTIONS.filter((t) => {
        if (t.kid_id !== kid.id) return false;
        const txTime = new Date(t.created_at).getTime();
        return txTime >= startMs && txTime <= endMs;
      });
      return {
        kid: { id: kid.id, name: kid.name, balance: kid.balance },
        transactions: txs,
        period: { from, to },
      } as T;
    }
    case "get-scheduled-hibahs":
      return { scheduledHibahs: [] } as T;
    case "quest-board":
      return {
        ageGroup: "10-12",
        quests: [
          {
            id: "demo-quest-1",
            slug: "duit-poket-master",
            title: "Duit Poket Master",
            summary: "Learn how to split your daily pocket money wisely.",
            icon: "Coins",
            points: 400,
            position: 1,
            questionCount: 3,
            status: "done",
            completedAt: new Date().toISOString(),
            bestCorrect: 3,
          },
          {
            id: "demo-quest-2",
            slug: "smart-shopper",
            title: "Smart Shopper",
            summary: "Compare prices and spot real discounts at the kedai runcit.",
            icon: "ShoppingBag",
            points: 400,
            position: 2,
            questionCount: 3,
            status: "open",
            completedAt: null,
            bestCorrect: null,
          },
          {
            id: "demo-quest-3",
            slug: "savings-streak",
            title: "Savings Streak",
            summary: "Discover how tiny daily savings add up to big rewards.",
            icon: "TrendingUp",
            points: 400,
            position: 3,
            questionCount: 4,
            status: "locked",
            completedAt: null,
            bestCorrect: null,
          },
          {
            id: "demo-quest-4",
            slug: "scam-spotter",
            title: "Online Safety & Scams",
            summary: "Identify fake prize messages and suspicious links.",
            icon: "ShieldAlert",
            points: 400,
            position: 4,
            questionCount: 4,
            status: "locked",
            completedAt: null,
            bestCorrect: null,
          },
          {
            id: "demo-quest-5",
            slug: "budget-boss",
            title: "Budget Boss",
            summary: "Make a weekly plan for canteen lunches and stationery.",
            icon: "Receipt",
            points: 400,
            position: 5,
            questionCount: 3,
            status: "locked",
            completedAt: null,
            bestCorrect: null,
          },
          {
            id: "demo-quest-6",
            slug: "sadaqah-champion",
            title: "Sadaqah Champion",
            summary: "Understand the barakah and joy of giving to those in need.",
            icon: "Heart",
            points: 400,
            position: 6,
            questionCount: 4,
            status: "locked",
            completedAt: null,
            bestCorrect: null,
          },
          {
            id: "demo-quest-7",
            slug: "bank-basics",
            title: "Bank & Digital Money",
            summary: "How DuitNow, cards, and bank accounts work.",
            icon: "CreditCard",
            points: 400,
            position: 7,
            questionCount: 3,
            status: "locked",
            completedAt: null,
            bestCorrect: null,
          },
          {
            id: "demo-quest-8",
            slug: "halal-wealth",
            title: "Halal Wealth Builder",
            summary: "Earning honestly and growing money the Shariah way.",
            icon: "Award",
            points: 400,
            position: 8,
            questionCount: 4,
            status: "locked",
            completedAt: null,
            bestCorrect: null,
          },
        ],
      } as T;
    case "quest-start":
      return {
        attemptId: "demo-attempt-" + Date.now(),
        quest: {
          title: "Smart Shopper",
          points: 400,
        },
        questions: [
          {
            id: "demo-q1",
            position: 1,
            prompt: "You have RM10 and want a drink (RM3) and a notebook (RM5). How much change will you get?",
            choices: ["RM1", "RM2", "RM3", "RM4"],
          },
          {
            id: "demo-q2",
            position: 2,
            prompt: "A shop offers 'Buy 2 Free 1' for pencils costing RM2 each. How much for 3 pencils?",
            choices: ["RM2", "RM4", "RM6", "RM5"],
          },
          {
            id: "demo-q3",
            position: 3,
            prompt: "What is the best way to avoid impulse buying at the school bookshop?",
            choices: ["Bring all your savings", "Make a shopping list first", "Buy whatever your friend buys", "Buy items on the front display"],
          },
        ],
      } as T;
    case "quest-answer": {
      const isCorrect = body.selectedIndex === 1;
      return {
        correct: isCorrect,
        correctIndex: 1,
        explanation: isCorrect
          ? "Great job! Calculating before buying keeps your money safe."
          : "Not quite. Remember to add the costs first (RM3 + RM5 = RM8), then subtract from RM10.",
        done: body.questionId === "demo-q3",
        correctCount: isCorrect ? 3 : 2,
        total: 3,
        passed: isCorrect,
        pointsAwarded: isCorrect ? 400 : 0,
        firstCompletion: isCorrect,
      } as T;
    }
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
    case "sadaqah":
      return {
        ok: true,
        balance: 137.5,
        coins_awarded: Math.floor((Number(body.amount) || 5) * 2),
        cause: (body.cause as string) || null,
      } as T;
    case "mark-notifications-read":
      return { ok: true } as T;
    case "penny-chat":
      if (functionName === "parent-finance") {
        return {
          reply: "Salam! As your family financial coach, I can help you guide your children on budgeting, savings, and Shariah values. What would you like to discuss today?",
          model: (body.model as string) || "deepseek-flash",
          thinking: body.thinking !== false,
          remaining: 49,
        } as T;
      }
      return {
        reply: "Salam! I am Penny, your Islamic finance companion. Always remember to save first, spend wisely, and give Sadaqah!",
        model: (body.model as string) || "deepseek-flash",
        thinking: body.thinking !== false,
        remaining: 29,
      } as T;
    case "transfer-recipients":
      return {
        siblings: [
          { id: "demo-kid-aisyah", name: "Aisyah", comfort_name: "Aisyah", avatar: null },
          { id: "demo-kid-siddiq", name: "Siddiq", comfort_name: "Siddiq", avatar: null },
        ],
        parent: { id: "demo-parent-id", name: "Ummi", avatar: null },
        balance: 142.5,
        dailyLimit: 50,
        usedToday: 0,
      } as T;
    case "transfer":
      if (body.pin && ADMIN_BYPASS.kid.pin && body.pin !== ADMIN_BYPASS.kid.pin) {
        throw new Error("That PIN isn't right. 4 tries left.");
      }
      return {
        ok: true,
        approvalId: "demo-approval-" + Date.now(),
        balance: 137.5,
        status: (body.recipientKind === "parent" ? "completed" : "pending") as any,
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
  const friendlyUnknownAction = "This feature isn't available yet. The app is being updated. Please try again later.";

  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const res =
        typeof error.context.clone === "function" ? error.context.clone() : error.context;
      const body = await res.json();
      if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
        const errorMsg = (body as { error: string }).error;
        if (errorMsg.startsWith("Unknown action:")) {
          return friendlyUnknownAction;
        }
        return sanitizeDisplayText(errorMsg);
      }
    } catch {
      // JSON parse failure must never throw out of the helper
    }
  }
  if (error instanceof Error && error.message) {
    if (error.message.startsWith("Unknown action:")) {
      return friendlyUnknownAction;
    }
    return sanitizeDisplayText(error.message);
  }
  if (typeof error === "string" && error.length > 0) {
    if (error.startsWith("Unknown action:")) {
      return friendlyUnknownAction;
    }
    return sanitizeDisplayText(error);
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

export async function edgeParentCreateKid(params: { name: string; username: string; birth_date?: string }) {
  return invoke<{ kid: any }>("parent-finance", { action: "create-kid", ...params });
}


export async function edgeParentDeleteKid(params: { kidId: string }) {
  return invoke<{ ok: boolean }>("parent-finance", { action: "delete-kid", ...params });
}

export async function edgeParentUpdateKid(params: {
  kidId: string;
  name: string;
  username?: string;
  birth_date?: string;
  birth_year?: number;
  age_group_override?: string | null;
}) {
  return invoke<{ ok: boolean }>("parent-finance", { action: "update-kid", ...params });
}

export async function edgeParentResetKidPin(params: { kidId: string }) {
  return invoke<{ ok: boolean; kidId: string; name: string; loginCode: string }>("parent-finance", { action: "reset-kid-pin", ...params });
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

export async function edgeKidSadaqah(params: { code: string; amount: number; cause?: string }) {
  return invoke<{ ok: boolean; balance?: number; coins_awarded?: number; cause?: string | null }>(
    "kid-finance",
    { action: "sadaqah", ...params }
  );
}

export async function edgeKidMarkNotificationsRead(params: { code: string }) {
  return invoke<{ ok: boolean }>("kid-finance", { action: "mark-notifications-read", ...params });
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
  return invoke<{ kidId: string; name: string; code?: string; needsPinSetup?: boolean; username?: string }>("kid-finance", { action: "login-by-code", ...params });
}

export async function edgeKidVerifyAccessCode(params: { loginCode: string }) {
  return invoke<{ ok: boolean; kidId: string; username: string; name: string; needsBirthday?: boolean }>("kid-finance", { action: "verify-access-code", ...params });
}

export async function edgeKidSetInitialPin(params: { loginCode: string; pin: string; comfortName?: string; birthDate?: string }) {
  return invoke<{ ok: boolean; kidId: string; name: string; code: string }>("kid-finance", { action: "set-initial-pin", ...params });
}

export async function edgeKidRegister(params: { setupCode: string; name: string; username: string; pin: string }) {
  return invoke<{ ok: boolean; kidId: string; code: string }>("kid-finance", { action: "register", ...params });
}

export async function edgeKidUnlock(params: { code: string; pin: string }) {
  return invoke<{ ok: boolean }>("kid-finance", { action: "unlock", ...params });
}

export async function edgeKidGetState(params: { code: string }) {
  return invoke<{
    kid: any;
    ageGroup?: "6-9" | "10-12" | "13-17";
    questsCompleted?: number;
    goals: any[];
    txs: any[];
    rewards: any[];
    loans: any[];
    approvals: any[];
    attempts: any[];
    parent: any;
    notifications: {
      id: string;
      kid_id: string;
      kind: string;
      message: string;
      link?: string | null;
      read: boolean;
      created_at: string;
    }[];
    unreadNotifications: number;
  }>("kid-finance", { action: "get-state", ...params });
}

export async function edgeKidGetHistory(params: { code: string; days: number }) {
  return invoke<{ txs: { id: string; type: string; amount: number; label: string | null; created_at: string }[] }>(
    "kid-finance",
    { action: "get-history", ...params },
  );
}

export async function edgeKidClaimCoins(params: { code: string }) {
  return invoke<{ claimed: number }>("kid-finance", { action: "claim-coins", ...params });
}

export interface QuestNode {
  id: string;
  slug: string;
  title: string;
  summary: string;
  icon: string;
  points: number;
  position: number;
  questionCount: number;
  status: "done" | "open" | "locked";
  completedAt: string | null;
  bestCorrect: number | null;
}

export async function edgeKidQuestBoard(params: { code: string }) {
  return invoke<{
    ageGroup: "6-9" | "10-12" | "13-17";
    quests: QuestNode[];
  }>("kid-finance", { action: "quest-board", ...params });
}

export async function edgeKidQuestStart(params: { code: string; questId: string }) {
  return invoke<{
    attemptId: string;
    quest: {
      title: string;
      points: number;
    };
    questions: {
      id: string;
      position: number;
      prompt: string;
      choices: string[];
    }[];
  }>("kid-finance", { action: "quest-start", ...params });
}

export async function edgeKidQuestAnswer(params: {
  code: string;
  attemptId: string;
  questionId: string;
  selectedIndex: number;
}) {
  return invoke<{
    correct: boolean;
    correctIndex: number;
    explanation: string;
    done: boolean;
    correctCount: number;
    total: number;
    passed?: boolean;
    pointsAwarded?: number;
    firstCompletion?: boolean;
  }>("kid-finance", { action: "quest-answer", ...params });
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
  context?: { page: string; detail?: string };
}) {
  return invoke<{
    reply: string;
    model: string;
    thinking: boolean;
    remaining: number;
  }>("kid-finance", { action: "penny-chat", ...params });
}

export async function edgeParentPennyChat(params: {
  message: string;
  history?: PennyChatMessage[];
  thinking?: boolean;
  model?: string;
  pinSession?: string;
  context?: { page: string; detail?: string };
}) {
  return invoke<{
    reply: string;
    model: string;
    thinking: boolean;
    remaining: number;
  }>("parent-finance", { action: "penny-chat", ...params });
}

export interface TransferRecipientSibling {
  id: string;
  name: string;
  comfort_name: string | null;
  avatar: string | null;
}

export interface TransferRecipientParent {
  id: string;
  name: string | null;
  avatar: string | null;
}

export interface KidTransferRecipientsResponse {
  siblings: TransferRecipientSibling[];
  parent: TransferRecipientParent | null;
  balance: number;
  dailyLimit: number;
  usedToday: number;
}

export async function edgeKidTransferRecipients(params: { code: string }) {
  return invoke<KidTransferRecipientsResponse>("kid-finance", {
    action: "transfer-recipients",
    ...params,
  });
}

export async function edgeKidTransfer(params: {
  code: string;
  pin: string;
  recipientKind: "kid" | "parent";
  recipientId: string;
  amount: number;
  note?: string;
  parentLabel?: string;
}) {
  return invoke<{
    ok: boolean;
    approvalId?: string;
    balance?: number;
    status: "pending" | "completed";
  }>("kid-finance", {
    action: "transfer",
    ...params,
  });
}

export async function edgeParentTransfer(params: {
  kidId: string;
  amount: number;
  note?: string;
  parentLabel?: string;
  pin: string;
}) {
  return invoke<{ ok: boolean; balance?: number }>("parent-finance", {
    action: "transfer",
    ...params,
  });
}

