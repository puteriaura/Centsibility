import { jsPDF } from "jspdf";
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

// App ink, navy, secondary ink, action text, periwinkle, soft blue,
// blue border, tinted surface, mustard and mustard shadow.
const colors = {
  ink: "#151E31", navy: "#22355B", secondary: "#344C7B", action: "#47629A",
  hero: "#A0B0DA", soft: "#C7D0EA", border: "#E2E7F4", tile: "#F1F3FB",
  mustard: "#DDC518", shadow: "#A6930E",
};

const faces = [
  ["baloo-2", 700], ["baloo-2", 800],
  ["lexend", 400], ["lexend", 500], ["lexend", 600],
] as const;

async function registerFonts(doc: jsPDF) {
  try {
    const fonts = await Promise.all(faces.map(async ([family, weight]) => {
      const name = `${family}-latin-${weight}-normal.ttf`;
      const response = await fetch(`/fonts/pdf/${name}`);
      if (!response.ok) throw new Error("PDF font unavailable");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 8192) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      }
      return { name, family, weight, binary };
    }));
    for (const { name, family, weight, binary } of fonts) {
      doc.addFileToVFS(name, binary);
      doc.addFont(name, family, String(weight));
    }
    return true;
  } catch {
    return false;
  }
}

async function rasterize(url: string, sizeMm: number, cornerRadiusMm = 0) {
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.ceil(sizeMm * 96 / 25.4 * 3);
    const context = canvas.getContext("2d");
    if (!context) return null;
    if (cornerRadiusMm) {
      context.beginPath();
      context.roundRect(0, 0, canvas.width, canvas.height, canvas.width * cornerRadiusMm / sizeMm);
      context.clip();
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export function loanTermDays(issuedAt: string, dueDate: string) {
  const issued = new Date(issuedAt.length === 10 ? issuedAt + "T12:00:00" : issuedAt);
  const start = Date.UTC(issued.getFullYear(), issued.getMonth(), issued.getDate());
  const end = Date.parse(dueDate.slice(0, 10));
  return Number.isFinite(end - start) ? Math.max(0, Math.round((end - start) / 86400000)) : 0;
}

export function clampPdfText(doc: jsPDF, value: string, width: number, maxLines = 2) {
  const lines: string[] = doc.splitTextToSize(value, width);
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  let tail = visible[maxLines - 1].trimEnd();
  while (tail && doc.getTextWidth(tail + "…") > width) tail = tail.slice(0, -1).trimEnd();
  visible[maxLines - 1] = tail + "…";
  return visible;
}

export async function buildLoanPdf(loan: LoanPromise) {
  const doc = new jsPDF({ format: "a4", orientation: "portrait", unit: "mm", compress: true, putOnlyUsedFonts: true });
  doc.setProperties({ title: "Kindness loan promise", creator: "Centsibility" });
  // Freeze the SVG pose so export is independent of animation and system theme.
  const pennySvg = proudPenny.replace(/<style>[\s\S]*?<\/style>/, "");
  const [embedded, penny, icon] = await Promise.all([
    registerFonts(doc),
    rasterize("data:image/svg+xml;charset=utf-8," + encodeURIComponent(pennySvg), 62),
    rasterize("/icons/app-192.png", 11, 2.6),
  ]);

  const font = (size: number, weight = 400, color = colors.ink, family = "lexend") => {
    doc.setFont(embedded ? family : "helvetica", embedded ? String(weight) : weight >= 600 ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color);
  };
  const tile = (x: number, y: number, w: number, h: number, radius: number, color: string) => {
    doc.setFillColor(color);
    doc.roundedRect(x, y, w, h, radius, radius, "F");
  };
  const due = formatDate(loan.due_date + (loan.due_date.length === 10 ? "T12:00:00" : ""));
  const issued = formatDate(loan.created_at);
  const amount = formatRM(Number(loan.amount)); // privacy-ok: explicit PDF export
  const days = loanTermDays(loan.created_at, loan.due_date);

  if (icon) doc.addImage(icon, "PNG", 15, 15, 11, 11);
  font(19, 800, colors.navy, "baloo-2");
  doc.text("Centsibility", icon ? 29 : 15, 22.3);
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
  const sprout = footerX - 4.5;
  doc.setDrawColor(colors.action);
  doc.setLineWidth(0.3);
  doc.line(sprout, 284.6, sprout, 282.6);
  doc.setFillColor(colors.hero);
  doc.ellipse(sprout + 0.7, 282.4, 0.9, 0.45, "F");
  doc.setFillColor(colors.mustard);
  doc.ellipse(sprout - 0.6, 283, 0.7, 0.42, "F");
  doc.text(footer, footerX, 283.8);
  return doc;
}

export async function exportLoanPdf(loan: LoanPromise) {
  const doc = await buildLoanPdf(loan);
  const name = `kindness-promise-${loan.due_date.slice(0, 10)}.pdf`;
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
