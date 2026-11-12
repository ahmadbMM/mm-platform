import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, json, S1, SAVED, LOOKED, booking, pickNight, details, bike, agree, register, toCheck } from './flow';

// What the partner forms give their riders, on the guests' form: Find my booking on any phone (a guest's I- number
// only), Cancel my booking, a calendar file, the night's facts, the grey cards while the calendar answers, Jeddah's time
// on a phone set elsewhere, a 320 px phone, and an accessibility check of every step. Tagged @webkit run on an iPhone too.
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

async function axe(page: Page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const w = window as unknown as { axe: { run(d: Element, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
    const root = document.querySelector('.mmf-petromin-invite') || document.body; // the form, not the website around it
    const r = await w.axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} x${v.nodes.length}`);
  });
}

test.describe('@webkit Petromin guests form', () => {
  test.use({ bypassCSP: true });

  test('find my booking: the number and the mobile bring it back on a phone that never had it', async ({ page }) => {
    const asks: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => {
      const b = r.request().postDataJSON() as Record<string, unknown>; asks.push(b);
      if (b.p_phone !== '+966512345678') return r.fulfill(json({ ok: false, error: 'notfound' }));
      return r.fulfill(json(LOOKED));
    });
    await page.goto('/petromin-invite?lang=en');
    await page.click('#find');
    const d = page.getByRole('dialog', { name: 'Find my booking' });
    await expect(d).toBeVisible();
    await expect(page.locator('#fd-no')).toHaveAttribute('placeholder', 'I-001');
    await page.click('#fd-go');
    await expect(page.locator('#fd-f-no')).toHaveClass(/invalid/);
    expect(asks).toHaveLength(0);
    // "4" is I-004; a wrong number is a plain miss, never a hint at which part was wrong.
    await page.fill('#fd-no', '4'); await page.fill('#fd-phone', '0512345679');
    await page.click('#fd-go');
    await expect(page.locator('#fd-miss')).toHaveText('We could not find a booking with this number and mobile number.');
    expect(asks[0]).toEqual({ p_invite_no: 'I-004', p_phone: '+966512345679' });
    await page.fill('#fd-no', 'i-004');
    await page.fill('#fd-phone', '٠٥١٢٣٤٥٦٧٨'); // Arabic digits are digits
    await page.click('#fd-go');
    await expect(d).toBeHidden();
    expect(asks[1]).toEqual({ p_invite_no: 'I-004', p_phone: '+966512345678' });
    await expect(page.locator('#chip-booking-value')).toHaveText('I-004');
    await expect(page.locator('#tk-name')).toHaveText('Amal Booked');
    await expect(page.locator('#qr canvas')).toHaveAttribute('data-code', 'MMC-08-a1b2c3');
    await expect(page.locator('#tk-price-value')).toContainText('57.50');
    // and the phone keeps it from now on
    await page.reload();
    await expect(page.locator('#chip-booking-value')).toHaveText('I-004');
  });

  test("find my booking takes a guest's I- number only: another form's number is refused before the server is asked", async ({ page }) => {
    const asks: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => { asks.push(r.request().postDataJSON()); return r.fulfill(json(LOOKED)); });
    await page.route('**/rest/v1/rpc/rider_lookup', (r) => { asks.push(r.request().postDataJSON()); return r.fulfill(json(LOOKED)); });
    await page.goto('/petromin-invite?lang=en');
    await page.click('#find');
    await page.fill('#fd-phone', '0512345678');
    for (const no of ['D-001', 'P-4', 'p004', 'MMC-08-a1b2c3', 'MMP-I-001', 'I-1234567', 'X']) {
      await page.fill('#fd-no', no);
      await page.click('#fd-go');
      await expect(page.locator('#fd-f-no'), no).toHaveClass(/invalid/);
      await expect(page.locator('#fd-f-no .err'), no).toHaveText('Enter your booking number');
    }
    expect(asks).toHaveLength(0);
    await expect(page.locator('#success')).toBeHidden();
  });

  test('a number found on several nights: each night is asked for by its id and kept on the phone', async ({ page }) => {
    const asks: Record<string, unknown>[] = [];
    const S9 = { ...S1, id: '2099-02-22-pw', start: '2099-02-22T19:00:00+03:00', end: '2099-02-22T21:00:00+03:00' };
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S9])));
    await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => {
      const b = r.request().postDataJSON() as Record<string, unknown>; asks.push(b);
      return r.fulfill(json(b.p_session_id === S9.id ? { ...LOOKED, ref: 'MMC-22-zzz', session: S9, more: [] } : { ...LOOKED, more: [S9.id] }));
    });
    await page.goto('/petromin-invite?lang=en');
    await page.click('#find');
    await page.fill('#fd-no', 'I-004'); await page.fill('#fd-phone', '0512345678');
    await page.click('#fd-go');
    await expect(page.locator('#chip-booking-value')).toHaveText('I-004');
    expect(asks[1]).toEqual({ p_invite_no: 'I-004', p_phone: '+966512345678', p_session_id: S9.id });
    await expect(page.locator('#others-list .other')).toHaveText(['I-004 · Amal Booked']);
    await page.click('#others-list .other');
    await expect(page.locator('#qr canvas')).toHaveAttribute('data-code', 'MMC-22-zzz');
  });

  test('cancel my booking asks first, then the booking goes and the phone shows a fresh form', async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    let answer: Record<string, unknown> = { ok: false, error: 'checked_in' };
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/petromin_invite_cancel', (r) => { sent.push(r.request().postDataJSON()); return r.fulfill(json(answer)); });
    await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)); } }, SAVED);
    await page.goto('/petromin-invite?lang=en');
    await page.click('#cancel-booking');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#ask-text')).toHaveText('Cancel booking I-004? You will lose your place.');
    await page.click('#ask-no');
    expect(sent).toHaveLength(0);
    await page.click('#cancel-booking'); await page.click('#ask-yes');
    await expect(page.locator('.done-note')).toHaveText('You have already checked in. Ask the desk to change your booking.');
    await expect(page.locator('#success')).toBeVisible();
    answer = { ok: false, error: 'session' };
    await page.click('#cancel-booking'); await page.click('#ask-yes');
    await expect(page.locator('.done-note')).toHaveText('This session is no longer open');
    answer = { ok: true, booking_no: 'I-004', session_id: S1.id };
    await page.click('#cancel-booking'); await page.click('#ask-yes');
    await expect(page.locator('#notice')).toHaveText('Your booking was cancelled.');
    await expect(page.locator('.step[data-step="1"]')).toBeVisible();
    expect(sent[2]).toEqual({ p_invite_no: 'I-004', p_phone: '+966512345678', p_session_id: S1.id });
    expect(await page.evaluate(() => localStorage.getItem('mm-pminvite-booking'))).toBeNull();
  });

  test('the ticket saves to a calendar with a reminder before bikes are handed out, and says where and the helmet', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), SAVED);
    await page.goto('/petromin-invite?lang=en');
    await expect(page.locator('#tk-place-value')).toHaveText('Jeddah Corniche Circuit');
    await expect(page.locator('#tk-pickup-value')).toHaveText(/06:45/);
    await expect(page.locator('#directions')).toBeVisible();
    await expect(page.locator('.ticket-helmet')).toHaveText('Helmets are required. One comes with every bike.');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#calendar')]);
    expect(dl.suggestedFilename()).toBe('petromin-invite-I-004.ics');
    const ics = readFileSync(await dl.path(), 'utf8');
    expect(ics).toContain('DTSTART:20990208T154500Z'); // 18:45 in Jeddah
    expect(ics).toContain('DTEND:20990208T180000Z');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics).toContain('LOCATION:Jeddah Corniche Circuit');
    expect(ics).toContain('URL:https://micromobility.sa/petromin-invite');
    expect(ics).toMatch(/SUMMARY:Petromin Ride Night: Invited Guests · I-004/);
    expect(ics).not.toMatch(/dukan|petrolube|Circuit Night/i);
  });

  test('Add to Apple Wallet asks the website for the pass of this booking (an iPhone only)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'the button shows on an iPhone or iPad');
    const asked: Record<string, unknown>[] = [];
    await page.route('**/api/petromin-pass', (r) => { asked.push(r.request().postDataJSON()); return r.fulfill({ status: 200, headers: { 'content-type': 'application/vnd.apple.pkpass' }, body: 'PK' }); });
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), SAVED);
    await page.goto('/petromin-invite?lang=ar');
    await expect(page.locator('#wallet')).toBeVisible();
    await page.click('#wallet');
    await expect.poll(() => asked.length).toBe(1);
    expect(asked[0]).toEqual({ bookingNo: 'I-004', phone: '+966512345678', sessionId: S1.id, lang: 'ar' });
  });

  test('the night card says when bikes are handed out and where; grey cards while the calendar answers', async ({ page }) => {
    let release: () => void = () => {};
    const held = new Promise<void>((res) => { release = res; });
    await page.route('**/rest/v1/rpc/rider_sessions', async (r) => { await held; return r.fulfill(json([S1])); });
    await page.goto('/petromin-invite?lang=en');
    await expect(page.locator('#sessions .session.skeleton')).toHaveCount(3);
    await expect(page.locator('#sessions')).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(page.locator('#sessions .session-facts')).toHaveText('Bikes from 06:45 PM · Jeddah Corniche Circuit');
    await expect(page.locator('#sessions .session-date')).toHaveText('Sun, Feb 8');
  });

  test('no night to offer, or no answer: the WhatsApp line is beside the message', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.abort());
    await page.goto('/petromin-invite?lang=en');
    await expect(page.locator('#banner .banner-text')).toHaveText('Could not reach the server');
    await expect(page.locator('#sessions .sessions-empty')).toHaveText('No upcoming sessions');
    await expect(page.locator('#sessions .sessions-help')).toHaveAttribute('href', /wa\.me\/966566668818/);
  });

  test('a refusal the form does not know is not called a lost connection, and the second offers WhatsApp', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/petromin_invite_book', (r) => r.fulfill(json({ ok: false, error: 'riders' })));
    await page.goto('/petromin-invite?lang=en');
    await register(page);
    await expect(page.locator('#banner .banner-text')).toHaveText('We could not save this. Please try again.');
    await expect(page.locator('#banner')).toBeInViewport();
    await expect(page.locator('#banner-help')).toBeHidden();
    await page.click('#submit');
    await expect(page.locator('#banner-help')).toBeVisible();
  });

  test('throttled: the network is told to wait, and nothing is booked', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/petromin_invite_book', (r) => r.fulfill(json({ ok: false, error: 'throttled' })));
    await page.goto('/petromin-invite?lang=en');
    await register(page);
    await expect(page.locator('#banner .banner-text')).toHaveText('Too many submissions from this network');
    await expect(page.locator('#success')).toBeHidden();
  });

  test('every step and the ticket pass an accessibility check, in English and Arabic', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/petromin_invite_book', booking([]));
    for (const lang of ['en', 'ar']) {
      await page.goto(`/petromin-invite?lang=${lang}`);
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
      await page.click('#next'); // no bike: its message
      expect(await axe(page), `${lang} step 3 with its message`).toEqual([]);
      await bike(page);
      await page.click('#submit'); // the two boxes' messages
      expect(await axe(page), `${lang} step 4 with its messages`).toEqual([]);
      await agree(page);
      await page.click('#submit');
      await expect(page.locator('#success')).toBeVisible();
      expect(await axe(page), `${lang} ticket`).toEqual([]);
      await page.evaluate(() => localStorage.clear());
    }
  });

  test('a ticket on the waitlist and an edit with its locked number pass the accessibility check too', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => r.fulfill(json({ ...LOOKED, status: 'waitlist' })));
    await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), { ...SAVED, status: 'waitlist' });
    await page.goto('/petromin-invite?lang=en');
    await expect(page.locator('#tk-status')).toBeVisible();
    expect(await axe(page), 'waitlist ticket').toEqual([]);
    await page.click('#edit');
    await page.click('#review .rv-change[data-go="2"]');
    await expect(page.locator('#phone')).toHaveJSProperty('readOnly', true);
    expect(await axe(page), 'edit, the details').toEqual([]);
  });
});

test.describe('a phone set to another time zone, and a narrow phone', () => {
  test.use({ timezoneId: 'America/New_York', viewport: { width: 320, height: 640 } });
  test('the night reads in Jeddah time, and nothing is wider than a 320 px screen', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/petromin_invite_book', booking([]));
    await page.goto('/petromin-invite?lang=en');
    await expect(page.locator('#sessions .session-time')).toHaveText('07:00 PM – 09:00 PM');
    const wide = async () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(await wide(), 'step 1').toBe(false);
    await pickNight(page);
    expect(await wide(), 'step 2').toBe(false);
    await details(page);
    expect(await wide(), 'step 3').toBe(false);
    await bike(page);
    expect(await wide(), 'step 4').toBe(false);
    await agree(page);
    await page.click('#submit');
    await expect(page.locator('#success')).toBeVisible();
    await expect(page.locator('#chip-session-value')).toContainText('07:00 PM – 09:00 PM');
    expect(await wide(), 'the ticket').toBe(false);
  });
  test('Arabic at 320 px too', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/petromin_invite_book', booking([], 'I-001', { status: 'waitlist' }));
    await page.goto('/petromin-invite?lang=ar');
    await toCheck(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    await agree(page);
    await page.click('#submit');
    await expect(page.locator('#tk-status')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  });
});
