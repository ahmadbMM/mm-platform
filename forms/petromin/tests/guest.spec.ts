import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { json, pickCompany, toCheck, stubAccount, guestSignIn, guestCreate, guestBook, GUEST } from './flow';
import { setLang } from './lang';

// Petromin's invited guests on the Petromin page (the owner, 2026-11-13: guests "create an account and go through the
// whole process" on this page, and "for invitees ask them from which company are they"): a MicroMobility account,
// signed into or made here, then the company they are from, the night and the bike. The booking is the account's own,
// with an I- number, its own code for the desk and the fare paid there.
const S1 = { id: '2099-02-08-pw', title: "Petromin's Circuit Night", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00', collect: '18:45', place: null };
const S2 = { id: '2099-02-15-pw', title: "Petromin's Wednesdays", start: '2099-02-15T19:00:00+03:00', end: '2099-02-15T21:00:00+03:00', collect: '18:45', place: null };
const BOOKED = (o: Record<string, unknown> = {}) => ({ ok: true, resubmitted: false, booking_no: 'I-003', invite_no: 'I-003', ref: 'MMC-41-abcdef', status: 'waiting', name: GUEST.name, phone: GUEST.phone, type: 'Hybrid', company: 'Aramco Trading', price: 75, session: S1, ...o });
const SITE_NOTICE = /export const PRIVACY_VERSION = "(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(resolve(__dirname, '../../../apps/web/src/content/privacy-notice.ts'), 'utf8'))![1];
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
async function axe(page: Page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const w = window as unknown as { axe: { run(d: Element, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
    const root = document.querySelector('.mmf-petromin') || document.body;
    const r = await w.axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} x${v.nodes.length}`);
  });
}
async function nights(page: Page, list: object[] = [S1, S2]) { await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json(list))); }
function book(page: Page, answer: (body: Record<string, unknown>, n: number) => unknown) {
  const sent: Record<string, unknown>[] = [];
  return page.route('**/rest/v1/rpc/petromin_guest_book', (r) => { sent.push(r.request().postDataJSON()); return r.fulfill(json(answer(sent[sent.length - 1], sent.length))); }).then(() => sent);
}

test('@webkit a new guest makes an account on the page, as the booking site makes one, then books with it', async ({ page }) => {
  await nights(page);
  const acct = await stubAccount(page);
  const sent = await book(page, () => BOOKED());
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('/petromin?lang=en');
  await pickCompany(page, 'Guest');
  await expect(page.locator('#form .title')).toHaveText('Petromin Ride Night: Invited Guests');
  await guestCreate(page);
  // The calls, in the booking site's order: is the email taken, is the mobile, the account, its consents, its contact.
  expect(acct.calls.map((c) => c[0]).slice(0, 5)).toEqual(['customer_exists', 'customer_exists', 'customer_signup', 'customer_consents', 'customer_set_emergency']);
  expect(acct.of('customer_exists')).toEqual([{ p_email: GUEST.email, p_phone: '' }, { p_email: '', p_phone: '+966512345678' }]);
  const made = acct.of('customer_signup')[0];
  expect(made).toEqual({ p_id: made.p_id, p_name: 'Sara Alharbi', p_email: GUEST.email, p_phone: '+966512345678', p_pwd: 'ridewithme9', p_height: 170, p_type_preference: 'Any', p_gender: 'female' });
  expect(String(made.p_id)).toMatch(/^[a-z0-9]{10,24}$/);
  // The Privacy Notice a new account confirms is the website's own, at its version.
  expect(acct.of('customer_consents')[0]).toEqual({ p_id: made.p_id, p_token: GUEST.token, p_privacy: SITE_NOTICE, p_ride_news: false });
  expect(acct.of('customer_set_emergency')[0]).toEqual({ p_id: made.p_id, p_token: GUEST.token, p_name: 'Omar Alharbi', p_phone: '+966598765432', p_relation: 'sibling' });
  await expect(page.locator('#notice')).toHaveText('Your account has been created');
  await expect(page.locator('#ac-who')).toContainText('Booking as Sara Alharbi');
  // Signed in: the company they are from is asked, and required.
  await page.click('#next');
  await expect(page.locator('#f-ac-company .err')).toHaveText('Enter your company');
  await expect(page.locator('.step[data-pane="account"]')).toBeVisible();
  await page.fill('#ac-company', 'Aramco Trading');
  await page.click('#next');
  // The night is named by its day and time alone, then the bike: Hybrid or Mountain, no height (the account's).
  await expect(page.locator('.step[data-pane="session"]')).toBeVisible();
  await expect(page.locator('#sessions .session-date').first()).not.toContainText(/Circuit Night|Wednesdays/);
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await expect(page.locator('.step[data-pane="bike"] .step-title')).toHaveText('Bike type');
  await expect(page.locator('#f-height')).toBeHidden();
  await expect(page.locator('#f-riders')).toBeHidden();
  await expect(page.locator('#types .tile:visible')).toHaveText(['Hybrid', 'Mountain']);
  await page.click('#types .tile[data-v="Hybrid"]');
  await toCheck(page);
  await expect(page.locator('#review .rv')).toHaveCount(3);
  await expect(page.locator('#review')).toContainText('Sara Alharbi');
  await expect(page.locator('#review')).toContainText('Aramco Trading');
  await expect(page.locator('#f-privacy')).toBeHidden(); // the notice is the account's, confirmed when it was made
  await page.click('#submit');
  await expect(page.locator('#f-waiver .err')).toBeVisible();
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  // The booking: the account's, with no name, mobile or height sent (they are the account's).
  expect(sent).toEqual([{ p_id: made.p_id, p_token: GUEST.token, p_session_id: S1.id, p_type: 'Hybrid', p_company: 'Aramco Trading', p_waiver: '2026-10-v3' }]);
  await expect(page.locator('#chip-booking-value')).toHaveText('I-003');
  await expect(page.locator('#qr canvas')).toHaveAttribute('data-code', 'MMC-41-abcdef'); // the booking's own code, which the desk scans into check-in
  await expect(page.locator('#tk-name')).toHaveText('Sara Alharbi');
  await expect(page.locator('#tk-type-value')).toHaveText('Hybrid');
  await expect(page.locator('#chip-company-value')).toHaveText('Aramco Trading');
  await expect(page.locator('#tk-price-value')).toHaveText(/75/);
  await expect(page.locator('#tk-price-value .sr')).toHaveText('SAR');
  await expect(page.locator('#chip')).toBeHidden(); // no badge
  await expect(page.locator('#tk-status')).toBeHidden();
  await expect(page.locator('#edit')).toBeVisible();
  // The session never reaches the phone's storage, and no password stays in a box.
  const kept = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
  expect(kept).not.toContain(GUEST.token);
  expect(kept).not.toContain('ridewithme9');
  expect(await page.locator('#ac-pwd').inputValue()).toBe('');
  expect(errs).toEqual([]);
});

test('a guest with an account signs in: the company comes from the account, and the booking is made', async ({ page }) => {
  await nights(page);
  const acct = await stubAccount(page, { workplace: 'Red Sea Global' });
  const sent = await book(page, (b) => BOOKED({ company: b.p_company, type: b.p_type, session: S2 }));
  await page.goto('/petromin?lang=en');
  await pickCompany(page, 'Guest');
  await guestSignIn(page);
  expect(acct.of('customer_login')[0]).toEqual({ p_identifier: GUEST.email, p_pwd: 'ridewithme9' });
  await expect(page.locator('#ac-company')).toHaveValue('Red Sea Global');
  await expect(page.locator('#ac-who')).toHaveText(`Booking as ${GUEST.name} · ${GUEST.email}`);
  for (const id of ['f-ac-xheight', 'xem-block', 'f-ac-nat', 'f-ac-birth', 'ac-blocked']) await expect(page.locator(`#${id}`), id).toBeHidden(); // nothing owed
  await page.click('#next');
  await page.locator('#sessions .session').nth(1).click();
  await page.click('#next');
  await page.click('#types .tile[data-v="Mountain"]');
  await toCheck(page);
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#chip-booking-value')).toHaveText('I-003');
  expect(sent).toEqual([{ p_id: GUEST.id, p_token: GUEST.token, p_session_id: S2.id, p_type: 'Mountain', p_company: 'Red Sea Global', p_waiver: '2026-10-v3' }]);
  await expect(page.locator('#chip-company-value')).toHaveText('Red Sea Global');
  // Register another forgets the account: the next person signs in for themselves.
  await page.click('#another');
  await pickCompany(page, 'Guest');
  await expect(page.locator('#ac-ask')).toBeVisible();
  await expect(page.locator('#ac-ident')).toHaveValue('');
});

test('sign-in says what is wrong: nothing typed, the wrong details, too many tries, a temporary password', async ({ page }) => {
  await nights(page);
  let answer: { status: number; body: unknown } = { status: 200, body: [] };
  await page.route('**/rest/v1/rpc/customer_login', (r) => r.fulfill(json(answer.body, answer.status)));
  await page.route('**/rest/v1/rpc/customer_pwd_state', (r) => r.fulfill(json(true)));
  await page.goto('/petromin?lang=en');
  await pickCompany(page, 'Guest');
  await page.click('#ac-yes');
  await page.click('#ac-signin-btn');
  await expect(page.locator('#f-ac-ident .err')).toHaveText('Enter an email or a phone number.');
  await expect(page.locator('#f-ac-spwd .err')).toHaveText('Enter your password.');
  await page.fill('#ac-ident', GUEST.email); await page.fill('#ac-spwd', 'not-the-one');
  await page.locator('#ac-spwd').press('Enter'); // Enter in the box is its panel's button
  await expect(page.locator('#f-ac-spwd .err')).toHaveText('Those sign-in details aren’t right. Try again.');
  await page.fill('#ac-ident', '512345000');
  answer = { status: 400, body: { code: 'P0001', message: 'LOCKED' } };
  await page.click('#ac-signin-btn');
  await expect(page.locator('#f-ac-spwd .err')).toHaveText('Too many failed attempts. Wait about 15 minutes and try again, or reset your password.');
  // A password staff issued is changed in the booking app first.
  answer = { status: 200, body: [{ id: GUEST.id, name: GUEST.name, email: GUEST.email, phone: GUEST.phone, session_token: GUEST.token }] };
  await page.click('#ac-signin-btn');
  await expect(page.locator('#ac-temp')).toBeVisible();
  await expect(page.locator('#ac-temp a')).toHaveAttribute('href', /^https:\/\/[a-z.-]+\/$/);
  await expect(page.locator('#ac-details')).toBeHidden();
  // Back from the panel is the question again, not the first step.
  await page.click('#back');
  await expect(page.locator('#ac-ask')).toBeVisible();
  await page.click('#back');
  await expect(page.locator('.step[data-step="1"]')).toBeVisible();
});

test('creating an account is checked as the booking site checks it', async ({ page }) => {
  await nights(page);
  const acct = await stubAccount(page, { exists: 'phone' });
  await page.goto('/petromin?lang=en');
  await pickCompany(page, 'Guest');
  await page.click('#ac-no');
  await page.click('#ac-create-btn'); // nothing typed: every box says what it wants
  for (const [id, msg] of [['f-ac-name', 'Enter your first and last name'], ['f-ac-gender', 'Choose your gender'], ['f-ac-email', 'Enter your email address'], ['f-ac-phone', 'Enter your mobile number'],
    ['f-ac-pwd', 'Use at least 8 characters.'], ['f-ac-height', 'Enter your height in cm (100 to 250)'], ['f-em-name', 'Enter your contact’s name.'], ['f-ac-ack', 'Please confirm you’ve read the Privacy Notice.']]) {
    await expect(page.locator(`#${id} .err`), id).toHaveText(msg);
  }
  expect(acct.of('customer_signup')).toHaveLength(0);
  // A name: letters only (a digit never lands, a dash is a space), first and last in full, a real one.
  await page.locator('#ac-first').pressSequentially('Sara7');
  await expect(page.locator('#ac-first')).toHaveValue('Sara');
  await page.fill('#ac-last', 'A');
  await page.click('#ac-create-btn');
  await expect(page.locator('#f-ac-name .err')).toHaveText('Write your first and last name in full, not initials');
  await page.fill('#ac-last', 'Guest');
  await page.click('#ac-create-btn');
  await expect(page.locator('#f-ac-name .err')).toHaveText('Please enter your real name');
  await page.fill('#ac-last', 'Al-Harbi');
  await page.locator('#ac-last').blur();
  await page.click('#ac-genders .tile[data-v="female"]');
  // An email with a misspelt provider is offered as it was meant.
  await page.fill('#ac-email', 'sara@gmial.com');
  await page.click('#ac-create-btn');
  await expect(page.locator('#f-ac-email .err')).toHaveText('Did you mean sara@gmail.com?');
  await page.click('#ac-email-fix');
  await expect(page.locator('#ac-email')).toHaveValue('sara@gmail.com');
  // A mobile of another country by its own rules; a number with its code moves the picker.
  await page.fill('#ac-phone', '+971 50 123 4567');
  await expect(page.locator('#ac-cc-code')).toHaveText('+971');
  await page.fill('#ac-phone', '12345');
  await page.click('#ac-create-btn');
  await expect(page.locator('#f-ac-phone .err')).toHaveText('This is not a mobile number for +971. Please check it.');
  await page.fill('#ac-phone', '501234567');
  // Passwords: eight or more, typed the same twice.
  await page.fill('#ac-pwd', 'short'); await page.click('#ac-create-btn');
  await expect(page.locator('#f-ac-pwd .err')).toHaveText('Use at least 8 characters.');
  await page.fill('#ac-pwd', 'ridewithme9'); await page.fill('#ac-pwd2', 'ridewithme8'); await page.click('#ac-create-btn');
  await expect(page.locator('#f-ac-pwd2 .err')).toHaveText('Passwords do not match.');
  await page.fill('#ac-pwd2', 'ridewithme9');
  await page.fill('#ac-height', '99'); await page.click('#ac-create-btn');
  await expect(page.locator('#f-ac-height .err')).toHaveText('Enter your height in cm (100 to 250)');
  await page.fill('#ac-height', '170');
  // The emergency contact: a name, a number that is not the rider's own, how they are related.
  await page.fill('#em-name', 'Omar Alharbi');
  await page.locator('#em-cc').selectOption({ value: 'AE+971' });
  await page.fill('#em-phone', '501234567');
  await page.click('#ac-create-btn');
  await expect(page.locator('#f-em-phone .err')).toHaveText('Your contact’s number can’t be your own.');
  await page.fill('#em-phone', '502223334');
  await page.click('#ac-create-btn');
  await expect(page.locator('#f-em-rel .err')).toHaveText('Choose how they are related to you.');
  await page.selectOption('#em-rel', 'friend');
  await page.click('#ac-create-btn');
  await expect(page.locator('#f-ac-ack .err')).toBeVisible();
  await page.check('#ac-ack'); await page.check('#ac-news');
  // The mobile already has an account: said on its box, and no account is made.
  await page.click('#ac-create-btn');
  await expect(page.locator('#f-ac-phone .err')).toHaveText('An account with this mobile number already exists. Sign in to book with it.');
  expect(acct.of('customer_exists')).toEqual([{ p_email: 'sara@gmail.com', p_phone: '' }, { p_email: '', p_phone: '+971501234567' }]);
  expect(acct.of('customer_signup')).toHaveLength(0);
  // The emergency contact's relations and the country list are the booking site's: Saudi Arabia first and again in its place.
  expect(await page.locator('#em-rel option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).toEqual(['', 'spouse', 'parent', 'sibling', 'child', 'relative', 'friend', 'colleague', 'other']);
  const codes = await page.locator('#ac-cc option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(codes[0]).toBe('SA+966');
  expect(codes.filter((v) => v === 'SA+966')).toHaveLength(2);
  expect(codes.length).toBeGreaterThan(150);
  expect(codes.some((v) => /^IL\+/.test(v))).toBe(false);
});

test('an account that owes an answer is asked it here: an emergency contact, a nationality, a date of birth, a height', async ({ page }) => {
  await nights(page);
  const acct = await stubAccount(page, { owes: ['emergency', 'nationality', 'birth_date'], emergency: false, profile: { height: null } });
  await book(page, () => BOOKED());
  await page.goto('/petromin?lang=en');
  await pickCompany(page, 'Guest');
  await guestSignIn(page);
  for (const id of ['f-ac-xheight', 'xem-block', 'f-ac-nat', 'f-ac-birth']) await expect(page.locator(`#${id}`), id).toBeVisible();
  await expect(page.locator('#ac-blocked')).toBeHidden();
  await page.fill('#ac-company', 'Aramco Trading');
  await page.click('#next'); // nothing answered
  for (const [id, msg] of [['f-ac-xheight', 'Enter your height in cm (100 to 250)'], ['f-xem-name', 'Enter your contact’s name.'], ['f-ac-nat', 'Choose your nationality'], ['f-ac-birth', 'Choose your date of birth']]) {
    await expect(page.locator(`#${id} .err`), id).toHaveText(msg);
  }
  await expect(page.locator('.step[data-pane="account"]')).toBeVisible();
  await page.fill('#ac-xheight', '172');
  await page.fill('#xem-name', 'Omar Alharbi'); await page.fill('#xem-phone', '598765432'); await page.selectOption('#xem-rel', 'parent');
  // Saudi Arabia first and again in its alphabetical place.
  const nats = await page.locator('#ac-nat option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(nats.slice(0, 2)).toEqual(['', 'Saudi Arabia']);
  expect(nats.filter((v) => v === 'Saudi Arabia')).toHaveLength(2);
  expect(nats).not.toContain('Israel');
  await page.selectOption('#ac-nat', { index: 1 });
  await page.selectOption('#ac-birth-y', '1990'); await page.selectOption('#ac-birth-m', '5'); await page.selectOption('#ac-birth-d', '17');
  await page.click('#next');
  await expect(page.locator('.step[data-pane="session"]')).toBeVisible();
  expect(acct.of('customer_fix_save')[0]).toEqual({ p_id: GUEST.id, p_token: GUEST.token, p_values: { birth_date: '1990-05-17', nationality: 'Saudi Arabia', emergency: { name: 'Omar Alharbi', phone: '+966598765432', relation: 'parent' } } });
  expect(acct.of('customer_set_emergency')[0]).toEqual({ p_id: GUEST.id, p_token: GUEST.token, p_name: 'Omar Alharbi', p_phone: '+966598765432', p_relation: 'parent' });
  expect(acct.of('customer_set_birth_nat')[0]).toEqual({ p_id: GUEST.id, p_token: GUEST.token, p_birth_date: '1990-05-17', p_nationality: 'Saudi Arabia' });
  expect(acct.of('customer_set_height')[0]).toEqual({ p_id: GUEST.id, p_token: GUEST.token, p_height: 172 });
});

test('what this page cannot ask is finished in the booking app: the step says so and does not go on', async ({ page }) => {
  await nights(page);
  await stubAccount(page, { owes: ['email', 'instagram'] });
  await page.goto('/petromin?lang=en');
  await pickCompany(page, 'Guest');
  await guestSignIn(page);
  await expect(page.locator('#ac-blocked')).toBeVisible();
  await expect(page.locator('#ac-blocked')).toContainText('Your account needs a few more details');
  await expect(page.locator('#ac-blocked a')).toHaveText('Finish on the booking site');
  await expect(page.locator('#ac-blocked a')).toHaveAttribute('href', /^https:\/\/[a-z.-]+\/$/);
  await page.fill('#ac-company', 'Aramco Trading');
  await page.click('#next');
  await expect(page.locator('.step[data-pane="account"]')).toBeVisible();
  await expect(page.locator('#ac-blocked')).toBeVisible();
});

test('the booking\'s refusals are said where they belong: a night already booked, a bike closed, a session signed out, an answer owed', async ({ page }) => {
  await nights(page);
  await stubAccount(page);
  const refusals: unknown[] = [{ ok: false, error: 'booked' }, { ok: false, error: 'type_closed' }, { ok: false, error: 'company' }, { ok: false, error: 'fix', fields: ['nationality'] }, { ok: false, error: 'signin' }];
  const sent = await book(page, (_b, n) => refusals[n - 1] ?? BOOKED({ status: 'waitlist' }));
  await page.goto('/petromin?lang=en');
  await guestBook(page);
  // This account already rides that night on a booking of its own: said on the night, and another can be picked.
  await expect(page.locator('.step[data-pane="session"]')).toBeVisible();
  await expect(page.locator('#f-session .err')).toHaveText('You already have a booking on this ride.');
  await page.locator('#sessions .session').nth(1).click();
  await page.click('#next'); // straight back to the summary
  await expect(page.locator('.step[data-pane="check"]')).toBeVisible();
  await page.check('#waiver'); await page.click('#submit');
  await expect(page.locator('.step[data-pane="bike"]')).toBeVisible();
  await expect(page.locator('#f-type .err')).toHaveText('That bike type is closed for this ride. Choose another.');
  await page.click('#types .tile[data-v="Mountain"]');
  await page.click('#next');
  await page.check('#waiver'); await page.click('#submit');
  await expect(page.locator('.step[data-pane="account"]')).toBeVisible();
  await expect(page.locator('#f-ac-company .err')).toHaveText('Enter your company');
  await page.click('#next');
  await page.check('#waiver'); await page.click('#submit');
  // The account owes an answer now (the nationality, from its second booking on): the account step says so.
  await expect(page.locator('.step[data-pane="account"]')).toBeVisible();
  await expect(page.locator('#banner')).toContainText('Your account still needs a few details before it can book.');
  await page.click('#next');
  await page.check('#waiver'); await page.click('#submit');
  // The session is no longer good: sign in again, then on.
  await expect(page.locator('#ac-signin')).toBeVisible();
  await expect(page.locator('#banner')).toContainText('You were signed out. Sign in again to book.');
  await page.fill('#ac-ident', GUEST.email); await page.fill('#ac-spwd', 'ridewithme9');
  await page.click('#ac-signin-btn');
  await expect(page.locator('#ac-details')).toBeVisible();
  await page.click('#next');
  await expect(page.locator('.step[data-pane="check"]')).toBeVisible();
  await page.check('#waiver'); await page.click('#submit');
  // A full night: the booking waits, said as a status and never as a place in a line.
  await expect(page.locator('#success .title')).toHaveText('You\'re on the waitlist');
  await expect(page.locator('#tk-status')).toHaveText('On the waitlist');
  await expect(page.locator('#result')).toBeHidden();
  expect(await page.locator('#success').innerText()).not.toMatch(/#\s?\d|\bplace \d|position/i);
  expect(sent).toHaveLength(6);
  expect(sent[1]).toMatchObject({ p_session_id: S2.id, p_type: 'Hybrid' });
  expect(sent[2]).toMatchObject({ p_session_id: S2.id, p_type: 'Mountain' });
});

test('@webkit Edit after a reload asks for the account again, then saves the change as that booking\'s', async ({ page }) => {
  const SAVED = { kind: 'guest', name: GUEST.name, phone: GUEST.phone, company: 'Aramco Trading', type: 'Hybrid', status: 'waiting', price: 75, ref: 'MMC-41-abcdef', account: true, session: S1, bookingNo: 'I-003', riders: [], submittedAt: '2099-02-01T10:00:00Z' };
  await page.addInitScript((s) => { if (!localStorage.getItem('mm-petromin-registration')) localStorage.setItem('mm-petromin-registration', JSON.stringify(s)); }, SAVED);
  await nights(page);
  await stubAccount(page);
  const looked: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => { looked.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, booking_no: 'I-003', invite_no: 'I-003', ref: 'MMC-41-abcdef', company: 'Aramco Trading', account: true, name: GUEST.name, phone: GUEST.phone, type: 'Hybrid', status: 'waiting', checked_in: false, price: 75, paid: false, session: S1, more: [], riders: [] })); });
  const sent = await book(page, (b) => BOOKED({ type: b.p_type, booking_no: 'I-001', invite_no: 'I-001', session: S2 }));
  await page.goto('/petromin?lang=en');
  await expect(page.locator('#chip-booking-value')).toHaveText('I-003');
  await page.click('#edit');
  expect(looked[0]).toEqual({ p_invite_no: 'I-003', p_phone: GUEST.phone, p_session_id: S1.id });
  // No account in memory after the reload: sign in first.
  await expect(page.locator('#ac-signin')).toBeVisible();
  await expect(page.locator('#form .title')).toHaveText('Edit your booking');
  await page.fill('#ac-ident', GUEST.email); await page.fill('#ac-spwd', 'ridewithme9');
  await page.click('#ac-signin-btn');
  await expect(page.locator('#ac-company')).toHaveValue('Aramco Trading'); // the booking's own
  await page.click('#next');
  await expect(page.locator('.step[data-pane="check"]')).toBeVisible();
  // Another night and another bike.
  await page.click('#review .rv-change[data-go="3"]');
  await page.locator('#sessions .session').nth(1).click();
  await page.click('#next');
  await page.click('#review .rv-change[data-go="4"]');
  await page.click('#types .tile[data-v="Mountain"]');
  await page.click('#next');
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('.done-note')).toHaveText('Your booking was updated.');
  expect(sent).toEqual([{ p_id: GUEST.id, p_token: GUEST.token, p_session_id: S2.id, p_type: 'Mountain', p_company: 'Aramco Trading', p_waiver: '2026-10-v3', p_from_no: 'I-003', p_from_session: S1.id }]);
  await expect(page.locator('#chip-booking-value')).toHaveText('I-001'); // the other night's own number
});

test('Cancel my booking goes through the guests\' own call, with the number, the mobile and the night', async ({ page }) => {
  const SAVED = { kind: 'guest', name: GUEST.name, phone: GUEST.phone, company: 'Aramco Trading', type: 'Hybrid', status: 'waiting', price: 75, ref: 'MMC-41-abcdef', account: true, session: S1, bookingNo: 'I-003', riders: [], submittedAt: '2099-02-01T10:00:00Z' };
  await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('mm-petromin-registration', JSON.stringify(s)); } }, SAVED);
  await nights(page);
  const sent: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/petromin_invite_cancel', (r) => { sent.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, booking_no: 'I-003', session_id: S1.id })); });
  await page.goto('/petromin?lang=en');
  await page.click('#cancel-booking');
  await expect(page.locator('#ask-text')).toHaveText('Cancel booking I-003? You will lose your place.');
  await page.click('#ask-yes');
  await expect(page.locator('#notice')).toHaveText('Your booking was cancelled.');
  await expect(page.locator('.step[data-step="1"]')).toBeVisible();
  expect(sent).toEqual([{ p_invite_no: 'I-003', p_phone: GUEST.phone, p_session_id: S1.id }]);
  expect(await page.evaluate(() => localStorage.getItem('mm-petromin-registration'))).toBeNull();
});

