import type { Tables, Database } from "@/integrations/supabase/types";

export type Kid = Omit<
  Tables<"kids">,
  | "session_token"
  | "hashed_pin"
  | "bridge_key_hash"
  | "failed_login_attempts"
  | "locked_until"
>;
export type Approval = Tables<"approvals"> & {
  kids: { name: string } | null;
  to_kid?: { name: string; comfort_name?: string | null } | null;
};
export type Reward = Tables<"rewards"> & { kids: { name: string } | null };
export type Loan = Tables<"loans"> & { kids: { name: string } | null };
export type Transaction = Tables<"transactions"> & {
  kids: { name: string } | null;
};
export type Notification = Tables<"notifications">;
export type ScheduledHibah = Tables<"scheduled_hibahs">;

export type TransactionRow =
  Database["public"]["Tables"]["transactions"]["Row"];

export type StatementTx = {
  id: string;
  created_at: string;
  type: string;
  label: string;
  amount: number;
  kid_id: string;
};

export type StatementResult = {
  kid: { id: string; name: string; balance: number };
  transactions: StatementTx[];
  period: { from: string; to: string };
} | null;
