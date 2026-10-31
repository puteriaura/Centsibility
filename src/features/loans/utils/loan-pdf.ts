import { jsPDF } from "jspdf";
import { formatDate } from "@/lib/format";

export async function exportLoanPdf(loan: {
  amount: number;
  due_date: string;
  reason: string | null;
  created_at: string;
  signature_data_url?: string | null;
  kidName: string;
}) {
  const doc = new jsPDF();

  // Outer pastel border
  doc.setDrawColor(255, 182, 193);
  doc.setLineWidth(3);
  doc.roundedRect(8, 8, 194, 281, 8, 8);
  doc.setDrawColor(255, 215, 0);
  doc.setLineWidth(1);
  doc.roundedRect(11, 11, 188, 275, 6, 6);

  // Title banner
  doc.setFillColor(255, 244, 214);
  doc.roundedRect(15, 18, 180, 30, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(46, 139, 87);
  doc.text("My Super Promise!", 105, 32, { align: "center" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(120, 80, 0);
  doc.text("a friendly Qard Hasan agreement", 105, 42, { align: "center" });

  // Decorative stars (using asterisks — safe glyphs)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 170, 60);
  doc.text("* * *   ~   * * *", 105, 58, { align: "center" });

  // Body box
  doc.setFillColor(245, 252, 245);
  doc.roundedRect(15, 64, 180, 92, 6, 6, "F");

  doc.setFontSize(12);
  let y = 76;
  const row = (k: string, v: string) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(46, 139, 87);
    doc.text(k, 22, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.text(doc.splitTextToSize(v, 110), 75, y);
    y += 12;
  };
  row("Borrower:", loan.kidName);
  row("Amount:", `RM ${Number(loan.amount).toFixed(2)}`);
  row("Reason:", (loan.reason || "-").slice(0, 80));
  row("Issued:", formatDate(loan.created_at));
  row("Pay back by:", loan.due_date);
  row("Interest:", "0% (100% halal)");

  // Promises
  y = 168;
  doc.setFillColor(255, 248, 220);
  doc.roundedRect(15, y, 180, 76, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(204, 102, 0);
  doc.text("My Promises", 22, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  const promises = [
    "1. I will pay back the full amount by the due date.",
    "2. No interest, no late fees - this is a kindness loan.",
    "3. Paying on time grows my Trust Score.",
    "4. Being late will lower my Trust Score (so I'll try my best!).",
    "5. Both of us agree, witnessed by Centsibility.",
  ];
  let py = y + 22;
  promises.forEach((p) => {
    doc.text(p, 22, py, { maxWidth: 168 });
    py += 10;
  });

  // Signature box
  doc.setFillColor(240, 248, 255);
  doc.roundedRect(15, 250, 180, 32, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(70, 70, 200);
  doc.text("Signed by:", 22, 261);

  if (loan.signature_data_url) {
    try {
      doc.addImage(loan.signature_data_url, "PNG", 70, 252, 60, 24);
    } catch {
      /* ignore */
    }
  }
  doc.setLineWidth(0.4);
  doc.setDrawColor(150, 150, 150);
  doc.line(70, 277, 165, 277);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(loan.kidName, 70, 282);

  const safeName = loan.kidName.replace(/[^a-z0-9-_]/gi, "_");
  const name = `my-super-promise-${safeName}-${loan.due_date}.pdf`;
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
