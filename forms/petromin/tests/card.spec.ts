import { test, expect } from '@playwright/test';
const S1 = { id: '2026-09-21-pw', title: "Petromin's ND96 Session", start: '2026-09-21T19:00:00+03:00', end: '2026-09-21T21:00:00+03:00' };
const json = (b: unknown) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('booking card, registering with two companions', async ({ page }) => {
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json({ ok: true, id: 1, match: 'none', booking_no: 'P-026', riders: 3, session: S1 })));
  await page.goto('/petromin', { waitUntil: 'networkidle' });
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', '104582'); await page.fill('#name', 'Faisal Al Harbi'); await page.fill('#phone', '512345678');
  await page.fill('#em-name', 'Huda Contact'); await page.fill('#em-phone', '551112222'); await page.selectOption('#em-rel', 'spouse');
  await page.click('#next');
  await page.fill('#height', '178'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.check('#privacy'); // the Privacy Notice confirmation a new registration needs
  await page.check('#waiver'); // the ride waiver every registration needs
  await page.click('#add-rider'); await page.locator('#riders .rider').nth(0).locator('.rider-name input').fill('Sara');
  await page.locator('#riders .rider').nth(0).locator('.rider-height input').fill('162');
  await page.locator('#riders .rider').nth(0).locator('.tile[data-v="Mountain"]').click();
  await page.click('#submit');
  await expect(page.locator('#ticket')).toBeVisible();
  console.log('number :', (await page.locator('#ticket .ticket-num').textContent())?.trim());
  console.log('party  :', (await page.locator('#chip-riders').textContent())?.replace(/\s+/g, ' ').trim());
  console.log('qr     :', await page.locator('#ticket .qr svg').count());
  console.log('cols   :', (await page.locator('#ticket .ticket-cols').allTextContents())[0].replace(/\s+/g, ' ').trim());
  console.log('riders :', (await page.locator('#riders-note').textContent())?.trim());
  await page.screenshot({ path: 'card.png', fullPage: true });
  expect(errs).toEqual([]);
});
