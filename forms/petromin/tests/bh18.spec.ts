import { test, expect, type Page } from '@playwright/test';
import { json, pickCompany, register, stubAccount, guestSignIn, GUEST } from './flow';
import { setLang } from './lang';

// The bug hunt of 2026-11-18: an invited guest's Forgot password, the second contact's number, a shared phone (the
// last account's birth date and nationality, Edit on another person's ticket, Cancel), and the review's Change while a
// registration is on its way.
const S1 = { id: '2099-02-08-pw', title: "Petromin's Circuit Night", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00', collect: '18:45', place: null };
const B = { id: 'guest0002', token: 'tok-b', name: 'Basma Second', email: 'basma.second@gmail.com', phone: '+966523456789' };
const BOOKED = (o: Record<string, unknown> = {}) => ({ ok: true, resubmitted: false, booking_no: 'I-003', invite_no: 'I-003', ref: 'MMC-41-abcdef', status: 'waiting', name: GUEST.name, phone: GUEST.phone, type: 'Hybrid', company: 'Aramco Trading', price: 75, session: S1, ...o });
async function nights(page: Page) { await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1]))); }

/** From the account's signed-in panel: the company, the night, the bike, the waiver and Register. */
async function finishGuest(page: Page) {
  await page.fill('#ac-company', 'Aramco Trading');
  await page.click('#next');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#types .tile[data-v="Hybrid"]');
  await page.click('#next');
  await page.check('#waiver');
  await page.click('#submit');
}
async function signInAs(page: Page, ident: string) {
  await page.click('#ac-yes');
  await page.fill('#ac-ident', ident);
  await page.fill('#ac-spwd', 'ridewithme9');
  await page.click('#ac-signin-btn');
  await expect(page.locator('#ac-details')).toBeVisible();
}

test('Forgot password opens the booking site on its reset step, in the page language', async ({ page }) => {
  await nights(page);
  await page.goto('/petromin?lang=en');
  await expect(page.locator('#ac-forgot')).toHaveAttribute('href', /\?handoff=site&auth=forgot&lang=en$/);
  await setLang(page, 'ar');
  await expect(page.locator('#ac-forgot')).toHaveAttribute('href', /\?handoff=site&auth=forgot&lang=ar$/);
});

test('the first contact refused as the second contact\'s number is said on its box, not as a lost connection', async ({ page }) => {
  await nights(page);
  await stubAccount(page, { owes: ['emergency'], emergency: false });
  await page.route('**/rest/v1/rpc/customer_set_emergency', (r) => r.fulfill(json({ code: '22023', message: 'BAD_INPUT', details: 'em_same' }, 400)));
  await page.goto('/petromin?lang=en');
  await pickCompany(page, 'Guest');
  await guestSignIn(page);
  await page.fill('#ac-company', 'Aramco Trading');
  await page.fill('#xem-name', 'Omar Alharbi'); await page.fill('#xem-phone', '598765432'); await page.selectOption('#xem-rel', 'sibling');
  await page.click('#next');
  await expect(page.locator('#f-xem-phone .err')).toHaveText('The two emergency contacts can’t have the same number.');
  await expect(page.locator('#banner')).toBeHidden();
});

test('a shared phone: the next account never gets the last one\'s birth date, nationality or contact', async ({ page }) => {
  await nights(page);
  const profile: Record<string, unknown> = { birth_date: '1990-04-12', nationality: 'Egypt' };
  const o: Parameters<typeof stubAccount>[1] = { profile };
  const acct = await stubAccount(page, o);
  await page.route('**/rest/v1/rpc/petromin_guest_book', (r) => r.fulfill(json(BOOKED())));
  await page.goto('/petromin?lang=en');
  await pickCompany(page, 'Guest');
  await guestSignIn(page);
  await expect(page.locator('#ac-nat')).toHaveValue('Egypt');
  await finishGuest(page);
  await expect(page.locator('#chip-booking-value')).toHaveText('I-003');
  // The next person, an account with no birth date or nationality, owing both.
  await page.click('#another');
  o.login = [{ id: B.id, name: B.name, email: B.email, phone: B.phone, session_token: B.token }];
  Object.assign(profile, { id: B.id, name: B.name, email: B.email, phone: B.phone, birth_date: '', nationality: '' });
  acct.owe(['nationality', 'birth_date']);
  await pickCompany(page, 'Guest');
  await signInAs(page, B.email);
  await expect(page.locator('#f-ac-nat')).toBeVisible();
  await expect(page.locator('#ac-nat')).toHaveValue('');
  for (const id of ['ac-birth-d', 'ac-birth-m', 'ac-birth-y']) await expect(page.locator(`#${id}`), id).toHaveValue('');
});

