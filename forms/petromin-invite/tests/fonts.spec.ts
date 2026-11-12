import { test, expect, json, S1, SAVED } from './flow';

// The fonts are the website's own files (apps/web/public/fonts/forms), never Google Fonts: the Petromin form's faces,
// Space Grotesk, IBM Plex Sans Arabic (Arabic and Urdu), Noto Sans Devanagari and Noto Sans Bengali. On the website's
// page the site's own Space Grotesk and IBM Plex Sans Arabic serve, never fetched a second time. The riyal sign is the
// site's own font file too.
for (const [lang, family] of [['en', 'Space Grotesk'], ['ar', 'IBM Plex Sans Arabic'], ['ur', 'IBM Plex Sans Arabic'], ['hi', 'Noto Sans Devanagari'], ['bn', 'Noto Sans Bengali']] as const) {
  test(`the page's fonts are the site's own (${lang}: ${family})`, async ({ page }) => {
    const asked: string[] = []; const failed: string[] = [];
    page.on('request', (r) => asked.push(r.url()));
    page.on('response', (r) => { if (r.url().includes('/fonts/') && r.status() !== 200) failed.push(`${r.status()} ${r.url()}`); });
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.goto(`/petromin-invite?lang=${lang}`);
    const onSite = await page.locator('.mmf-petromin-invite').count() > 0;
    // Polled: the website's page draws the form's text once its scripts run, after the page is on screen. There the
    // site's own faces (next/font) carry other names, so only the faces the form fetches itself are looked for by name.
    if (!onSite || !(lang === 'en' || lang === 'ar' || lang === 'ur')) {
      await expect.poll(() => page.evaluate(async (f) => {
        await document.fonts.ready;
        return [...document.fonts].filter((x) => x.family.replace(/"/g, '') === f && x.status === 'loaded').length;
      }, family), { message: `${family} faces loaded` }).toBeGreaterThan(0);
    }
    expect(asked.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
    const own = asked.filter((u) => new URL(u).pathname.startsWith('/fonts/forms/'));
    if (onSite && (lang === 'en' || lang === 'ar' || lang === 'ur')) expect(own.filter((u) => /space-grotesk|ibm-plex/.test(u))).toEqual([]);
    else expect(own.length).toBeGreaterThan(0);
    expect(failed).toEqual([]);
  });
}

test('the riyal sign on the ticket is drawn by the site\'s own font file', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => asked.push(new URL(r.url()).pathname));
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), SAVED);
  await page.goto('/petromin-invite?lang=en');
  await expect(page.locator('#tk-price-value .amt-sign')).toBeVisible();
  await expect.poll(() => asked.some((p) => /^\/fonts\/Riyal-\d+\.woff2$/.test(p)), { message: 'Riyal font fetched' }).toBe(true);
  await expect.poll(() => page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((x) => x.family.replace(/"/g, '') === 'MM Riyal' && x.status === 'loaded'); })).toBe(true);
});

test('the title and the buttons are in Space Grotesk', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin-invite?lang=en');
  if (await page.locator('.mmf-petromin-invite').count()) return; // the website's page: its own Space Grotesk, by its own name
  for (const sel of ['#form .title', '#next', '#sessions .session-date']) {
    await expect.poll(() => page.locator(sel).first().evaluate((el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/"/g, '').trim()), sel).toBe('Space Grotesk');
  }
});
