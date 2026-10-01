import { describe, it, expect } from "vitest";
import { groupByDay, type HistoryTx } from "@/lib/history";

describe("groupByDay", () => {
  it("places 2026-09-26T17:30:00Z under 27 September for Malaysia time zone (UTC+8)", () => {
    const txs: HistoryTx[] = [
      {
        id: "tx-1",
        type: "DEPOSIT",
        amount: 50,
        label: "Hibah",
        created_at: "2026-09-26T17:30:00Z",
      },
    ];

    const groups = groupByDay(txs, "Asia/Kuala_Lumpur");
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("2026-09-27");
    expect(groups[0].heading).toBe("Sunday, 27 September 2026");
    expect(groups[0].rows[0].id).toBe("tx-1");
  });

  it("sorts days newest first and rows within each day newest first", () => {
    const txs: HistoryTx[] = [
      {
        id: "tx-old-day",
        type: "DEPOSIT",
        amount: 20,
        created_at: "2026-09-25T10:00:00Z",
      },
      {
        id: "tx-new-day-earlier",
        type: "SPEND",
        amount: 5,
        created_at: "2026-09-27T02:00:00Z",
      },
      {
        id: "tx-new-day-later",
        type: "SPEND",
        amount: 15,
        created_at: "2026-09-27T08:00:00Z",
      },
    ];

    const groups = groupByDay(txs, "Asia/Kuala_Lumpur");
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("2026-09-27");
    expect(groups[1].key).toBe("2026-09-25");

    // Inside the 2026-09-27 group, the later one (08:00Z) comes before earlier (02:00Z)
    expect(groups[0].rows[0].id).toBe("tx-new-day-later");
    expect(groups[0].rows[1].id).toBe("tx-new-day-earlier");
  });

  it("filters out pot-only transaction types INVEST_GAIN and INVEST_LOSS", () => {
    const txs: HistoryTx[] = [
      {
        id: "tx-wallet",
        type: "DEPOSIT",
        amount: 30,
        created_at: "2026-09-27T05:00:00Z",
      },
      {
        id: "tx-invest-gain",
        type: "INVEST_GAIN",
        amount: 1.25,
        created_at: "2026-09-27T06:00:00Z",
      },
      {
        id: "tx-invest-loss",
        type: "INVEST_LOSS",
        amount: 0.5,
        created_at: "2026-09-27T07:00:00Z",
      },
    ];

    const groups = groupByDay(txs, "Asia/Kuala_Lumpur");
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].id).toBe("tx-wallet");
  });

  it("formats the day heading as 'Sunday, 27 September 2026'", () => {
    const txs: HistoryTx[] = [
      {
        id: "tx-sunday",
        type: "SADAQAH",
        amount: 5,
        created_at: "2026-09-27T04:00:00Z",
      },
    ];

    const groups = groupByDay(txs, "Asia/Kuala_Lumpur");
    expect(groups[0].heading).toBe("Sunday, 27 September 2026");
  });
});
