import { test, expect, type Page } from '@playwright/test';
import { flipLang } from './lang';

// micromobility.sa/saturday end to end in a browser, every database call stubbed (and the booking app it hands the
// rider on to): the landing (saturday_rides), the ride code checked first (saturday_rides(code)), the account
// (sign-up, sign-in, or handed back signed in with ?code=), the details a Saturday ride asks for, the booking
// (saturday_book) and the hand-on to the booking app (customer_handoff_create -> ?signin=).
const json = (b: unknown, status = 200) => ({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(b) });
const refuse = (message: string, details: string | null = null) => json({ code: 'P0001', message, details, hint: null }, 400);
type Body = Record<string, unknown>;
type Answers = Partial<Record<string, (body: Body) => ReturnType<typeof json>>>;
const BOOKING = 'https://experiences.micromobility.sa/';
const RIDE = { session_id: '2099-11-14', session_date: '2099-11-14', day: 'Saturday', bike_slots: '{"_time":"05:45 - 06:15","Road":10}', meet_url: 'https://maps.app.goo.gl/pdcMn1mGcCdabia7A', title: null, status: 'open', opens_at: null, code_ok: null, code_open: null };
const RIDE2 = { ...RIDE, session_id: '2099-11-21', session_date: '2099-11-21' };
const SARA = { id: 'c-sara', name: 'Sara Alharbi', email: 'sara.alharbi@gmail.com', phone: '+966552468013', height: 165, type_preference: 'Hybrid', birth_date: '1994-03-12', nationality: 'Saudi Arabia', gender: 'female', socials: { instagram: 'sara.rides', x: 'sararides' } };
const EM_ROW = { emergency_name: 'Layla Alharbi', emergency_phone: '+966551234567', emergency_relation: 'sibling', emergency2_name: null, emergency2_phone: null, emergency2_relation: null };
const HANDOFF = 'cd'.repeat(24);
// saturday_rides: the rides, and with a code whether it is good on each and has places there.
const ridesFor = (rides: Body[], good: Record<string, [boolean, boolean]> = {}) => (b: Body) =>
  json(rides.map((r) => (b.p_code ? { ...r, code_ok: (good[String(b.p_code).toUpperCase()] || [false, false])[0], code_open: (good[String(b.p_code).toUpperCase()] || [false, false])[1] } : r)));

