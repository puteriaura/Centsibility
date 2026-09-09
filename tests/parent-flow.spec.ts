import { test, expect } from "@playwright/test";

const EMAIL = "test@centsibility.com";
const PASSWORD = "password123";

test.describe('Parent Dashboard Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button:has-text("Sign in")');
    await page.waitForURL('**/parent');
  });

  test('redirects to parent dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/parent$/);
    await expect(page.locator('text=Commander')).toBeVisible();
  });

  test('creates a new kid and shows login code', async ({ page }) => {
    await expect(page.locator('text=Crew Members')).toBeVisible();
    await page.fill('input[placeholder="Child\'s Name"]', 'TestKid');
    await page.fill('input[placeholder="username"]', 'testkid');
    await page.click('button:has-text("Add Astronaut")');
    const codeCard = page.locator('text=6-Digit Login Code');
    await expect(codeCard).toBeVisible();
    const code = await page.locator('div.font-mono').first().innerText();
    console.log('Generated kid login code:', code);
  });
});
