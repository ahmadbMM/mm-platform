import { test, expect, type Page } from '@playwright/test';
// Screenshots for review (not part of CI): SHOTS=<dir> npx playwright test shots
const DIR = process.env.SHOTS;
test.skip(!DIR, 'screenshots only when SHOTS is set');
const RIDE = { session_id: '2026-10-24', session_date: '2026-10-24', bike_slots: '{"_time":"05:45 - 06:15"}', meet_url: 'https://maps.app.goo.gl/x', open: true, code_needed: true, code_open: true };
async function stub(page: Page) {
  await page.route('**/rest/v1/rpc/*', (r) => {
    const fn = r.request().url().split('/rpc/')[1];
    const map: Record<string, unknown> = { partner_status: [RIDE], customer_login: [{ id: 'c', name: 'Sara Alharbi', email: 'sara@gmail.com', phone: '+966552468013', session_token: 't' }], customer_pwd_state: false,
      customer_profile: [{ id: 'c', name: 'Sara Alharbi', email: 'sara@gmail.com', phone: '+966552468013', height: 165, type_preference: 'Hybrid', birth_date: '1994-03-12', nationality: 'Saudi Arabia', socials: { instagram: 's' } }],
      customer_emergency: [{ emergency_name: 'L A', emergency_phone: '+966551234567', emergency_relation: 'sibling' }], customer_whatsapp: [{ phone: '+966552468013', whatsapp_same: true }], customer_fix_fields: [] };
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(map[fn] ?? true) });
  });
}
async function snap(page: Page, name: string) { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true }); }
for (const [name, opts] of [['landing-light', { colorScheme: 'light' }], ['landing-dark', { colorScheme: 'dark' }]] as const) {
  test(name, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, ...opts });
    await stub(page); await page.goto('/defe?lang=en'); await expect(page.locator('#state')).toHaveText('Places open'); await snap(page, name);
  });
}
test('landing-ar', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await stub(page); await page.goto('/defe?lang=ar'); await expect(page.locator('#state')).toHaveText('الأماكن متاحة'); await snap(page, 'landing-ar');
});
test('steps', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await stub(page); await page.goto('/defe?lang=en'); await expect(page.locator('#go')).toBeEnabled();
  await page.click('#go'); await snap(page, 'ask');
  await page.click('#ask-no'); await snap(page, 'account');
  await page.click('#back-land'); await page.click('#ask-yes'); await page.fill('#ident', 'sara@gmail.com'); await page.fill('#spwd', 'x'); await page.click('#signin');
  await page.click('#d-next'); await expect(page.locator('#s-book')).toBeVisible();
  await page.click('#groups .opt[data-v="beg"]'); await page.fill('#code', 'DEFE24'); await snap(page, 'book');
});
for (const w of [320, 1440]) {
  test(`header-${w}`, async ({ browser }) => {
    for (const lang of ['en', 'ar']) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } });
      await stub(page); await page.goto(`/defe?lang=${lang}`); await page.evaluate(() => document.fonts.ready);
      const r = await page.evaluate(() => {
        const top = document.querySelector('.top')!.getBoundingClientRect();
        const inside = ['.mm svg', '.dbadge', '#lang'].map((s) => { const b = document.querySelector(s)!.getBoundingClientRect(); return b.left >= top.left - 0.5 && b.right <= top.right + 0.5 && b.top >= top.top && b.bottom <= top.bottom; });
        return { inside, scroll: document.documentElement.scrollWidth, w: innerWidth };
      });
      expect(r.inside).toEqual([true, true, true]);
      expect(r.scroll).toBeLessThanOrEqual(r.w);
      await snap(page, `landing-${w}-${lang}`);
    }
  });
}