test('a guest\'s account step and ticket pass an accessibility check, in English and Arabic', async ({ page }) => {
  await nights(page, [S1]);
  const acct = await stubAccount(page, { emergency: false });
  await book(page, () => BOOKED());
  for (const lang of ['en', 'ar']) {
    acct.owe(['emergency', 'nationality', 'birth_date']);
    await page.goto(`/petromin?lang=${lang}`);
    await pickCompany(page, 'Guest');
    expect(await axe(page), `${lang} the question`).toEqual([]);
    await page.click('#ac-no');
    await page.click('#ac-create-btn'); // every message showing
    expect(await axe(page), `${lang} create account with its messages`).toEqual([]);
    await page.click('.ac-to-signin');
    await page.click('#ac-signin-btn');
    expect(await axe(page), `${lang} sign in with its messages`).toEqual([]);
    await page.fill('#ac-ident', GUEST.email); await page.fill('#ac-spwd', 'ridewithme9');
    await page.click('#ac-signin-btn');
    await expect(page.locator('#ac-details')).toBeVisible();
    await page.click('#next'); // what the account owes, unanswered
    expect(await axe(page), `${lang} signed in, with what the account owes`).toEqual([]);
    await page.fill('#ac-company', 'Aramco Trading');
    await page.fill('#xem-name', 'Omar Alharbi'); await page.fill('#xem-phone', '598765432'); await page.selectOption('#xem-rel', 'parent');
    await page.selectOption('#ac-nat', { index: 1 });
    await page.selectOption('#ac-birth-y', '1990'); await page.selectOption('#ac-birth-m', '5'); await page.selectOption('#ac-birth-d', '17');
    await page.click('#next');
    await page.locator('#sessions .session').first().click();
    await page.click('#next');
    await page.click('#types .tile[data-v="Hybrid"]');
    await expect(page.locator('#types .tile[aria-checked="true"]')).toHaveCSS('background-color', 'rgb(26, 25, 25)'); // its colour has settled
    expect(await axe(page), `${lang} the bike`).toEqual([]);
    await toCheck(page);
    expect(await axe(page), `${lang} check and agree`).toEqual([]);
    await page.check('#waiver');
    await page.click('#submit');
    await expect(page.locator('#success')).toBeVisible();
    expect(await axe(page), `${lang} ticket`).toEqual([]);
    await page.evaluate(() => localStorage.clear());
  }
});

test('the account step speaks the page\'s language: its words, its lists and its messages', async ({ page }) => {
  await nights(page);
  await stubAccount(page);
  await page.goto('/petromin?lang=en');
  await pickCompany(page, 'Guest');
  await setLang(page, 'ar');
  await expect(page.locator('#ac-ask-q')).toHaveText('هل لديك حساب في MicroMobility؟');
  await page.click('#ac-no');
  await page.click('#ac-create-btn');
  for (const id of ['f-ac-name', 'f-ac-gender', 'f-ac-email', 'f-ac-phone', 'f-ac-pwd', 'f-ac-height', 'f-em-name', 'f-ac-ack']) {
    await expect(page.locator(`#${id} .err`), id).not.toHaveText(/[A-Za-z]{4,}/); // no English left in a message
  }
  expect((await page.locator('#em-rel option').allTextContents()).join(' ')).not.toMatch(/[A-Za-z]{3,}/);
  await setLang(page, 'ja');
  await expect(page.locator('#ac-create .ac-h')).not.toHaveText('Create account');
  expect((await page.locator('#em-rel option').allTextContents()).join(' ')).not.toMatch(/Spouse|Parent|Friend|Choose/);
});
