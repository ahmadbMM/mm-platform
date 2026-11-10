import { test, expect } from '@playwright/test';

// A screen reader names every box, a companion's with its rider, and hears a message with the box it
// is about: aria-invalid on the box and the message as its description while it shows, the message
// itself a polite live region.
const S1 = { id: '2099-02-08-pw', title: "Petromin's Wednesdays", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' };
const json = (body: unknown) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });

test("a field's message is tied to its box while it shows", async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin?lang=en');
  const sessions = page.locator('#sessions');
  await page.click('#next');
  await expect(sessions).toHaveAttribute('aria-invalid', 'true');
  await expect(sessions).toHaveAccessibleDescription('Choose a session');
  await expect(page.locator('#f-session .err')).toHaveAttribute('aria-live', 'polite');
  await page.locator('#sessions .session').first().click();
  await expect(sessions).not.toHaveAttribute('aria-invalid', 'true');
  await expect(sessions).toHaveAccessibleDescription('');

  await page.click('#next');
  await page.click('#next'); // nothing filled in on the second step
  await expect(page.locator('#badge')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#badge')).toHaveAccessibleDescription('Enter your badge number');
  await expect(page.locator('#companies')).toHaveAccessibleDescription('Choose your company');
  // The message is the box's description while it shows (the name has no hint line since 2026-11-11).
  await expect(page.locator('#name')).toHaveAccessibleDescription('Enter your full name');
  await page.fill('#name', 'Amal Booked');
  await expect(page.locator('#name')).toHaveAccessibleDescription('');
  await expect(page.locator('#name')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#phone')).toHaveAccessibleDescription('Enter a valid Saudi mobile number (05XXXXXXXX)');
  for (const id of ['f-session', 'f-company', 'f-badge', 'f-name', 'f-phone', 'f-height', 'f-type', 'f-riders', 'f-privacy', 'f-waiver', 'rd-f-name', 'rd-f-height', 'rd-f-type']) {
    await expect(page.locator(`#${id} .err`), id).toHaveAttribute('aria-live', 'polite');
  }
});

test("a companion is written in a dialog named with its rider; its boxes' messages are tied to them; its card's buttons say whose", async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin?lang=en');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', 'A-12'); await page.fill('#name', 'Amal Booked'); await page.fill('#phone', '512345678');
  await page.click('#next');
  await page.fill('#height', '175'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.click('#add-rider');
  const dialog = page.getByRole('dialog', { name: 'Rider 2', exact: true });
  await expect(dialog).toBeVisible();
  const name2 = dialog.getByRole('textbox', { name: 'Full name', exact: true });
  await expect(name2).toBeFocused();
  // Every box judged at once on Save, each with its own message.
  await page.click('#rd-save');
  await expect(name2).toHaveAttribute('aria-invalid', 'true');
  await expect(name2).toHaveAccessibleDescription("Enter the rider's full name");
  await expect(dialog.getByRole('textbox', { name: 'Height in cm', exact: true })).toHaveAccessibleDescription("Enter the rider's height in cm (100 to 250)");
  await expect(dialog.getByRole('radiogroup', { name: 'Bike type', exact: true })).toHaveAccessibleDescription('Choose a bike type');
  await expect(name2).toBeFocused();
  await name2.fill('Sara Ali');
  await expect(name2).not.toHaveAttribute('aria-invalid', 'true');
  await dialog.getByRole('textbox', { name: 'Height in cm', exact: true }).fill('160');
  // The bike types are one radio group: the arrow keys move the choice.
  await dialog.getByRole('radio', { name: 'Hybrid' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('radio', { name: 'Mountain' })).toHaveAttribute('aria-checked', 'true');
  await page.click('#rd-save');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Change Rider 2', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Remove Rider 2', exact: true })).toBeVisible();
});

test('the night, the company and the bike type are radio groups the arrow keys move through, one tab stop each', async ({ page }) => {
  const S2 = { ...S1, id: '2099-02-10-pw', start: '2099-02-10T19:00:00+03:00', end: '2099-02-10T21:00:00+03:00' };
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.goto('/petromin?lang=en');
  const nights = page.locator('#sessions .session');
  await expect(nights).toHaveCount(2);
  await expect(nights.nth(0)).toHaveAttribute('tabindex', '0');
  await expect(nights.nth(1)).toHaveAttribute('tabindex', '-1');
  await nights.nth(0).focus();
  await page.keyboard.press('ArrowDown');
  await expect(nights.nth(1)).toBeFocused();
  await expect(nights.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(nights.nth(1)).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('Home');
  await expect(nights.nth(0)).toHaveAttribute('aria-checked', 'true');
  await page.click('#next');
  // Arabic: the arrow pointing to the next choice is the left one.
  await page.evaluate(() => (window as unknown as { RiderRegistration: { applyLang(c: string): void } }).RiderRegistration.applyLang('ar'));
  await page.locator('#companies .company').first().focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#companies .company[data-v="Petrolube"]')).toHaveAttribute('aria-checked', 'true');
});

test('a new step starts at its heading, in view, not part-way down the page', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin?lang=en');
  await page.locator('#sessions .session').first().click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.click('#next');
  const head = page.locator('.step[data-step="2"] .step-title');
  await expect(head).toBeFocused();
  await expect(head).toBeInViewport();
  await expect(page.locator('#stepper')).toBeInViewport();
});
