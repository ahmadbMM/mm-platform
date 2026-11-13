import { expect, type Page } from '@playwright/test';

// The form's five steps (2026-11-13): the company first, then the picked company's own. For Petromin and Petrolube:
// the night, the rider, the bikes (companions as cards, each written in a centred dialog), then everything on one page
// with the Privacy Notice and waiver boxes above "Agree and register". Dukan's employees walk the same steps without a
// badge or companions; an invited guest's are the account, the night, the bike, then Check and agree. The specs walk
// them through these, so a change of flow is changed here once.

export const json = (body: unknown, status = 200) => ({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });

export type Company = 'Petromin' | 'Petrolube' | 'Dukan' | 'Guest';

/** Step 1: the company, then Continue. */
export async function pickCompany(page: Page, company: Company | string = 'Petromin') {
  await page.click(`#companies .company[data-v="${company}"]`);
  await page.click('#next');
}

/** The night at `index`, then Continue. From the first step it picks the company on the way (Petromin unless told). */
export async function pickNight(page: Page, index = 0, company: Company | string = 'Petromin') {
  if (await page.locator('.step[data-pane="company"]').isVisible()) await pickCompany(page, company);
  await page.locator('#sessions .session').nth(index).click();
  await page.click('#next');
}

/** The rider's details: badge (Petromin and Petrolube only), name and phone, then Continue. */
export async function details(page: Page, d: { badge?: string; name?: string; phone?: string } = {}) {
  if (await page.locator('#f-badge').isVisible()) await page.fill('#badge', d.badge ?? 'A-12');
  await page.fill('#name', d.name ?? 'Amal Booked');
  await page.fill('#phone', d.phone ?? '512345678');
  await page.click('#next');
}

/** The rider's own height and bike (Continue is the caller's). */
export async function bike(page: Page, height = '175', type = 'Hybrid') {
  await page.fill('#height', height);
  await page.click(`#types .tile[data-v="${type}"]`);
}

/** A companion through the dialog: Save closes it when every box is right. */
export async function addRider(page: Page, r: { name: string; height: string | number; type?: string }) {
  await page.click('#add-rider');
  await expect(page.locator('#rider-dialog')).toBeVisible();
  await page.fill('#rd-name', r.name);
  await page.fill('#rd-height', String(r.height));
  if (r.type) await page.click(`#rd-types .tile[data-v="${r.type}"]`);
  await page.click('#rd-save');
}

/** The bike step to the last one (Check and agree). */
export async function toCheck(page: Page) {
  await page.click('#next');
  await expect(page.locator('.step[data-pane="check"]')).toBeVisible();
}

/** The last step: the boxes (the Privacy Notice only on a new registration, never for an invited guest). */
export async function agree(page: Page, privacy = true) {
  if (privacy) await page.check('#privacy');
  await page.check('#waiver');
}

/** The whole way to a registration sent: company, night, rider, bike, boxes, Agree and register. */
export async function register(page: Page, d: Parameters<typeof details>[1] & { company?: Company | string; height?: string; type?: string } = {}) {
  await pickNight(page, 0, d.company ?? 'Petromin');
  await details(page, d);
  await bike(page, d.height, d.type);
  await toCheck(page);
  await agree(page);
  await page.click('#submit');
}

/* ── An invited guest: the calls their account makes, answered here ── */

export const GUEST = { id: 'guest0001', token: 'tok-guest', name: 'Sara Alharbi', email: 'sara.alharbi@gmail.com', phone: '+966512345678' };

/** Answers the account's calls (sign in, sign up, what the account holds and owes) and records every call made.
 *  `owes` is what customer_fix_fields answers until the page saves the answer (owe() sets it again); `profile` lays over
 *  the account's own row. */
