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

// A number typed with its country code but no + or 00 used to get the code twice ("+971971501234567"):
// the code goes when what is left has the length of a mobile number there and the whole does not.
test('a number typed with its country code but no + or 00 keeps the code once', async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => {
    if (r.request().method() !== 'OPTIONS') sent.push(JSON.parse(r.request().postData() || '{}'));
    return r.fulfill(json({ ok: true, id: 1, match: 'none', booking_no: 'P-026', riders: 1, session: S1 }));
  });
  await page.goto('/petromin', { waitUntil: 'networkidle' });
  const e164 = (code: string, typed: string) => page.evaluate(([c, t]) => {
    (document.getElementById('cc') as HTMLSelectElement).value = c;
    (document.getElementById('phone') as HTMLInputElement).value = t;
    return (window as unknown as { RiderRegistration: { getPhone(): string } }).RiderRegistration.getPhone();
  }, [code, typed]);
  for (const [code, typed, want] of [
    ['971', '971501234567', '+971501234567'],
    ['971', '9710501234567', '+971501234567'],
    ['971', '0501234567', '+971501234567'],
    ['971', '+971 50 123 4567', '+971501234567'],
    ['91', '919876543210', '+919876543210'],
    ['91', '9198765432', '+919198765432'], // an Indian mobile that starts with 91 keeps it
    ['44', '447911123456', '+447911123456'],
    ['44', '07911123456', '+447911123456'],
    ['1', '12025550123', '+12025550123'],
    ['55', '55991234567', '+5555991234567'], // a Brazilian mobile in area 55 keeps it
    ['55', '5555991234567', '+5555991234567'],
    ['961', '9613123456', '+9613123456'],
    ['966', '966512345678', '+966512345678'],
  ]) expect(await e164(code, typed), `${code} ${typed}`).toBe(want);

  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', '104582'); await page.fill('#name', 'Faisal Al Harbi');
  await page.selectOption('#cc', '971');
  await page.fill('#phone', '971501234567');
  await page.click('#next');
  await expect(page.locator('#f-phone')).not.toHaveClass(/invalid/);
  await page.fill('#height', '178'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.check('#privacy');
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#ticket')).toBeVisible();
  expect(sent[0]).toMatchObject({ p_phone: '+971501234567' });
});
