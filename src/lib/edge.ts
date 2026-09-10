// Typed helpers for invoking Supabase Edge Functions.
// These replace the old client-side "server function" calls
// for financial operations that must run server-side.

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isParentBypassed, isKidBypassed } from "@/lib/admin-bypass";
import { DEMO_KID_STATE } from "@/lib/demo-data";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

function getMockEdgeResponse<T>(functionName: string, body: Record<string, unknown>): T {
  const action = String(body.action || "");
  switch (action) {
    case "get-profile":
      return { id: "demo-parent-id", email: "test@centsibility.com" } as T;
    case "get-pin":
      return { pin_hash: null } as T;
    case "set-pin":
      return { ok: true } as T;
    case "login":
    case "login-by-code":
      return { kidId: "demo-kid-aiman", name: "Aiman", code: "AIMAN1" } as T;
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
        kid: { id: "demo-kid-aiman", name: "Aiman", balance: 142.5 },
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
      return { ok: true, fullyRepaid: false, trustDelta: 1 } as T;
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
async function invoke<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) {
      if (isParentBypassed() || isKidBypassed()) {
        console.warn(`Edge function [${functionName}:${body.action}] failed, using mock response`);
        return getMockEdgeResponse<T>(functionName, body);
      }
      throw new Error(error.message || "Edge function call failed");
    }
    if (data?.error) {
      if (isParentBypassed() || isKidBypassed()) {
        return getMockEdgeResponse<T>(functionName, body);
      }
      throw new Error(data.error);
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

export async function edgeParentSetPin(params: { pin_hash: string }) {
  return invoke<{ ok: boolean }>("parent-finance", { action: "set-pin", ...params });
}

export async function edgeParentGetPin() {
  return invoke<{ pin_hash: string | null }>("parent-finance", { action: "get-pin" });
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

export async function edgeKidRepayLoan(params: { code: string; loanId: string; amount: number; }) {
  return invoke<{ ok: boolean; fullyRepaid: boolean; trustDelta: number }>("kid-finance", { action: "loan-repay", ...params });
}

export async function edgeKidInvestSettle(params: { code: string }) {
  return invoke<{ paid: number }>("kid-finance", { action: "invest-settle", ...params });
}

export async function edgeKidContributeGoal(params: { code: string; goalId: string; amount: number; }) {
  return invoke<{ ok: boolean }>("kid-finance", { action: "contribute-goal", ...params });
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

