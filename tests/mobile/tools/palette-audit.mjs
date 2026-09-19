import fs from "fs";
import path from "path";

// WCAG relative luminance and contrast ratio helpers
function parseHex(hex) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6); // drop alpha for base contrast
  if (h.length !== 6) return null;
  const num = parseInt(h, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function relativeLuminance(rgb) {
  const srgb = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function contrastRatio(hex1, hex2) {
  const rgb1 = parseHex(hex1);
  const rgb2 = parseHex(hex2);
  if (!rgb1 || !rgb2) return "N/A";
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

const BRAND_PALETTE = {
  mint: "#F3FFE1",
  raspberry: "#DD2D4A",
  bubblegum: "#F26A8D",
  mist: "#F49CBB",
  cyan: "#CBEEF3",
  white: "#FFFFFF",
  ink: "#111111",
  textPrimary: "#252525",
  textSecondary: "#525252",
  textMuted: "#646464",
};

// Patterns to detect in code
const HEX_REGEX = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
const TAILWIND_COLOR_REGEX = /\b(bg|text|border|ring|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-([0-9]{2,3})\b/g;
const GRADIENT_REGEX = /\b(from|via|to)-([a-z0-9#-/[\]]+)\b|linear-gradient\([^)]+\)/g;

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== "node_modules" && f !== ".agents" && f !== "dist") {
        scanDir(full, fileList);
      }
    } else if (/\.(tsx|ts|css)$/.test(f) && !f.endsWith(".d.ts")) {
      fileList.push(full);
    }
  }
  return fileList;
}

export function auditColors() {
  const srcFiles = scanDir(path.resolve("src"));
  const auditEntries = [];

  for (const file of srcFiles) {
    const relPath = path.relative(process.cwd(), file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;

      // 1. Hex matches
      let hexMatch;
      while ((hexMatch = HEX_REGEX.exec(lineText)) !== null) {
        const val = hexMatch[0];
        let role = "Unknown";
        let proposed = "--brand-raspberry";
        let targetBg = "#FFFFFF";

        if (/background|bg-|fill/i.test(lineText)) {
          role = "Background/Fill";
          proposed = "--surface-soft";
        } else if (/color|text-|stroke/i.test(lineText)) {
          role = "Text/Icon";
          proposed = "--ink";
        } else if (/border|ring/i.test(lineText)) {
          role = "Border/Divider";
          proposed = "--border";
        }

        const ratioWhite = contrastRatio(val, "#FFFFFF");
        const ratioMint = contrastRatio(val, "#F3FFE1");

        auditEntries.push({
          file: `${relPath}:${lineNum}`,
          value: val,
          type: "hex",
          role,
          proposedToken: proposed,
          ratioOnWhite: ratioWhite,
          ratioOnMint: ratioMint,
          lineSnippet: lineText.trim().slice(0, 80),
        });
      }

      // 2. Tailwind standard palette classes
      let twMatch;
      while ((twMatch = TAILWIND_COLOR_REGEX.exec(lineText)) !== null) {
        const val = twMatch[0];
        auditEntries.push({
          file: `${relPath}:${lineNum}`,
          value: val,
          type: "tailwind-class",
          role: twMatch[1] === "text" ? "Text" : twMatch[1] === "bg" ? "Background" : "Border",
          proposedToken: twMatch[1] === "text" ? "text-[var(--ink)]" : "bg-[var(--surface-soft)]",
          ratioOnWhite: "token-dependent",
          ratioOnMint: "token-dependent",
          lineSnippet: lineText.trim().slice(0, 80),
        });
      }
    });
  }

  const resultsDir = path.resolve("tests/mobile/results");
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(
    path.join(resultsDir, "audit-colors-raw.json"),
    JSON.stringify(auditEntries, null, 2)
  );

  console.log(`Audited ${srcFiles.length} files. Total color occurrences: ${auditEntries.length}`);
  console.log(`Saved to tests/mobile/results/audit-colors-raw.json`);
  return auditEntries;
}

if (process.argv[1] && process.argv[1].endsWith("palette-audit.mjs")) {
  auditColors();
}
