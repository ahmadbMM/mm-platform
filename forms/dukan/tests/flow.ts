import { expect, type Page } from '@playwright/test';

// The form's three steps: the night, the rider (name and mobile number only), then everything on one page with the
// Privacy Notice and waiver boxes above "Agree and register". The specs walk them through these, so a change of flow is
// changed here once.

export const json = (body: unknown, status = 200) => ({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** A partner night as rider_sessions gives it. Its title is another company's name for the night: the page never shows it. */
export const S1 = { id: '2099-02-08-pw', title: "Petromin's Circuit Night", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00', collect: '18:45', place: null };
export const S2 = { id: '2099-02-15-pw', title: "Petromin's Wednesdays", start: '2099-02-15T19:00:00+03:00', end: '2099-02-15T21:00:00+03:00', collect: '18:45', place: null };
/** A registration as this phone saves it. */
export const SAVED = { name: 'Amal Booked', company: 'Dukan', phone: '+966512345678', session: { id: S1.id, start: S1.start, end: S1.end, collect: '18:45', place: null }, bookingNo: 'D-004', submittedAt: '2099-02-01T10:00:00Z' };
/** rider_register's answer for a Dukan registration. */
export const BOOKED = (no = 'D-001', session: object = S1) => ({ ok: true, booking_no: no, riders: 1, resubmitted: false, session });

/** Step 1: the night at `index`, then Continue. */
export async function pickNight(page: Page, index = 0) {
  await page.locator('#sessions .session').nth(index).click();
  await page.click('#next');
}

/** Step 2: name and phone, then Continue (to Check and agree). */
export async function details(page: Page, d: { name?: string; phone?: string } = {}) {
  await page.fill('#name', d.name ?? 'Amal Booked');
  await page.fill('#phone', d.phone ?? '512345678');
  await page.click('#next');
}

/** Step 3: the boxes (the Privacy Notice only on a new registration). */
export async function agree(page: Page, privacy = true) {
  if (privacy) await page.check('#privacy');
  await page.check('#waiver');
}

/** To Check and agree with everything filled in. */
export async function toCheck(page: Page, d: Parameters<typeof details>[1] = {}) {
  await pickNight(page);
  await details(page, d);
  await expect(page.locator('.step[data-step="3"]')).toBeVisible();
}

/** The whole way to a registration sent: night, rider, boxes, Agree and register. */
export async function register(page: Page, d: Parameters<typeof details>[1] = {}) {
  await toCheck(page, d);
  await agree(page);
  await page.click('#submit');
}

/** Every word the form puts on the screen or names for a screen reader (its scripts and styles left out): on the
 *  website's page the form's own box, dialogs included. */
export async function wordsOnPage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = document.querySelector('.mmf-dukan') || document.body;
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

/** No other company's name: Petromin and Petrolube in the scripts the form is shown in. */
export const OTHER_COMPANY = /petromin|petrolube|بترومين|بترولوب|پیٹرومن|पेट्रोमिन|পেট্রোমিন/i;
