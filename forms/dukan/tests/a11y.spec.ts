import { test, expect } from '@playwright/test';
import { json, S1, S2, pickNight } from './flow';
import { setLang } from './lang';

// A screen reader names every box and hears a message with the box it is about: aria-invalid on the box and the
// message as its description while it shows, the message itself a polite live region.
test("a field's message is tied to its box while it shows", async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/dukan?lang=en');
  const sessions = page.locator('#sessions');
  await page.click('#next');
  await expect(sessions).toHaveAttribute('aria-invalid', 'true');
  await expect(sessions).toHaveAccessibleDescription('Choose a session');
  await page.locator('#sessions .session').first().click();
  await expect(sessions).not.toHaveAttribute('aria-invalid', 'true');
  await expect(sessions).toHaveAccessibleDescription('');

  await page.click('#next');
  await page.click('#next'); // nothing filled in on the second step
  await expect(page.getByRole('textbox', { name: 'Full name', exact: true })).toHaveAccessibleDescription('Enter your full name');
  await page.fill('#name', 'Amal Booked');
  await expect(page.locator('#name')).toHaveAccessibleDescription('');
  await expect(page.locator('#name')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('textbox', { name: 'Mobile number', exact: true })).toHaveAccessibleDescription('Enter a valid Saudi mobile number (05XXXXXXXX)');
  for (const id of ['f-session', 'f-name', 'f-phone', 'f-privacy', 'f-waiver', 'fd-f-no', 'fd-f-phone']) {
    await expect(page.locator(`#${id} .err`), id).toHaveAttribute('aria-live', 'polite');
  }
});

test('the nights are a radio group the arrow keys move through, one tab stop', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.goto('/dukan?lang=en');
  const nights = page.locator('#sessions .session');
  await expect(nights).toHaveCount(2);
  await expect(nights.nth(0)).toHaveAttribute('tabindex', '0');
  await expect(nights.nth(1)).toHaveAttribute('tabindex', '-1');
  await nights.nth(0).focus();
  await page.keyboard.press('ArrowDown');
  await expect(nights.nth(1)).toBeFocused();
  await expect(nights.nth(1)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Home');
  await expect(nights.nth(0)).toHaveAttribute('aria-checked', 'true');
  // Arabic: the arrow pointing to the next choice is the left one.
  await setLang(page, 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await nights.nth(0).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(nights.nth(1)).toHaveAttribute('aria-checked', 'true');
});

test('a new step starts at its heading, in view, not part-way down the page', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/dukan?lang=en');
  await page.locator('#sessions .session').first().click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.click('#next');
  const head = page.locator('.step[data-step="2"] .step-title');
  await expect(head).toBeFocused();
  await expect(head).toBeInViewport();
  await expect(page.locator('#stepper')).toBeInViewport();
});

test('Enter in a box on the second step is Continue, and one registration goes at a time', async ({ page }) => {
  let calls = 0;
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', async (r) => {
    calls++;
    await new Promise((res) => setTimeout(res, 800));
    return r.fulfill(json({ ok: true, booking_no: 'D-007', riders: 1, resubmitted: false, session: S1 }));
  });
  await page.goto('/dukan?lang=en');
  await pickNight(page);
  await page.fill('#name', 'Amal  Booked'); await page.fill('#phone', '512345678');
  await page.locator('#phone').press('Enter');
  await expect(page.locator('.step[data-step="3"]')).toBeVisible();
  await expect(page.locator('#f-privacy')).not.toHaveClass(/invalid/);
  await expect(page.locator('#f-waiver')).not.toHaveClass(/invalid/);
  await page.check('#privacy'); await page.check('#waiver');
  await page.click('#submit');
  await page.evaluate(() => (document.getElementById('form') as HTMLFormElement).requestSubmit());
  await page.evaluate(() => (document.getElementById('form') as HTMLFormElement).requestSubmit());
  await expect(page.locator('#success')).toBeVisible();
  expect(calls).toBe(1);
  await expect(page.locator('#tk-name')).toHaveText('Amal Booked');
});

test('names nobody sees follow the language', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/dukan?lang=ar');
  if (await page.locator('#lang').count()) await expect(page.locator('#lang')).toHaveAttribute('aria-label', 'اللغة');
  await expect(page.locator('#sessions')).toHaveAttribute('aria-label', 'الجلسة');
  await setLang(page, 'fr');
  await expect(page.locator('#stepper')).toHaveAttribute('aria-label', 'Progression');
});
