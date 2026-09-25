import { test, expect } from '@playwright/test';
const S1 = { id: '2026-09-21-pw', title: "Petromin's ND96 Session", start: '2026-09-21T19:00:00+03:00', end: '2026-09-21T21:00:00+03:00' };
const json = (b: unknown) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(b) });
for (const lang of ['ar', 'fr', 'es', 'pt', 'hi', 'ne', 'tl', 'bn']) {
  test(`the booking card speaks ${lang}`, async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.addInitScript(() => localStorage.setItem('mm-petromin-registration', JSON.stringify({
      badge: 'E-1', name: 'A B', company: 'Petromin', phone: '+966512345678', height: 170, type: 'Hybrid',
      session: { id: '2026-09-21-pw', start: '2026-09-21T19:00:00+03:00', end: '2026-09-21T21:00:00+03:00' },
      bookingNo: 'P-026', riders: [{ name: 'Sara', height: 160, type: 'Hybrid' }], submittedAt: '2026-09-20T10:00:00Z' })));
    await page.clock.setFixedTime(new Date('2026-09-20T12:00:00+03:00')); // the fixture's session is the 21st: before it, not after
    await page.goto(`/petromin?lang=${lang}`, { waitUntil: 'networkidle' });
    await expect(page.locator('#ticket')).toBeVisible();
    // The real invariant: every key the card asks for exists in this language's dictionary.
    // Some translations equal the English word (French "Badge", Tagalog "Booking"), so
    // comparing rendered text against English would cry wolf.
    const { missing, shown } = await page.evaluate(() => {
      const w = window as unknown as { RiderRegistration?: { translations?: Record<string, Record<string, string>> } };
      const dict = w.RiderRegistration!.translations![document.documentElement.lang] || {};
      const keys = Array.from(document.querySelectorAll('#ticket [data-t]')).map((e) => e.getAttribute('data-t')!);
      return { missing: keys.filter((k) => !(k in dict)), shown: Array.from(document.querySelectorAll('#ticket [data-t]')).map((e) => e.textContent!.trim()) };
    });
    console.log(`${lang}: ${shown.join(' | ')}`);
    expect(missing, `keys with no ${lang} translation`).toEqual([]);
  });
}
