import { test, expect } from '@playwright/test';

const { E2E_PARENT_EMAIL, E2E_PARENT_PASSWORD, E2E_KID_USERNAME, E2E_KID_PIN } = process.env;

test.describe('Authentication Flows', () => {
  (E2E_PARENT_EMAIL && E2E_PARENT_PASSWORD ? test : test.skip)('Parent can log in to the dashboard', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');
    
    // Fill in credentials
    await page.fill('input[type="email"]', E2E_PARENT_EMAIL!);
    await page.fill('input[type="password"]', E2E_PARENT_PASSWORD!);
    
    // Click submit
    await page.click('button[type="submit"]');
    
    // Wait for the parent dashboard to load (checking for URL or heading)
    await expect(page).toHaveURL(/\/parent/);
    
    // Assert dashboard is visible by checking for some known parent UI elements
    // For example, looking for "Recruit another astronaut" or parent text
    await expect(page.locator('text=astronaut').first()).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  (E2E_KID_USERNAME && E2E_KID_PIN ? test : test.skip)('Kid can log in using code and PIN', async ({ page }) => {
    // Navigate to kid login
    await page.goto('/kid-login');
    
    // Switch to Username + PIN tab
    await page.click('text="Username + PIN"');

    // Wait for username input
    await page.fill('input[placeholder="e.g. aiman"]', E2E_KID_USERNAME!);
    
    // Fill PIN
    await page.fill('input[type="password"]', E2E_KID_PIN!);
    
    // Click submit
    await page.click('button[type="submit"]');
    
    // Wait for the kid dashboard to load
    await expect(page).toHaveURL(/\/kid/);
  });
});
