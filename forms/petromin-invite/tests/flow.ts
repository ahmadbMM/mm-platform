import { test as base, expect, type Page, type Route } from '@playwright/test';

// The form's four steps: the night, the guest (name and mobile number), the bike, then everything on one page with the
// Privacy Notice and waiver boxes above "Agree and register". The specs walk them through these, so a change of flow is
// changed here once.

export const json = (body: unknown, status = 200) => ({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** Every database call is stubbed: one a spec does not answer itself gets a "no such call" here, so nothing ever reaches
 *  the real database. A spec's own page.route, added after this one, answers first. */
export const test = base.extend<{ stubDb: void }>({
  stubDb: [async ({ page }, use) => {
    await page.route('**/rest/v1/rpc/**', (r) => r.fulfill(json({ code: 'PGRST202', message: 'not stubbed in this spec', details: null, hint: null }, 404)));
    await use();
  }, { auto: true }],
});
export { expect };

/** A partner night as rider_sessions gives it. Its title is the calendar's name for the night: the page never shows it. */
export const S1 = { id: '2099-02-08-pw', title: "Petromin's Circuit Night", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00', collect: '18:45', place: null };
export const S2 = { id: '2099-02-15-pw', title: "Petromin's Wednesdays", start: '2099-02-15T19:00:00+03:00', end: '2099-02-15T21:00:00+03:00', collect: '18:45', place: null };
/** A booking as this phone saves it. */
export const SAVED = { name: 'Amal Booked', phone: '+966512345678', type: 'Hybrid', status: 'waiting', price: 57.5, ref: 'MMC-08-a1b2c3', session: { id: S1.id, start: S1.start, end: S1.end, collect: '18:45', place: null }, bookingNo: 'I-004', submittedAt: '2099-02-01T10:00:00Z' };
/** petromin_invite_book's answer to the arguments `a` it was sent. */
export const BOOKED = (a: Record<string, unknown>, no = 'I-001', session: object = S1, extra: Record<string, unknown> = {}) => ({
  ok: true, resubmitted: false, booking_no: no, invite_no: no, ref: `MMC-08-${no.slice(2)}abc`, status: 'waiting',
  name: a.p_name, phone: a.p_phone, type: a.p_type, price: 57.5, session, ...extra,
});
/** A stub for petromin_invite_book that keeps what was sent and answers BOOKED. */
export function booking(sent: Record<string, unknown>[], no: string | ((n: number) => string) = 'I-001', extra: Record<string, unknown> = {}, session: object = S1) {
  return (r: Route) => {
    const a = r.request().postDataJSON() as Record<string, unknown>; sent.push(a);
    return r.fulfill(json(BOOKED(a, typeof no === 'function' ? no(sent.length) : no, session, extra)));
  };
}
/** petromin_invite_lookup's answer for SAVED. */
export const LOOKED = { ok: true, booking_no: 'I-004', invite_no: 'I-004', ref: 'MMC-08-a1b2c3', company: null, name: 'Amal Booked', phone: '+966512345678', type: 'Hybrid', status: 'waiting', checked_in: false, price: 57.5, paid: false, session: S1, more: [], riders: [] };

/** Step 1: the night at `index`, then Continue. */
export async function pickNight(page: Page, index = 0) {
  await page.locator('#sessions .session').nth(index).click();
  await page.click('#next');
}

/** Step 2: name and phone, then Continue (to the bike). */
export async function details(page: Page, d: { name?: string; phone?: string } = {}) {
  await page.fill('#name', d.name ?? 'Amal Booked');
  await page.fill('#phone', d.phone ?? '512345678');
  await page.click('#next');
}

/** Step 3: the bike, then Continue (to Check and agree). */
export async function bike(page: Page, type = 'Hybrid') {
  await page.click(`#types .tile[data-v="${type}"]`);
  await page.click('#next');
}

/** Step 4: the boxes (the Privacy Notice only on a new booking). */
export async function agree(page: Page, privacy = true) {
  if (privacy) await page.check('#privacy');
  await page.check('#waiver');
}

/** To Check and agree with everything filled in. */
export async function toCheck(page: Page, d: Parameters<typeof details>[1] & { type?: string } = {}) {
  await pickNight(page);
  await details(page, d);
  await bike(page, d.type);
  await expect(page.locator('.step[data-step="4"]')).toBeVisible();
}

/** The whole way to a booking sent: night, guest, bike, boxes, Agree and register. */
export async function register(page: Page, d: Parameters<typeof toCheck>[1] = {}) {
  await toCheck(page, d);
  await agree(page);
  await page.click('#submit');
}

/** Every word the form puts on the screen or names for a screen reader (its scripts and styles left out): on the
 *  website's page the form's own box, dialogs included. */
export async function wordsOnPage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = document.querySelector('.mmf-petromin-invite') || document.body;
    const out: string[] = [document.title];
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const p = n.parentElement;
      if (p && !p.closest('script, style')) out.push(n.nodeValue || '');
    }
    root.querySelectorAll('*').forEach((el) => {
      for (const a of ['alt', 'aria-label', 'title', 'placeholder', 'value', 'href']) { const v = el.getAttribute(a); if (v && !(a === 'value' && el.tagName === 'OPTION')) out.push(v); }
      if (el instanceof HTMLInputElement) out.push(el.placeholder);
    });
    return out.join(' \n');
  });
}

/** No company but MicroMobility and Petromin: the other partners' names in the scripts the form is shown in. */
export const OTHER_COMPANY = /dukan|petrolube|دكان|بترولوب|पेट्रोल्यूब|পেট্রোলুব|پیٹرولیوب/i;