test('Edit on another person\'s ticket on the phone asks for that ticket\'s own sign-in, and keeps the ticket', async ({ page }) => {
  await nights(page);
  const profile: Record<string, unknown> = {};
  const o: Parameters<typeof stubAccount>[1] = { profile };
  await stubAccount(page, o);
  const sent: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/petromin_guest_book', (r) => {
    const b = r.request().postDataJSON() as Record<string, unknown>; sent.push(b);
    return r.fulfill(json(b.p_id === B.id ? BOOKED({ booking_no: 'I-004', invite_no: 'I-004', name: B.name, phone: B.phone }) : BOOKED()));
  });
  await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => r.fulfill(json({ ok: true, booking_no: 'I-003', invite_no: 'I-003', ref: 'MMC-41-abcdef', company: 'Aramco Trading', account: true, name: GUEST.name, phone: GUEST.phone, type: 'Hybrid', status: 'waiting', checked_in: false, price: 75, paid: false, session: S1, more: [], riders: [] })));
  await page.goto('/petromin?lang=en');
  // A books, then B books on the same phone.
  await pickCompany(page, 'Guest');
  await guestSignIn(page);
  await finishGuest(page);
  await expect(page.locator('#chip-booking-value')).toHaveText('I-003');
  await page.click('#another');
  o.login = [{ id: B.id, name: B.name, email: B.email, phone: B.phone, session_token: B.token }];
  Object.assign(profile, { id: B.id, name: B.name, email: B.email, phone: B.phone });
  await pickCompany(page, 'Guest');
  await signInAs(page, B.email);
  await finishGuest(page);
  await expect(page.locator('#chip-booking-value')).toHaveText('I-004');
  // A's ticket, then Edit: B's account is not A's.
  await page.locator('#others-list .other').click();
  await expect(page.locator('#chip-booking-value')).toHaveText('I-003');
  await page.click('#edit');
  await expect(page.locator('#ac-signin')).toBeVisible();
  await expect(page.locator('#ac-who')).toHaveText('');
  expect(sent.filter((b) => b.p_from_no)).toEqual([]);
});

test('cancelling a guest\'s booking forgets the account: the next person is asked to sign in', async ({ page }) => {
  await nights(page);
  await stubAccount(page);
  await page.route('**/rest/v1/rpc/petromin_guest_book', (r) => r.fulfill(json(BOOKED())));
  await page.route('**/rest/v1/rpc/petromin_invite_cancel', (r) => r.fulfill(json({ ok: true, booking_no: 'I-003', session_id: S1.id })));
  await page.goto('/petromin?lang=en');
  await pickCompany(page, 'Guest');
  await guestSignIn(page);
  await finishGuest(page);
  await expect(page.locator('#chip-booking-value')).toHaveText('I-003');
  await page.click('#cancel-booking');
  await page.click('#ask-yes');
  await expect(page.locator('#notice')).toHaveText('Your booking was cancelled.');
  await pickCompany(page, 'Guest');
  await expect(page.locator('#ac-ask')).toBeVisible();
  await expect(page.locator('#ac-details')).toBeHidden();
  await expect(page.locator('#ac-who')).toHaveText('');
});

test('while a registration is on its way, the review\'s Change cannot be pressed', async ({ page }) => {
  await nights(page);
  let release: () => void = () => {};
  const held = new Promise<void>((res) => { release = res; });
  await page.route('**/rest/v1/rpc/rider_register', async (r) => { await held; return r.fulfill(json({ ok: true, booking_no: 'PM-001', session: S1 })); });
  await page.goto('/petromin?lang=en');
  await register(page);
  await expect(page.locator('#submit')).toBeDisabled();
  for (const b of await page.locator('#review .rv-change').all()) await expect(b).toBeDisabled();
  release();
  await expect(page.locator('#chip-booking-value')).toHaveText('PM-001');
});