async function open(page: Page, qs = '', answers: Answers = {}) {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const calls: { fn: string; body: Body }[] = [];
  let made: Body | null = null; // the account customer_signup made, which customer_profile then reads
  const base: Answers = {
    saturday_rides: ridesFor([RIDE], { IMC26: [true, true] }),
    customer_exists: () => json(false),
    customer_signup: (b) => { made = b; return json([{ id: b.p_id, session_token: 'tok-new' }]); },
    customer_consents: () => json({ privacy_version: '2026-11-05', ride_news: false }),
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
    saturday_book: (b) => json([{ id: (b.p_entry as Body).id, queue_num: 61, status: 'waiting', refused: null }]),
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
  await page.goto('/saturday' + qs);
  const of = (fn: string) => calls.filter((c) => c.fn === fn).map((c) => c.body);
  return { errs, of };
}
async function code(page: Page, c = 'imc26') {
  await expect(page.locator('#go')).toBeEnabled();
  await page.fill('#code', c);
  await page.click('#go');
}
async function signUp(page: Page) {
  await expect(page.locator('#p-ask')).toBeVisible();
  await page.click('#ask-no');
  await page.fill('#first', 'sara');
  await page.fill('#last', 'al-harbi');
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
async function signIn(page: Page) {
  await expect(page.locator('#p-ask')).toBeVisible();
  await page.click('#ask-yes');
  await page.fill('#ident', 'sara.alharbi@gmail.com');
  await page.fill('#spwd', 'Ride2Work');
  await page.click('#signin');
}
async function book(page: Page, o: { group?: string; bike?: string } = {}) {
  await expect(page.locator('#s-book')).toBeVisible();
  await page.click(`#groups .opt[data-v="${o.group ?? 'beg'}"]`);
  await page.click(`#bikes .pill[data-v="${o.bike ?? 'Hybrid'}"]`);
  await page.click('#waiver .tick-box');
  await page.click('#book');
}

test('the landing shows the next Saturday ride and asks for the ride code, never a count', async ({ page }) => {
  const { errs, of } = await open(page);
  await expect(page.locator('#title')).toHaveText(/Saturday\s*Social Ride/);
  await expect(page.locator('#eyebrow')).toHaveText('MicroMobility community · 14 Nov 2099');
  await expect(page.locator('#state')).toHaveText('Places open');
  const facts = page.locator('#facts');
  await expect(facts).toContainText('Saturday 14 November');
  await expect(facts).toContainText('05:45 – 06:15');
  await expect(facts.locator('a')).toHaveAttribute('href', RIDE.meet_url);
  await expect(facts).toContainText('Free · helmet comes with the bike');
  await expect(page.locator('#f-code')).toBeVisible();
  await expect(page.locator('#go')).toBeEnabled();
  expect(await page.locator('main').innerText()).not.toMatch(/\b\d+ (places|bookings|left)\b/i);
  expect(of('saturday_rides')).toEqual([{ p_code: null }]);
  expect(errs).toEqual([]);
});

test('a code that does not work is said on the code box, and nothing else happens', async ({ page }) => {
  const { of } = await open(page);
  await page.click('#go'); // empty
  await expect(page.locator('#f-code .err')).toHaveText('Enter your ride code');
  await code(page, 'NOPE1');
  await expect(page.locator('#f-code .err')).toHaveText("That code doesn't work. Check the code you were given.");
  await expect(page.locator('#v-landing')).toBeVisible();
  await expect(page.locator('#p-ask')).toBeHidden();
  await code(page, 'no spaces!'); // not a code at all: refused before it is sent
  await expect(page.locator('#f-code .err')).toHaveText("That code doesn't work. Check the code you were given.");
  expect(of('saturday_rides').map((b) => b.p_code)).toEqual([null, 'NOPE1']);
});

test('a code whose places on the ride are taken says so', async ({ page }) => {
  await open(page, '', { saturday_rides: ridesFor([RIDE], { FULL1: [true, false] }) });
  await code(page, 'FULL1');
  await expect(page.locator('#f-code .err')).toHaveText("This code's places are all booked.");
});

test('too many wrong codes from one address', async ({ page }) => {
  await open(page, '', { saturday_rides: (b) => (b.p_code ? refuse('RATE_LIMITED') : json([RIDE])) });
  await code(page, 'WRONG9');
  await expect(page.locator('#f-code .err')).toHaveText('Too many wrong codes. Wait a few minutes, then try again.');
});

test('no Saturday ride coming: no code box, no button', async ({ page }) => {
  await open(page, '', { saturday_rides: () => json([]) });
  await expect(page.locator('#state')).toHaveText('No ride open');
  await expect(page.locator('#land-notice')).toContainText('No Saturday ride is open for booking right now.');
  await expect(page.locator('#f-code')).toBeHidden();
  await expect(page.locator('#go')).toBeDisabled();
});

test('a ride that opens at a set time says when', async ({ page }) => {
  await open(page, '', { saturday_rides: () => json([{ ...RIDE, status: 'closed', opens_at: '2099-11-11T17:00:00Z' }]) });
  await expect(page.locator('#state')).toHaveText('Opens soon');
  await expect(page.locator('#land-notice')).toContainText('Booking opens Wednesday 11 November at 20:00.');
  await expect(page.locator('#go')).toBeDisabled();
});

test('a full ride takes the waitlist, and the booking says so', async ({ page }) => {
  const { of } = await open(page, '', {
    saturday_rides: ridesFor([{ ...RIDE, status: 'full' }], { IMC26: [true, true] }),
    saturday_book: (b) => json([{ id: (b.p_entry as Body).id, queue_num: 70, status: 'waitlist', refused: null }]),
  });
  await expect(page.locator('#state')).toHaveText('Waitlist only');
  await expect(page.locator('#land-notice')).toContainText('This ride is full.');
  await code(page);
  await signIn(page);
  await page.click('#d-next');
  await book(page);
  await expect(page.locator('#done-title')).toHaveText("You're on the waitlist");
  expect(of('saturday_book')).toHaveLength(1);
});

test('a new rider: code, account, details, booking, then the booking app signed in', async ({ page }) => {
  const { errs, of } = await open(page);
  await code(page);
  await signUp(page);
  await expect(page.locator('#acct-made')).toBeVisible();
  // date of birth, nationality and Instagram, every time; the height filled from the sign-up
  await page.selectOption('#birth-y', '1994'); await page.selectOption('#birth-m', '3'); await page.selectOption('#birth-d', '12');
  await page.selectOption('#nat', 'Saudi Arabia');
  await page.click('#was .tile[data-v="yes"]');
  await page.fill('#ig', 'https://instagram.com/sara.rides/');
  await expect(page.locator('#xheight')).toHaveValue('165');
  await page.click('#d-next');
  await book(page, { group: 'int', bike: 'Road' });
  await expect(page.locator('#done-title')).toHaveText('Your request is in');
  await expect(page.locator('#done-text')).toContainText('Once the list is published, My Bookings shows whether your place is confirmed.');
  await expect(page.locator('#done-sum')).toContainText('IMC26');
  const b = of('saturday_book')[0];
  expect(b.p_session).toBe('2099-11-14');
  expect(b.p_code).toBe('imc26');
  expect(b.p_token).toBe('tok-new');
  const e = b.p_entry as Body;
  expect(e).toMatchObject({ type_preference: 'Road', ride_group: 'int', height: 165, size: 'S' });
  expect(String(e.waiver_version)).toMatch(/^\d{4}-\d{2}-v\d+$/);
  expect(e).not.toHaveProperty('ask');
  expect(of('customer_set_socials')[0].p_socials).toMatchObject({ instagram: 'sara.rides' });
  await page.waitForURL(BOOKING + '**', { timeout: 10000 });
  expect(page.url()).toBe(`${BOOKING}?signin=${HANDOFF}&tab=bookings&lang=en`);
  expect(errs).toEqual([]);
});

test('a code that books two Saturdays asks which, and books the one picked', async ({ page }) => {
  const { of } = await open(page, '', { saturday_rides: ridesFor([RIDE, RIDE2], { IMC26: [true, true] }) });
  await code(page);
  await signIn(page);
  await page.click('#d-next');
  await expect(page.locator('#f-ride')).toBeVisible();
  await expect(page.locator('#rides .opt')).toHaveCount(2);
  await page.click('#rides .opt[data-v="2099-11-21"]');
  await expect(page.locator('#review')).toContainText('21 Nov');
  await book(page);
  await expect(page.locator('#done-title')).toHaveText('Your request is in');
  expect(of('saturday_book')[0].p_session).toBe('2099-11-21');
});

test('a code off on one Saturday books the other only, without asking', async ({ page }) => {
  const { of } = await open(page, '', { saturday_rides: (b) => json(b.p_code ? [{ ...RIDE, code_ok: false, code_open: false }, { ...RIDE2, code_ok: true, code_open: true }] : [RIDE, RIDE2]) });
  await code(page);
  await signIn(page);
  await page.click('#d-next');
  await expect(page.locator('#f-ride')).toBeHidden();
  await book(page);
  expect(of('saturday_book')[0].p_session).toBe('2099-11-21');
});

test('the code refused at the last step (its places went meanwhile) goes back to the code box', async ({ page }) => {
  await open(page, '', { saturday_book: () => json([{ id: null, queue_num: null, status: null, refused: 'CODE_USED_UP' }]) });
  await code(page);
  await signIn(page);
  await page.click('#d-next');
  await book(page);
  await expect(page.locator('#v-landing')).toBeVisible();
  await expect(page.locator('#f-code .err')).toHaveText("This code's places are all booked.");
});

test('a rider who already has a booking on the ride is told so, with the way to it', async ({ page }) => {
  await open(page, '', { saturday_book: () => refuse('One place per person on this ride.', 'ONE_PER_SESSION') });
  await code(page);
  await signIn(page);
  await page.click('#d-next');
  await book(page);
  await expect(page.locator('#b-notice')).toContainText('You already have a booking on this ride.');
  await expect(page.locator('#b-open')).toBeVisible();
  await expect(page.locator('#book')).toBeDisabled();
});

test('our bikes taken (the members limit): the bike box says to come with your own', async ({ page }) => {
  await open(page, '', { saturday_book: () => refuse('Our bikes are taken for this ride. You can still join with your own bike.', 'MEMBER_BIKES_FULL') });
  await code(page);
  await signIn(page);
  await page.click('#d-next');
  await book(page);
  await expect(page.locator('#f-bike .err')).toHaveText('Our bikes are taken for this ride. You can still join with your own bike.');
});

test('handed back signed in by the booking app, the code typed before is checked again and on to the details', async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem('mm-saturday-code', 'IMC26'); } catch (e) { /* none */ } });
  const { of } = await open(page, `?code=${'ab'.repeat(24)}&lang=en`);
  await expect(page.locator('#s-details')).toBeVisible();
  await expect(page.locator('#d-who')).toContainText('Booking as Sara Alharbi');
  expect(of('customer_handoff_redeem')).toHaveLength(1);
  expect(of('saturday_rides').map((b) => b.p_code)).toEqual([null, 'IMC26']);
  expect(page.url()).not.toContain('code=');
});

