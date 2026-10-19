import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { localPreview } from "./local-preview.mjs";

const base = process.env.CENTSIBILITY_UI_BASE || "http://127.0.0.1:3000";
const stop = await localPreview(base);
const output = "test-results/root-reference-ui/design/penny";
fs.mkdirSync(output, { recursive: true });
// Development-only harness imports the actual shipped rig; no copied character drawing.
fs.writeFileSync(
  "analysis/penny-review.html",
  '<!doctype html><html><head><meta charset="utf-8"><title>Penny review</title></head><body><div id="review"></div><script type="module" src="/analysis/penny-review.tsx"></script></body></html>',
);
fs.writeFileSync(
  "analysis/penny-review.tsx",
  `import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PennyMascot,PENNY_POSES} from '/src/components/PennyMascot';
import {flushSync} from 'react-dom';
import '/src/styles.css';import '/src/reference-theme.css';
function Review(){const [state,setState]=useState('neutral'),[view,setView]=useState('sheet');
window.reviewState=(value)=>flushSync(()=>setState(value));window.reviewView=(value)=>flushSync(()=>setView(value));
return <div style={{padding:24,color:'var(--ink)',background:'var(--canvas)',width:view==='sheet'?920:600}}>
<h1 style={{fontSize:24}}>Original Penny · {view}</h1>
{view==='sheet'?<div style={{display:'grid',gridTemplateColumns:'repeat(2, 1fr)',gap:16}}>{Object.keys(PENNY_POSES).map(pose=><section key={pose} style={{background:'var(--surface)',borderRadius:18,padding:12}}><h2 style={{fontSize:16,margin:0}}>{pose}</h2><div style={{display:'flex',alignItems:'end',justifyContent:'space-between'}}>{[24,40,80,160].map(size=><div key={size}><PennyMascot state={pose} size={size}/><small style={{display:'block',textAlign:'center'}}>{size}px</small></div>)}</div></section>)}</div>:<div id="stage" style={{display:'flex',alignItems:'center',justifyContent:'center',width:540,height:240,background:'var(--surface)',borderRadius:18}}><PennyMascot state={state} size={160} label={state}/>{view==='multiple'&&<PennyMascot state="loading" size={160} label="loading"/>}</div>}
</div>}
createRoot(document.getElementById('review')).render(<Review/>);`,
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
const durations = {
  neutral: 0,
  welcome: 1100,
  guide: 700,
  happy: 600,
  encouraging: 700,
  attentive: 500,
  proud: 800,
  celebrate: 1200,
  reassuring: 900,
  loading: 1600,
  saved: 500,
  unavailable: 500,
};
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 960, height: 960 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      (theme) => localStorage.setItem("centsibility.appearance", theme),
      theme,
    );
    const page = await context.newPage();
    await page.goto(base + "/analysis/penny-review.html", {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${output}/poses-${theme}.png`,
      fullPage: true,
    });
    const counts = await page.locator("[data-penny-rig]").evaluateAll((rigs) =>
      rigs.map((rig) => ({
        arms: rig.querySelectorAll('[data-limb$="arm"]').length,
        legs: rig.querySelectorAll('[data-limb$="leg"]').length,
        bodies: rig.querySelectorAll("[data-penny-body]").length,
      })),
    );
    assert.equal(counts.length, 24);
    assert(counts.every((c) => c.arms === 2 && c.legs === 2 && c.bodies === 1));
    reports.push({ theme, staticRigs: counts.length });
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 650, height: 440 },
    reducedMotion: "no-preference",
  });
  await context.addInitScript(() =>
    localStorage.setItem("centsibility.appearance", "light"),
  );
  const page = await context.newPage();
  await page.goto(base + "/analysis/penny-review.html", {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => {
    window.reviewView("single");
  });
  await page.locator("#stage").waitFor();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  const frameReport = [];
  for (const [state, duration] of Object.entries(durations)) {
    await page.evaluate(() => window.reviewState("neutral"));
    await page.clock.runFor(32);
    await page.evaluate((state) => window.reviewState(state), state);
    let previous = 0;
    // Mid-wave 40/60% supplement quarter frames near maximum arm extension.
    for (const percent of [0, 25, 40, 50, 60, 75, 100]) {
      const target = Math.round((duration * percent) / 100);
      await page.clock.runFor(Math.max(16, target - previous));
      previous = target;
      await page
        .locator("#stage")
        .screenshot({ path: `${output}/${state}-${percent}.png` });
      const anatomy = await page
        .locator("[data-penny-rig]")
        .evaluate((rig) => ({
          arms: rig.querySelectorAll('[data-limb$="arm"]').length,
          legs: rig.querySelectorAll('[data-limb$="leg"]').length,
          bodies: rig.querySelectorAll("[data-penny-body]").length,
        }));
      assert.deepEqual(anatomy, { arms: 2, legs: 2, bodies: 1 });
      frameReport.push({ state, percent, ...anatomy });
    }
  }
  await page.evaluate(() => {
    window.reviewView("multiple");
    window.reviewState("celebrate");
  });
  await page.clock.runFor(100);
  await expect(page.locator("[data-penny-rig]")).toHaveCount(2);
  await page.evaluate(() => {
    for (const state of [
      "welcome",
      "saved",
      "celebrate",
      "loading",
      "unavailable",
    ])
      window.reviewState(state);
  });
  await page.clock.runFor(32);
  await expect(page.locator('[data-core-state="unavailable"]')).toHaveCount(1);
  await page
    .locator("#stage")
    .screenshot({ path: `${output}/rapid-loading-error.png` });
  await page.clock.resume();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() =>
    window.dispatchEvent(new Event("centsibility:appearance")),
  );
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.waitForTimeout(100);
  await page
    .locator("#stage")
    .screenshot({ path: `${output}/reduced-mid-animation.png` });
  const before = await page.locator("#stage").innerHTML();
  await page.waitForTimeout(2000);
  assert.equal(
    await page.locator("#stage").innerHTML(),
    before,
    "Reduced motion must settle both instances",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => window.reviewState("loading"));
  await page.waitForTimeout(100);
  await page
    .locator("#stage")
    .evaluate((el) => (el.style.marginTop = "1500px"));
  await page.waitForTimeout(100);
  await expect(page.locator('.penny-mascot[data-paused="true"]')).toHaveCount(
    2,
  );
  await page.evaluate(() => window.reviewState("welcome"));
  await page.waitForTimeout(100);
  await page.locator("#stage").evaluate((el) => (el.style.marginTop = "0"));
  await page.waitForTimeout(100);
  await expect(page.locator('.penny-mascot[data-paused="true"]')).toHaveCount(
    0,
  );
  const arm = page.locator('[data-state="welcome"] [data-limb="right-arm"]');
  const settled = await arm.getAttribute("style");
  await page.waitForTimeout(300);
  assert.equal(
    await arm.getAttribute("style"),
    settled,
    "Offscreen one-shot must not replay on return",
  );
  await page.evaluate(() => window.reviewState("neutral"));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.reviewState("welcome"));
  await page.waitForTimeout(32);
  const newEvent = await arm.getAttribute("style");
  await page.waitForTimeout(300);
  assert.notEqual(
    await arm.getAttribute("style"),
    newEvent,
    "A later meaningful event must animate again",
  );
  reports.push({
    frames: frameReport.length,
    simultaneousInstances: 2,
    rapidStateChanges: "PASS",
    reducedMotionMidAnimation: "PASS",
    offscreen: "PASS",
    offscreenReentry: "PASS",
  });
  await context.close();
  // Observe real-time playback without a mocked clock; retain sampled transforms.
  const playback = await browser.newPage({
    viewport: { width: 650, height: 440 },
    reducedMotion: "no-preference",
  });
  await playback.goto(base + "/analysis/penny-review.html", {
    waitUntil: "networkidle",
  });
  await playback.evaluate(() => window.reviewView("single"));
  const samples = await playback.evaluate(async () => {
    window.reviewState("welcome");
    const rows = [];
    const start = performance.now();
    while (performance.now() - start < 1250) {
      await new Promise(requestAnimationFrame);
      const rig = document.querySelector("[data-penny-rig]");
      rows.push({
        ms: Math.round(performance.now() - start),
        arms: rig.querySelectorAll('[data-limb$="arm"]').length,
        right: rig
          .querySelector('[data-limb="right-arm"]')
          .getAttribute("style"),
      });
    }
    return rows;
  });
  assert(samples.every((s) => s.arms === 2));
  assert(
    new Set(samples.map((s) => s.right)).size > 3,
    "Playback must visibly change the wave",
  );
  reports.push({ livePlaybackFrames: samples.length });
  fs.writeFileSync(
    `${output}/playback-samples.json`,
    JSON.stringify(samples, null, 2),
  );
  fs.writeFileSync(
    `${output}/verification.json`,
    JSON.stringify({ reports, frames: frameReport }, null, 2),
  );
  console.log(JSON.stringify(reports));
} finally {
  await browser.close();
  stop();
}
