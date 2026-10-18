import { test, expect, type Page } from '@playwright/test';

// micromobility.sa/defe end to end in a browser, every database call stubbed (and the booking app it
// hands the rider on to): the landing (partner_status), the account (sign-up, sign-in, or handed back
// signed in with ?code=), the details a Saturday ride asks for, the booking (partner_book) and the
// hand-on to the booking app (customer_handoff_create -> ?signin=).
const json = (b: unknown, status = 200) => ({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(b) });
const refuse = (message: string, details: string | null = null) => json({ code: 'P0001', message, details, hint: null }, 400);
type Body = Record<string, unknown>;
type Answers = Partial<Record<string, (body: Body) => ReturnType<typeof json>>>;
const BOOKING = 'https://micromobilityrentals.pages.dev/';
const RIDE = { session_id: '2026-10-24', session_date: '2026-10-24', bike_slots: '{"_time":"05:45 - 06:15","Road":10}', meet_url: 'https://maps.app.goo.gl/pdcMn1mGcCdabia7A', open: true, code_needed: true, code_open: true };
const SARA = { id: 'c-sara', name: 'Sara Alharbi', email: 'sara.alharbi@gmail.com', phone: '+966552468013', height: 165, type_preference: 'Hybrid', birth_date: '1994-03-12', nationality: 'Saudi Arabia', gender: 'female', socials: { instagram: 'sara.rides', x: 'sararides' } };
const EM_ROW = { emergency_name: 'Layla Alharbi', emergency_phone: '+966551234567', emergency_relation: 'sibling', emergency2_name: null, emergency2_phone: null, emergency2_relation: null };
const HANDOFF = 'cd'.repeat(24);

async function open(page: Page, qs = '', answers: Answers = {}) {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const calls: { fn: string; body: Body }[] = [];
  let made: Body | null = null; // the account customer_signup made, which customer_profile then reads
  const base: Answers = {
    partner_status: () => json([RIDE]),
    customer_exists: () => json(false),
    customer_signup: (b) => { made = b; return json([{ id: b.p_id, session_token: 'tok-new' }]); },
    customer_consents: () => json({ privacy_version: '2026-10-14', ride_news: false }),
    customer_set_emergency: () => json(true),
    customer_set_emergency2: () => json(true),
    customer_login: () => json([{ id: 'c-sara', name: 'Sara Alharbi', email: SARA.email, phone: SARA.phone, height: 165, session_token: 'tok-in' }]),
    customer_pwd_state: () => json(false),
    customer_handoff_redeem: () => json([{ id: 'c-sara', name: 'Sara Alharbi', session_token: 'tok-handed' }]),
    customer_profile: (b) => json([made && b.p_id === made.p_id
      ? { id: made.p_id, name: made.p_name, email: made.p_email, phone: made.p_phone, height: made.p_height, type_preference: 'Any', birth_date: null, nationality: null, gender: made.p_gender, socials: null }
      : SARA]),
    customer_emergency: () => json([EM_ROW]),
    customer_whatsapp: (b) => json([made && b.p_id === made.p_id ? { phone: made.p_phone, whatsapp_same: null, whatsapp: null } : { phone: SARA.phone, whatsapp_same: true, whatsapp: null }]),
    customer_fix_fields: () => json([]),
    customer_set_birth_nat: () => json(true),
    customer_set_whatsapp: () => json(true),
    customer_set_socials: () => json(true),
    customer_set_height: () => json(true),
    partner_book: (b) => json([{ id: (b.p_entry as Body).id, queue_num: 61, status: 'waiting' }]),
    customer_handoff_create: () => json(HANDOFF),
  };
  await page.route('**/rest/v1/rpc/*', async (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill(json({}));
    const fn = r.request().url().split('/rpc/')[1];
    const body = JSON.parse(r.request().postData() || '{}');
    calls.push({ fn, body });
    const a = answers[fn] || base[fn];
    return r.fulfill(a ? a(body) : json({ code: 'PGRST202', message: 'Could not find the function' }, 404));
  });
  await page.route(BOOKING + '**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Booking app</title><p>booking app</p>' }));
  await page.goto('/defe' + qs);
  const of = (fn: string) => calls.filter((c) => c.fn === fn).map((c) => c.body);
  const order = () => calls.map((c) => c.fn);
  return { errs, of, order };
}
async function signUp(page: Page) {
  await page.click('#go');
  // the account question first (the owner, 2026-10-17); no fields until it is answered
  await expect(page.locator('#p-ask')).toBeVisible();
  await expect(page.locator('#p-create')).toBeHidden();
  await expect(page.locator('#p-signin')).toBeHidden();
  await page.click('#ask-no');
  await expect(page.locator('#p-create')).toBeVisible();
  await page.fill('#first', 'sara');
  await page.fill('#last', 'al-harbi'); // a dash becomes a space
  await page.click('#genders .tile[data-v="female"]');
  await page.fill('#email', 'Sara.Alharbi@Gmail.com');
  await page.fill('#phone', '0552468013');
  await page.fill('#pwd', 'Ride2Work');
  await page.fill('#pwd2', 'Ride2Work');
  await page.fill('#height', '165');
  await page.fill('#em-name', 'Layla Alharbi');
  await page.fill('#em-phone', '0551234567');
  await page.selectOption('#em-rel', 'sibling');
  await page.click('#ack .tick-box');
  await page.click('#create');
}
async function book(page: Page, o: { code?: string; group?: string; bike?: string; shirt?: string } = {}) {
  await expect(page.locator('#s-book')).toBeVisible();
  if (o.code !== '') await page.fill('#code', o.code ?? 'DEFE24');
  await page.click(`#groups .opt[data-v="${o.group ?? 'beg'}"]`);
  await page.click(`#bikes .pill[data-v="${o.bike ?? 'Hybrid'}"]`);
  // The Defe shirt: 'yes', or the size wanted (no shirt on 22 October); '' answers nothing.
  const sh = o.shirt ?? 'M';
  if (sh === 'yes') await page.click('#shirtgot .pill[data-v="yes"]');
  else if (sh) { await page.click('#shirtgot .pill[data-v="no"]'); await page.click(`#shirtsizes .pill[data-v="${sh}"]`); }
  await page.click('#waiver .tick-box');
  await page.click('#book');
}

