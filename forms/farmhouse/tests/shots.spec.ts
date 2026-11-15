import { test, expect, type Page } from '@playwright/test';
// Screenshots for review (not part of CI): SHOTS=<dir> npx playwright test shots
const DIR = process.env.SHOTS;
test.skip(!DIR, 'screenshots only when SHOTS is set');
const NIGHT = { id: '2099-11-19-fh', date: '2099-11-19', day: 'Thursday', title: 'The Farmhouse Night', title_ar: 'ليلة فارم هاوس', time: '16:30 - 20:30', place: 'Farmhouse, Dhahban', place_ar: 'فارم هاوس، ذهبان', map: 'https://maps.app.goo.gl/x', ig: 'thefarmhouse.jed', state: 'open', max: 4 };
async function stub(page: Page) {
  await page.route('**/rest/v1/rpc/*', (r) => {
    const fn = r.request().url().split('/rpc/')[1];
    const body = JSON.parse(r.request().postData() || '{}');
    const map: Record<string, unknown> = {
      farm_night: { ok: true, code: 'FARM2099', signed_in: !!body.p_id, nights: [{ ...NIGHT, held: body.p_id ? [] : null }] },
      customer_login: [{ id: 'c', name: 'Sara Alharbi', email: 'sara@gmail.com', phone: '+966552468013', session_token: 't' }], customer_pwd_state: false,
      customer_profile: [{ id: 'c', name: 'Sara Alharbi', email: 'sara@gmail.com', phone: '+966552468013', height: 165, birth_date: '1994-03-12', nationality: 'Saudi Arabia', socials: {} }],
      customer_emergency: [{ emergency_name: 'L A', emergency_phone: '+966551234567', emergency_relation: 'sibling' }], customer_whatsapp: [{ phone: '+966552468013', whatsapp_same: true }], customer_fix_fields: [],
      farm_book: { ok: true, added: 3, people: ['Sara Alharbi', 'Lina Alharbi', 'Omar Alharbi'] }, customer_handoff_create: null,
    };
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(fn in map ? map[fn] : true) });
  });
}
async function snap(page: Page, name: string) { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true }); }
for (const [lang, scheme] of [['en', 'light'], ['en', 'dark'], ['ar', 'light']] as const) {
  test(`landing-${lang}-${scheme}`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    await stub(page); await page.goto(`/farmhouse?lang=${lang}`); await expect(page.locator('#go')).toBeEnabled(); await snap(page, `landing-${lang}-${scheme}`);
  });
}
test('steps', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await stub(page); await page.goto('/farmhouse?lang=en');
  await page.fill('#code', 'FARM2099'); await page.click('#go'); await expect(page.locator('#p-ask')).toBeVisible(); await snap(page, 'ask');
  await page.click('#back-land'); await snap(page, 'landing-after-code');
  await page.click('#go'); await page.click('#ask-yes'); await page.fill('#ident', 'sara@gmail.com'); await page.fill('#spwd', 'x'); await page.click('#signin');
  await expect(page.locator('#s-book')).toBeVisible();
  await page.click('#ppl-inc'); await page.click('#ppl-inc'); await page.fill('#pn-0', 'Lina Alharbi'); await page.fill('#pn-1', 'Omar Alharbi'); await snap(page, 'people');
  await page.click('#waiver .tick-box'); await page.click('#book'); await expect(page.locator('#done-title')).toBeVisible(); await snap(page, 'done');
});
