import { chromium } from "@playwright/test";

const ROUTES = [
  "/", "/login", "/kid-login", "/kid/wallet", "/kid/card",
  "/kid/goals", "/kid/loans", "/kid/invest", "/kid/zakat",
  "/kid/sadaqah", "/kid/rewards", "/kid/chat", "/kid/insights"
];

async function check() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
  });

  await context.addInitScript(() => {
    sessionStorage.setItem("centsibility:admin-bypass-kid", "true");
    localStorage.setItem(
      "centsibility.kid",
      JSON.stringify({
        kidId: "demo-kid-aiman",
        code: "AIMAN1",
        name: "Aiman",
        expiresAt: Date.now() + 86400000,
      })
    );
  });

  const page = await context.newPage();
  let failures = [];

  for (const r of ROUTES) {
    await page.goto(`http://localhost:4173${r}`, { waitUntil: "networkidle" });
    const res = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("input, select, textarea"));
      const textTypes = new Set(["text", "email", "password", "search", "tel", "url", "number", ""]);
      const fails = [];
      for (const el of els) {
        if (el.tagName === "INPUT" && !textTypes.has((el.type || "").toLowerCase())) continue;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const fs = parseFloat(style.fontSize);
        if (fs < 15.5) {
          fails.push({ id: el.id, tag: el.tagName, type: el.type, fontSize: fs, cls: el.className });
        }
      }
      return fails;
    });
    if (res.length > 0) {
      failures.push({ route: r, fails: res });
    }
  }

  await browser.close();
  console.log(`Routes checked at 320px: ${ROUTES.length}`);
  console.log(`Input font failures: ${JSON.stringify(failures, null, 2)}`);
  if (failures.length > 0) process.exit(1);
}

check();
