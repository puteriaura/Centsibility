// Demo rows keep the legacy emoji avatar values that avatar.ts maps to icons.
// avoid-ai-design-ignore-file: I2
import type {
  Kid,
  Approval,
  Reward,
  Loan,
  Transaction,
  Notification,
  ScheduledHibah,
} from "@/types/domain";

export const DEMO_IDENTITY = import.meta.env.DEV
  ? {
      parentEmail: "test@centsibility.com",
      kidUsername: "aiman",
      kidCode: "DEMO01",
      kidId: "demo-kid-aiman",
      sessionToken: "demo-token-aiman",
    }
  : {
      parentEmail: "demo@example.com",
      kidUsername: "demo",
      kidCode: "DEMO00",
      kidId: "demo-kid-demo",
      sessionToken: "demo-token-demo",
    };

export const DEMO_KID: Kid = {
  id: DEMO_IDENTITY.kidId,
  parent_id: "demo-parent-id",
  name: "Aiman",
  comfort_name: null,
  username: DEMO_IDENTITY.kidUsername,
  login_code: DEMO_IDENTITY.kidCode,
  has_pin: false,
  balance: 142.5,
  coins: 520,
  coins_decimal: 520,
  avatar: "🚀",
  bio: "Super saver",
  birth_date: "2015-06-15",
  birth_year: 2015,
  hibah_rate: 0.05,
  invest_balance: 0.0,
  invest_last_paid: new Date().toISOString(),
  invest_rate: 0.02,
  level: 3,
  quiz_correct: 3,
  quiz_date: new Date().toISOString().slice(0, 10),
  quiz_index: 1,
  quiz_wrong: 0,
  streak: 5,
  trust_score: 95,
  unclaimed_coins: 10,
  xp: 450,
  created_at: "2026-01-01T00:00:00.000Z",
  last_login_date: new Date().toISOString().slice(0, 10),
};

export const DEMO_KID_2: Kid = {
  id: "demo-kid-aisyah",
  parent_id: "demo-parent-id",
  name: "Aisyah",
  comfort_name: "Aisyah",
  username: "aisyah",
  login_code: "AISYAH",
  has_pin: false,
  balance: 85.0,
  coins: 300,
  coins_decimal: 300,
  avatar: "🌸",
  bio: "Curious explorer",
  birth_date: "2017-09-20",
  birth_year: 2017,
  hibah_rate: 0.05,
  invest_balance: 0.0,
  invest_last_paid: new Date().toISOString(),
  invest_rate: 0.02,
  level: 2,
  quiz_correct: 2,
  quiz_date: new Date().toISOString().slice(0, 10),
  quiz_index: 0,
  quiz_wrong: 0,
  streak: 3,
  trust_score: 90,
  unclaimed_coins: 5,
  xp: 220,
  created_at: "2026-01-01T00:00:00.000Z",
  last_login_date: new Date().toISOString().slice(0, 10),
};

export const DEMO_KIDS: Kid[] = [DEMO_KID, DEMO_KID_2];

export const DEMO_APPROVALS: Approval[] = [
  {
    id: "demo-approval-1",
    kid_id: DEMO_KID.id,
    to_kid_id: null,
    kind: "DEPOSIT",
    amount: 15.0,
    reason: "Saved weekend allowance",
    status: "pending",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    resolved_at: null,
    kids: { name: DEMO_KID.name },
  },
  {
    id: "demo-approval-2",
    kid_id: DEMO_KID.id,
    to_kid_id: "demo-kid-aisyah",
    kind: "TRANSFER",
    amount: 5.0,
    reason: "Lunch treat",
    status: "pending",
    created_at: new Date(Date.now() - 1800000).toISOString(),
    resolved_at: null,
    kids: { name: DEMO_KID.name },
    to_kid: { name: "Aisyah", comfort_name: "Aisyah" },
  },
];

