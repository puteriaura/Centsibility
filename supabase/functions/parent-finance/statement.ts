const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class StatementError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "StatementError";
    this.status = status;
  }
}

export function mytRange(from: string, to: string): { startIso: string; endIso: string } {
  if (!from || !to || !DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
    throw new StatementError("Invalid date format. Expected yyyy-MM-dd", 400);
  }
  const startDate = new Date(`${from}T00:00:00+08:00`);
  const endDate = new Date(`${to}T23:59:59.999+08:00`);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new StatementError("Invalid date values", 400);
  }

  return {
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
  };
}
import { walletDeltaCents } from "../_shared/wallet-transactions.ts";
import { verifyKidOwnership } from "./ownership.ts";


type StatementRow = { id: string; created_at: string; type: string; label: string | null; amount: number };

export async function getStatement(admin: Parameters<typeof verifyKidOwnership>[0], parentId: string, { kidId, from, to }: { kidId: string; from: string; to: string }) {
  const { startIso, endIso } = mytRange(from, to);
  if (startIso > endIso) throw new StatementError("Statement start must precede its end");
  const endExclusive = Date.parse(endIso) + 1;
  const pageSize = 500;
  let kid = await verifyKidOwnership(admin, kidId, parentId, "id, name, balance");
  for (let attempt = 0; attempt < 2; attempt++) {
    const transactions: StatementRow[] = [];
    let afterNet = 0;
    let periodNet = 0;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await admin.from("transactions").select("*").eq("kid_id", kid.id)
        .gte("created_at", startIso).order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error || !data) throw new Error("Statement transactions unavailable");
      for (const tx of data as StatementRow[]) {
        const delta = walletDeltaCents(tx);
        if (Date.parse(tx.created_at) >= endExclusive) afterNet += delta;
        else {
          transactions.push(tx);
          periodNet += delta;
        }
      }
      if (data.length < pageSize) break;
    }
    const latest = await verifyKidOwnership(admin, kidId, parentId, "id, name, balance");
    if (Number(latest.balance) === Number(kid.balance)) {
      const closingCents = Math.round(Number(latest.balance) * 100) - afterNet;
      return {
        kid: { id: latest.id, name: latest.name, balance: latest.balance },
        transactions, period: { from, to },
        openingBalance: (closingCents - periodNet) / 100,
        closingBalance: closingCents / 100,
      };
    }
    kid = latest;
  }
  throw new StatementError("Balance changed while loading. Please retry.", 409);
}