// The owner, 2026-11-09: "don't allow a flagged account field to type in the same info in the field again".
test('a question staff flagged refuses what the account already holds; a new answer goes through customer_fix_save, then on to book', async ({ page }) => {
  const SAME = 'This is the same as what is on your account. Please correct it.';
  let flags = ['nationality', 'instagram', 'emergency2'];
  const { errs, of } = await open(page, '', {
    customer_emergency: () => json([{ ...EM_ROW, emergency2_name: 'Omar Alharbi', emergency2_phone: '+966559876543', emergency2_relation: 'parent' }]),
    customer_fix_fields: () => json(flags),
    customer_fix_save: () => { flags = []; return json([]); },
  });
  await code(page);
  await signIn(page);
  await expect(page.locator('#s-details')).toBeVisible();
  await expect(page.locator('#xem2-box')).toBeVisible();
  await page.click('#d-next');
  for (const f of ['#f-nat', '#f-ig', '#f-xem2-name']) await expect(page.locator(`${f} .err`)).toHaveText(SAME);
  await expect(page.locator('#f-xem-name .err')).toHaveText(''); // the first contact is not flagged
  await flipLang(page);
  await expect(page.locator('#f-nat .err')).toHaveText('هذا مطابق لما هو مسجل في حسابك. يرجى تصحيحه.');
  await flipLang(page);
  expect(of('customer_fix_save')).toEqual([]);
  await page.selectOption('#nat', 'Egypt');
  await page.fill('#ig', 'sara.on.bikes');
  await page.fill('#xem2-phone', '0559876544');
  await page.click('#d-next');
  await expect(page.locator('#s-book')).toBeVisible();
  expect(of('customer_fix_save')).toEqual([{ p_id: 'c-sara', p_token: 'tok-in', p_values: {
    nationality: 'Egypt', instagram: 'sara.on.bikes', emergency2: { name: 'Omar Alharbi', phone: '+966559876544', relation: 'parent' } } }]);
  expect(errs).toEqual([]);
});

test('a forgotten password goes through the booking app and keeps the code for the way back', async ({ page }) => {
  await open(page);
  await code(page);
  await page.click('#ask-yes');
  await expect(page.locator('#si-other')).toHaveAttribute('href', `${BOOKING}?handoff=saturday&lang=en&auth=forgot`);
  await expect(page.locator('#si-other')).toHaveText('Forgot password?');
  await page.click('#si-other');
  await page.waitForURL(BOOKING + '**');
  // back in this tab (as the booking app sends the rider): the code is in its box again, and taken out of storage
  await page.goBack();
  await expect(page.locator('#code')).toHaveValue('imc26');
  expect(await page.evaluate(() => sessionStorage.getItem('mm-saturday-code'))).toBeNull();
});

test('Arabic: right to left, the code and the ride in Arabic', async ({ page }) => {
  const { errs } = await open(page, '?lang=ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#state')).toHaveText('الأماكن متاحة');
  await expect(page.locator('label[for="code"]')).toHaveText('رمز الرحلة');
  await code(page, 'NOPE1');
  await expect(page.locator('#f-code .err')).toHaveText('هذا الرمز غير صالح. تحقّق من الرمز الذي حصلت عليه.');
  expect(errs).toEqual([]);
});
