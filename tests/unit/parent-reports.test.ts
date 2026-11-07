import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { Route } from "../../src/routes/parent.reports";
import type { StatementResult } from "../../src/types/domain";

const fixture = vi.hoisted(() => ({ statement: null as StatementResult, inject: false }));
vi.mock("react", async (load) => {
  const react = await load<typeof import("react")>();
  return { ...react, useState(initial: unknown) {
    if (initial === null && fixture.inject) {
      fixture.inject = false;
      return react.useState(fixture.statement);
    }
    return react.useState(initial);
  } };
});
vi.mock("@/lib/edge", () => ({ edgeParentGetStatement: vi.fn() }));
vi.mock("@/hooks/use-parent-data", () => ({
  useParentData: () => ({ kids: [{ id: "demo", name: "Demo saver", trust_score: 600 }], loans: [], hasLoaded: true }),
}));
vi.mock("@/features/privacy", () => ({
  usePrivacy: () => ({ locked: false, isMasked: false }),
  useMoney: () => ({ format: (amount: number) => `RM${amount.toFixed(2)}` }),
  Money: ({ amount }: { amount: number }) => `RM${amount.toFixed(2)}`,
  LogInToView: () => null,
}));
vi.mock("@/components/charts/money-donut", () => ({ MoneyDonut: () => null }));

it("reports keep activity visible but omit opening, closing and row balances for old responses", () => {
  const statement: NonNullable<StatementResult> = {
    kid: { id: "demo", name: "Demo saver", balance: 999 },
    transactions: [{ id: "t1", kid_id: "demo", created_at: "2026-11-04T04:00:00Z", type: "WITHDRAWAL", label: "School supplies", amount: 5 }],
    period: { from: "2026-11-01", to: "2026-11-30" },
  };
  const render = (value: StatementResult) => {
    fixture.statement = value;
    fixture.inject = true;
    return renderToStaticMarkup(createElement(Route.options.component!));
  };
  const legacy = render(statement);
  expect(legacy).toContain("School supplies");
  expect(legacy).toContain("Save PDF");
  expect(legacy).not.toMatch(/Opening Balance|Closing Balance|bal RM|RM999\.00/);

  const current = render({ ...statement, openingBalance: 50, closingBalance: 45 });
  expect(current).toContain("Opening Balance");
  expect(current).toContain("Closing Balance");
  expect(current).toContain("bal RM45.00");
  expect(current).not.toContain("RM999.00");
});
