import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { states } from './build.mjs';

const folder = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const state of states) {
    const source = await readFile(join(folder, 'animated', `${state.name}.svg`), 'utf8');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setContent(`<style>body{margin:0;background:white}svg{display:block}</style>${source}`);
    const active = await page.evaluate(() => document.getAnimations().length);
    assert.equal(active > 0, state.duration > 0, `${state.name}: motion presence`);
    await page.evaluate(() => document.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; }));
    const start = await page.evaluate(() => [...document.querySelectorAll('svg g')].map(e => getComputedStyle(e).transform));
    await page.evaluate(t => document.getAnimations().forEach(a => { a.currentTime = t; }), state.duration * 500);
    const middle = await page.evaluate(() => [...document.querySelectorAll('svg g')].map(e => getComputedStyle(e).transform));
    if (state.duration > 0) assert.notDeepEqual(start, middle, `${state.name}: pose changes`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, `${state.name}: reduced motion`);
    const fallback = await page.locator('svg').screenshot();
    await page.setContent(`<style>body{margin:0;background:white}svg{display:block}</style>${await readFile(join(folder, 'static', `${state.name}.svg`), 'utf8')}`);
    assert.deepEqual(await page.locator('svg').screenshot(), fallback, `${state.name}: fallback matches static asset`);
    console.log(`${state.name}: motion and reduced-motion fallback verified`);
  }
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`file:///${join(folder, 'index.html').replaceAll('\\', '/')}`);
  assert.equal(await page.locator('article').count(), 12, 'Gallery shows every state');
  assert.equal(await page.locator('#repeat').isChecked(), true, 'Preview repetition is enabled');
  await page.waitForFunction(() => Number(document.querySelector('[data-state="welcome"]').dataset.replayedAt) > 0, null, { timeout: 5000 });
  await page.locator('#reduce').check();
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'Manual reduced-motion control');
  for (const state of states) {
    const angles = await page.locator(`[data-state="${state.name}"]`).evaluate(stage => ['left-arm', 'right-arm'].map(cls => {
      const transform = getComputedStyle(stage.querySelector('.' + cls)).transform;
      const matrix = new DOMMatrix(transform === 'none' ? undefined : transform);
      return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    }));
    assert.ok(Math.abs(angles[0] - (state.left || 0)) < .01, `${state.name}: isolated left-arm fallback`);
    assert.ok(Math.abs(angles[1] - (state.right || 0)) < .01, `${state.name}: isolated right-arm fallback`);
  }
  await page.locator('[data-replay="saved"]').click();
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'Replay respects reduced motion');
  await page.locator('#dark').check();
  assert.equal(await page.locator('.shoe').first().evaluate(node => getComputedStyle(node).fill), 'rgb(133, 101, 145)', 'Dark-background shoes retain contrast');
  await page.locator('#pause').check();
  await mkdir(join(folder, 'previews'), { recursive: true });
  await page.screenshot({ path: join(folder, 'previews', 'gallery-dark.png'), fullPage: true });
  await page.locator('#dark').uncheck();
  await page.screenshot({ path: join(folder, 'previews', 'gallery.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile layout fits viewport');
  await page.screenshot({ path: join(folder, 'previews', 'gallery-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Gallery: replay, manual reduced motion, dark background, and mobile layout verified');
  await page.setViewportSize({ width: 512, height: 512 });
  const requested = process.argv[2];
  const renderStates = requested === 'all' ? states : requested ? states.filter(s => s.name === requested) : [];
  if (requested) assert.ok(renderStates.length, `Unknown state ${requested}`);
  for (const state of renderStates) {
    const requested = state.name;
    const frames = join(folder, 'previews', `${requested}-frames`);
    await mkdir(frames, { recursive: true });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setContent(`<style>body{margin:0;background:white}svg{display:block}</style>${await readFile(join(folder, 'animated', `${requested}.svg`), 'utf8')}`);
    await page.evaluate(() => document.getAnimations().forEach(a => a.pause()));
    const count = Math.ceil((state.duration + (state.loop ? 0 : 0.5)) * 30);
    for (let i = 0; i < count; i++) {
      await page.evaluate(t => document.getAnimations().forEach(a => { a.currentTime = t; }), i * 1000 / 30);
      await page.screenshot({ path: join(frames, `${String(i).padStart(3, '0')}.png`) });
    }
    const output = join(folder, 'previews', `${requested}.gif`);
    const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(frames, '%03d.png'), '-filter_complex', '[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse', '-frames:v', String(count), '-loop', '0', output], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames', '-of', 'json', output], { encoding: 'utf8' });
    assert.equal(probe.status, 0, probe.stderr);
    assert.equal(Number(JSON.parse(probe.stdout).streams[0].nb_frames), count, 'Preview excludes stale frames from previous renders');
    console.log(`Preview rendered: ${output}`);
  }
} finally {
  await browser.close();
}