test('Register & book asks whether they have an account, and the answer opens its fields', async ({ page }) => {
  const { errs } = await open(page);
  await page.click('#go');
  await expect(page.locator('#p-ask')).toBeVisible();
  await expect(page.locator('#ask-q')).toHaveText('Do you have a MicroMobility account?');
  await expect(page.locator('#p-create')).toBeHidden();
  await expect(page.locator('#p-signin')).toBeHidden();
  await page.click('#ask-yes');
  await expect(page.locator('#p-signin')).toBeVisible();
  await expect(page.locator('#p-ask')).toBeHidden();
  // Back returns to the question, not to the ride
  await page.click('#back-land');
  await expect(page.locator('#p-ask')).toBeVisible();
  await expect(page.locator('#p-signin')).toBeHidden();
  await page.click('#ask-no');
  await expect(page.locator('#p-create')).toBeVisible();
  await page.click('#back-land');
  await page.click('#back-land');
  await expect(page.locator('#v-landing')).toBeVisible();
  expect(errs).toEqual([]);
});

test('the landing shows the ride, whether places are open, and never a count', async ({ page }) => {
  const { errs } = await open(page);
  await expect(page.locator('#title')).toHaveText(/One ride\.\s*One purpose\./);
  await expect(page.locator('#eyebrow')).toHaveText('Saturday Social Ride · 24 Oct 2026');
  await expect(page.locator('#state')).toHaveText('Places open');
  await expect(page.locator('#code-chip')).toBeVisible();
  const facts = page.locator('#facts');
  await expect(facts).toContainText('Saturday 24 October');
  await expect(facts).toContainText('05:45 – 06:15');
  await expect(facts.locator('a')).toHaveAttribute('href', RIDE.meet_url);
  await expect(facts).toContainText('Beginners 20 km to the Jeddah Yacht Club');
  await expect(facts).toContainText('Free · helmet comes with the bike');
  await expect(page.locator('#go')).toBeEnabled();
  await expect(page.locator('#go')).toHaveText('Register & book');
  // Both logos sit in the header; the MicroMobility words follow the text colour.
  await expect(page.locator('.mm svg')).toBeVisible();
  await expect(page.locator('.dbadge svg')).toBeVisible();
  // No numbers of places or bookings: no "x / y", no "left", nothing like 80 or 63 on the page.
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
  expect(text).not.toMatch(/places? left|booked so far|remaining/i);
  expect(text).not.toMatch(/\b(80|70|63|150)\b/);
  expect(errs).toEqual([]);
});

