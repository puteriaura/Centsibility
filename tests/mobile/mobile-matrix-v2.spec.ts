import { test, expect, chromium, webkit } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "fs";
import path from "path";

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "844x390", width: 844, height: 390 },
];

const ROUTES = [
  { path: "/", type: "public", name: "landing", proof: { selector: "header, .landing-hero, a[href='/login'], text=Smart Money" } },
  { path: "/login", type: "public", name: "login", proof: { selector: "input[type='email'], button[type='submit'], text=Parent Login" } },
  { path: "/kid-login", type: "public", name: "kid-login", proof: { selector: "input, button, .kid-login, text=Young Saver Login" } },
  { path: "/kid", type: "kid", name: "kid-home", proof: { selector: ".kid-greeting__name, .kid-page, .kid-bottom-nav, text=Cmdr." } },
  { path: "/kid/wallet", type: "kid", name: "kid-wallet", proof: { selector: ".stat-card, text=Deposit, a[href='/kid/wallet'], text=Total Balance" } },
  { path: "/kid/card", type: "kid", name: "kid-card", proof: { selector: ".debit-card, h1, text=Debit Card-i" } },
  { path: "/kid/goals", type: "kid", name: "kid-goals", proof: { selector: "text=Savings Pots, h1" } },
  { path: "/kid/loans", type: "kid", name: "kid-loans", proof: { selector: "text=Qard Hasan, text=Good-will Loan, text=My Loans" } },
  { path: "/kid/invest", type: "kid", name: "kid-invest", proof: { selector: "text=Halal Growth, text=Risk Tier" } },
  { path: "/kid/zakat", type: "kid", name: "kid-zakat", proof: { selector: "text=Zakat Calculator, text=Nisab, text=How Zakat on Wealth Works" } },
  { path: "/kid/sadaqah", type: "kid", name: "kid-sadaqah", proof: { selector: "text=Sadaqah, text=Local Masjid, text=Voluntary Charity" } },
  { path: "/kid/rewards", type: "kid", name: "kid-rewards", proof: { selector: "text=Reward Store, h1" } },
  { path: "/kid/quiz", type: "kid", name: "kid-quiz", proof: { selector: "text=Halal Quest, text=Question" } },
  { path: "/kid/chat", type: "kid", name: "kid-chat", proof: { selector: "text=Penny, textarea, input[placeholder*='Ask']" } },
  { path: "/kid/insights", type: "kid", name: "kid-insights", proof: { selector: ".insights-ask-hero__title, text=Create budget, text=Financial Insights" } },
  { path: "/parent", type: "parent", name: "parent-home", proof: { selector: ".parent-home, .parent-page, text=Parent Dashboard" } },
  { path: "/parent/approvals", type: "parent", name: "parent-approvals", proof: { selector: "text=Notifications, .settings-page-title" } },
  { path: "/parent/insights", type: "parent", name: "parent-insights", proof: { selector: "section.deposit-hero, text=Family cashflow, text=Spending recap" } },
  { path: "/parent/reports", type: "parent", name: "parent-reports", proof: { selector: "text=Financial Report, h1" } },
  { path: "/parent/settings", type: "parent", name: "parent-settings", proof: { selector: "nav[aria-label='Settings sections'], .settings-profile, text=Settings" } },
];

const BASE_URL = process.env.BASE_URL || "http://localhost:4173";
const RESULTS_DIR = path.resolve(process.cwd(), "tests/mobile/results");
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, "screenshots");
const OUTPUT_FILE = path.join(RESULTS_DIR, process.env.MATRIX_OUT || "after-v2.json");

fs.mkdirSync(RESULTS_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const resultsRecord: Record<string, any> = {};

function saveResults() {
  if (Object.keys(resultsRecord).length > 0) {
    let existing: Record<string, any> = {};
    try {
      if (fs.existsSync(OUTPUT_FILE)) {
        existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf8"));
      }
    } catch {}
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ ...existing, ...resultsRecord }, null, 2));
  }
}

test.afterAll(() => {
  saveResults();
});

