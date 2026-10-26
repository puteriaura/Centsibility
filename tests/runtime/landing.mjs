import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { localPreview } from "./local-preview.mjs";

const base = process.env.CENTSIBILITY_UI_BASE || "http://127.0.0.1:4390";
const out = path.resolve(
  process.env.CENTSIBILITY_LANDING_OUTPUT || "test-results/landing",
);
fs.mkdirSync(out, { recursive: true });
process.env.VITE_SUPABASE_URL ||= "http://127.0.0.1:9";
process.env.VITE_SUPABASE_ANON_KEY ||= ["local", "synthetic", "only"].join("-");
const stop = await localPreview(base),
  browser = await chromium.launch({ channel: "chrome", headless: true });
const reference = fs.readFileSync(
  "analysis/design/landing-preview.html",
  "utf8",
);
const results = [],
  errors = [],
  copy = [],
  motion = [];
let blocked = 0;
async function context(theme, width, mode = "normal") {
  const c = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: mode === "system" ? "reduce" : "no-preference",
  });
  await c.route("**/*", (r) => {
    if (
      r
        .request()
        .url()
        .startsWith(base + "/")
    )
      return r.continue();
    blocked++;
    return r.abort();
  });
  await c.addInitScript(
    ({ theme, mode }) => {
      if (location.protocol !== "http:") return;
      if (!localStorage.getItem("centsibility.appearance"))
        localStorage.setItem("centsibility.appearance", theme);
      localStorage.setItem(
        "centsibility.reduce-animations",
        String(mode === "app"),
      );
      if (mode === "text200")
        document.addEventListener(
          "DOMContentLoaded",
          () => (document.documentElement.style.fontSize = "200%"),
        );
      window.landingAnimations = [];
      document.addEventListener("animationstart", (e) => {
        if (e.target.closest(".landing-page"))
          window.landingAnimations.push({
            name: e.animationName,
            target: e.target.className,
          });
      });
    },
    { theme, mode },
  );
  c.on("page", (p) =>
    p.on("pageerror", (e) =>
      errors.push({
        message: e.message.replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]"),
        route: new URL(p.url()).pathname,
      }),
    ),
  );
  return c;
}
async function ready(p) {
  await p.locator("h1").waitFor({ timeout: 90000 });
  await p.evaluate(() => document.fonts.ready);
  await p.locator(".landing-photo > img").evaluate((el) => el.decode());
  await p.waitForTimeout(850);
}
async function noOverflow(p) {
  assert(
    await p.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth),
    "Horizontal page overflow",
  );
}
async function compareCopy(p, theme) {
  const sections = await p.evaluate((html) => {
    const reference = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("#page").content;
    function text(e) {
      e = e.cloneNode(true);
      e.normalize();
      const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      const words = [];
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (n.parentElement?.closest("svg,style,script,.landing-skip"))
          continue;
        const s = n.textContent.replace(/\s+/g, " ").trim();
        if (s) words.push(s);
      }
      return words.join(" ");
    }
    return [
      ["header", "header"],
      [".hero", ".landing-hero"],
      [".facts", ".landing-facts"],
      ["#how", "#how"],
      ["#app", "#app"],
      ["#views", "#views"],
      ["#principles", "#principles"],
      [".cta", ".landing-cta"],
      ["footer", "footer"],
    ].map(([ref, actual]) => ({
      section: actual,
      expected: text(reference.querySelector(ref)),
      actual: text(document.querySelector(actual)),
    }));
  }, reference);
  copy.push({ theme, sections });
  for (const s of sections)
    assert.equal(
      s.actual,
      s.expected,
      "Approved copy mismatch in " + s.section,
    );
}
try {
  for (const theme of ["light", "dark"])
    for (const width of [360, 390, 430, 1280, 1440])
      for (const mode of [
        "normal",
        "system",
        "app",
        ...([360, 390].includes(width) ? ["text200"] : []),
      ]) {
        const c = await context(theme, width, mode),
          p = await c.newPage();
        await p.goto(base);
        await ready(p);
        await noOverflow(p);
        assert.equal(await p.locator("h1").count(), 1);
        assert.equal(await p.locator("#landing-main").count(), 1);
        assert.equal(
          await p.locator('.landing-phone[aria-hidden="true"]').count(),
          3,
        );
        const animations = await p.evaluate(() => window.landingAnimations);
        if (mode === "system" || mode === "app")
          assert.equal(
            animations.filter((a) => a.name === "landing-arrive").length,
            0,
          );
        else
          assert.equal(
            animations.filter((a) => a.name === "landing-arrive").length,
            2,
          );
        assert(
          animations.every((a) => a.name === "landing-arrive"),
          "Only the hero may animate",
        );
        motion.push({ theme, width, mode, animations });
        const targets = await p
          .locator(".landing-page a,.landing-page button")
          .evaluateAll((els) =>
            els
              .map((el) => {
                const r = el.getBoundingClientRect(),
                  s = getComputedStyle(el);
                return {
                  label: el.getAttribute("aria-label") || el.textContent.trim(),
                  width: r.width,
                  height: r.height,
                  visible: s.display !== "none" && r.width > 0 && r.height > 0,
                };
              })
              .filter((t) => t.visible),
          );
        assert(
          targets.every((t) => t.width >= 44 && t.height >= 44),
          "Target below44px",
        );
        const file = `landing-${width}-${theme}-${mode}.png`;
        await p.screenshot({ path: path.join(out, file), fullPage: true });
        results.push({
          theme,
          width,
          mode,
          file,
          targets,
          scrollWidth: await p.evaluate(
            () => document.scrollingElement.scrollWidth,
          ),
        });
        if (width === 390 && mode === "normal") {
          await compareCopy(p, theme);
          await p
            .getByRole("button", { name: "Open menu", exact: true })
            .click();
          await expect(p.locator("#landing-mobile-menu")).toBeVisible();
          await noOverflow(p);
          await expect(p.locator("#landing-mobile-menu a")).toHaveCount(5);
          await p.screenshot({
            path: path.join(out, `menu-${theme}.png`),
            fullPage: true,
          });
          await p.locator('#landing-mobile-menu a[href="#how"]').click();
          await expect(p.locator("#landing-mobile-menu")).toHaveCount(0);
          await noOverflow(p);
        }
        await c.close();
        console.log(
          JSON.stringify({ theme, width, mode, states: results.length }),
        );
      }
  const c = await context("light", 390),
    p = await c.newPage();
  await p.goto(base);
  await ready(p);
  await p
    .getByRole("button", { name: "Dark mode", exact: true })
    .filter({ visible: true })
    .click();
  await expect(p.locator("html")).toHaveAttribute("data-theme", "dark");
  await p.reload();
  await ready(p);
  await expect(p.locator("html")).toHaveAttribute("data-theme", "dark");
  assert.equal(
    await p.evaluate(() => localStorage.getItem("centsibility.appearance")),
    "dark",
  );
  await p.goto(base + "/kid-login");
  await expect(p.locator("html")).toHaveAttribute("data-theme", "dark");
  await p.locator('[role="tab"]').first().waitFor();
  await p.screenshot({
    path: path.join(out, "kid-login-theme-dark.png"),
    fullPage: true,
  });
  await p.goto(base);
  await ready(p);
  await p
    .getByRole("button", { name: "Dark mode", exact: true })
    .filter({ visible: true })
    .click();
  await expect(p.locator("html")).toHaveAttribute("data-theme", "light");
  assert.equal(
    await p.evaluate(() => localStorage.getItem("centsibility.appearance")),
    "light",
  );
  await p.keyboard.press("Tab");
  await p.getByRole("link", { name: "Skip to content", exact: true }).focus();
  await p.keyboard.press("Enter");
  await expect(p.locator("#landing-main")).toBeFocused();
  await c.close();
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(
      {
        results,
        errors,
        blockedExternalRequests: blocked,
        themePersists: true,
        kidLoginSharesTheme: true,
        themeRestored: true,
        skipLinkFocus: true,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(out, "copy.json"), JSON.stringify(copy, null, 2));
  fs.writeFileSync(
    path.join(out, "motion.json"),
    JSON.stringify(motion, null, 2),
  );
  assert.equal(errors.length, 0);
  console.log(
    JSON.stringify({
      states: results.length,
      pageErrors: errors.length,
      blockedExternalRequests: blocked,
      copySections: 18,
      themePersists: true,
      kidLoginSharesTheme: true,
      themeRestored: true,
      skipLinkFocus: true,
    }),
  );
} finally {
  await browser.close();
  stop();
}
