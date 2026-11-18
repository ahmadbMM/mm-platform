import { test, expect, type Page } from '@playwright/test';
import { flipLang } from './lang';

// micromobility.sa/farmhouse end to end in a browser, every database call stubbed (and the booking app it hands the
// rider on to): the code first (farm_night(code): the night it opens, never a count), the account ("Do you have a
// MicroMobility account?", the sign-up or the sign-in, or handed back signed in with ?code=), only the details the
// account still owes, who is coming (the holder and up to three family members, four in all per account), the farm
// night's own waiver, the booking (farm_book) and the hand-on to the booking app (customer_handoff_create -> ?signin=).
const json = (b: unknown, status = 200) => ({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(b) });
type Body = Record<string, unknown>;
type Answers = Partial<Record<string, (body: Body) => ReturnType<typeof json>>>;
const BOOKING = 'https://experiences.micromobility.sa/';
const CODE = 'FARM2099';
const NIGHT = {
  id: '2099-11-19-fh', date: '2099-11-19', day: 'Thursday', title: 'The Farmhouse Night', title_ar: 'ليلة فارم هاوس', time: '16:30 - 20:30',
  place: 'Farmhouse, Dhahban', place_ar: 'فارم هاوس، ذهبان', map: 'https://maps.app.goo.gl/farmhouse', ig: 'thefarmhouse.jed', state: 'open', max: 4, held: null as string[] | null,
};
const SARA = { id: 'c-sara', name: 'Sara Alharbi', email: 'sara.alharbi@gmail.com', phone: '+966552468013', height: 165, type_preference: 'Hybrid', birth_date: '1994-03-12', nationality: 'Saudi Arabia', gender: 'female', socials: { instagram: 'sara.rides' } };
const EM_ROW = { emergency_name: 'Layla Alharbi', emergency_phone: '+966551234567', emergency_relation: 'sibling', emergency2_name: null, emergency2_phone: null, emergency2_relation: null };
const HANDOFF = 'cd'.repeat(24);
const WAIVER = 'farm-2026-11-v1';
// farm_night: the code (any case) opens the night; signed in, the night says the names the account holds there.
const nightFor = (n: Partial<typeof NIGHT> = {}, held: string[] = []) => (b: Body) =>
  String(b.p_code || '').toUpperCase() === CODE
    ? json({ ok: true, code: CODE, signed_in: !!b.p_id, nights: [{ ...NIGHT, ...n, held: b.p_id ? held : null }] })
    : json({ ok: false, error: 'code' });

