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
      kidCode: "AIMAN1",
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
  balance: 142.5,
  coins: 520,
  coins_decimal: 520,
  avatar: "🚀",
  bio: "Super saver",
  birth_date: "2015-06-15",
  birth_year: 2015,
  bridge_key_hash: null,
  failed_login_attempts: 0,
  hashed_pin: null,
  hibah_rate: 0.05,
  invest_balance: 50.0,
  invest_last_paid: new Date().toISOString(),
  invest_rate: 0.02,
  level: 3,
  locked_until: null,
  quiz_correct: 3,
  quiz_date: new Date().toISOString().slice(0, 10),
  quiz_index: 1,
  quiz_wrong: 0,
  streak: 5,
  trust_score: 95,
  unclaimed_coins: 10,
  xp: 450,
  session_token: DEMO_IDENTITY.sessionToken,
  created_at: "2026-01-01T00:00:00.000Z",
  last_login_date: new Date().toISOString().slice(0, 10),
};

export const DEMO_APPROVALS: Approval[] = [
  {
    id: "demo-approval-1",
    kid_id: DEMO_KID.id,
    kind: "DEPOSIT",
    amount: 15.0,
    reason: "Saved weekend allowance",
    status: "pending",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    resolved_at: null,
    kids: { name: DEMO_KID.name },
  },
];

export const DEMO_REWARDS: Reward[] = [
  {
    id: "demo-reward-1",
    kid_id: DEMO_KID.id,
    name: "National Planetarium Visit",
    cost: 100,
    status: "requested",
    created_at: new Date(Date.now() - 7200000).toISOString(),
    kids: { name: DEMO_KID.name },
  },
  {
    id: "demo-reward-2",
    kid_id: DEMO_KID.id,
    name: "Space Lego Set",
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

export const DEMO_KID_STATE = {
  kid: DEMO_KID,
  goals: [
    {
      id: "demo-goal-1",
      kid_id: DEMO_KID.id,
      name: "New Bicycle",
      target: 200.0,
      saved: 174.0,
      emoji: "🚲",
      created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
    },
  ],
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
};