export async function stubAccount(page: Page, o: { owes?: string[]; profile?: Record<string, unknown>; emergency?: boolean; workplace?: string; exists?: 'email' | 'phone'; login?: unknown } = {}) {
  const calls: Array<[string, Record<string, unknown>]> = [];
  let made: string | null = null;
  let owes = o.owes ?? [];
  const on = (fn: string, answer: (body: Record<string, unknown>) => unknown) => page.route(`**/rest/v1/rpc/${fn}`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill(json({}));
    const body = JSON.parse(route.request().postData() || '{}');
    calls.push([fn, body]);
    await route.fulfill(json(answer(body)));
  });
  await on('customer_login', () => o.login !== undefined ? o.login : [{ id: GUEST.id, name: GUEST.name, email: GUEST.email, phone: GUEST.phone, session_token: GUEST.token }]);
  await on('customer_pwd_state', () => false);
  await on('customer_exists', (b) => (o.exists === 'email' && !!b.p_email) || (o.exists === 'phone' && !!b.p_phone));
  await on('customer_signup', (b) => { made = String(b.p_id); return [{ id: b.p_id, session_token: GUEST.token }]; });
  await on('customer_consents', () => ({ ok: true }));
  await on('customer_set_emergency', () => { owes = owes.filter((k) => k !== 'emergency'); return true; });
  await on('customer_set_height', () => true);
  await on('customer_set_birth_nat', () => { owes = owes.filter((k) => k !== 'nationality' && k !== 'birth_date'); return true; });
  await on('customer_fix_save', () => []);
  await on('customer_profile', () => [{ id: made ?? GUEST.id, name: GUEST.name, email: GUEST.email, phone: GUEST.phone, height: 170, birth_date: '', nationality: '', ...(o.profile ?? {}) }]);
  await on('customer_emergency', () => (o.emergency === false ? [{ emergency_name: '', emergency_phone: '', emergency_relation: '' }] : [{ emergency_name: 'Omar Alharbi', emergency_phone: '+966598765432', emergency_relation: 'sibling' }]));
  await on('customer_fix_fields', () => owes);
  await on('customer_about', () => [{ profession: '', workplace: o.workplace ?? '', heard_from: '' }]);
  return { calls, of: (fn: string) => calls.filter((c) => c[0] === fn).map((c) => c[1]), owe: (list: string[]) => { owes = list; } };
}

/** The account step, signing in: the question, the sign-in panel, then the signed-in panel showing. */
export async function guestSignIn(page: Page) {
  await page.click('#ac-yes');
  await page.fill('#ac-ident', GUEST.email);
  await page.fill('#ac-spwd', 'ridewithme9');
  await page.click('#ac-signin-btn');
  await expect(page.locator('#ac-details')).toBeVisible();
}

/** The account step, creating an account: every box of the sign-up, then the signed-in panel showing. */
export async function guestCreate(page: Page) {
  await page.click('#ac-no');
  await page.fill('#ac-first', 'Sara');
  await page.fill('#ac-last', 'Alharbi');
  await page.click('#ac-genders .tile[data-v="female"]');
  await page.fill('#ac-email', GUEST.email);
  await page.fill('#ac-phone', '512345678');
  await page.fill('#ac-pwd', 'ridewithme9');
  await page.fill('#ac-pwd2', 'ridewithme9');
  await page.fill('#ac-height', '170');
  await page.fill('#em-name', 'Omar Alharbi');
  await page.fill('#em-phone', '598765432');
  await page.selectOption('#em-rel', 'sibling');
  await page.check('#ac-ack');
  await page.click('#ac-create-btn');
  await expect(page.locator('#ac-details')).toBeVisible();
}

/** A guest's whole way to a booking sent: Guest, sign in, the company typed, the night, the bike, the waiver. */
export async function guestBook(page: Page, d: { company?: string; type?: string; night?: number } = {}) {
  await pickCompany(page, 'Guest');
  await guestSignIn(page);
  await page.fill('#ac-company', d.company ?? 'Aramco Trading');
  await page.click('#next');
  await page.locator('#sessions .session').nth(d.night ?? 0).click();
  await page.click('#next');
  await page.click(`#types .tile[data-v="${d.type ?? 'Hybrid'}"]`);
  await toCheck(page);
  await page.check('#waiver');
  await page.click('#submit');
}

/* ── What a rider can see or hear on the page right now ── */

/** Every word showing (the form's box, or the page), the open dialogs' among them, with the names a screen reader says
 *  for what shows (alt, aria-label, title, placeholder) and the tab's title on the form's own page. Hidden steps, tiles
 *  and marks are left out: after Dukan is picked the others' are still in the page, out of sight and hearing. */
export async function shownWords(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = (document.querySelector('.mmf-petromin') || document.body) as HTMLElement;
    const out: string[] = [document.querySelector('.mmf-petromin') ? '' : document.title, root.innerText];
    const seen = (el: Element) => { const r = (el as HTMLElement).getClientRects(); return r.length > 0 && getComputedStyle(el as HTMLElement).visibility !== 'hidden'; };
    root.querySelectorAll('[alt], [aria-label], [title], [placeholder]').forEach((el) => {
      if (!seen(el)) return;
      for (const a of ['alt', 'aria-label', 'title', 'placeholder']) { const v = el.getAttribute(a); if (v) out.push(v); }
    });
    return out.join('\n');
  });
}
export const OTHER_COMPANY = /petromin|petrolube|بترومين|بترولوب|پیٹرومن|पेट्रोमिन|পেট্রোমিন/i;
