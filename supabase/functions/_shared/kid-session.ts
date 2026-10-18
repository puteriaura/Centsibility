import { isKidSessionToken } from "./kid-session-token.ts";
import { hashKey } from "./rate-limit.ts";

// Match the existing shared helpers' Supabase query boundary.
type Admin = { from(table: string): any; rpc(name: string, args: Record<string, unknown>): PromiseLike<{ error: unknown }> };
const DAY = 24 * 60 * 60 * 1000;
export const hashSessionToken = hashKey;

export function nextExpiry(createdAt: string, now = Date.now()): string {
  return new Date(Math.min(Date.parse(createdAt) + 90 * DAY, now + 30 * DAY)).toISOString();
}

export async function issueKidSession(admin: Admin, kidId: string, expectedPinHash: string): Promise<string> {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
  const { error } = await admin.rpc("kid_session_create", {
    p_kid_id: kidId, p_token_hash: await hashSessionToken(token), p_expected_pin_hash: expectedPinHash,
  });
  if (error) throw new Error("Could not start your session. Please sign in again.");
  return token;
}

export async function resolveKidSession(admin: Admin, token: unknown) {
  if (!isKidSessionToken(token)) return null;
  const now = Date.now(), nowIso = new Date(now).toISOString();
  const { data: session, error } = await admin.from("kid_sessions")
    .select("id,kid_id,created_at,last_seen_at,expires_at")
    .eq("token_hash", await hashSessionToken(token as string)).is("revoked_at", null).gt("expires_at", nowIso).maybeSingle();
  if (error) throw new Error("Session check unavailable. Please try again.");
  if (!session || Date.parse(session.created_at) + 90 * DAY <= now) return null;
  if (Date.parse(session.last_seen_at) < now - DAY) {
    const { data: renewed, error: renewalError } = await admin.from("kid_sessions")
      .update({ last_seen_at: nowIso, expires_at: nextExpiry(session.created_at, now) })
      .eq("id", session.id).is("revoked_at", null).gt("expires_at", nowIso).select("id").maybeSingle();
    if (renewalError) throw new Error("Session renewal unavailable. Please try again.");
    if (!renewed) return null;
  }
  const { data: kid, error: kidError } = await admin.from("kids").select("id,parent_id,name,balance,coins,unclaimed_coins,xp,level,streak,hibah_rate,trust_score,created_at,invest_balance,invest_rate,invest_last_paid,quiz_date,quiz_correct,quiz_wrong,quiz_index,coins_decimal,avatar,username,hashed_pin,failed_login_attempts,locked_until,birth_date,birth_year,bio,last_login_date,risk_appetite,invest_frequency,invest_last_settled,quiz_total_correct,card_frozen,card_daily_limit,card_online_enabled,penny_ai_date,penny_ai_count,card_controls_locked,comfort_name,age_group_override,market_tracker_enabled,has_pin,login_code_expires_at").eq("id", session.kid_id).maybeSingle();
  if (kidError) throw new Error("Account check unavailable. Please try again.");
  return kid?.hashed_pin ? kid : null;
}

export async function revokeKidSession(admin: Admin, token: string): Promise<void> {
  const { error } = await admin.from("kid_sessions").update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", await hashSessionToken(token)).is("revoked_at", null);
  if (error) throw new Error("Could not sign out. Please try again.");
}

export async function revokeAllKidSessions(admin: Admin, kidId: string): Promise<void> {
  const { error } = await admin.from("kid_sessions").update({ revoked_at: new Date().toISOString() }).eq("kid_id", kidId).is("revoked_at", null);
  if (error) throw new Error("Could not reset child sessions. Please try again.");
}
