import { test, expect } from '@playwright/test';

// The fonts are the website's own files (apps/web/public/fonts), never Google Fonts: Archivo for the display lines,
// Space Grotesk for the English text, IBM Plex Sans Arabic for the Arabic, and the site's riyal sign (MM Riyal) for
// the prices.
const EVENINGS = { one: 10, both: 15, evenings: [{ day: '2099-11-14', kind: 'jcc' }] };
const BOARD = { day: '2099-11-14', kind: 'jcc', one: 10, both: 15, left: { early: 18, late: 18, both: 18, pm: 18, total: 18 },
  ended: { early: false, late: false, both: false, pm: false }, units: Array.from({ length: 18 }, (_, i) => ({ code: String(i + 1), out: false })), taken: { e: [], l: [] } };
for (const [lang, family] of [['en', 'Archivo'], ['en', 'Space Grotesk'], ['ar', 'IBM Plex Sans Arabic'], ['en', 'MM Riyal']] as const) {
  test(`the page's fonts are the site's own (${lang}: ${family})`, async ({ page }) => {
    const asked: string[] = []; const failed: string[] = [];
    page.on('request', (r) => asked.push(r.url()));
    page.on('response', (r) => { if (r.url().includes('/fonts/') && r.status() !== 200) failed.push(`${r.status()} ${r.url()}`); });
    await page.route('**/rest/v1/rpc/*', (r) => {
      const fn = r.request().url().split('/rpc/')[1];
      const body = fn === 'locker_evenings' ? EVENINGS : fn === 'locker_board' ? BOARD : [];
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    await page.goto(`/lockers?lang=${lang}`);
    await expect(page.locator('#periods .opt').first()).toContainText('⃁');
    await expect.poll(() => page.evaluate(async (f) => {
      await document.fonts.ready;
      return [...document.fonts].filter((x) => x.family.replace(/"/g, '') === f && x.status === 'loaded').length;
    }, family), { message: `${family} faces loaded` }).toBeGreaterThan(0);
    expect(asked.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
    expect(failed).toEqual([]);
  });
}