async function open(page: Page, qs = '', answers: Answers = {}) {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const calls: { fn: string; body: Body }[] = [];
  let made: Body | null = null; // the account customer_signup made, which customer_profile then reads
  const base: Answers = {
    farm_night: nightFor(),
    customer_exists: () => json(false),
    customer_signup: (b) => { made = b; return json([{ id: b.p_id, session_token: 'tok-new' }]); },
    customer_consents: () => json({ privacy_version: '2026-11-14', ride_news: false }),
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
    customer_fix_save: () => json([]),
    customer_set_birth_nat: () => json(true),
    customer_set_whatsapp: () => json(true),
    customer_set_socials: () => json(true),
    customer_set_height: () => json(true),
    farm_book: (b) => json({ ok: true, added: (b.p_family as string[]).length + 1, people: [made ? String(made.p_name) : 'Sara Alharbi', ...(b.p_family as string[])], session: { id: NIGHT.id, date: NIGHT.date } }),
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
  await page.goto('/farmhouse' + qs);
  const of = (fn: string) => calls.filter((c) => c.fn === fn).map((c) => c.body);
  return { errs, of };
}
async function code(page: Page, c = 'farm2099') {
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
async function send(page: Page) {
  await page.click('#waiver .tick-box');
  await page.click('#book');
}

test('the landing names the night and asks for the code, and shows nothing of the night before it', async ({ page }) => {
  const { errs, of } = await open(page);
  await expect(page.locator('#title')).toHaveText('The Farmhouse Night');
  await expect(page.locator('.hero .fh-mark')).toHaveAttribute('src', '/site/farm-logo.jpg');
  await expect(page.locator('#eyebrow')).toHaveText('MicroMobility community');
  await expect(page.locator('#facts')).toBeHidden();
  await expect(page.locator('#state')).toBeHidden();
  await expect(page.locator('#land-ig')).toBeHidden();
  await expect(page.locator('#f-code label')).toHaveText('Booking code');
  await expect(page.locator('main')).not.toContainText(/Dhahban|19 November|16:30|4:30/);
  expect(of('farm_night')).toEqual([]);
  expect(errs).toEqual([]);
});

test('a code that does not work is said on the code box, and nothing else happens', async ({ page }) => {
  const { of } = await open(page);
  await page.click('#go'); // empty
  await expect(page.locator('#f-code .err')).toHaveText('Enter your booking code');
  await code(page, 'NOPE1');
  await expect(page.locator('#f-code .err')).toHaveText("That code doesn't work. Check the code you were given.");
  await expect(page.locator('#v-landing')).toBeVisible();
  await expect(page.locator('#facts')).toBeHidden();
  await code(page, 'no spaces!'); // not a code at all: refused before it is sent
  await expect(page.locator('#f-code .err')).toHaveText("That code doesn't work. Check the code you were given.");
  expect(of('farm_night')).toEqual([{ p_code: 'NOPE1', p_id: null, p_token: null }]);
});

test('too many wrong codes from one address: the wait is said on the code box', async ({ page }) => {
  await open(page, '', { farm_night: () => json({ ok: false, error: 'throttled' }) });
  await code(page, 'NOPE2');
  await expect(page.locator('#f-code .err')).toHaveText('Too many wrong codes. Wait a few minutes, then try again.');
});

test('a good code goes on to the account question; Back shows the night, its times, venue, map and Instagram, never a count', async ({ page }) => {
  const { errs, of } = await open(page);
  await code(page, 'farm٢٠٩٩'); // Arabic-Indic digits are read as their digits
  await expect(page.locator('#p-ask')).toBeVisible();
  await expect(page.locator('#ask-q')).toHaveText('Do you have a MicroMobility account?');
  expect(of('farm_night')).toEqual([{ p_code: 'farm2099', p_id: null, p_token: null }]);
  await page.click('#back-land');
  const facts = page.locator('#facts');
  await expect(facts).toBeVisible();
  await expect(facts).toContainText('Thursday 19 November');
  await expect(facts).toContainText(/Arrival\s*4:30\s?pm/i);
  await expect(facts).toContainText(/Dinner\s*8:30\s?pm/i);
  await expect(facts).toContainText('Farmhouse, Dhahban');
  await expect(facts.locator('a')).toHaveAttribute('href', NIGHT.map);
  await expect(facts).toContainText('You and up to three family members');
  await expect(page.locator('#state')).toHaveText('Places open');
  await expect(page.locator('#land-ig')).toHaveAttribute('href', 'https://www.instagram.com/thefarmhouse.jed/');
  await expect(page.locator('#land-ig')).toHaveText('@thefarmhouse.jed');
  await expect(page.locator('#eyebrow')).toHaveText('MicroMobility community · 19 Nov 2099');
  expect(await page.locator('main').innerText()).not.toMatch(/\b\d+ (places|bookings|left|going)\b/i);
  expect(errs).toEqual([]);
});

test('a night fully booked, or one whose bookings are over, stays on the landing with its words', async ({ page }) => {
  await open(page, '', { farm_night: nightFor({ state: 'full' }) });
  await code(page);
  await expect(page.locator('#state')).toHaveText('Fully booked');
  await expect(page.locator('#land-notice .notice-h')).toHaveText('The Farmhouse Night is fully booked.');
  await expect(page.locator('#p-ask')).toBeHidden();
  await expect(page.locator('#v-landing')).toBeVisible();
});

test('a good code whose night is over says bookings are closed', async ({ page }) => {
  await open(page, '', { farm_night: () => json({ ok: false, error: 'over' }) });
  await code(page);
  await expect(page.locator('#state')).toHaveText('Bookings closed');
  await expect(page.locator('#land-notice .notice-h')).toHaveText('Bookings for the Farmhouse Night are closed.');
  await expect(page.locator('#p-ask')).toBeHidden();
});

test('no account: the sign-up asks no height, the account is made, nothing more is owed, and the holder books alone', async ({ page }) => {
  const { errs, of } = await open(page);
  await code(page);
  await expect(page.locator('#f-height')).toHaveCount(0);
  await signUp(page);
  await expect(page.locator('#s-book')).toBeVisible(); // nothing owed: the details step is skipped
  await expect(page.locator('#b-made')).toBeVisible();
  await expect(page.locator('#st-title')).toHaveText('Who is coming');
  await expect(page.locator('#people-label')).toHaveText('People coming');
  await expect(page.locator('#ppl-n')).toHaveText('1');
  await expect(page.locator('#pn-you')).toHaveValue('Sara Al Harbi');
  await expect(page.locator('#pn-you')).toHaveAttribute('readonly', '');
  const signup = of('customer_signup')[0];
  expect(signup.p_height).toBeNull();
  expect(signup.p_name).toBe('Sara Al Harbi');
  expect(of('customer_set_emergency')).toHaveLength(1);
  await expect(page.locator('#review')).toContainText('Sara Al Harbi');
  await expect(page.locator('#review')).toContainText(CODE);
  await send(page);
  await expect(page.locator('#done-title')).toHaveText('Your request is in');
  await expect(page.locator('#done-sum')).toContainText('Sara Al Harbi');
  expect(of('farm_book')).toEqual([{ p_id: signup.p_id, p_token: 'tok-new', p_session: NIGHT.id, p_code: CODE, p_family: [], p_waiver: WAIVER }]);
  await page.waitForURL(BOOKING + '?signin=' + HANDOFF + '&tab=bookings&lang=en');
  expect(errs).toEqual([]);
});

test('an account: sign in, only what it still owes is asked (here the nationality), then who is coming', async ({ page }) => {
  let owes = ['nationality'];
  const { of } = await open(page, '', { customer_fix_fields: () => json(owes), customer_set_birth_nat: () => { owes = []; return json(true); }, customer_profile: () => json([{ ...SARA, nationality: null }]) });
  await code(page);
  await signIn(page);
  await expect(page.locator('#s-details')).toBeVisible();
  await expect(page.locator('#f-nat')).toBeVisible();
  for (const id of ['#f-birth', '#f-ig', '#f-xheight', '#f-wa', '#xem-block']) await expect(page.locator(id)).toBeHidden();
  await page.selectOption('#nat', 'Saudi Arabia');
  await page.click('#d-next');
  await expect(page.locator('#s-book')).toBeVisible();
  await expect(page.locator('#b-made')).toBeHidden();
  expect(of('customer_set_birth_nat')).toEqual([{ p_id: 'c-sara', p_token: 'tok-in', p_birth_date: SARA.birth_date, p_nationality: 'Saudi Arabia' }]);
  expect(of('farm_night').at(-1)).toEqual({ p_code: CODE, p_id: 'c-sara', p_token: 'tok-in' });
});

// A flagged second contact, or a non-member's flagged Instagram, may be answered "I don't have one" (customer_fix_save's
// p_values.none, as the booking app's check-up offers it; bug hunt 2026-11-18): never a contact made up to get past.
test("a flagged second contact or a non-member's Instagram: I don't have one clears it, and the booking goes on", async ({ page }) => {
  let owes = ['emergency2', 'instagram'];
  const { of } = await open(page, '', {
    customer_fix_fields: () => json(owes),
    customer_fix_save: () => { owes = []; return json([]); },
    community_member: () => json(false),
    customer_emergency: () => json([{ ...EM_ROW, emergency2_name: 'Omar Alharbi', emergency2_phone: '+966559998877', emergency2_relation: 'friend' }]),
  });
  await code(page);
  await signIn(page);
  await expect(page.locator('#s-details')).toBeVisible();
  await expect(page.locator('#xem2-box')).toBeVisible();
  await expect(page.locator('#xem2-none')).toHaveText("I don't have one");
  await expect(page.locator('#ig-none')).toBeVisible();
  await page.click('#xem2-none');
  await expect(page.locator('#xem2-box')).toBeHidden();
  await page.fill('#ig', '');
  await page.click('#ig-none');
  await page.click('#d-next');
  await expect(page.locator('#s-book')).toBeVisible();
  expect(of('customer_fix_save')[0]).toEqual({ p_id: 'c-sara', p_token: 'tok-in', p_values: { none: ['instagram', 'emergency2'] } });
  expect(of('customer_set_emergency2')).toEqual([]);
  expect(of('customer_set_socials')).toEqual([]);
});

test("a Community member's flagged Instagram is not offered I don't have one", async ({ page }) => {
  await open(page, '', { customer_fix_fields: () => json(['instagram']), community_member: () => json(true) });
  await code(page);
  await signIn(page);
  await expect(page.locator('#f-ig')).toBeVisible();
  await expect(page.locator('#ig-none')).toBeHidden();
});

test('family members: up to four in all, each named by the rules a booking takes, and sent without the holder', async ({ page }) => {
  const { of } = await open(page);
  await code(page);
  await signIn(page);
  await expect(page.locator('#s-book')).toBeVisible();
  await expect(page.locator('#ppl-dec')).toBeDisabled();
  for (let i = 0; i < 3; i++) await page.click('#ppl-inc');
  await expect(page.locator('#ppl-n')).toHaveText('4');
  await expect(page.locator('#ppl-inc')).toBeDisabled();
  await expect(page.locator('#people .person')).toHaveCount(4);
  await page.click('#ppl-dec');
  await expect(page.locator('#people input[data-k]')).toHaveCount(2);
  await page.click('#waiver .tick-box');
  await page.click('#book');
  await expect(page.locator('#f-pn-0 .err')).toHaveText('Enter their name');
  await page.fill('#pn-0', 'L');
  await page.fill('#pn-1', 'Omar 2');
  await page.click('#book');
  await expect(page.locator('#f-pn-0 .err')).toHaveText('Use letters and spaces only, with at least two letters in each part of the name.');
  await expect(page.locator('#f-pn-1 .err')).toHaveText('Use letters and spaces only, with at least two letters in each part of the name.');
  await page.fill('#pn-0', 'lina alharbi');
  await page.fill('#pn-1', 'Omar-Alharbi'); // a dash becomes a space as it is typed
  await expect(page.locator('#pn-1')).toHaveValue('Omar Alharbi');
  await expect(page.locator('#review')).toContainText('Lina Alharbi');
  await page.click('#book');
  await expect(page.locator('#done-title')).toHaveText('Your request is in');
  expect(of('farm_book').map((b) => b.p_family)).toEqual([['Lina Alharbi', 'Omar Alharbi']]);
  await expect(page.locator('#done-sum')).toContainText('Omar Alharbi');
});

test('an account that already holds two places: they are listed, and only family members are added, two at most', async ({ page }) => {
  const { of } = await open(page, '', { farm_night: nightFor({}, ['Sara Alharbi', 'Lina Alharbi']) });
  await code(page);
  await signIn(page);
  await expect(page.locator('#s-book')).toBeVisible();
  await expect(page.locator('#held li')).toHaveText(['Sara Alharbi', 'Lina Alharbi']);
  await expect(page.locator('#people-label')).toHaveText('Family members to add');
  await expect(page.locator('#pn-you')).toHaveCount(0);
  await page.click('#ppl-inc');
  await expect(page.locator('#ppl-n')).toHaveText('2');
  await expect(page.locator('#ppl-inc')).toBeDisabled();
  await page.fill('#pn-0', 'Omar Alharbi');
  await page.fill('#pn-1', 'Huda Alharbi');
  await send(page);
  await expect(page.locator('#done-title')).toBeVisible();
  expect(of('farm_book').map((b) => b.p_family)).toEqual([['Omar Alharbi', 'Huda Alharbi']]);
});

test('an account that already holds four places: nothing more to add, and its booking is one press away', async ({ page }) => {
  await open(page, '', { farm_night: nightFor({}, ['Sara Alharbi', 'Lina Alharbi', 'Omar Alharbi', 'Huda Alharbi']) });
  await code(page);
  await signIn(page);
  await expect(page.locator('#b-notice .notice-h')).toHaveText('Your booking already has four people, the most one account can bring.');
  await expect(page.locator('#b-open')).toBeVisible();
  await expect(page.locator('#book')).toBeDisabled();
  await expect(page.locator('#f-people')).toBeHidden();
  await page.click('#b-open');
  await page.waitForURL(BOOKING + '?signin=' + HANDOFF + '&tab=bookings&lang=en');
});

for (const [error, check] of [
  ['room', async (page: Page) => expect(page.locator('#f-people .err')).toHaveText('There are not enough places left for everyone. Try with fewer people.')],
  ['full', async (page: Page) => expect(page.locator('#b-notice .notice-h')).toHaveText('The Farmhouse Night is fully booked.')],
  ['session', async (page: Page) => expect(page.locator('#b-notice .notice-h')).toHaveText('Bookings for the Farmhouse Night are closed.')],
  ['waiver', async (page: Page) => expect(page.locator('#banner')).toContainText('The waiver has changed. Reload this page to read the new one.')],
  ['fix', async (page: Page) => { await expect(page.locator('#banner')).toContainText('Your account still needs a few details before it can book.'); await expect(page.locator('.step:not([hidden])')).toHaveCount(1); }],
  ['throttled', async (page: Page) => expect(page.locator('#banner')).toContainText(/Too many|attempts|tries/i)],
  ['signin', async (page: Page) => { await expect(page.locator('#banner')).toContainText('You were signed out. Sign in again to book.'); await expect(page.locator('#p-signin')).toBeVisible(); }],
  ['code', async (page: Page) => { await expect(page.locator('#v-landing')).toBeVisible(); await expect(page.locator('#f-code .err')).toHaveText("That code doesn't work. Check the code you were given."); }],
  ['name', async (page: Page) => expect(page.locator('#f-pn-0 .err')).toHaveText('Use letters and spaces only, with at least two letters in each part of the name.')],
] as const) {
  test(`farm_book's "${error}" is answered in its own words`, async ({ page }) => {
    await open(page, '', { farm_book: () => json({ ok: false, error, name: 'Lina Alharbi' }) });
    await code(page);
    await signIn(page);
    await page.click('#ppl-inc');
    await page.fill('#pn-0', 'Lina Alharbi');
    await send(page);
    await check(page);
  });
}

test('farm_book\'s "cap": the night is read again and the four already held are said', async ({ page }) => {
  let held: string[] = [];
  await open(page, '', {
    farm_night: (b) => nightFor({}, held)(b),
    farm_book: () => { held = ['Sara Alharbi', 'A One', 'B Two', 'C Three']; return json({ ok: false, error: 'cap', held: 4 }); },
  });
  await code(page);
  await signIn(page);
  await send(page);
  await expect(page.locator('#b-notice .notice-h')).toHaveText('Your booking already has four people, the most one account can bring.');
});

test('the farm night\'s own waiver: its title opens it, and the box must be ticked', async ({ page }) => {
  await open(page);
  await code(page);
  await signIn(page);
  await expect(page.locator('#wv-open')).toHaveText('Farm House Night waiver');
  await expect(page.locator('#waiver-lbl')).toContainText('I have read the waiver and agree for myself and on behalf of everyone on this booking');
  await page.click('#book');
  await expect(page.locator('#f-waiver .err')).toHaveText('Tick the box to accept the waiver');
  await page.click('#wv-open');
  await expect(page.locator('#wv')).toBeVisible();
  await expect(page.locator('#wv-body')).toContainText('animals that can bite, kick or scratch');
  const box = await page.locator('#wv .modal-box').boundingBox();
  const vp = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - vp.width / 2)).toBeLessThan(2); // centred (the owner's rule)
  await page.keyboard.press('Escape');
  await expect(page.locator('#wv')).toBeHidden();
});

