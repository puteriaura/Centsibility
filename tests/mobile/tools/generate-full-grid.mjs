import fs from "fs";
import path from "path";

const VIEWPORTS = [
  "320x568",
  "360x800",
  "390x844",
  "430x932",
  "768x1024",
  "844x390",
];

const ENGINES = ["chromium", "webkit"];

const ROUTES = [
  "landing",
  "login",
  "kid-login",
  "kid-home",
  "kid-wallet",
  "kid-card",
  "kid-goals",
  "kid-loans",
  "kid-invest",
  "kid-zakat",
  "kid-sadaqah",
  "kid-rewards",
  "kid-quiz",
  "kid-chat",
  "kid-insights",
  "parent-home",
  "parent-approvals",
  "parent-insights",
  "parent-reports",
  "parent-settings",
];

function getCellCode(item) {
  if (!item) return "-";
  if (item.rendered === false || item.status === "R") return "R";
  const codes = [];
  if (item.overflow && item.overflow.length > 0) codes.push("O");
  if (item.smallTargets && item.smallTargets.length > 0) codes.push("T");
  if (item.smallFonts && item.smallFonts.length > 0) codes.push("F");
  if (item.errors && item.errors.length > 0) codes.push("E");
  if (item.axeViolations && item.axeViolations.length > 0) codes.push("A");
  return codes.length === 0 ? "ok" : codes.join("");
}

export function generateGrid(jsonPath) {
  if (!fs.existsSync(jsonPath)) {
    console.error(`File not found: ${jsonPath}`);
    return null;
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  
  // Header
  const cols = [];
  for (const eng of ENGINES) {
    const p = eng === "chromium" ? "Cr" : "Wk";
    for (const vp of VIEWPORTS) {
      cols.push(`${p}:${vp.split("x")[0]}`);
    }
  }

  let table = `| Route | ` + cols.join(" | ") + ` |\n`;
  table += `|---|` + cols.map(() => "---").join("|") + `|\n`;

  for (const r of ROUTES) {
    const row = [r];
    for (const eng of ENGINES) {
      for (const vp of VIEWPORTS) {
        const key = `${eng}:${vp}:${r}`;
        const item = data[key];
        row.push(getCellCode(item));
      }
    }
    table += `| ` + row.join(" | ") + ` |\n`;
  }

  // All failing elements
  const failingElements = [];
  for (const [key, item] of Object.entries(data)) {
    if (item.overflow && item.overflow.length > 0) {
      for (const off of item.overflow) {
        failingElements.push({ type: "Overflow", route: item.route, context: key, detail: off });
      }
    }
    if (item.smallTargets && item.smallTargets.length > 0) {
      for (const t of item.smallTargets) {
        failingElements.push({
          type: "TouchTarget",
          route: item.route,
          context: key,
          detail: `${t.selector} (${t.width}x${t.height}px) "${t.text}"`,
        });
      }
    }
    if (item.smallFonts && item.smallFonts.length > 0) {
      for (const f of item.smallFonts) {
        failingElements.push({
          type: "FontFloor",
          route: item.route,
          context: key,
          detail: `${f.selector} (${f.fontSize}px)`,
        });
      }
    }
    if (item.errors && item.errors.length > 0) {
      for (const e of item.errors) {
        failingElements.push({ type: "Error", route: item.route, context: key, detail: e });
      }
    }
    if (item.axeViolations && item.axeViolations.length > 0) {
      for (const a of item.axeViolations) {
        failingElements.push({
          type: "Axe",
          route: item.route,
          context: key,
          detail: `${a.id} [${a.impact}]: ${a.help}`,
        });
      }
    }
  }

  return { table, failingElements };
}

if (process.argv[2]) {
  const res = generateGrid(process.argv[2]);
  if (res) {
    let rCount = 0;
    let okCount = 0;
    let failCount = 0;
    let oCount = 0;
    let tCount = 0;
    let fCount = 0;
    let eCount = 0;
    let aCount = 0;

    const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    for (const item of Object.values(data)) {
      const code = getCellCode(item);
      if (code === "R") rCount++;
      else if (code === "ok") okCount++;
      else {
        failCount++;
        if (code.includes("O")) oCount++;
        if (code.includes("T")) tCount++;
        if (code.includes("F")) fCount++;
        if (code.includes("E")) eCount++;
        if (code.includes("A")) aCount++;
      }
    }

    console.log(res.table);
    console.log(`\n=== SUMMARY STATS ===`);
    console.log(`Total Cells: ${Object.keys(data).length}`);
    console.log(`R (Not Rendered): ${rCount}`);
    console.log(`OK (Passing): ${okCount}`);
    console.log(`FAIL: ${failCount} (O: ${oCount}, T: ${tCount}, F: ${fCount}, E: ${eCount}, A: ${aCount})`);
    console.log(`Total Violations: ${res.failingElements.length}`);
  }
}
