import { test, expect } from '@playwright/test';

// Digits typed on an Arabic keyboard are digits: the phone check used to delete them before
// reading the number, so a valid mobile read as too short and the form would not go on.
const S1 = { id: '2026-09-21-pw', title: "Petromin's ND96 Session", start: '2026-09-21T19:00:00+03:00', end: '2026-09-21T21:00:00+03:00' };
const json = (b: unknown) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('a phone and a badge typed in Arabic digits go through, and reach the server as digits', async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => {
    if (r.request().method() !== 'OPTIONS') sent.push(JSON.parse(r.request().postData() || '{}'));
    return r.fulfill(json({ ok: true, id: 1, match: 'none', booking_no: 'P-026', riders: 1, session: S1 }));
  });
  await page.goto('/petromin', { waitUntil: 'networkidle' });
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', '١٠٤٥٨٢'); await page.fill('#name', 'Faisal Al Harbi'); await page.fill('#phone', '٥١٢٣٤٥٦٧٨');
  await page.click('#next');
  await expect(page.locator('#f-phone')).not.toHaveClass(/invalid/);
  await page.fill('#height', '178'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.check('#privacy');
  await page.check('#waiver'); // the ride waiver every registration needs
  await page.click('#submit');
  await expect(page.locator('#ticket')).toBeVisible();
  expect(sent[0]).toMatchObject({ p_badge: '104582', p_phone: '+966512345678' });
});
