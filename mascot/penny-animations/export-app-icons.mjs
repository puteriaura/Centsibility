import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const svg = await readFile('public/icons/centsibility-app.svg', 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe' });
try {
  for (const size of [180, 192, 512, 1024]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>body{margin:0}body>svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.screenshot({ path: resolve(`public/icons/app-${size}.png`) });
    await page.close();
  }
} finally { await browser.close(); }
