import { test, expect } from '@playwright/test';
import { json, S1 } from './flow';

// The fonts are the website's own files (apps/web/public/fonts/forms), never Google Fonts. Dukan's own face, Rubik,
// draws Latin and Arabic; Urdu keeps IBM Plex Sans Arabic (Rubik lacks some of its letters), Hindi and Nepali Noto Sans
// Devanagari, Bengali Noto Sans Bengali.
for (const [lang, family, file] of [['en', 'Rubik', 'rubik-var-latin'], ['ar', 'Rubik', 'rubik-var-arabic'], ['hi', 'Noto Sans Devanagari', 'noto-sans-devanagari'], ['bn', 'Noto Sans Bengali', 'noto-sans-bengali']] as const) {
  test(`the page's fonts are the site's own (${lang}: ${family})`, async ({ page }) => {
    const asked: string[] = []; const failed: string[] = [];
    page.on('request', (r) => asked.push(r.url()));
    page.on('response', (r) => { if (r.url().includes('/fonts/') && r.status() !== 200) failed.push(`${r.status()} ${r.url()}`); });
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.goto(`/dukan?lang=${lang}`);
    // Polled: the website's page draws the form's text once its scripts run, after the page is on screen.
    await expect.poll(() => page.evaluate(async (f) => {
      await document.fonts.ready;
      return [...document.fonts].filter((x) => x.family.replace(/"/g, '') === f && x.status === 'loaded').length;
    }, family), { message: `${family} faces loaded` }).toBeGreaterThan(0);
    expect(asked.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
    const own = () => asked.filter((u) => new URL(u).pathname.startsWith('/fonts/forms/'));
    // the website's page puts the form's words in its language once its scripts run, so a script's face comes after
    await expect.poll(() => own().some((u) => u.includes(file)), { message: `${file} fetched` }).toBe(true);
    // never a face the form does not use (Space Grotesk is the website's, not Dukan's)
    expect(own().filter((u) => /space-grotesk/.test(u))).toEqual([]);
    expect(failed).toEqual([]);
  });
}

test('the title and the buttons are in Rubik', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/dukan?lang=en');
  for (const sel of ['#form .title', '#next', '#sessions .session-date']) {
    await expect.poll(() => page.locator(sel).first().evaluate((el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/"/g, '').trim()), sel).toBe('Rubik');
  }
});
