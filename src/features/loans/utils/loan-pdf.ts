import { jsPDF } from "jspdf";
import { formatDate, formatRM } from "@/lib/format";

export async function exportLoanPdf(loan: {
  amount: number;
  due_date: string;
  reason: string | null;
  created_at: string;
  signature_data_url?: string | null;
  kidName: string;
}) {
  const doc = new jsPDF();

  doc.setFillColor("#A0B0DA"); // --blue-300 / --brand-card
  doc.setTextColor("#151E31"); // --blue-900 / --on-brand-card
  doc.setDrawColor("#151E31");
  doc.roundedRect(18, 18, 174, 44, 5, 5, "F");
  doc.line(32, 44, 32, 36);
  doc.ellipse(29, 35, 3, 2);
  doc.ellipse(35, 32, 3, 2);
  doc.line(32, 37, 35, 33);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.text("Kindness loan promise", 44, 37);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Qard Hasan · 0% interest", 44, 48);

  doc.setDrawColor("#E4E7F1"); // --gray-200
  doc.setLineWidth(0.2);
  let y = 78;
  for (const [label, value] of [
    ["Borrower", loan.kidName],
    ["Amount", formatRM(Number(loan.amount))], // privacy-ok: explicit PDF export
    ["Reason", loan.reason?.slice(0, 240) || "None provided"],
    ["Issued", formatDate(loan.created_at)],
    ["Pay back by", formatDate(loan.due_date)],
  ]) {
    doc.setFont("helvetica", "bold");
    doc.text(label, 22, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, 116);
    doc.text(lines, 72, y);
    y += Math.max(1, lines.length) * 5 + 7;
    doc.line(22, y - 6, 188, y - 6);
  }

  doc.setFont("helvetica", "bold");
  doc.text("My promises", 22, y + 5);
  doc.setFont("helvetica", "normal");
  [
    "I will pay back the full amount by the due date.",
    "There is no interest and there are no late fees.",
    "Paying on time helps build my trust score.",
    "Paying late lowers my trust score.",
    "Both of us agree, witnessed by Centsibility.",
  ].forEach((promise, i) => doc.text(`${i + 1}. ${promise}`, 22, y + 15 + i * 8));

  const signatureTop = y + 56;
  doc.roundedRect(22, signatureTop, 166, 36, 2, 2);
  doc.text("Signature", 27, signatureTop + 8);
  if (loan.signature_data_url) {
    try {
      doc.addImage(loan.signature_data_url, "PNG", 68, signatureTop + 3, 60, 24);
    } catch {
      // Leave the signature box available if the image is damaged.
    }
  }
  doc.line(68, signatureTop + 28, 174, signatureTop + 28);
  doc.setFontSize(10);
  doc.text("Made with Centsibility", 105, 280, { align: "center" });

  const safeName = loan.kidName.replace(/[^a-z0-9-_]/gi, "_");
  const name = `kindness-loan-promise-${safeName}-${loan.due_date}.pdf`;
  const file = new File([doc.output("blob")], name, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
    }
  }
  doc.save(name);
}
