import { test, expect, type Page } from '@playwright/test';

// Bug hunt 2026-10-14: the second step checks what the database checks, Enter is Continue, one
// registration at a time, the ticket's code is a canvas, and the hidden names are translated.
const S1 = { id: '2099-03-08-pw', title: "Petromin's Wednesdays", start: '2099-03-08T19:00:00+03:00', end: '2099-03-08T21:00:00+03:00' };
const json = (body: unknown) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function toStep2(page: Page) {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin?lang=en');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
}

test.describe('@bh14 petromin form', () => {
  test('Enter in a box on the second step is Continue, not a submit with the last step in red', async ({ page }) => {
    await toStep2(page);
    await page.fill('#badge', '104582'); await page.fill('#name', 'Amal Booked'); await page.fill('#phone', '512345678');
    await page.locator('#phone').press('Enter');
    await expect(page.locator('.step[data-step="3"]')).toBeVisible();
    await expect(page.locator('#f-height')).not.toHaveClass(/invalid/);
    await expect(page.locator('#f-type')).not.toHaveClass(/invalid/);
  });

  test('the second step refuses what the database refuses: a badge in other letters, one word, an initial', async ({ page }) => {
    await toStep2(page);
    await page.fill('#badge', 'بطاقة'); await page.fill('#name', 'Amal'); await page.fill('#phone', '512345678');
    await page.click('#next');
    await expect(page.locator('.step[data-step="2"]')).toBeVisible();
    await expect(page.locator('#f-badge')).toHaveClass(/invalid/);
    await expect(page.locator('#f-name .err')).toHaveText('Enter your full name');
    await page.fill('#badge', 'A-12'); await page.fill('#name', 'A Booked');
    await page.click('#next');
    await expect(page.locator('#f-badge')).not.toHaveClass(/invalid/);
    await expect(page.locator('#f-name .err')).toHaveText('Write your first and last name in full, not initials');
    await page.fill('#name', 'Amal Booked');
    await page.click('#next');
    await expect(page.locator('.step[data-step="3"]')).toBeVisible();
  });

  test('a number too short for the database is refused on the second step', async ({ page }) => {
    await toStep2(page);
    await page.fill('#badge', '104582'); await page.fill('#name', 'Amal Booked');
    await page.locator('#cc').selectOption('1');
    await page.fill('#phone', '123456');
    await page.click('#next');
    await expect(page.locator('#f-phone')).toHaveClass(/invalid/);
  });

  test('one registration at a time, and the ticket code is a canvas', async ({ page }) => {
    let calls = 0;
    await page.route('**/rest/v1/rpc/rider_register', async (r) => {
      if (r.request().method() !== 'OPTIONS') calls++;
      await new Promise((res) => setTimeout(res, 800));
      return r.fulfill(json({ ok: true, booking_no: 'P-007', riders: 1, session: S1 }));
    });
    await toStep2(page);
    await page.fill('#badge', '104582'); await page.fill('#name', 'Amal  Booked'); await page.fill('#phone', '512345678');
    await page.click('#next');
    await page.fill('#height', '175'); await page.click('#types .tile[data-v="Hybrid"]');
    await page.check('#privacy'); await page.check('#waiver');
    await page.click('#submit');
    await page.locator('#height').press('Enter');
    await page.evaluate(() => (document.getElementById('form') as HTMLFormElement).requestSubmit());
    await expect(page.locator('#success')).toBeVisible();
    expect(calls).toBe(1);
    await expect(page.locator('#qr canvas')).toBeVisible();
    await expect(page.locator('#qr svg')).toHaveCount(0);
    await expect(page.locator('#tk-name')).toHaveText('Amal Booked');
  });

  test('names nobody sees follow the language', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.goto('/petromin?lang=ar');
    await expect(page.locator('#lang')).toHaveAttribute('aria-label', 'اللغة');
    await expect(page.locator('#sessions')).toHaveAttribute('aria-label', 'الجلسة');
    await page.locator('#lang').selectOption('fr');
    await expect(page.locator('#stepper')).toHaveAttribute('aria-label', 'Progression');
    await expect(page.locator('.banner-close')).not.toHaveAttribute('aria-label', /.+/);
  });
});
