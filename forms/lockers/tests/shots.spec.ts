import { test, expect, type Page } from '@playwright/test';
// Screenshots for review (not part of CI): SHOTS=<dir> npx playwright test shots
const DIR = process.env.SHOTS;
test.skip(!DIR, 'screenshots only when SHOTS is set');
const D1 = '2099-11-14';
const UNITS = Array.from({ length: 18 }, (_, i) => ({ code: String(i + 1), out: i + 1 === 12 }));
const BOARD = { day: D1, kind: 'jcc', one: 10, both: 15, left: { early: 14, late: 16, both: 13, pm: 13, total: 17 },
  ended: { early: false, late: false, both: false, pm: false }, units: UNITS, taken: { e: ['4', '7', '15'], l: ['9'] } };
async function stub(page: Page) {
  await page.clock.setFixedTime(new Date('2099-11-14T14:00:00Z'));
  await page.route('**/rest/v1/rpc/*', (r) => {
    const fn = r.request().url().split('/rpc/')[1];
    const map: Record<string, unknown> = {
      locker_evenings: { one: 10, both: 15, evenings: [{ day: D1, kind: 'jcc' }, { day: '2099-11-17', kind: 'jcc' }, { day: '2099-11-18', kind: 'jcc' }] },
      locker_board: BOARD,
      customer_login: [{ id: 'c', name: 'Sara Alharbi', email: 'sara@gmail.com', phone: '+966552468013', session_token: 't' }], customer_pwd_state: false,
      customer_wallet: { balance: 40, rows: [] },
      customer_lockers: [{ id: 'r1', booking_id: null, day: D1, period: 'early', status: 'reserved', price: 10, on_bill: false, pay: 'wallet', paid: true, code: '5' },
        { id: 'r2', booking_id: null, day: D1, period: 'early', status: 'in_use', price: 10, on_bill: false, pay: 'desk', paid: false, code: '6' }],
      customer_locker_book: { ok: true, rentals: [{ id: 'r1', code: '5' }], left: BOARD.left },
    };
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(map[fn] ?? true) });
  });
}
async function snap(page: Page, name: string) { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true }); }
for (const [name, lang, scheme, w] of [['pick-light', 'en', 'light', 390], ['pick-dark', 'en', 'dark', 390], ['pick-ar', 'ar', 'light', 390], ['pick-desk', 'en', 'light', 1280], ['pick-desk-dark', 'ar', 'dark', 1280]] as const) {
  test(name, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: scheme });
    await stub(page); await page.goto(`/lockers?lang=${lang}`);
    await expect(page.locator('.door[data-code="1"]')).toBeVisible();
    await page.click('.door[data-code="5"]'); await page.click('.door[data-code="8"]');
    await snap(page, name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
  });
}
test('review-done', async ({ browser }) => {
  for (const scheme of ['light', 'dark'] as const) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    await stub(page); await page.goto('/lockers?lang=en');
    await page.click('.door[data-code="5"]'); await page.click('#go');
    await snap(page, `ask-${scheme}`);
    await page.click('#ask-yes'); await page.fill('#ident', 'sara@gmail.com'); await page.fill('#spwd', 'x'); await page.click('#signin');
    await expect(page.locator('#s-review')).toBeVisible(); await page.click('#pays [data-v="wallet"]'); await snap(page, `review-${scheme}`);
    await page.click('#book'); await expect(page.locator('#v-done')).toBeVisible(); await snap(page, `done-${scheme}`);
    await page.click('#mine-done .mine-x'); await snap(page, `remove-${scheme}`);
  }
});
