import { formatRM } from "./format";
import { transactionAmount } from "./finance";
import { transactionTitle, transactionTypeLabel } from "./labels";
import { clampPdfText, colors, createPdf, drawPdfSprout, sharePdf } from "./pdf";
import { statementPdfCategories, summarizeStatement } from "./statement";
import type { StatementResult } from "@/types/domain";

const success = "#0E7A4E";
const bars = ["#6B81B5", colors.mustard, success, colors.hero, colors.secondary, colors.soft];
const timeZone = "Asia/Kuala_Lumpur";
const shortDate = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" });
const monthDate = new Intl.DateTimeFormat("en-GB", { timeZone, month: "long", year: "numeric" });
const calendarDate = (day: string) => new Date(day + "T12:00:00Z");

export function statementPdfFilename(from: string) {
  return `statement-${from.slice(0, 7)}.pdf`;
}

export async function buildStatementPdf(statement: NonNullable<StatementResult>, generatedAt = new Date()) {
  const { doc, brand, font, tile } = await createPdf("Monthly statement");
  const { transactions, balances, balanceMap, categories, totalIn, totalOut, net } = summarizeStatement(statement);
  const from = calendarDate(statement.period.from);
  const to = calendarDate(statement.period.to);
  const month = monthDate.format(from);
  const title = `${statement.kid.name}'s statement`;
  const amount = (value: number) => formatRM(value); // privacy-ok: explicit PDF export
  const signed = (value: number) => (value < 0 ? "−" : "+") + amount(Math.abs(value));
  const rule = (left: number, right: number, y: number, color = colors.soft) => {
    doc.setDrawColor(color);
    doc.setLineWidth(0.28);
    doc.line(left, y, right, y);
  };

  brand();
  font(8.5, 600, colors.action);
  const heading = "MONTHLY STATEMENT";
  const tracking = 0.36;
  doc.text(heading, 195 - doc.getTextWidth(heading) - (heading.length - 1) * tracking, 18.6, { charSpace: tracking });
  font(12, 600);
  doc.text(month, 195, 24.3, { align: "right" });
  font(26, 800, colors.ink, "baloo-2");
  doc.text(clampPdfText(doc, title, 180, 1), 15, 39.2, { charSpace: -0.18 });
  font(10, 400, colors.action);
  const startLabel = statement.period.from.slice(0, 7) === statement.period.to.slice(0, 7)
    ? String(Number(statement.period.from.slice(-2))) : shortDate.format(from);
  doc.text(`${startLabel} to ${longDate.format(to)} · Spending wallet · Amounts in RM`, 15, 46.3);

  tile(15, 53.2, 180, 50.5, 7, colors.hero);
  doc.saveGraphicsState();
  doc.roundedRect(15, 53.2, 180, 50.5, 7, 7, null);
  doc.clip();
  doc.discardPath();
  doc.setGState(doc.GState({ opacity: 0.5 }));
  doc.setFillColor(colors.soft);
  doc.circle(179, 57.2, 40, "F");
  doc.setGState(doc.GState({ opacity: 0.72 }));
  tile(111.5, balances ? 61.1 : 64.4, 74.5, balances ? 34.4 : 27.8, 5, "#FFFFFF");
  doc.restoreGraphicsState();

  font(10, 600, colors.navy);
  doc.text(balances ? `Closing balance on ${shortDate.format(to)}` : "Spending wallet", 24, 72.2);
  if (balances) {
    const closing = amount(balances.closing);
    font(38, 800, colors.ink, "baloo-2");
    if (doc.getTextWidth(closing) > 83) doc.setFontSize(38 * 83 / doc.getTextWidth(closing));
    doc.text(closing, 24, 84.8);
  } else {
    font(27, 800, colors.ink, "baloo-2");
    doc.text("Monthly activity", 24, 84.8);
  }

  const stat = (label: string, value: string, y: number, color = colors.ink) => {
    font(10, 600, color);
    const valueWidth = doc.getTextWidth(value);
    doc.text(value, 181, y, { align: "right" });
    font(10, 400, colors.secondary);
    const labelWidth = 61 - valueWidth;
    if (doc.getTextWidth(label) > labelWidth) doc.setFontSize(10 * labelWidth / doc.getTextWidth(label));
    doc.text(label, 116.5, y);
  };
  if (balances) stat(`Opening balance on ${shortDate.format(from)}`, amount(balances.opening), 68.6);
  stat("Money in", signed(totalIn), balances ? 75.2 : 72, success);
  stat("Money out", "−" + amount(totalOut), balances ? 81.8 : 78.6);
  rule(116.5, 181, balances ? 85 : 82);
  stat("Change this month", signed(net), balances ? 90.7 : 87.7, net >= 0 ? success : colors.ink);

  let titleY = 115.5;
  const categoryRows = statementPdfCategories(categories);
  if (categoryRows.length) {
    font(15, 700, colors.ink, "baloo-2");
    doc.text("Where the money went", 15, titleY);
    let y = 124.1;
    for (const [index, category] of categoryRows.entries()) {
      const percentage = `${category.percent}%`;
      font(8.5, 400, colors.action);
      const pctWidth = doc.getTextWidth(percentage);
      font(9.5);
      const availableWidth = 40 - pctWidth - 1.5;
      const measuredWidth = doc.getTextWidth(category.name);
      if (measuredWidth > availableWidth) doc.setFontSize(Math.max(6, 9.4 * availableWidth / measuredWidth));
      const label = doc.getTextWidth(category.name) <= availableWidth
        ? category.name : clampPdfText(doc, category.name, availableWidth, 1)[0];
      doc.text(label, 15, y);
      const labelWidth = doc.getTextWidth(label);
      font(8.5, 400, colors.action);
      doc.text(percentage, 16.5 + labelWidth, y);
      tile(57, y - 2.7, 112, 2.6, 1.3, colors.border);
      const width = 112 * category.fraction;
      tile(57, y - 2.7, width, 2.6, Math.min(width / 2, 1.3), bars[index] ?? colors.action);
      font(9.5, 600);
      doc.text(amount(category.value), 195, y, { align: "right" });
      y += 6.8;
    }
    titleY = y + 6.1;
  }
  font(15, 700, colors.ink, "baloo-2");
  doc.text("Transactions", 15, titleY);

  const amountX = balances ? 168 : 192;
  const tableHeader = (baseline: number) => {
    font(8, 500, colors.action);
    doc.text("Date", 18, baseline);
    doc.text("Description", 35, baseline);
    doc.text("Amount", amountX, baseline, { align: "right" });
    if (balances) doc.text("Balance", 192, baseline, { align: "right" });
    rule(15, 195, baseline + 3);
    return baseline + 3;
  };
  let rowTop = tableHeader(titleY + 7.9);
  if (!transactions.length) {
    font(9, 400, colors.action);
    doc.text("No wallet transactions this month.", 18, rowTop + 6);
  }
  let rowOnPage = 0;
  for (const tx of transactions) {
    font(9, 500);
    const description = clampPdfText(doc, transactionTitle(tx), amountX - 61, 3);
    const rowHeight = 12 + (description.length - 1) * 4;
    if (rowTop + rowHeight > 269) {
      doc.addPage();
      font(13, 700, colors.ink, "baloo-2");
      doc.text(clampPdfText(doc, `${title} · ${month}`, 155, 1), 15, 20.2);
      font(9, 400, colors.action);
      doc.text("Continued", 195, 20.2, { align: "right" });
      rule(15, 195, 25.7, colors.border);
      rowTop = tableHeader(37.3);
      rowOnPage = 0;
    }
    if (rowOnPage % 2 === 1) {
      doc.setFillColor("#F5F6FA");
      doc.rect(15, rowTop, 180, rowHeight, "F");
    }
    const baseline = rowTop + 5.1;
    font(9, 400, colors.secondary);
    doc.text(shortDate.format(new Date(tx.created_at)), 18, baseline);
    font(9, 500);
    doc.text(description, 35, baseline, { lineHeightFactor: 4 / (9 * 25.4 / 72) });
    font(7.5, 400, colors.action);
    doc.text(transactionTypeLabel(tx.type, tx.label), 35, baseline + 4 * description.length);
    const txAmount = transactionAmount(tx.type, tx.label, tx.amount);
    font(9, 600, txAmount.tone === "in" ? success : colors.ink);
    doc.text(txAmount.text, amountX, baseline, { align: "right" });
    const running = balanceMap.get(tx.id);
    if (running !== undefined) {
      font(9, 400, colors.action);
      doc.text(amount(running), 192, baseline, { align: "right" });
    }
    rowTop += rowHeight;
    rowOnPage++;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    drawPdfSprout(doc, 17.3, 284.9);
    font(8, 400, colors.action);
    doc.text(`Made with Centsibility · Practice money for families, not a bank account · Generated ${longDate.format(generatedAt)}`, 21.4, 284.9);
    font(8, 500, colors.action);
    doc.text(`Page ${page} of ${pages}`, 195, 284.9, { align: "right" });
  }
  return doc;
}

export async function exportStatementPdf(statement: NonNullable<StatementResult>) {
  await sharePdf(await buildStatementPdf(statement), statementPdfFilename(statement.period.from));
}
