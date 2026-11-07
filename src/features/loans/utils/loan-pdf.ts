import { clampPdfText, colors, createPdf, drawPdfSprout, rasterize, sharePdf } from "@/lib/pdf";
export { clampPdfText } from "@/lib/pdf";
import { formatDate, formatRM } from "@/lib/format";
import proudPenny from "@/assets/penny/proud.svg?raw";

type LoanPromise = {
  id: string;
  amount: number;
  due_date: string;
  reason: string | null;
  created_at: string;
  signature_data_url?: string | null;
  kidName: string;
};

export function loanTermDays(issuedAt: string, dueDate: string) {
  const issued = new Date(issuedAt.length === 10 ? issuedAt + "T12:00:00" : issuedAt);
  const start = Date.UTC(issued.getFullYear(), issued.getMonth(), issued.getDate());
  const end = Date.parse(dueDate.slice(0, 10));
  return Number.isFinite(end - start) ? Math.max(0, Math.round((end - start) / 86400000)) : 0;
}

export async function buildLoanPdf(loan: LoanPromise) {
  // Freeze the SVG pose so export is independent of animation and system theme.
  const pennySvg = proudPenny.replace(/<style>[\s\S]*?<\/style>/, "");
  const [{ doc, font, tile, brand }, penny] = await Promise.all([
    createPdf("Kindness loan promise"),
    rasterize("data:image/svg+xml;charset=utf-8," + encodeURIComponent(pennySvg), 62),
  ]);
  const due = formatDate(loan.due_date + (loan.due_date.length === 10 ? "T12:00:00" : ""));
  const issued = formatDate(loan.created_at);
  const amount = formatRM(Number(loan.amount)); // privacy-ok: explicit PDF export
  const days = loanTermDays(loan.created_at, loan.due_date);

  brand();
  font(8.5, 600, colors.action);
  const reference = `PROMISE NO. KL-${loan.id.slice(0, 4).toUpperCase()}`;
  const tracking = 0.35;
  const trackedWidth = doc.getTextWidth(reference) + (reference.length - 1) * tracking;
  doc.text(reference, 195 - trackedWidth, 21.3, { charSpace: tracking });

  tile(15, 33, 180, 89.5, 8, colors.hero);
  doc.saveGraphicsState();
  doc.roundedRect(15, 33, 180, 89.5, 8, 8, null);
  doc.clip();
  doc.discardPath();
  doc.setFillColor(colors.soft);
  doc.setGState(doc.GState({ opacity: 0.55 }));
  doc.circle(175, 45, 46, "F");
  doc.setGState(doc.GState({ opacity: 0.35 }));
  doc.circle(114, 129.5, 23, "F");
  doc.setGState(doc.GState({ opacity: 1 }));
  if (penny) doc.addImage(penny, "PNG", 122.5, 68.5, 62, 62, undefined, "SLOW");
  doc.restoreGraphicsState();

  font(10, 600, colors.navy);
  doc.text("Qard Hasan · a kindness loan", 26, 47.4);
  font(34, 800, colors.ink, "baloo-2");
  doc.text(["My Kindness", "Promise"], 26, 59, { lineHeightFactor: 1.02 });
  font(10, 500, colors.navy);
  const borrower = clampPdfText(doc, `${loan.kidName} borrowed`, 99);
  doc.text(borrower, 26, borrower.length > 1 ? 80 : 84.5);
  font(44, 800, colors.ink, "baloo-2");
  doc.text(amount, 26, 97.4);
  font(9.5, 600);
  const chip = "0% interest, always";
  const chipWidth = doc.getTextWidth(chip) + 8;
  tile(26, 105.5, chipWidth, 7.2, 3.6, colors.shadow);
  tile(26, 105, chipWidth, 7.2, 3.6, colors.mustard);
  doc.text(chip, 30, 110);

  const tiles = [
    { x: 15, width: 68, label: "For", value: loan.reason?.trim() || "None provided" },
    { x: 87, width: 52, label: "Borrowed on", value: issued },
    { x: 143, width: 52, label: "Pay back by", value: due },
  ];
  for (const { x, width, label, value } of tiles) {
    tile(x, 129.5, width, 20, 5, colors.tile);
    font(8.5, 500, colors.action);
    doc.text(label, x + 5, 136.8);
    font(13, 600);
    const lines = clampPdfText(doc, value, width - 10);
    doc.text(lines, x + 5, lines.length > 1 ? 142 : 143.5, { lineHeightFactor: 1.1 });
  }

  font(9, 600, colors.navy);
  const term = `${days} ${days === 1 ? "day" : "days"} to pay back`;
  const pillWidth = doc.getTextWidth(term) + 6;
  const pillLeft = 105 - pillWidth / 2;
  tile(pillLeft, 156, pillWidth, 6.4, 3.2, colors.border);
  doc.text(term, 105, 160.2, { align: "center" });
  font(9, 500, colors.secondary);
  doc.text(issued, 15, 160.2);
  doc.text(due, 195, 160.2, { align: "right" });
  const trackStart = 18 + doc.getTextWidth(issued);
  const trackEnd = 192 - doc.getTextWidth(due);
  tile(trackStart, 158.5, pillLeft - 3 - trackStart, 1.2, 0.6, colors.soft);
  const rightStart = pillLeft + pillWidth + 3;
  tile(rightStart, 158.5, trackEnd - rightStart, 1.2, 0.6, colors.soft);

  font(17, 700, colors.ink, "baloo-2");
  doc.text("My promises", 15, 175.8);
  const promises = [
    `I will pay back ${amount} by ${due}.`,
    "No interest and no late fees. This is a kindness loan (Qard Hasan).",
    "Paying back on time grows my Trust Score.",
    "If I need more time, I will talk to my parent early.",
    "We both agree, with Centsibility as our witness.",
  ];
  font(11);
  let row = 186.6;
  for (const promise of promises) {
    doc.setFillColor(colors.mustard);
    doc.circle(17.8, row - 0.9, 2.8, "F");
    doc.setDrawColor(colors.ink);
    doc.setLineWidth(0.55);
    doc.line(16.6, row - 0.9, 17.5, row);
    doc.line(17.5, row, 19.1, row - 1.7);
    const lines: string[] = doc.splitTextToSize(promise, 171);
    if (promise === promises[0] && lines.length === 1) {
      let x = 24;
      for (const [fragment, weight] of [["I will pay back ", 400], [amount, 600], [" by ", 400], [due + ".", 600]] as const) {
        font(11, weight);
        doc.text(fragment, x, row);
        x += doc.getTextWidth(fragment);
      }
      font(11);
    } else {
      doc.text(lines, 24, row);
    }
    row += 9.2 + (lines.length - 1) * 4;
  }

  for (const [x, label] of [[15, "Signed by me"], [107.5, "Witnessed by my parent"]] as const) {
    doc.setDrawColor(colors.soft);
    doc.setLineWidth(0.28);
    doc.roundedRect(x, 235.5, 87.5, 38, 5, 5);
    font(8.5, 500, colors.action);
    doc.text(label, x + 5, 242.7);
    doc.setDrawColor(colors.hero);
    doc.line(x + 5, 262.5, x + 82.5, 262.5);
    font(10, 600);
    doc.text(clampPdfText(doc, x === 15 ? loan.kidName : "Parent", 53), x + 5, 267.5, { lineHeightFactor: 1.02 });
    font(8.5, 400, colors.action);
    doc.text(x === 15 ? issued : "Date", x + 82.5, 267, { align: "right" });
  }

  if (loan.signature_data_url) {
    try {
      const { width, height } = doc.getImageProperties(loan.signature_data_url);
      const scale = Math.min(45 / width, 15 / height);
      doc.addImage(loan.signature_data_url, "PNG", 20, 260 - height * scale, width * scale, height * scale, undefined, "SLOW");
    } catch {
      // A damaged signature leaves the writing space available.
    }
  }

  font(8.5, 400, colors.action);
  const footer = "Made with Centsibility · Qard Hasan means you pay back exactly what you borrowed.";
  const footerX = (210 - doc.getTextWidth(footer)) / 2 + 3;
  drawPdfSprout(doc, footerX - 4.5, 283.8);
  doc.text(footer, footerX, 283.8);
  return doc;
}

export async function exportLoanPdf(loan: LoanPromise) {
  const doc = await buildLoanPdf(loan);
  const name = `kindness-promise-${loan.due_date.slice(0, 10)}.pdf`;
  await sharePdf(doc, name);
}
