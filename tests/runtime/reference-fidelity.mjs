import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import { parse } from "dotenv";
import { localPreview } from "./local-preview.mjs";

const base = process.env.CENTSIBILITY_UI_BASE || "http://127.0.0.1:3000";
const stop = await localPreview(base);
await build({
  stdin: {
    contents:
      'export { getMockEdgeResponse } from "./src/lib/edge"; export * from "./src/lib/demo-data";',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: "analysis/private/reference-ui-integration/fidelity-fixtures.mjs",
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  define: { "import.meta.env.DEV": "true", "import.meta.env": "{}" },
  alias: { "@": path.resolve("src") },
});
const fixtures = await import(
  pathToFileURL(path.resolve("analysis/private/reference-ui-integration/fidelity-fixtures.mjs")).href
);
const env = {...parse(fs.readFileSync(".env")), ...parse(fs.readFileSync(".env.local"))};
const authKey = `sb-${new URL(env.VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "synthetic@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: { display_name: "Synthetic Parent" },
  created_at: "2026-01-01T00:00:00Z",
};
const auth = {
  access_token: "synthetic-access-token",
  refresh_token: "synthetic-refresh-token",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user,
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const mode of ["kid", "parent"]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      ({ mode, authKey, auth }) => {
        sessionStorage.setItem("centsibility.just_unlocked", "1");
        if(mode === "parent") sessionStorage.setItem("parentSessionValidUntil",String(Date.now()+1800000));
        localStorage.setItem("centsibility.appearance", "light");
        if (mode === "kid") {
          localStorage.setItem("centsibility.parent.blocked", "true");
          localStorage.setItem(
            "centsibility.kid",
            JSON.stringify({
              kidId: "demo-kid-aiman",
              name: "Synthetic Zoë",
              code: "a".repeat(64),
              expiresAt: Date.now() + 86400000,
            }),
          );
        } else {
          localStorage.setItem(authKey, JSON.stringify(auth));
          sessionStorage.setItem(
            "centsibility.parent.pinSession",
            JSON.stringify({
              token: "synthetic-parent-pin",
              expiresAt: new Date(Date.now() + 1800000).toISOString(),
            }),
          );
        }
      },
      { mode, authKey, auth },
    );
    let sent = [],
      scenario = "normal",
      failure = null;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === base) return route.continue();
      const reply = (body, status = 200) =>
        route.fulfill({
          status,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
          },
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (route.request().method() === "OPTIONS") return reply({});
      if (url.pathname.includes("/auth/")) return reply(user);
      if(url.pathname.includes('/rest/v1/')) {
        const table=url.pathname.split('/').at(-1);
        const tables={kids:fixtures.DEMO_KIDS,goals:fixtures.DEMO_GOALS,approvals:fixtures.DEMO_APPROVALS,rewards:fixtures.DEMO_REWARDS,loans:fixtures.DEMO_LOANS,transactions:fixtures.DEMO_TRANSACTIONS,notifications:fixtures.DEMO_NOTIFICATIONS,scheduled_hibahs:fixtures.DEMO_SCHEDULED_HIBAHS,profiles:[{id:user.id,email:user.email}]};
        const state=typeof variant==='undefined'?'normal':variant;
        if(state==='loading') await new Promise(resolve=>setTimeout(resolve,3000));
        if(state==='error') return reply({message:'Synthetic service unavailable'},503);
        return reply(state==='empty'?[]:(tables[table]||[]));
      }
      if(!url.pathname.includes('/functions/')) return route.abort();
      const body = route.request().postDataJSON() || {};
      if (body.action === "transfer") {
        sent.push(body);
        await new Promise((resolve) => setTimeout(resolve, 450));
        if (failure) return reply({ error: failure }, 403);
        return reply({ ok: true, status: "completed", balance: 40 });
      }
      if (body.action === "transfer-recipients")
        return reply({
          parent: { id: "synthetic-parent", name: "Synthetic Parent" },
          siblings:
            scenario === "no-sibling"
              ? []
              : [{ id: "synthetic-sibling", name: "Synthetic Sibling" }],
          balance: scenario === "zero-balance" ? 0 : scenario === "low-balance" ? 2 : 100,
          dailyLimit: 50,
          usedToday: 0,
        });
      if (body.action === "pin-status")
        return reply({ attemptsLeft: 5, lockedUntil: null });
      if (body.action === "get-state")
        return reply({
          ...fixtures.DEMO_KID_STATE,
          kid: {
            ...fixtures.DEMO_KID_STATE.kid,
            name: "Synthetic Zoë",
            balance: 100,
          },
        });
      if (body.action === "get-profile")
        return reply({ id: user.id, email: user.email });
      if (body.action === "get-pin") return reply({ hasPin: true });
      if (body.action === "get-parent-data")
        return reply({
          kids: fixtures.DEMO_KIDS,
          goals: [],
          approvals: [],
          rewards: [],
          loans: [],
          txs: [],
          notifications: [],
          scheduledHibahs: [],
        });
      return reply(
        fixtures.getMockEdgeResponse(
          url.pathname.includes("parent-finance")
            ? "parent-finance"
            : "kid-finance",
          body,
        ),
      );
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/${mode}/transfer`, { waitUntil: "networkidle" });
    const amount = page.getByRole("spinbutton", {
      name: "Transfer amount in RM",
    });
    await expect(amount).toBeVisible();
    await expect(page.locator(".shell-bottomnav")).toHaveCount(0);
    const recipients = page.locator(".recipient-chip");
    await expect(recipients.first()).toBeVisible();
    await recipients.first().click();
    const next = page.getByRole("button", { name: "Continue", exact: true });
    for (const value of [
      "0",
      "0.50",
      "50.001",
      mode === "kid" ? "51" : "1001",
    ]) {
      await amount.fill(value);
      await expect(next).toBeDisabled();
    }
    await amount.fill("5.25");
    await expect(page.getByLabel("Reason or Note (Optional)")).toHaveAttribute(
      "maxlength",
      "40",
    );
    await page.getByLabel("Reason or Note (Optional)").fill("Synthetic test");
    assert.equal(sent.length, 0, "No money moves during composition");
    await next.click();
    await expect(page.getByText("Transfer Summary")).toBeVisible();
    assert.equal(sent.length, 0);
    await page.getByRole("button", { name: "Edit transfer" }).click();
    await expect(amount).toHaveValue("5.25");
    await expect(page.getByLabel("Reason or Note (Optional)")).toHaveValue(
      "Synthetic test",
    );
    await next.click();
    await page.getByRole("button", { name: "Enter PIN to Confirm" }).click();
    await page.getByRole("button", { name: "← Cancel and go back" }).click();
    assert.equal(sent.length, 0);
    await page.getByRole("button", { name: "Enter PIN to Confirm" }).click();
    failure = "Incorrect PIN";
    for (const digit of ["1", "2", "3", "4", "5", "6"])
      await page
        .getByRole("button", { name: `Key ${digit}`, exact: true })
        .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Incorrect PIN" }),
    ).toBeVisible();
    assert.equal(sent.length, 1);
    await expect(
      page.getByRole("button", { name: "Key 6", exact: true }),
    ).toBeEnabled();
    failure = "PIN expired";
    for (const digit of ["1", "2", "3", "4", "5", "6"])
      await page
        .getByRole("button", { name: `Key ${digit}`, exact: true })
        .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "PIN expired" }),
    ).toBeVisible();
    assert.equal(sent.length, 2);
    await expect(
      page.getByRole("button", { name: "Key 6", exact: true }),
    ).toBeEnabled();
    failure = null;
    for (const digit of ["1", "2", "3", "4", "5"])
      await page
        .getByRole("button", { name: `Key ${digit}`, exact: true })
        .click();
    await page
      .getByRole("button", { name: "Key 6", exact: true })
      .evaluate((button) => {
        for (let repeat = 0; repeat < 4; repeat++) button.click();
      });
    await expect(
      page.getByRole("button", { name: "← Cancel and go back" }),
    ).toBeDisabled();
    await expect(
      page.getByText("Transfer sent!", { exact: true }),
    ).toBeVisible();
    assert.equal(
      sent.length,
      3,
      "Repeated presses while pending must not submit again",
    );
    assert.equal(sent.at(-1).amount, 5.25);
    assert.equal(sent.at(-1).note, "Synthetic test");
    if (mode === "kid") {
      scenario = "no-sibling";
      await page.goto(`${base}/kid/transfer`, { waitUntil: "networkidle" });
      await expect(page.locator(".recipient-chip")).toHaveCount(1);
      scenario = "zero-balance";
      await page.goto(`${base}/kid/transfer`, { waitUntil: "networkidle" });
      await page.locator(".recipient-chip").first().click();
      await amount.fill("1");
      await expect(next).toBeDisabled();
      scenario = "low-balance";
      await page.goto(`${base}/kid/transfer`, { waitUntil: "networkidle" });
      await page.locator(".recipient-chip").first().click();
      await amount.fill("3");
      await expect(next).toBeDisabled();
      await expect(page.getByText("Amount exceeds your available balance", {exact:true})).toBeVisible();
      await page.goto(`${base}/kid/more`, { waitUntil: "networkidle" });
      for (const destination of [
        "goals",
        "loans",
        "card",
        "invest",
        "sadaqah",
        "zakat",
        "history",
        "missions",
        "rewards",
        "quiz",
        "chat",
        "notifications",
      ])
        await expect(
          page.locator(`main a[href="/kid/${destination}"]`),
        ).toBeVisible();
      assert.equal(await page.locator('main a[href^="/parent"]').count(), 0);
      await page.goto(`${base}/kid`, { waitUntil: "networkidle" });
      await expect(page.locator('nav[aria-label="Shortcuts"] a')).toHaveCount(
        4,
      );
      await expect(page.locator(".balance-carousel")).toHaveCount(0);
      await page.getByRole("button", { name: "Hide balance" }).click();
      await page.goto(`${base}/kid/insights`, { waitUntil: "networkidle" });
      await expect(
        page.locator(".insights-donut-svg circle[stroke-dasharray]"),
      ).toHaveCount(0);
      assert(
        !/RM\d/.test(await page.locator("main").innerText()),
        "Masked Insights must hide money in visible text",
      );
      assert(
        !/RM\d/.test(await page.locator("main").ariaSnapshot()),
        "Accessible text must mask money",
      );
      assert(
        !/\d+%/.test(await page.locator("main").innerText()),
        "Masked Insights must hide category percentages",
      );
    }
    if (mode === "kid") {
      await page.goto(base + "/kid", { waitUntil: "networkidle" });
      await page.evaluate(
        () => (document.documentElement.style.fontSize = "200%"),
      );
      const title = page.locator("main .ui-card p").first();
      await expect(title).toBeVisible();
      const titleWidth = await title.evaluate(
        (el) => el.getBoundingClientRect().width,
      );
      assert(
        titleWidth >= 160,
        "Large text descriptions must retain readable width",
      );
      const amountWrap = await page
        .locator(".balance-hero strong")
        .first()
        .evaluate(
          (el) =>
            el.getBoundingClientRect().height /
            parseFloat(getComputedStyle(el).lineHeight),
        );
      assert(
        amountWrap <= 1.1,
        "Secondary balance must remain one intact amount",
      );
      await page.goto(base + "/kid/transfer", { waitUntil: "networkidle" });
      await page.evaluate(
        () => (document.documentElement.style.fontSize = "200%"),
      );
      const toWrap = await page
        .getByRole("heading", { name: "To", exact: true })
        .evaluate(
          (el) =>
            el.getBoundingClientRect().height /
            parseFloat(getComputedStyle(el).lineHeight),
        );
      assert(toWrap <= 1.1, "Transfer's To label must not split into letters");
    }
    assert.deepEqual(errors, []);
    results.push({ mode, status: "PASS", transferRequests: sent.length });
    await context.close();
  }
  fs.mkdirSync("test-results/root-reference-ui/design", { recursive: true });
  fs.writeFileSync(
    "test-results/root-reference-ui/design/reference-regressions.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  stop();
}