test('in Arabic the page reads right to left, the night in its Arabic names, the waiver its own', async ({ page }) => {
  await open(page, '?lang=ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#title')).toHaveText('ليلة فارم هاوس');
  await code(page);
  await page.click('#back-land');
  await expect(page.locator('#facts')).toContainText('فارم هاوس، ذهبان');
  await expect(page.locator('#facts')).toContainText('الوصول');
  await expect(page.locator('#facts')).toContainText('العشاء');
  await page.click('#go');
  await signIn(page);
  await expect(page.locator('#wv-open')).toHaveText('إقرار ليلة المزرعة');
  await expect(page.locator('#st-title')).toHaveText('من سيحضر');
  await flipLang(page);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#st-title')).toHaveText('Who is coming');
});

test('in Urdu too the page reads right to left, in its own words', async ({ page }) => {
  await open(page, '?lang=ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#title')).toHaveText('فارم ہاؤس نائٹ');
  await expect(page.locator('#f-code label')).toHaveText('بکنگ کوڈ');
});

test('at 320px nothing runs off the side, the landing or the booking step', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await open(page);
  const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(await wide()).toBeLessThanOrEqual(0);
  await code(page);
  await signIn(page);
  for (let i = 0; i < 3; i++) await page.click('#ppl-inc');
  await expect(page.locator('#people .person')).toHaveCount(4);
  expect(await wide()).toBeLessThanOrEqual(0);
});

