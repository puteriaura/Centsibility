import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Isolated demo session. No live account or financial endpoint is touched.
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.addInitScript(() => {
    sessionStorage.setItem('centsibility:admin-bypass-kid', 'true');
    localStorage.setItem('centsibility.kid', JSON.stringify({ kidId: 'demo-kid-aiman', code: 'AIMAN1', name: 'Aiman', expiresAt: Date.now() + 86400000 }));
  });
  await page.goto('http://127.0.0.1:3000/kid/chat', { waitUntil: 'domcontentloaded' });
  const mascot = page.locator('.penny-chat__mascot .penny-mascot');
  await expect(mascot).toHaveAttribute('data-state', 'welcome', { timeout: 30000 });
  await expect(mascot.locator('svg')).toBeVisible();
  await page.screenshot({ path: 'mascot/penny-animations/previews/app-chat.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const active = await mascot.locator('svg').evaluate(svg => [...svg.querySelectorAll('*')].filter(el => getComputedStyle(el).animationName !== 'none').length);
  expect(active).toBe(0);
  await page.goto('http://127.0.0.1:3000/kid/goals', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.penny-goal-mascot')).toBeVisible();
  await page.screenshot({ path: 'mascot/penny-animations/previews/app-goals.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const icon = await page.request.get('http://127.0.0.1:3000/icons/app-192.png');
  expect(icon.ok()).toBe(true);
  expect(errors).toEqual([]);
  console.log('Mobile chat, goal screen, reduced motion, app icon, and runtime checks passed.');
} finally { await browser.close(); }
