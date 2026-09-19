import fs from "fs";

function analyzeCells(file) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let totalCells = 0;
  let passingCells = 0;
  let failingCells = 0;
  let oCells = 0, tCells = 0, fCells = 0, eCells = 0, aCells = 0;
  let totalViolations = 0;

  for (const [key, item] of Object.entries(data)) {
    totalCells++;
    let hasFail = false;
    if (item.overflow && item.overflow.length > 0) { oCells++; hasFail = true; totalViolations += item.overflow.length; }
    if (item.smallTargets && item.smallTargets.length > 0) { tCells++; hasFail = true; totalViolations += item.smallTargets.length; }
    if (item.smallFonts && item.smallFonts.length > 0) { fCells++; hasFail = true; totalViolations += item.smallFonts.length; }
    if (item.errors && item.errors.length > 0) { eCells++; hasFail = true; totalViolations += item.errors.length; }
    if (item.axeViolations && item.axeViolations.length > 0) { aCells++; hasFail = true; totalViolations += item.axeViolations.length; }

    if (hasFail) failingCells++;
    else passingCells++;
  }

  return { totalCells, passingCells, failingCells, oCells, tCells, fCells, eCells, aCells, totalViolations };
}

console.log("=== CELL STATS ===");
console.log("BEFORE:", JSON.stringify(analyzeCells("tests/mobile/results/before-final.json"), null, 2));
console.log("AFTER:", JSON.stringify(analyzeCells("tests/mobile/results/after-final.json"), null, 2));
