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
  // The name keeps its hint, and adds the message while it shows.
  await expect(page.locator('#name')).toHaveAccessibleDescription('Use the same name you booked with so we can find your booking Enter your full name');
  await page.fill('#name', 'Amal Booked');
  await expect(page.locator('#name')).toHaveAccessibleDescription('Use the same name you booked with so we can find your booking');
  await expect(page.locator('#name')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#phone')).toHaveAccessibleDescription('Enter a valid Saudi mobile number (05XXXXXXXX)');
  for (const id of ['f-session', 'f-company', 'f-badge', 'f-name', 'f-phone', 'f-height', 'f-type', 'f-privacy', 'f-waiver']) {
    await expect(page.locator(`#${id} .err`), id).toHaveAttribute('aria-live', 'polite');
  }
});

test("each companion's boxes are named with their rider, and their messages are tied to them", async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin?lang=en');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', 'A-12'); await page.fill('#name', 'Amal Booked'); await page.fill('#phone', '512345678');
  await page.fill('#em-name', 'Huda Contact'); await page.fill('#em-phone', '551112222'); await page.selectOption('#em-rel', 'spouse');
  await page.click('#next');
  await page.fill('#height', '175'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.click('#add-rider'); await page.click('#add-rider');
  const name2 = page.getByRole('textbox', { name: 'Rider 2 Full name', exact: true });
  const name3 = page.getByRole('textbox', { name: 'Rider 3 Full name', exact: true });
  await expect(name2).toBeVisible();
  await expect(name3).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Rider 2 Height in cm', exact: true })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Rider 3 Bike type', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Rider 3', exact: true })).toBeVisible();
  // A label still focuses its box.
  await page.locator('#riders .rider').nth(1).locator('.rider-name label').click();
  await expect(name3).toBeFocused();

  await page.check('#privacy'); await page.check('#waiver');
  await page.click('#submit');
  await expect(name2).toHaveAttribute('aria-invalid', 'true');
  await expect(name2).toHaveAccessibleDescription("Enter the rider's full name");
  await expect(page.locator('#rider-0-name-err')).toHaveAttribute('aria-live', 'polite');
  await name2.fill('Sara Ali');
  await expect(name2).not.toHaveAttribute('aria-invalid', 'true');
  await expect(name2).toHaveAccessibleDescription('');
  await page.getByRole('spinbutton', { name: 'Rider 2 Height in cm', exact: true }).fill('160');
  await page.locator('#riders .rider').nth(0).locator('.tile[data-v="Mountain"]').click();
  await name3.fill('Omar Ali');
  await page.getByRole('spinbutton', { name: 'Rider 3 Height in cm', exact: true }).fill('180');
  await page.click('#submit');
  const type3 = page.getByRole('radiogroup', { name: 'Rider 3 Bike type', exact: true });
  await expect(type3).toHaveAttribute('aria-invalid', 'true');
  await expect(type3).toHaveAccessibleDescription('Choose a bike type');
});