test('a new rider makes the account, gives the ride details, books, and is handed on to the booking app', async ({ page }) => {
  const { errs, of, order } = await open(page);
  await signUp(page);
  await expect(page.locator('#s-details')).toBeVisible();
  await expect(page.locator('#acct-made')).toBeVisible();
  expect(of('customer_exists')).toEqual([{ p_email: 'sara.alharbi@gmail.com', p_phone: '' }, { p_email: '', p_phone: '+966552468013' }]);
  const su = of('customer_signup')[0];
  expect(su).toEqual({ p_id: expect.stringMatching(/^[a-z0-9]{8,20}$/), p_name: 'Sara Al Harbi', p_email: 'sara.alharbi@gmail.com', p_phone: '+966552468013',
    p_pwd: 'Ride2Work', p_height: 165, p_type_preference: 'Any', p_gender: 'female' });
  expect(su).not.toHaveProperty('p_heard_from');
  expect(of('customer_consents')).toEqual([{ p_id: su.p_id, p_token: 'tok-new', p_privacy: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), p_ride_news: false }]);
  expect(of('customer_set_emergency')).toEqual([{ p_id: su.p_id, p_token: 'tok-new', p_name: 'Layla Alharbi', p_phone: '+966551234567', p_relation: 'sibling' }]);
  // The details: everything a Saturday ride asks for that a new account lacks; the height comes filled in.
  for (const f of ['#f-birth', '#f-nat', '#f-wa', '#f-ig', '#f-xheight']) await expect(page.locator(f)).toBeVisible();
  await expect(page.locator('#xem-block')).toBeHidden();
  await expect(page.locator('#xheight')).toHaveValue('165');
  await expect(page.locator('#wa-label')).toContainText('+966552468013');
  // Saudi Arabia first in the list and again in its place; never Israel.
  const nats = await page.locator('#nat option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
  expect(nats[1]).toBe('Saudi Arabia');
  expect(nats.filter((v) => v === 'Saudi Arabia').length).toBe(2);
  expect(nats.some((v) => /israel/i.test(v))).toBe(false);
  await page.click('#d-next');
  await expect(page.locator('#f-birth')).toHaveClass(/invalid/);
  await page.selectOption('#birth-y', '1994');
  await page.selectOption('#birth-m', '3');
  await page.selectOption('#birth-d', '12');
  await page.selectOption('#nat', 'Egypt');
  await page.click('#was .tile[data-v="yes"]');
  await page.fill('#ig', 'https://www.instagram.com/sara.rides/?hl=en');
  await page.click('#d-next');
  await expect(page.locator('#s-book')).toBeVisible();
  expect(of('customer_set_birth_nat')).toEqual([{ p_id: su.p_id, p_token: 'tok-new', p_birth_date: '1994-03-12', p_nationality: 'Egypt' }]);
  expect(of('customer_set_whatsapp')).toEqual([{ p_id: su.p_id, p_token: 'tok-new', p_same: true, p_phone: null }]);
  expect(of('customer_set_socials')).toEqual([{ p_id: su.p_id, p_token: 'tok-new', p_socials: { instagram: 'sara.rides' } }]);
  expect(of('customer_set_height')).toEqual([]); // unchanged
  // The booking: the code, the group, the bike, the review, the waiver behind its pop-up.
  await expect(page.locator('#review')).toContainText('Free');
  await page.click('#wv-open');
  await expect(page.locator('#wv')).toBeVisible();
  await expect(page.locator('#wv-body')).toContainText('Cycling is a physical activity that carries risk');
  const box = await page.locator('#wv .modal-box').boundingBox(), vp = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - vp.width / 2)).toBeLessThan(2); // centred
  await page.keyboard.press('Escape');
  await book(page);
  await expect(page.locator('#v-done')).toBeVisible();
  await expect(page.locator('#done-title')).toHaveText("You're riding");
  await expect(page.locator('#done-sum')).toContainText('Beginners · 20 km');
  await expect(page.locator('#done-sum')).toContainText('Hybrid + helmet');
  await expect(page.locator('#done-sum')).toContainText('To get one · M');
  const pb = of('partner_book');
  expect(pb).toEqual([{ p_id: su.p_id, p_token: 'tok-new', p_partner: 'defe', p_code: 'DEFE24',
    p_entry: { id: expect.stringMatching(/^df[0-9a-f]{24}$/), type_preference: 'Hybrid', height: 165, size: 'S', ride_group: 'beg', waiver_version: '2026-10-v3',
      ask: { shirt_got: false, shirt: 'M' } } }]);
  // About two seconds later: the booking app, signed in by a one-time code, on My Bookings.
  await page.waitForURL(BOOKING + '**', { timeout: 6000 });
  expect(page.url()).toBe(`${BOOKING}?signin=${HANDOFF}&tab=bookings&lang=en`);
  expect(order().filter((f) => f === 'customer_handoff_create').length).toBe(1);
  expect(errs).toEqual([]);
});

