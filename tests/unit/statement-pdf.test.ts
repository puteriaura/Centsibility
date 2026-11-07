import { afterEach, expect, it, vi } from "vitest";
import { buildStatementPdf, exportStatementPdf, statementPdfFilename } from "../../src/lib/statement-pdf";
import { statementPdfCategories, summarizeStatement } from "../../src/lib/statement";
import type { StatementResult } from "../../src/types/domain";

const { textCalls, save } = vi.hoisted(() => ({
  textCalls: [] as { text: string | string[]; y: number; page: number }[],
  save: vi.fn(),
}));
vi.mock("jspdf", async (load) => {
  const actual = await load<typeof import("jspdf")>();
  return { jsPDF: class extends actual.jsPDF {
    constructor(options?: ConstructorParameters<typeof actual.jsPDF>[0]) {
      super(options);
      const text = this.text.bind(this);
      this.text = (value, x, y, opts, transform) => {
        textCalls.push({ text: value, y, page: this.getCurrentPageInfo().pageNumber });
        return text(value, x, y, opts, transform);
      };
      this.save = save;
    }
  } };
});

const makeStatement = (count: number): NonNullable<StatementResult> => ({
  kid: { id: "demo", name: "Demo saver", balance: 999 },
  period: { from: "2026-11-01", to: "2026-11-30" },
  openingBalance: 100,
  closingBalance: 100 - count,
  transactions: Array.from({ length: count }, (_, i) => ({
    id: String(i), kid_id: "demo", created_at: "2026-11-18T03:00:00Z",
    amount: 1, type: "WITHDRAWAL", label: `Entry ${i}`,
  })),
});

afterEach(() => { textCalls.length = 0; vi.unstubAllGlobals(); vi.clearAllMocks(); });
const noFonts = () => vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));

it("paginates 40 transactions with repeated headers and keeps each row together", async () => {
  noFonts();
  const doc = await buildStatementPdf(makeStatement(40));
  expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  expect(textCalls.filter(row => row.text === "Description").map(row => row.page))
    .toEqual(Array.from({ length: doc.getNumberOfPages() }, (_, i) => i + 1));
  for (let i = 0; i < 40; i++) {
    const row = textCalls.find(item => Array.isArray(item.text) && item.text.join("") === `Entry ${i}`);
    expect(row).toBeDefined();
    expect(textCalls).toContainEqual({ text: "Withdrawal", page: row!.page, y: row!.y + 4 });
    expect(row!.y + 4).toBeLessThan(269);
  }
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    expect(textCalls.some(row => row.page === i && row.text === `Page ${i} of ${doc.getNumberOfPages()}`)).toBe(true);
  }
});

it("uses shares of all debits and puts the tail in Other", () => {
  const categories = [40, 20, 10, 8, 7, 6, 5, 4].map((value, i) => ({ name: String(i), value }));
  const result = statementPdfCategories(categories);
  expect(result).toHaveLength(7);
  expect(result[0]).toEqual({ name: "0", value: 40, percent: 40, fraction: 1 });
  expect(result.at(-1)).toEqual({ name: "Other", value: 9, percent: 9, fraction: 9 / 40 });
});

it("omits the reports and PDF balances when an old backend only provides current balance", async () => {
  noFonts();
  const { openingBalance: _opening, closingBalance: _closing, ...legacy } = makeStatement(3);
  expect(summarizeStatement(legacy)).toMatchObject({ balances: null, totalOut: 3 });
  expect(summarizeStatement(legacy).balanceMap.size).toBe(0);
  expect([...summarizeStatement(makeStatement(3)).balanceMap.values()]).toEqual([97, 98, 99]);
  expect((await buildStatementPdf(legacy)).getNumberOfPages()).toBe(1);
  expect(textCalls.some(row => /Opening balance|Closing balance|^Balance$|999/.test(String(row.text)))).toBe(false);
  expect(textCalls.some(row => row.text === "Amount")).toBe(true);
});

it("exports the period filename without a child name", async () => {
  noFonts();
  vi.stubGlobal("navigator", {});
  expect(statementPdfFilename("2026-11-01")).toBe("statement-2026-11.pdf");
  await exportStatementPdf(makeStatement(3));
  expect(save).toHaveBeenCalledWith("statement-2026-11.pdf");
});