test('a forgotten password goes to the booking app, and the code waits for the way back signed in', async ({ page }) => {
  const { of } = await open(page);
  await code(page);
  await page.click('#ask-yes');
  await expect(page.locator('#si-other')).toHaveAttribute('href', BOOKING + '?handoff=farmhouse&lang=en&auth=forgot');
  await page.evaluate(() => document.getElementById('si-other')!.addEventListener('click', (e) => e.preventDefault())); // stay to read this tab's storage
  await page.click('#si-other');
  expect(await page.evaluate(() => sessionStorage.getItem('mm-farmhouse-code'))).toBe(CODE);
  expect(of('farm_night')).toHaveLength(1);
});

test('handed back signed in (?code=) with the code kept: the code is read again and on to who is coming', async ({ page }) => {
  await page.addInitScript((c) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('mm-farmhouse-code', c); sessionStorage.setItem('seeded', '1'); } }, CODE);
  const { of } = await open(page, '?code=' + 'ab'.repeat(24));
  await expect(page.locator('#s-book')).toBeVisible();
  expect(of('customer_handoff_redeem')).toHaveLength(1);
  expect(of('farm_night')).toEqual([{ p_code: CODE, p_id: 'c-sara', p_token: 'tok-handed' }, { p_code: CODE, p_id: 'c-sara', p_token: 'tok-handed' }]);
  await expect(page.locator('#pn-you')).toHaveValue('Sara Alharbi');
});