test('an existing rider signs in with their mobile, confirms the height and books', async ({ page }) => {
  const { errs, of } = await open(page);
  await page.click('#go-signin');
  await expect(page.locator('#p-signin')).toBeVisible();
  await expect(page.locator('#si-other')).toHaveAttribute('href', `${BOOKING}?handoff=defe&lang=en`);
  await page.fill('#ident', '055 246 8013');
  await page.fill('#spwd', 'Ride2Work');
  await page.click('#signin');
  await expect(page.locator('#s-details')).toBeVisible();
  expect(of('customer_login')).toEqual([{ p_identifier: '+966552468013', p_pwd: 'Ride2Work' }]);
  expect(of('customer_pwd_state')).toEqual([{ p_id: 'c-sara', p_token: 'tok-in' }]);
  // Only what is missing - nothing here - and the height, always.
  for (const f of ['#f-birth', '#f-nat', '#f-wa', '#f-ig', '#xem-block']) await expect(page.locator(f)).toBeHidden();
  await expect(page.locator('#xheight')).toHaveValue('165');
  await expect(page.locator('#d-who')).toContainText('Booking as Sara Alharbi');
  await page.fill('#xheight', '168');
  await page.click('#d-next');
  await expect(page.locator('#s-book')).toBeVisible();
  expect(of('customer_set_height')).toEqual([{ p_id: 'c-sara', p_token: 'tok-in', p_height: 168 }]);
  expect(of('customer_set_birth_nat')).toEqual([]);
  // The bike the account prefers is picked already.
  await expect(page.locator('#bikes .pill[data-v="Hybrid"]')).toHaveAttribute('aria-checked', 'true');
  await book(page, { group: 'int', bike: 'Own' });
  await expect(page.locator('#v-done')).toBeVisible();
  expect((of('partner_book')[0].p_entry as Body)).toMatchObject({ type_preference: 'Own', height: 168, size: 'S', ride_group: 'int' });
  expect(errs).toEqual([]);
});

test('sign-in says when the account is locked, and sends a temporary password to the booking site', async ({ page }) => {
  let n = 0;
  await open(page, '', {
    customer_login: () => (++n === 1 ? refuse('LOCKED') : json([{ id: 'c-sara', name: 'Sara Alharbi', session_token: 'tok-in' }])),
    customer_pwd_state: () => json(true),
  });
  await page.click('#go-signin');
  await page.fill('#ident', 'sara.alharbi@gmail.com');
  await page.fill('#spwd', 'wrong');
  await page.click('#signin');
  await expect(page.locator('#f-spwd .err')).toContainText('Too many failed attempts');
  await page.click('#signin');
  await expect(page.locator('#si-temp')).toBeVisible();
  await expect(page.locator('#si-temp-a')).toHaveAttribute('href', `${BOOKING}?handoff=defe&lang=en`);
  await expect(page.locator('#s-details')).toBeHidden();
});

test('handed back from the booking app with ?code=, the rider goes straight to the details', async ({ page }) => {
  const code = 'ab'.repeat(24);
  const { errs, of } = await open(page, `?code=${code}&lang=en`);
  await expect(page.locator('#s-details')).toBeVisible();
  expect(of('customer_handoff_redeem')).toEqual([{ p_code: code }]);
  expect(page.url()).not.toContain('code=');
  expect(page.url()).toContain('lang=en');
  expect(of('customer_profile')).toEqual([{ p_id: 'c-sara', p_token: 'tok-handed' }]);
  expect(errs).toEqual([]);
});

