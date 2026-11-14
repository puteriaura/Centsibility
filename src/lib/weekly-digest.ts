export interface WeeklyDigestKid {
  id: string;
  name: string;
  streak?: number | null;
}

export interface WeeklyDigestTx {
  id: string;
  type: string;
  amount: number;
  created_at: string;
}

export interface WeeklyDigestApproval {
  id: string;
  status: string;
}

export interface WeeklyDigestSummary {
  savedAmount: number;
  givenAmount: number;
  pendingRequests: number;
  topStreak: number;
  topStreakKid: string | null;
  txCount: number;
  talkingPointEn: string;
  talkingPointMs: string;
}

const SAVED_TYPES = new Set(["DEPOSIT", "GOAL_SAVE", "SAVINGS", "HIBAH", "CHORE"]);
const GIVEN_TYPES = new Set(["SADAQAH", "ZAKAT"]);

export function buildWeeklyDigest(
  kids: WeeklyDigestKid[],
  txs: WeeklyDigestTx[],
  approvals: WeeklyDigestApproval[],
  now = new Date(),
): WeeklyDigestSummary {
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  let savedAmount = 0;
  let givenAmount = 0;
  let txCount = 0;

  for (const t of txs) {
    const ts = Date.parse(t.created_at);
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    txCount++;
    const amt = Math.abs(Number(t.amount) || 0);
    const kind = String(t.type || "").toUpperCase();
    if (SAVED_TYPES.has(kind)) savedAmount += amt;
    if (GIVEN_TYPES.has(kind)) givenAmount += amt;
  }

  const pendingRequests = approvals.filter(
    (a) => String(a.status || "").toUpperCase() === "PENDING",
  ).length;

  let topStreak = 0;
  let topStreakKid: string | null = null;
  for (const k of kids) {
    const s = Number(k.streak ?? 0);
    if (s > topStreak) {
      topStreak = s;
      topStreakKid = k.name;
    }
  }

  let talkingPointEn =
    "Ask your children what they want to save for first this week.";
  let talkingPointMs =
    "Tanya anak-anak apa sasaran Tabung yang mereka mahu utamakan minggu ini.";

  if (pendingRequests > 0) {
    talkingPointEn = `You have ${pendingRequests} waiting ${pendingRequests === 1 ? "request" : "requests"}. Sit together for two minutes to decide why each one matters.`;
    talkingPointMs = `Ada ${pendingRequests} permintaan menunggu. Luangkan dua minit bersama anak untuk bincang keutamaan setiap permintaan.`;
  } else if (givenAmount > 0) {
    talkingPointEn = "Celebrate this week's Sadaqah together and ask who they would like to help next.";
    talkingPointMs = "Raikan sedekah minggu ini bersama-sama dan tanya siapa yang mereka ingin bantu selepas ini.";
  } else if (topStreak >= 3 && topStreakKid) {
    talkingPointEn = `Praise ${topStreakKid}'s ${topStreak}-day streak and talk about how small daily habits build Tabung.`;
    talkingPointMs = `Puji rentetan ${topStreak} hari ${topStreakKid} dan bincang bagaimana tabiat kecil setiap hari membina Tabung.`;
  }

  return {
    savedAmount: Number(savedAmount.toFixed(2)),
    givenAmount: Number(givenAmount.toFixed(2)),
    pendingRequests,
    topStreak,
    topStreakKid,
    txCount,
    talkingPointEn,
    talkingPointMs,
  };
}
