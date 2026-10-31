import { afterEach, expect, it, vi } from "vitest";
import { exportLoanPdf } from "../../src/features/loans/utils/loan-pdf";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("jspdf", () => ({ jsPDF: class {
  setDrawColor() {} setLineWidth() {} roundedRect() {} setFillColor() {}
  setFont() {} setFontSize() {} setTextColor() {} text() {} line() {}
  splitTextToSize(value: string) { return value; }
  output() { return new Blob(["synthetic PDF"], { type: "application/pdf" }); }
  save = save;
} }));
const loan = { amount: 100, due_date: "2026-11-14", reason: "Practice",
  created_at: "2026-10-31", kidName: "Synthetic" };
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("shares a PDF file where supported, and falls back when unavailable or rejected", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  const canShare = vi.fn().mockReturnValue(true);
  vi.stubGlobal("navigator", { canShare, share });
  await exportLoanPdf(loan);
  const file = share.mock.calls[0][0].files[0];
  expect(file.type).toBe("application/pdf");
  expect(file.name.endsWith(".pdf")).toBe(true);
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