test('the details ask only what the account is missing, and keep the other handles', async ({ page }) => {
  const { of } = await open(page, '', {
    customer_profile: () => json([{ ...SARA, nationality: null, socials: { x: 'sararides', tiktok: 'sara.tt' } }]),
    customer_emergency: () => json([{ ...EM_ROW, emergency_name: null, emergency_phone: null, emergency_relation: null }]),
    customer_whatsapp: () => json([{ phone: SARA.phone, whatsapp_same: false, whatsapp: '+201012345678' }]),
  });
  await page.click('#go-signin');
  await page.fill('#ident', 'sara.alharbi@gmail.com');
  await page.fill('#spwd', 'Ride2Work');
  await page.click('#signin');
  await expect(page.locator('#s-details')).toBeVisible();
  await expect(page.locator('#f-birth')).toBeHidden();
  await expect(page.locator('#f-wa')).toBeHidden();
  await expect(page.locator('#f-nat')).toBeVisible();
  await expect(page.locator('#f-ig')).toBeVisible();
  await expect(page.locator('#xem-block')).toBeVisible();
  await page.selectOption('#nat', 'Saudi Arabia');
  await page.fill('#ig', '@sara.rides');
  await page.fill('#xem-name', 'Layla-Alharbi');
  await expect(page.locator('#xem-name')).toHaveValue('Layla Alharbi');
  await page.fill('#xem-phone', '0551234567');
  await page.selectOption('#xem-rel', 'sibling');
  await page.click('#d-next');
  await expect(page.locator('#s-book')).toBeVisible();
  // the birth date the account holds goes back with the nationality (the function writes both)
  expect(of('customer_set_birth_nat')).toEqual([{ p_id: 'c-sara', p_token: 'tok-in', p_birth_date: '1994-03-12', p_nationality: 'Saudi Arabia' }]);
  expect(of('customer_set_socials')).toEqual([{ p_id: 'c-sara', p_token: 'tok-in', p_socials: { x: 'sararides', tiktok: 'sara.tt', instagram: 'sara.rides' } }]);
  expect(of('customer_set_emergency')).toEqual([{ p_id: 'c-sara', p_token: 'tok-in', p_name: 'Layla Alharbi', p_phone: '+966551234567', p_relation: 'sibling' }]);
  expect(of('customer_set_whatsapp')).toEqual([]);
});

test('a detail only the booking site can take sends the rider there', async ({ page }) => {
  await open(page, '', { customer_fix_fields: () => json(['email']) });
  await page.click('#go-signin');
  await page.fill('#ident', 'sara.alharbi@gmail.com');
  await page.fill('#spwd', 'Ride2Work');
  await page.click('#signin');
  await expect(page.locator('#d-blocked')).toBeVisible();
  await expect(page.locator('#d-blocked-a')).toHaveAttribute('href', `${BOOKING}?handoff=defe&lang=en`);
  await page.click('#d-next');
  await expect(page.locator('#s-book')).toBeHidden();
});

async function toBook(page: Page) {
  await page.click('#go-signin');
  await page.fill('#ident', 'sara.alharbi@gmail.com');
  await page.fill('#spwd', 'Ride2Work');
  await page.click('#signin');
  await page.click('#d-next');
  await expect(page.locator('#s-book')).toBeVisible();
}

test('the booking asks whether the rider got a Defe shirt on 22 October, and the size when not', async ({ page }) => {
  const { errs, of } = await open(page);
  await toBook(page);
  await expect(page.locator('#f-shirtsize')).toBeHidden();
  await book(page, { shirt: '' });
  await expect(page.locator('#f-shirt .err')).toHaveText('Tell us whether you received a Defe shirt');
  await page.click('#shirtgot .pill[data-v="no"]');
  await expect(page.locator('#f-shirtsize')).toBeVisible();
  await page.click('#book');
  await expect(page.locator('#f-shirtsize .err')).toHaveText('Choose your T-shirt size');
  expect(of('partner_book')).toEqual([]);
  // Yes: no size asked, and the booking says they have one.
  await page.click('#shirtgot .pill[data-v="yes"]');
  await expect(page.locator('#f-shirtsize')).toBeHidden();
  await expect(page.locator('#review')).toContainText('Already have one');
  await page.click('#book');
  await expect(page.locator('#v-done')).toBeVisible();
  expect((of('partner_book')[0].p_entry as Body).ask).toEqual({ shirt_got: true });
  await expect(page.locator('#done-sum')).toContainText('Already have one');
  expect(errs).toEqual([]);
});

