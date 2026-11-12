import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { json, S1, SAVED, BOOKED, pickNight, details, agree, register, toCheck } from './flow';

// What the Petromin form's round of 2026-11-11 gave its riders, on the Dukan form: Find my booking on any phone, Cancel
// my booking, a calendar file, the night's facts, the grey cards while the calendar answers, Jeddah's time on a phone
// set elsewhere, a 320 px phone, and an accessibility check of every step. Tagged @webkit run on an iPhone too.
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

async function axe(page: Page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const w = window as unknown as { axe: { run(d: Element, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
    const root = document.querySelector('.mmf-dukan') || document.body; // the form, not the website around it
    const r = await w.axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} x${v.nodes.length}`);
  });
}
const LOOKED = { ok: true, booking_no: 'D-004', company: 'Dukan', badge: 'DK-512345678', name: 'Amal Booked', phone: '+966512345678', height: null, type: 'Hybrid', checked_in: false, session: S1, riders: [] };

test.describe('@webkit Dukan form', () => {
  test.use({ bypassCSP: true });

  test('find my booking: the number and the mobile bring it back on a phone that never had it', async ({ page }) => {
    const asks: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/rider_lookup', (r) => {
      const b = r.request().postDataJSON() as Record<string, unknown>; asks.push(b);
      if (b.p_phone !== '+966512345678') return r.fulfill(json({ ok: false, error: 'notfound' }));
      return r.fulfill(json(LOOKED));
    });
    await page.goto('/dukan?lang=en');
    await page.click('#find');
    const d = page.getByRole('dialog', { name: 'Find my booking' });
    await expect(d).toBeVisible();
    await expect(page.locator('#fd-no')).toHaveAttribute('placeholder', 'D-001');
    await page.click('#fd-go');
    await expect(page.locator('#fd-f-no')).toHaveClass(/invalid/);
    expect(asks).toHaveLength(0);
    // "4" is D-004; a wrong number is a plain miss, never a hint at which part was wrong.
    await page.fill('#fd-no', '4'); await page.fill('#fd-phone', '0512345679');
    await page.click('#fd-go');
    await expect(page.locator('#fd-miss')).toHaveText('We could not find a booking with this number and mobile number.');
    expect(asks[0]).toEqual({ p_booking_no: 'D-004', p_phone: '+966512345679' });
    await page.fill('#fd-phone', '٠٥١٢٣٤٥٦٧٨'); // Arabic digits are digits
    await page.click('#fd-go');
    await expect(d).toBeHidden();
    await expect(page.locator('#chip-booking-value')).toHaveText('D-004');
    await expect(page.locator('#tk-name')).toHaveText('Amal Booked');
    // and the phone keeps it from now on
    await page.reload();
    await expect(page.locator('#chip-booking-value')).toHaveText('D-004');
  });

  test("find my booking shows a Dukan registration only: another company's booking is a miss", async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/rider_lookup', (r) => r.fulfill(json({ ...LOOKED, booking_no: 'P-004', company: 'Petromin' })));
    await page.goto('/dukan?lang=en');
    await page.click('#find');
    await page.fill('#fd-no', 'P-4'); await page.fill('#fd-phone', '0512345678');
    await page.click('#fd-go');
    await expect(page.locator('#fd-miss')).toHaveText('We could not find a booking with this number and mobile number.');
    await expect(page.locator('#success')).toBeHidden();
  });

  test('cancel my booking asks first, then the booking goes and the phone shows a fresh form', async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    let answer: Record<string, unknown> = { ok: false, error: 'desk' };
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/rider_cancel', (r) => { sent.push(r.request().postDataJSON()); return r.fulfill(json(answer)); });
    await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('mm-dukan-registration', JSON.stringify(s)); } }, SAVED);
    await page.goto('/dukan?lang=en');
    await page.click('#cancel-booking');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#ask-text')).toHaveText('Cancel booking D-004? You will lose your place.');
    await page.click('#ask-no');
    expect(sent).toHaveLength(0);
    await page.click('#cancel-booking'); await page.click('#ask-yes');
    await expect(page.locator('.done-note')).toHaveText('The desk has this booking. Ask the desk to cancel it.');
    await expect(page.locator('#success')).toBeVisible();
    answer = { ok: true, booking_no: 'D-004', session_id: S1.id };
    await page.click('#cancel-booking'); await page.click('#ask-yes');
    await expect(page.locator('#notice')).toHaveText('Your booking was cancelled.');
    await expect(page.locator('.step[data-step="1"]')).toBeVisible();
    expect(sent[1]).toEqual({ p_booking_no: 'D-004', p_proof_phone: '+966512345678', p_session_id: S1.id });
    expect(await page.evaluate(() => localStorage.getItem('mm-dukan-registration'))).toBeNull();
  });

  test('the ticket saves to a calendar with a reminder before bikes are handed out, and says where and the helmet', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.addInitScript((s) => localStorage.setItem('mm-dukan-registration', JSON.stringify(s)), SAVED);
    await page.goto('/dukan?lang=en');
    await expect(page.locator('#tk-place-value')).toHaveText('Jeddah Corniche Circuit');
    await expect(page.locator('#tk-pickup-value')).toHaveText(/06:45/);
    await expect(page.locator('#directions')).toBeVisible();
    await expect(page.locator('.ticket-helmet')).toHaveText('Helmets are required. One comes with every bike.');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#calendar')]);
    expect(dl.suggestedFilename()).toBe('dukan-D-004.ics');
    const ics = readFileSync(await dl.path(), 'utf8');
    expect(ics).toContain('DTSTART:20990208T154500Z'); // 18:45 in Jeddah
    expect(ics).toContain('DTEND:20990208T180000Z');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics).toContain('LOCATION:Jeddah Corniche Circuit');
    expect(ics).toContain('URL:https://micromobility.sa/dukan');
    expect(ics).toMatch(/SUMMARY:Dukan bike night · D-004/);
    expect(ics).not.toMatch(/petromin/i);
  });

  test('Add to Apple Wallet asks the website for the pass of this booking (an iPhone only)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'the button shows on an iPhone or iPad');
    const asked: Record<string, unknown>[] = [];
    await page.route('**/api/petromin-pass', (r) => { asked.push(r.request().postDataJSON()); return r.fulfill({ status: 200, headers: { 'content-type': 'application/vnd.apple.pkpass' }, body: 'PK' }); });
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.addInitScript((s) => localStorage.setItem('mm-dukan-registration', JSON.stringify(s)), SAVED);
    await page.goto('/dukan?lang=ar');
    await expect(page.locator('#wallet')).toBeVisible();
    await page.click('#wallet');
    await expect.poll(() => asked.length).toBe(1);
    expect(asked[0]).toEqual({ bookingNo: 'D-004', phone: '+966512345678', sessionId: S1.id, lang: 'ar' });
  });

  test('the night card says when bikes are handed out and where; grey cards while the calendar answers', async ({ page }) => {
    let release: () => void = () => {};
    const held = new Promise<void>((res) => { release = res; });
    await page.route('**/rest/v1/rpc/rider_sessions', async (r) => { await held; return r.fulfill(json([S1])); });
    await page.goto('/dukan?lang=en');
    await expect(page.locator('#sessions .session.skeleton')).toHaveCount(3);
    await expect(page.locator('#sessions')).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(page.locator('#sessions .session-facts')).toHaveText('Bikes from 06:45 PM · Jeddah Corniche Circuit');
    await expect(page.locator('#sessions .session-date')).toHaveText('Sun, Feb 8');
  });

  test('no night to offer, or no answer: the WhatsApp line is beside the message', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.abort());
    await page.goto('/dukan?lang=en');
    await expect(page.locator('#banner .banner-text')).toHaveText('Could not reach the server');
    await expect(page.locator('#sessions .sessions-empty')).toHaveText('No upcoming sessions');
    await expect(page.locator('#sessions .sessions-help')).toHaveAttribute('href', /wa\.me\/966566668818/);
  });

  test('a refusal the form does not know is not called a lost connection, and the second offers WhatsApp', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json({ ok: false, error: 'riders' })));
    await page.goto('/dukan?lang=en');
    await register(page);
    await expect(page.locator('#banner .banner-text')).toHaveText('We could not save this. Please try again.');
    await expect(page.locator('#banner')).toBeInViewport();
    await expect(page.locator('#banner-help')).toBeHidden();
    await page.click('#submit');
    await expect(page.locator('#banner-help')).toBeVisible();
  });

  test('every step and the ticket pass an accessibility check, in English and Arabic', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(BOOKED())));
    for (const lang of ['en', 'ar']) {
      await page.goto(`/dukan?lang=${lang}`);
      await expect(page.locator('#sessions .session')).toHaveCount(1);
      expect(await axe(page), `${lang} step 1`).toEqual([]);
      await page.click('#find');
      await page.click('#fd-go'); // its messages showing
      expect(await axe(page), `${lang} find my booking`).toEqual([]);
      await page.click('#fd-cancel');
      await pickNight(page);
      await page.click('#next'); // nothing filled in: every message showing
      expect(await axe(page), `${lang} step 2 with its messages`).toEqual([]);
      await details(page);
      await page.click('#submit'); // the two boxes' messages
      expect(await axe(page), `${lang} step 3 with its messages`).toEqual([]);
      await agree(page);
      await page.click('#submit');
      await expect(page.locator('#success')).toBeVisible();
      expect(await axe(page), `${lang} ticket`).toEqual([]);
      await page.evaluate(() => localStorage.clear());
    }
  });
});

test.describe('a phone set to another time zone, and a narrow phone', () => {
  test.use({ timezoneId: 'America/New_York', viewport: { width: 320, height: 640 } });
  test('the night reads in Jeddah time, and nothing is wider than a 320 px screen', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(BOOKED())));
    await page.goto('/dukan?lang=en');
    await expect(page.locator('#sessions .session-time')).toHaveText('07:00 PM – 09:00 PM');
    const wide = async () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(await wide(), 'step 1').toBe(false);
    await pickNight(page);
    expect(await wide(), 'step 2').toBe(false);
    await details(page);
    expect(await wide(), 'step 3').toBe(false);
    await agree(page);
    await page.click('#submit');
    await expect(page.locator('#success')).toBeVisible();
    expect(await wide(), 'the ticket').toBe(false);
  });
  test('Arabic at 320 px too', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.goto('/dukan?lang=ar');
    await toCheck(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  });
});
