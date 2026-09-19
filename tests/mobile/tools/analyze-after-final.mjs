import fs from "fs";

const data = JSON.parse(fs.readFileSync("tests/mobile/results/after-final.json", "utf8"));
const smallTargets = [];
const smallFonts = [];
const errors = [];
const axeViolations = [];

for (const [key, item] of Object.entries(data)) {
  if (item.smallTargets) {
    for (const t of item.smallTargets) {
      smallTargets.push({
        key,
        route: item.route,
        selector: t.selector,
        size: `${t.width}x${t.height}px`,
        text: t.text,
      });
    }
  }
  if (item.smallFonts) {
    for (const f of item.smallFonts) {
      smallFonts.push({
        key,
        route: item.route,
        selector: f.selector,
        fontSize: `${f.fontSize}px`,
      });
    }
  }
  if (item.errors) {
    for (const e of item.errors) {
      errors.push({ key, route: item.route, error: e });
    }
  }
  if (item.axeViolations) {
    for (const a of item.axeViolations) {
      axeViolations.push({ key, route: item.route, id: a.id, impact: a.impact, help: a.help });
    }
  }
}

console.log("=== UNIQUE SMALL TARGETS IN AFTER-FINAL ===");
const targetMap = new Map();
for (const t of smallTargets) {
  const k = `${t.selector} (${t.size}) text: "${t.text}"`;
  if (!targetMap.has(k)) targetMap.set(k, new Set());
  targetMap.get(k).add(`${t.route} [${t.key}]`);
}
for (const [k, v] of targetMap.entries()) {
  console.log(`- ${k}\n  Routes/Tests: ${Array.from(v).join(", ")}`);
}

console.log("\n=== UNIQUE SMALL FONTS IN AFTER-FINAL ===");
const fontMap = new Map();
for (const f of smallFonts) {
  const k = `${f.selector} (${f.fontSize})`;
  if (!fontMap.has(k)) fontMap.set(k, new Set());
  fontMap.get(k).add(`${f.route} [${f.key}]`);
}
for (const [k, v] of fontMap.entries()) {
  console.log(`- ${k}\n  Routes/Tests: ${Array.from(v).join(", ")}`);
}

console.log("\n=== UNIQUE ERRORS IN AFTER-FINAL ===");
const errorMap = new Map();
for (const e of errors) {
  const firstLine = e.error.split("\n")[0];
  if (!errorMap.has(firstLine)) errorMap.set(firstLine, new Set());
  errorMap.get(firstLine).add(e.route);
}
for (const [k, v] of errorMap.entries()) {
  console.log(`- ${k} on routes: ${Array.from(v).join(", ")}`);
}

console.log("\n=== AXE VIOLATIONS COUNT IN AFTER-FINAL ===");
const axeMap = new Map();
for (const a of axeViolations) {
  const k = `${a.id} [${a.impact}]: ${a.help}`;
  axeMap.set(k, (axeMap.get(k) || 0) + 1);
}
for (const [k, v] of axeMap.entries()) {
  console.log(`- ${k}: ${v} occurrences`);
}
