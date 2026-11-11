import { test, expect } from '@playwright/test';

// The fonts are the website's own files (apps/web/public/fonts/forms), never Google Fonts, which the page used to wait
// 4-5 s for. Latin and Arabic are Rubik (one variable file a script), Urdu IBM Plex Sans Arabic, Hindi Noto Sans
// Devanagari and Bengali Noto Sans Bengali. The page asks the database for the admins' settings, the sports staff added
// and its anonymous counts as it opens: all stubbed, so nothing reaches it.
for (const [lang, family, file] of [
  ['en', 'Rubik', 'rubik-var-latin.woff2'],
  ['ar', 'Rubik', 'rubik-var-arabic.woff2'],
  ['ur', 'IBM Plex Sans Arabic', 'ibm-plex-sans-arabic-arabic-'],
  ['hi', 'Noto Sans Devanagari', 'noto-sans-devanagari-'],
  ['bn', 'Noto Sans Bengali', 'noto-sans-bengali-'],
] as const) {
  test(`the page's fonts are the site's own (${lang}: ${family})`, async ({ page }) => {
    const asked: string[] = []; const failed: string[] = [];
    // a count sent with keepalive as the page closes would go out past the route: an ordinary fetch here
    await page.addInitScript(() => {
      const f = window.fetch;
      window.fetch = function (u: RequestInfo | URL, o?: RequestInit) { return f.call(this, u, o && o.keepalive ? { ...o, keepalive: false } : o); } as typeof fetch;
    });
    await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: '[]' }));
    page.on('request', (r) => asked.push(r.url()));
    page.on('response', (r) => { if (r.url().includes('/fonts/') && r.status() !== 200) failed.push(`${r.status()} ${r.url()}`); });
    await page.goto(`/community/registration?lang=${lang}`);
    const loaded = await page.evaluate(async (f) => {
      await document.fonts.ready;
      return [...document.fonts].filter((x) => x.family.replace(/"/g, '') === f && x.status === 'loaded').length;
    }, family);
    expect(loaded, `${family} faces loaded`).toBeGreaterThan(0);
    expect(asked.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
    expect(asked.some((u) => new URL(u).pathname.startsWith('/fonts/forms/' + file)), `${file} asked`).toBe(true);
    expect(failed).toEqual([]);
  });
}
