import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { json, pickNight, details, bike, addRider, toCheck, agree, register } from './flow';

// The round of 2026-11-11 (research report "Petromin form design and function"): Find my booking on any phone, Cancel
// my booking, a calendar file, the night's facts, the grey cards while the calendar answers, Arabic digits in the height,
// Jeddah's time on a phone set elsewhere, a 320 px phone, and an accessibility check of every step. Tagged @webkit run
// on an iPhone (WebKit) as well (playwright.config.ts).
const S1 = { id: '2099-02-08-pw', title: "Petromin's Circuit Night", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00', collect: '18:45', place: null };
const SAVED = { badge: 'A-12', name: 'Amal Booked', company: 'Petromin', phone: '+966512345678', height: 175, type: 'Hybrid', session: S1, bookingNo: 'P-004', riders: [{ name: 'Sara Ali', height: 160, type: 'Mountain' }], submittedAt: '2099-02-01T10:00:00Z' };
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

async function axe(page: Page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const w = window as unknown as { axe: { run(d: Element, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
    const root = document.querySelector('.mmf-petromin') || document.body; // the form, not the website around it
    const r = await w.axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} x${v.nodes.length}`);
  });
}

test.describe('@webkit Petromin form, 2026-11-11', () => {
  test.use({ bypassCSP: true });

  test('find my booking: the number and the mobile bring it back on a phone that never had it', async ({ page }) => {
    const asks: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/rider_lookup', (r) => {
      const b = r.request().postDataJSON() as Record<string, unknown>; asks.push(b);
      if (b.p_phone !== '+966512345678') return r.fulfill(json({ ok: false, error: 'notfound' }));
      return r.fulfill(json({ ok: true, booking_no: 'P-004', company: 'Petromin', badge: 'A-12', name: 'Amal Booked', phone: '+966512345678', height: 175, type: 'Hybrid', checked_in: false, session: S1, riders: [{ name: 'Sara Ali', height: 160, type: 'Mountain' }] }));
    });
    await page.goto('/petromin?lang=en');
    await page.click('#find');
    const d = page.getByRole('dialog', { name: 'Find my booking' });
    await expect(d).toBeVisible();
    await page.click('#fd-go');
    await expect(page.locator('#fd-f-no')).toHaveClass(/invalid/);
    expect(asks).toHaveLength(0);
    // "4" is P-004; a wrong number is a plain miss, never a hint at which part was wrong.
    await page.fill('#fd-no', '4'); await page.fill('#fd-phone', '0512345679');
    await page.click('#fd-go');
    await expect(page.locator('#fd-miss')).toHaveText('We could not find a booking with this number and mobile number.');
    expect(asks[0]).toEqual({ p_booking_no: 'P-004', p_phone: '+966512345679' });
    await page.fill('#fd-phone', '٠٥١٢٣٤٥٦٧٨'); // Arabic digits are digits
    await page.click('#fd-go');
    await expect(d).toBeHidden();
    await expect(page.locator('#chip-booking-value')).toHaveText('P-004');
    await expect(page.locator('#chip-riders-value')).toHaveText('2');
    await expect(page.locator('#tk-name')).toHaveText('Amal Booked');
    // and the phone keeps it from now on
    await page.reload();
    await expect(page.locator('#chip-booking-value')).toHaveText('P-004');
  });

  test('cancel my booking asks first, then the whole party goes and the phone shows a fresh form', async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    let answer: Record<string, unknown> = { ok: false, error: 'desk' };
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/rider_cancel', (r) => { sent.push(r.request().postDataJSON()); return r.fulfill(json(answer)); });
    await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('mm-petromin-registration', JSON.stringify(s)); } }, SAVED);
    await page.goto('/petromin?lang=en');
    await page.click('#cancel-booking');
    await expect(page.locator('#ask-text')).toHaveText('Cancel booking P-004? Every rider on it loses their place.');
    await page.click('#ask-no');
    expect(sent).toHaveLength(0);
    await page.click('#cancel-booking'); await page.click('#ask-yes');
    await expect(page.locator('.done-note')).toHaveText('The desk has this booking. Ask the desk to cancel it.');
    await expect(page.locator('#success')).toBeVisible();
    answer = { ok: true, booking_no: 'P-004', session_id: S1.id };
    await page.click('#cancel-booking'); await page.click('#ask-yes');
    await expect(page.locator('#notice')).toHaveText('Your booking was cancelled.');
    await expect(page.locator('.step[data-step="1"]')).toBeVisible();
    expect(sent[1]).toEqual({ p_booking_no: 'P-004', p_proof_phone: '+966512345678', p_session_id: S1.id });
    expect(await page.evaluate(() => localStorage.getItem('mm-petromin-registration'))).toBeNull();
  });

  test('the ticket saves to a calendar with a reminder before bikes are handed out, and says where and the helmet', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.addInitScript((s) => localStorage.setItem('mm-petromin-registration', JSON.stringify(s)), SAVED);
    await page.goto('/petromin?lang=en');
    await expect(page.locator('#tk-place-value')).toHaveText('Jeddah Corniche Circuit');
    await expect(page.locator('#directions')).toBeVisible();
    await expect(page.locator('.ticket-helmet')).toHaveText('Helmets are required. One comes with every bike.');
    // Petromin pays: no amount on the ticket (the fare is a guest's column, hidden and empty here)
    expect(await page.locator('#ticket').innerText()).not.toMatch(/\bSAR\b|﷼|[Pp]rice/);
    await expect(page.locator('#tk-price')).toBeHidden();
    await expect(page.locator('#tk-price-value')).toBeEmpty();
    await expect(page.locator('#tk-status')).toBeHidden();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#calendar')]);
    expect(dl.suggestedFilename()).toBe('petromin-P-004.ics');
    const ics = readFileSync(await dl.path(), 'utf8');
    expect(ics).toContain('DTSTART:20990208T154500Z'); // 18:45 in Jeddah
    expect(ics).toContain('DTEND:20990208T180000Z');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics).toContain('LOCATION:Jeddah Corniche Circuit');
    expect(ics).toMatch(/SUMMARY:Petromin bike night · P-004/);
  });

  test('the night card says when bikes are handed out and where; grey cards while the calendar answers', async ({ page }) => {
    let release: () => void = () => {};
    const held = new Promise<void>((res) => { release = res; });
    await page.route('**/rest/v1/rpc/rider_sessions', async (r) => { await held; return r.fulfill(json([S1])); });
    await page.goto('/petromin?lang=en');
    await expect(page.locator('#sessions .session.skeleton')).toHaveCount(3);
    await expect(page.locator('#sessions')).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(page.locator('#sessions .session-facts')).toHaveText('Bikes from 06:45 PM · Jeddah Corniche Circuit');
  });

  test('no night to offer, or no answer: the WhatsApp line is beside the message', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.abort());
    await page.goto('/petromin?lang=en');
    await expect(page.locator('#banner .banner-text')).toHaveText('Could not reach the server');
    await expect(page.locator('#sessions .sessions-empty')).toHaveText('No upcoming sessions');
    await expect(page.locator('#sessions .sessions-help')).toHaveAttribute('href', /wa\.me\/966566668818/);
  });

  test('a refusal the form does not know is not called a lost connection, and the second offers WhatsApp', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json({ ok: false, error: 'something_new' })));
    await page.goto('/petromin?lang=en');
    await register(page);
    await expect(page.locator('#banner .banner-text')).toHaveText('We could not save this. Please try again.');
    await expect(page.locator('#banner')).toBeInViewport();
    await expect(page.locator('#banner-help')).toBeHidden();
    await page.click('#submit');
    await expect(page.locator('#banner-help')).toBeVisible();
  });

  test('a height typed in Arabic digits is a height', async ({ page }) => {
    const regs: Record<string, unknown>[] = [];
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, id: 1, booking_no: 'P-001', session: S1 })); });
    await page.goto('/petromin?lang=ar');
    await pickNight(page);
    await details(page);
    await bike(page, '١٧٨');
    await addRider(page, { name: 'Sara Ali', height: '١٦٠', type: 'Mountain' });
    await toCheck(page);
    await agree(page);
    await page.click('#submit');
    await expect(page.locator('#success')).toBeVisible();
    expect(regs[0]).toMatchObject({ p_height: 178, p_lang: 'ar', p_riders: [{ name: 'Sara Ali', height: 160, type: 'Mountain' }] });
  });

  test('every step and the ticket pass an accessibility check, in English and Arabic', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json({ ok: true, id: 1, booking_no: 'P-001', session: S1 })));
    for (const lang of ['en', 'ar']) {
      await page.goto(`/petromin?lang=${lang}`);
      await expect(page.locator('#sessions .session')).toHaveCount(1);
      expect(await axe(page), `${lang} step 1`).toEqual([]);
      await pickNight(page);
      await page.click('#next'); // nothing filled in: every message showing
      expect(await axe(page), `${lang} step 2 with its messages`).toEqual([]);
      await details(page);
      await bike(page);
      await addRider(page, { name: 'Sara Ali', height: 160, type: 'Mountain' });
      expect(await axe(page), `${lang} step 3`).toEqual([]);
      await toCheck(page);
      expect(await axe(page), `${lang} step 4`).toEqual([]);
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
    await page.goto('/petromin?lang=en');
    await expect(page.locator('#sessions .session-time')).toHaveText('07:00 PM – 09:00 PM');
    const wide = async () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(await wide(), 'step 1').toBe(false);
    await pickNight(page);
    await details(page);
    expect(await wide(), 'step 3').toBe(false);
    await bike(page);
    await addRider(page, { name: 'Sara Ali', height: 160, type: 'Mountain' });
    expect(await wide(), 'a companion card').toBe(false);
    await toCheck(page);
    expect(await wide(), 'step 4').toBe(false);
  });
});
