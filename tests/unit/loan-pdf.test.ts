import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { afterEach, expect, it, vi } from "vitest";
import { buildLoanPdf, clampPdfText, exportLoanPdf, loanTermDays } from "../../src/features/loans/utils/loan-pdf";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("jspdf", async (load) => {
  const actual = await load<typeof import("jspdf")>();
  return { jsPDF: class extends actual.jsPDF {
    constructor(options?: ConstructorParameters<typeof actual.jsPDF>[0]) {
      super(options);
      this.save = save;
    }
  } };
});

const loan = { id: "7f3a-demo", amount: 100, due_date: "2026-11-28", reason: "School supplies",
  created_at: "2026-11-07T12:00:00", kidName: "Demo borrower" };

const loadFonts = () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(readFileSync("public" + url))));
};
const failFonts = () => vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("loads the five Latin faces on export and falls back to Helvetica if a font is unavailable", async () => {
  loadFonts();
  const doc = await buildLoanPdf(loan);
  expect(doc.getFontList()["baloo-2"]).toEqual(["700", "800"]);
  expect(doc.getFontList().lexend).toEqual(["400", "500", "600"]);
  expect(fetch).toHaveBeenCalledTimes(5);

  failFonts();
  const fallback = await buildLoanPdf(loan);
  expect(fallback.getFont().fontName).toBe("helvetica");
  expect(fallback.output("arraybuffer").byteLength).toBeGreaterThan(0);
});

it("counts calendar days across month and daylight-saving boundaries", () => {
  expect(loanTermDays(loan.created_at, loan.due_date)).toBe(21);
  expect(loanTermDays("2026-10-31T22:30:00", "2026-11-02")).toBe(2);
});

it("clamps a long reason to two lines with a fitted ellipsis", () => {
  const doc = new jsPDF();
  doc.setFontSize(13);
  const width = 58;
  const lines = clampPdfText(doc, "School supplies and materials for a classroom project ".repeat(8), width);
  expect(lines).toHaveLength(2);
  expect(lines[1]).toMatch(/…$/);
  expect(lines.every(line => doc.getTextWidth(line) <= width)).toBe(true);
});

it("embeds a provided signature and leaves both boxes available without one", async () => {
  failFonts();
  const unsigned = await buildLoanPdf(loan);
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGMUlTNkYGBgYgADAAS+AGjPhhsyAAAAAElFTkSuQmCC";
  const signed = await buildLoanPdf({ ...loan, signature_data_url: png });
  expect(unsigned.output().includes("/Subtype /Image")).toBe(false);
  expect(signed.output().includes("/Subtype /Image")).toBe(true);
});

it("shares a private filename, silently handles cancellation, and falls back to save", async () => {
  failFonts();
  const share = vi.fn().mockResolvedValue(undefined);
  const canShare = vi.fn().mockReturnValue(true);
  vi.stubGlobal("navigator", { canShare, share });
  await exportLoanPdf(loan);
  const file = share.mock.calls[0][0].files[0];
  expect(file.type).toBe("application/pdf");
  expect(file.name).toBe("kindness-promise-2026-11-28.pdf");
  expect(canShare).toHaveBeenCalledWith({ files: [file] });
  expect(save).not.toHaveBeenCalled();
  share.mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
  await exportLoanPdf(loan);
  expect(save).not.toHaveBeenCalled();
  share.mockRejectedValueOnce(new Error("Sharing unavailable"));
  await exportLoanPdf(loan);
  expect(save).toHaveBeenCalledTimes(1);
  vi.stubGlobal("navigator", {});
  await exportLoanPdf(loan);
  expect(save).toHaveBeenCalledTimes(2);
});