test('the booking says when the code is wrong or its places are used up', async ({ page }) => {
  let answer = refuse('BAD_CODE');
  await open(page, '', { partner_book: () => answer });
  await toBook(page);
  await book(page, { code: 'DEFE2024' });
  await expect(page.locator('#f-code .err')).toHaveText("That code doesn't work. Check the code Defe sent you.");

  answer = refuse('CODE_USED_UP');
  await page.fill('#code', 'DEFE24');
  await page.click('#book');
  await expect(page.locator('#b-notice')).toContainText('Code places are all booked.');
  await expect(page.locator('#b-notice')).toContainText('More places open to everyone soon on this page.');
  await expect(page.locator('#book')).toBeDisabled();
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
});

test('Defe places taken while the rider books', async ({ page }) => {
  let answer = refuse('PARTNER_FULL');
  await open(page, '', { partner_book: () => answer });
  await toBook(page);
  await book(page);
  await expect(page.locator('#b-notice')).toContainText('All Defe places are taken.');
  await expect(page.locator('#book')).toBeDisabled();
});

test('a rider booked on the ride already is told so and offered their booking', async ({ page }) => {
  await open(page, '', { partner_book: () => refuse('You already have a place on this ride.', 'ONE_PER_SESSION') });
  await toBook(page);
  await book(page);
  await expect(page.locator('#b-notice')).toContainText('You already have a place on this ride.');
  await page.click('#b-open');
  await page.waitForURL(BOOKING + '**');
  expect(page.url()).toBe(`${BOOKING}?signin=${HANDOFF}&tab=bookings&lang=en`);
});

test('no Defe ride open: booking is closed', async ({ page }) => {
  await open(page, '', { partner_status: () => json([]) });
  await expect(page.locator('#state')).toHaveText('Booking is closed');
  await expect(page.locator('#go')).toBeDisabled();
  await expect(page.locator('#land-notice')).toContainText('Booking for this ride is closed.');
  await expect(page.locator('#have-acct')).toBeHidden();
});

test('Defe places full: the landing says Full, with no number', async ({ page }) => {
  await open(page, '', { partner_status: () => json([{ ...RIDE, open: false }]) });
  await expect(page.locator('#state')).toHaveText('Full');
  await expect(page.locator('#go')).toBeDisabled();
  await expect(page.locator('#go')).toHaveText('Full');
  await expect(page.locator('#land-notice')).toContainText('All Defe places are taken.');
  await expect(page.locator('#see-ticket-a')).toHaveAttribute('href', `${BOOKING}?tab=bookings&lang=en`);
  expect(await page.locator('body').innerText()).not.toMatch(/\d+\s*\/\s*\d+/);
});

test('the code places used up before staff open the page: said on the landing', async ({ page }) => {
  await open(page, '', { partner_status: () => json([{ ...RIDE, code_open: false }]) });
  await expect(page.locator('#land-notice')).toContainText('Code places are all booked.');
  await expect(page.locator('#state')).toHaveText('Places open');
});

test('Arabic reads right to left, with its own words', async ({ page }) => {
  const { errs } = await open(page, '?lang=ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('#title')).toHaveText(/رحلة واحدة\.\s*هدف واحد\./);
  await expect(page.locator('#state')).toHaveText('الأماكن متاحة');
  await expect(page.locator('#go')).toHaveText('سجّل واحجز');
  await expect(page.locator('#lang')).toHaveText('English');
  await page.click('#lang');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#state')).toHaveText('Places open');
  expect(page.url()).toContain('lang=en');
  expect(errs).toEqual([]);
});

test('Arabic full state says اكتمل العدد', async ({ page }) => {
  await open(page, '?lang=ar', { partner_status: () => json([{ ...RIDE, open: false }]) });
  await expect(page.locator('#state')).toHaveText('اكتمل العدد');
});

test('every button is rectangular', async ({ page }) => {
  await open(page);
  const round = await page.locator('button, .d-btn').evaluateAll((els) => els.filter((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) > 0).map((e) => e.id || e.className));
  expect(round).toEqual([]);
});

test('the page never shows an emoji (the flags of the phone picker aside)', async ({ page }) => {
  await open(page);
  const text = await page.evaluate(() => document.body.innerText);
  expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
});