export const DEMO_REWARDS: Reward[] = [
  {
    id: "demo-reward-1",
    kid_id: DEMO_KID.id,
    name: "Science Centre Visit",
    cost: 100,
    status: "requested",
    created_at: new Date(Date.now() - 7200000).toISOString(),
    kids: { name: DEMO_KID.name },
  },
  {
    id: "demo-reward-2",
    kid_id: DEMO_KID.id,
    name: "Lego City Set",
    cost: 250,
    status: "approved",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    kids: { name: DEMO_KID.name },
  },
];

export const DEMO_LOANS: Loan[] = [
  {
    id: "demo-loan-1",
    kid_id: DEMO_KID.id,
    amount: 30.0,
    reason: "New Astronomy Guidebook (due 30d)",
    status: "active",
    repaid: 10.0,
    due_date: new Date(Date.now() + 86400000 * 14).toISOString(),
    signature_data_url: null,
    signed_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    kids: { name: DEMO_KID.name },
  },
];

export const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: "demo-tx-4",
    kid_id: DEMO_KID.id,
    type: "TRANSFER_OUT",
    amount: 2.0,
    label: "Transfer sent",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    kids: { name: DEMO_KID.name },
  },
  {
    id: "demo-tx-5",
    kid_id: DEMO_KID.id,
    type: "TRANSFER_IN",
    amount: 5.0,
    label: "Transfer received",
    created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    kids: { name: DEMO_KID.name },
  },
  {
    id: "demo-tx-1",
    kid_id: DEMO_KID.id,
    type: "DEPOSIT",
    amount: 25.0,
    label: "Weekly Hibah Allowance",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    kids: { name: DEMO_KID.name },
  },
  {
    id: "demo-tx-2",
    kid_id: DEMO_KID.id,
    type: "SADAQAH",
    amount: 5.0,
    label: "Masjid Donation",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    kids: { name: DEMO_KID.name },
  },
  {
    id: "demo-tx-3",
    kid_id: DEMO_KID.id,
    type: "QARD",
    amount: 10.0,
    label: "Loan repayment",
    created_at: new Date(Date.now() - 259200000).toISOString(),
    kids: { name: DEMO_KID.name },
  },
];

export const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "demo-notif-1",
    parent_id: "demo-parent-id",
    kid_id: DEMO_KID.id,
    kind: "DEPOSIT",
    message: "Aiman requested approval for RM 15.00 deposit.",
    link: "/parent/approvals",
    read: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

export const DEMO_SCHEDULED_HIBAHS: ScheduledHibah[] = [
  {
    id: "demo-hibah-1",
    kid_id: DEMO_KID.id,
    parent_id: "demo-parent-id",
    amount: 10.0,
    frequency: "weekly",
    start_date: new Date(Date.now() - 86400000 * 7).toISOString(),
    end_date: null,
    next_run_at: new Date(Date.now() + 86400000 * 3).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];

export const DEMO_GOALS = [
  {
    id: "demo-goal-1",
    kid_id: DEMO_KID.id,
    name: "New Bicycle",
    target: 200.0,
    saved: 174.0,
    emoji: "🚲",
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
];

export const DEMO_KID_NOTIFICATIONS = [
  {
    id: "demo-kid-note-1",
    kid_id: DEMO_KID.id,
    kind: "SADAQAH",
    message: "You gave RM5.00 to Orphan Relief. +10 points",
    link: "/kid/sadaqah",
    read: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "demo-kid-note-2",
    kid_id: DEMO_KID.id,
    kind: "TRANSFER",
    message: "Test Parent sent you RM10.00 pocket money",
    link: "/kid/history",
    read: false,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export const DEMO_KID_STATE = {
  kid: DEMO_KID,
  ageGroup: "10-12" as "6-9" | "10-12" | "13-17",
  questsCompleted: 1,
  goals: DEMO_GOALS,
  txs: DEMO_TRANSACTIONS,
  rewards: DEMO_REWARDS,
  loans: DEMO_LOANS,
  approvals: DEMO_APPROVALS,
  attempts: [],
  parent: {
    id: "demo-parent-id",
    email: DEMO_IDENTITY.parentEmail,
    name: "Test Parent",
  },
  notifications: DEMO_KID_NOTIFICATIONS,
  unreadNotifications: 2,
};
