import { test, expect } from '@playwright/test';

// The fonts are the website's own files (apps/web/public/fonts/forms), never Google Fonts, which the
// page used to wait 4-5 s for. Each script's face loads from the site.
const S1 = { id: '2099-02-08-pw', title: "Petromin's Wednesdays", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' };
const json = (body: unknown) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });

for (const [lang, family] of [['en', 'Space Grotesk'], ['ar', 'IBM Plex Sans Arabic'], ['ur', 'IBM Plex Sans Arabic'], ['hi', 'Noto Sans Devanagari'], ['bn', 'Noto Sans Bengali']] as const) {
  test(`the page's fonts are the site's own (${lang}: ${family})`, async ({ page }) => {
    const asked: string[] = []; const failed: string[] = [];
    page.on('request', (r) => asked.push(r.url()));
    page.on('response', (r) => { if (r.url().includes('/fonts/') && r.status() !== 200) failed.push(`${r.status()} ${r.url()}`); });
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.goto(`/petromin?lang=${lang}`);
    const loaded = await page.evaluate(async (f) => {
      await document.fonts.ready;
      return [...document.fonts].filter((x) => x.family.replace(/"/g, '') === f && x.status === 'loaded').length;
    }, family);
    expect(loaded, `${family} faces loaded`).toBeGreaterThan(0);
    expect(asked.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
    expect(asked.some((u) => new URL(u).pathname.startsWith('/fonts/forms/'))).toBe(true);
    expect(failed).toEqual([]);
  });
}
