import { jsPDF } from "jspdf";

// App ink, navy, secondary ink, action text, periwinkle, soft blue,
// blue border, tinted surface, mustard and mustard shadow.
export const colors = {
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

export async function rasterize(url: string, sizeMm: number, cornerRadiusMm = 0) {
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

export function clampPdfText(doc: jsPDF, value: string, width: number, maxLines = 2) {
  const lines: string[] = doc.splitTextToSize(value, width);
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  let tail = visible[maxLines - 1].trimEnd();
  while (tail && doc.getTextWidth(tail + "…") > width) tail = tail.slice(0, -1).trimEnd();
  visible[maxLines - 1] = tail + "…";
  return visible;
}

export async function createPdf(title: string) {
  const doc = new jsPDF({ format: "a4", orientation: "portrait", unit: "mm", compress: true, putOnlyUsedFonts: true });
  doc.setProperties({ title, creator: "Centsibility" });
  const [embedded, icon] = await Promise.all([
    registerFonts(doc),
    rasterize("/icons/app-192.png", 11, 2.6),
  ]);
  const font = (size: number, weight = 400, color = colors.ink, family = "lexend") => {
    doc.setFont(embedded ? family : "helvetica", embedded ? String(weight) : weight >= 600 ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color);
  };
  const tile = (x: number, y: number, width: number, height: number, radius: number, color: string) => {
    doc.setFillColor(color);
    doc.roundedRect(x, y, width, height, radius, radius, "F");
  };
  const brand = () => {
    if (icon) doc.addImage(icon, "PNG", 15, 15, 11, 11);
    font(19, 800, colors.navy, "baloo-2");
    doc.text("Centsibility", icon ? 29 : 15, 22.3);
  };
  return { doc, font, tile, brand };
}

export function drawPdfSprout(doc: jsPDF, sprout: number, y: number) {
  doc.setDrawColor(colors.action);
  doc.setLineWidth(0.3);
  doc.line(sprout, y + 0.8, sprout, y - 1.2);
  doc.setFillColor(colors.hero);
  doc.ellipse(sprout + 0.7, y - 1.4, 0.9, 0.45, "F");
  doc.setFillColor(colors.mustard);
  doc.ellipse(sprout - 0.6, y - 0.8, 0.7, 0.42, "F");
}

export async function sharePdf(doc: jsPDF, name: string) {
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
