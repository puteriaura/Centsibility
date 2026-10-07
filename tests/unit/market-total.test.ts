import { describe, expect, it } from "vitest";
import { getBalanceSummary } from "../../src/lib/finance";
describe("missing market valuations", () => {
  it("does not turn unavailable investments into a principal-valued family total", () => {
    const summary = getBalanceSummary({ balance: 100, invest_balance: 20 }, [{ saved: 5 }], [], null);
    expect(summary.spending).toBe(100);
    expect(summary.tabung).toBe(5);
    expect(summary.investments).toBeNull();
    expect(summary.total).toBeNull();
  });
});
