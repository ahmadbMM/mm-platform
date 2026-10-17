import { test, expect } from '@playwright/test';

// The fonts are the website's own files (apps/web/public/fonts/forms), never Google Fonts: Archivo
// for the display lines, Space Grotesk for the English text, IBM Plex Sans Arabic for the Arabic.
for (const [lang, family] of [['en', 'Archivo'], ['en', 'Space Grotesk'], ['ar', 'IBM Plex Sans Arabic']] as const) {
  test(`the page's fonts are the site's own (${lang}: ${family})`, async ({ page }) => {
    const asked: string[] = []; const failed: string[] = [];
    page.on('request', (r) => asked.push(r.url()));
    page.on('response', (r) => { if (r.url().includes('/fonts/') && r.status() !== 200) failed.push(`${r.status()} ${r.url()}`); });
    await page.route('**/rest/v1/rpc/*', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
    await page.goto(`/defe?lang=${lang}`);
    const loaded = await page.evaluate(async (f) => {
      await document.fonts.ready;
      return [...document.fonts].filter((x) => x.family.replace(/"/g, '') === f && x.status === 'loaded').length;
    }, family);
    expect(loaded, `${family} faces loaded`).toBeGreaterThan(0);
    expect(asked.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
    expect(failed).toEqual([]);
  });
}
