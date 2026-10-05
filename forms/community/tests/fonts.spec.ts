import { test, expect } from '@playwright/test';

// The fonts are the website's own files (apps/web/public/fonts/forms), never Google Fonts, which the
// page used to wait 4-5 s for. Each script's face loads from the site. The page asks the database
// nothing on load, so nothing is stubbed.
for (const [lang, family] of [['en', 'Space Grotesk'], ['ar', 'IBM Plex Sans Arabic'], ['hi', 'Noto Sans Devanagari'], ['bn', 'Noto Sans Bengali']] as const) {
  test(`the page's fonts are the site's own (${lang}: ${family})`, async ({ page }) => {
    const asked: string[] = []; const failed: string[] = [];
    page.on('request', (r) => asked.push(r.url()));
    page.on('response', (r) => { if (r.url().includes('/fonts/') && r.status() !== 200) failed.push(`${r.status()} ${r.url()}`); });
    await page.goto(`/community/registration?lang=${lang}`);
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