for (const engineName of ["chromium", "webkit"] as const) {
  test.describe(`Engine: ${engineName}`, () => {
    for (const vp of VIEWPORTS) {
      test.describe(`Viewport ${vp.name}`, () => {
        for (const route of ROUTES) {
          test(`${route.name} (${route.path})`, async () => {
            const browserType = engineName === "chromium" ? chromium : webkit;
            const browser = await browserType.launch({ headless: true });
            const context = await browser.newContext({
              viewport: { width: vp.width, height: vp.height },
              deviceScaleFactor: 2,
            });

            // Network layer mocking for Supabase calls to avoid 401 unhandled rejections
            await context.route("**/functions/v1/**", async (r) => {
              const url = r.request().url();
              const postData = r.request().postDataJSON() || {};
              if (postData.action === "quiz-state") {
                await r.fulfill({
                  status: 200,
                  contentType: "application/json",
                  body: JSON.stringify({
                    date: new Date().toISOString().split("T")[0],
                    correct: 2,
                    wrong: 0,
                    index: 2,
                    maxPerDay: 5,
                    maxWrong: 2,
                  }),
                });
              } else if (url.includes("kid-finance") || postData.action === "get-state") {
                await r.fulfill({
                  status: 200,
                  contentType: "application/json",
                  body: JSON.stringify({
                    kid: {
                      id: "demo-kid-aiman",
                      parent_id: "demo-parent-id",
                      name: "Aiman",
                      username: "aiman",
                      login_code: "AIMAN1",
                      balance: 142.5,
                      coins: 520,
                      avatar: "🚀",
                      streak: 5,
                      level: 3,
                      xp: 450,
                      trust_score: 95,
                      hibah_rate: 0.05,
                      invest_balance: 50.0,
                    },
                    txs: [],
                    goals: [],
                    approvals: [],
                    rewards: [],
                    loans: [],
                  }),
                });
              } else {
                await r.fulfill({
                  status: 200,
                  contentType: "application/json",
                  body: JSON.stringify({
                    ok: true,
                    pin_hash: null,
                    kids: [{ id: "demo-kid-aiman", name: "Aiman" }],
                    approvals: [],
                    rewards: [],
                    loans: [],
                    transactions: [],
                    scheduledHibahs: [],
                  }),
                });
              }
            });

            await context.route("**/rest/v1/**", async (r) => {
              await r.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify([]),
              });
            });

            if (route.type === "kid") {
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
            } else if (route.type === "parent") {
              await context.addInitScript(() => {
                sessionStorage.setItem("centsibility:admin-bypass-parent", "true");
                sessionStorage.setItem(
                  "parentSessionValidUntil",
                  String(Date.now() + 3600000)
                );
              });
            }

            const page = await context.newPage();
            const errors: string[] = [];
            page.on("pageerror", (err) => errors.push(`PageError: ${err.message}`));
            page.on("console", (msg) => {
              if (msg.type() === "error") {
                errors.push(`ConsoleError: ${msg.text()}`);
              }
            });

            // V2: Wait for networkidle
            await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });

            // V2: Wait for document.fonts.ready and all stylesheet link tags to load
            await page.evaluate(async () => {
              if (document.fonts) {
                await document.fonts.ready;
              }
              const links = Array.from(document.querySelectorAll("link[rel=stylesheet]"));
              await Promise.all(
                links.map((link) => {
                  const l = link as HTMLLinkElement;
                  if (l.sheet) return Promise.resolve();
                  return new Promise((resolve) => {
                    l.addEventListener("load", resolve, { once: true });
                    l.addEventListener("error", resolve, { once: true });
                    setTimeout(resolve, 3000);
                  });
                })
              );
            });

            await page.waitForTimeout(200);

            // V2: Screenshot capture
            const screenshotRel = `screenshots/${engineName}-${vp.name}-${route.name}.png`;
            const screenshotPath = path.join(RESULTS_DIR, screenshotRel);
            await page.screenshot({ path: screenshotPath, fullPage: false });

            // V2: RENDER PROOF check
            const renderInfo = await page.evaluate((proofSelector) => {
              const h1El = document.querySelector("h1");
              const h1Text = h1El ? (h1El.innerText || "").trim() : "";
              const bodyText = (document.body ? document.body.innerText : "").trim();
              const bodyLength = bodyText.length;

              const hasErrorBoundary =
                h1Text.toLowerCase().includes("something went wrong") ||
                document.querySelector(".error-boundary") !== null ||
                bodyText.includes("Something went wrong");

              const currentPath = window.location.pathname;
              const isKidAuthGate =
                currentPath.startsWith("/kid-login") ||
                bodyText.includes("Young Saver Login");
              const isParentAuthGate =
                currentPath.startsWith("/login") ||
                bodyText.includes("Parent Login");

              const isBlank = bodyLength === 0;

              let proofMatched = false;
              try {
                if (proofSelector) {
                  const selectors = proofSelector.split(",").map((s: string) => s.trim());
                  for (const sel of selectors) {
                    if (sel.startsWith("text=")) {
                      const target = sel.slice(5).replace(/['"]/g, "").toLowerCase();
                      if (bodyText.toLowerCase().includes(target)) {
                        proofMatched = true;
                        break;
                      }
                    } else if (document.querySelector(sel)) {
                      proofMatched = true;
                      break;
                    }
                  }
                }
              } catch {}

              return {
                h1Text,
                bodyLength,
                hasErrorBoundary,
                isKidAuthGate,
                isParentAuthGate,
                isBlank,
                proofMatched,
                currentPath,
              };
            }, route.proof.selector);

            const isGate =
              (route.type === "kid" && renderInfo.isKidAuthGate) ||
              (route.type === "parent" && renderInfo.isParentAuthGate);
            const isRendered =
              !renderInfo.hasErrorBoundary &&
              !isGate &&
              !renderInfo.isBlank &&
              renderInfo.proofMatched;

            // 1. Horizontal overflow measurement (walk DOM for right edge > innerWidth)
            const overflow = await page.evaluate(() => {
              const winWidth = window.innerWidth;
              const docWidth = document.documentElement.scrollWidth;
              const offenders: string[] = [];

              if (docWidth > winWidth) {
                const all = Array.from(document.querySelectorAll("body *"));
                for (const el of all) {
                  const htmlEl = el as HTMLElement;
                  const rect = htmlEl.getBoundingClientRect();
                  if (rect.right > winWidth + 1) {
                    const tag = htmlEl.tagName.toLowerCase();
                    const id = htmlEl.id ? `#${htmlEl.id}` : "";
                    const cls = htmlEl.className && typeof htmlEl.className === "string"
                      ? "." + htmlEl.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".")
                      : "";
                    offenders.push(`${tag}${id}${cls} (right: ${Math.round(rect.right)}px > ${winWidth}px)`);
                  }
                }
              }
              return { hasOverflow: docWidth > winWidth, docWidth, winWidth, offenders };
            });

            // 2. Interactive touch targets (< 44x44)
            const smallTargets = await page.evaluate(() => {
              const selectors = 'button, a, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
              const elements = Array.from(document.querySelectorAll(selectors));
              const offenders: Array<{ selector: string; width: number; height: number; text: string }> = [];

              for (const el of elements) {
                const htmlEl = el as HTMLElement;
                const style = window.getComputedStyle(htmlEl);
                if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
                  continue;
                }
                const rect = htmlEl.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) continue;

                // Exempt inline links inside paragraphs
                if (htmlEl.tagName === "A" && htmlEl.closest("p")) continue;

                // For checkbox/radio, check hit area of input OR wrapping label
                if (htmlEl.tagName === "INPUT") {
                  const inputType = (htmlEl as HTMLInputElement).type;
                  if (inputType === "checkbox" || inputType === "radio") {
                    const parentLabel = htmlEl.closest("label");
                    const labelFor = htmlEl.id ? document.querySelector(`label[for="${htmlEl.id}"]`) : null;
                    const effectiveLabel = parentLabel || labelFor;
                    if (effectiveLabel) {
                      const lRect = effectiveLabel.getBoundingClientRect();
                      if (lRect.width >= 43.5 && lRect.height >= 43.5) {
                        continue;
                      }
                    }
                  }
                }

                if (rect.width < 43.5 || rect.height < 43.5) {
                  const tag = htmlEl.tagName.toLowerCase();
                  const cls = htmlEl.className && typeof htmlEl.className === "string"
                    ? "." + htmlEl.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".")
                    : "";
                  const id = htmlEl.id ? `#${htmlEl.id}` : "";
                  offenders.push({
                    selector: `${tag}${id}${cls}`,
                    width: Math.round(rect.width * 10) / 10,
                    height: Math.round(rect.height * 10) / 10,
                    text: (htmlEl.innerText || htmlEl.getAttribute("aria-label") || "").slice(0, 20).trim(),
                  });
                }
              }
              return offenders;
            });

            // 3. Form input font-size (< 16px) - text inputs, select, textarea only
            const smallFonts = await page.evaluate(() => {
              const textInputTypes = new Set(["text", "email", "password", "search", "tel", "url", "number", ""]);
              const elements = Array.from(document.querySelectorAll("input, select, textarea"));
              const offenders: Array<{ selector: string; fontSize: number }> = [];

              for (const el of elements) {
                const htmlEl = el as HTMLElement;
                if (htmlEl.tagName === "INPUT") {
                  const type = ((htmlEl as HTMLInputElement).type || "").toLowerCase();
                  if (!textInputTypes.has(type)) continue;
                }
                const style = window.getComputedStyle(htmlEl);
                if (style.display === "none" || style.visibility === "hidden") continue;

                const size = parseFloat(style.fontSize);
                if (size < 15.5) {
                  const tag = htmlEl.tagName.toLowerCase();
                  const cls = htmlEl.className && typeof htmlEl.className === "string"
                    ? "." + htmlEl.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".")
                    : "";
                  const id = htmlEl.id ? `#${htmlEl.id}` : "";
                  offenders.push({
                    selector: `${tag}${id}${cls}`,
                    fontSize: Math.round(size * 10) / 10,
                  });
                }
              }
              return offenders;
            });

            // 4. Axe-core accessibility scan (serious / critical violations)
            let axeViolations: Array<{ id: string; impact: string; help: string }> = [];
            try {
              const axeScan = await new AxeBuilder({ page }).analyze();
              axeViolations = axeScan.violations
                .filter((v) => v.impact === "serious" || v.impact === "critical")
                .map((v) => ({ id: v.id, impact: v.impact || "unknown", help: v.help }));
            } catch (err: any) {
              errors.push(`AxeError: ${err.message}`);
            }

            const key = `${engineName}:${vp.name}:${route.name}`;
            const passed =
              isRendered &&
              !overflow.hasOverflow &&
              smallTargets.length === 0 &&
              smallFonts.length === 0 &&
              errors.length === 0 &&
              axeViolations.length === 0;

            const status = !isRendered ? "R" : (passed ? "ok" : "fail");

            resultsRecord[key] = {
              engine: engineName,
              viewport: vp.name,
              route: route.name,
              path: route.path,
              rendered: isRendered,
              status,
              h1: renderInfo.h1Text,
              bodyLength: renderInfo.bodyLength,
              screenshot: screenshotRel,
              passed,
              overflow: overflow.hasOverflow ? overflow.offenders : null,
              smallTargets: smallTargets.length > 0 ? smallTargets : null,
              smallFonts: smallFonts.length > 0 ? smallFonts : null,
              axeViolations: axeViolations.length > 0 ? axeViolations : null,
              errors: errors.length > 0 ? errors : null,
            };

            saveResults();

            await context.close();
            await browser.close();

            // HARD ASSERTIONS
            expect(isRendered, `Route ${route.name} failed render proof at ${vp.name} (${engineName})`).toBe(true);

            expect(
              overflow.offenders,
              `Horizontal overflow on ${route.name} at ${vp.name} (${engineName}): ${overflow.offenders.slice(0, 3).join("; ")}`
            ).toHaveLength(0);

            expect(
              smallTargets,
              `Touch targets < 44x44 on ${route.name} at ${vp.name} (${engineName}): ${smallTargets.slice(0, 4).map((t) => `${t.selector} (${t.width}x${t.height}px)`).join("; ")}`
            ).toHaveLength(0);

            expect(
              smallFonts,
              `Input font < 16px on ${route.name} at ${vp.name} (${engineName}): ${smallFonts.map((f) => `${f.selector} (${f.fontSize}px)`).join("; ")}`
            ).toHaveLength(0);

            expect(
              axeViolations,
              `Axe serious/critical violations on ${route.name} at ${vp.name} (${engineName}): ${axeViolations.map((v) => `${v.id} (${v.impact})`).join("; ")}`
            ).toHaveLength(0);

            expect(errors, `Errors on ${route.name} at ${vp.name} (${engineName})`).toHaveLength(0);
          });
        }
      });
    }
  });
}
