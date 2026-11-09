import { test, expect, type Page } from '@playwright/test';

// micromobility.sa/lockers end to end in a browser, every database call stubbed: the evenings (locker_evenings), the
// cabinet (locker_board), the account (sign-up, sign-in, or handed back signed in with ?code=), the wallet
// (customer_wallet), the reservation (customer_locker_book), the rider's lockers (customer_lockers) and taking one
// back (customer_locker_drop). The days are in 2099 and the clock is fixed on the first of them, so nothing here
// depends on today.
const json = (b: unknown, status = 200) => ({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(b) });
const refuse = (message: string, code = 'P0001', status = 400) => json({ code, message, details: null, hint: null }, status);
type Body = Record<string, unknown>;
type Answers = Partial<Record<string, (body: Body) => ReturnType<typeof json>>>;
const BOOKING = 'https://experiences.micromobility.sa/';
const D1 = '2099-11-14', D2 = '2099-11-17', PM = '2099-11-18';
const NOW = new Date('2099-11-14T14:00:00Z'); // 5 PM in Jeddah on D1: D1 is "Tonight"
const UNITS = Array.from({ length: 18 }, (_, i) => ({ code: String(i + 1), out: i + 1 === 12 }));
const LEFT = { early: 15, late: 16, both: 14, pm: 14, total: 17 };
const NOT_ENDED = { early: false, late: false, both: false, pm: false };
const board = (day: string, o: Body = {}) => ({ day, kind: 'jcc', one: 10, both: 15, left: LEFT, ended: NOT_ENDED, units: UNITS, taken: { e: ['4', '7'], l: ['9'] }, ...o });
const EVENINGS = { one: 10, both: 15, evenings: [{ day: D1, kind: 'jcc' }, { day: D2, kind: 'jcc' }] };
const SARA = { id: 'c-sara', name: 'Sara Alharbi', email: 'sara.alharbi@gmail.com', phone: '+966552468013', session_token: 'tok-in' };
const HANDED = `?code=${'ab'.repeat(24)}`;

async function open(page: Page, qs = '', answers: Answers = {}) {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.clock.setFixedTime(NOW);
  const calls: { fn: string; body: Body }[] = [];
  const base: Answers = {
    locker_evenings: () => json(EVENINGS),
    locker_board: (b) => json(board(String(b.p_day))),
    customer_exists: () => json(false),
    customer_signup: (b) => json([{ id: b.p_id, session_token: 'tok-new' }]),
    customer_consents: () => json({ privacy_version: '2026-11-08', ride_news: false }),
    customer_set_emergency: () => json(true),
    customer_set_emergency2: () => json(true),
    customer_login: () => json([SARA]),
    customer_pwd_state: () => json(false),
    customer_handoff_redeem: () => json([{ id: SARA.id, name: SARA.name, session_token: 'tok-handed' }]),
    customer_wallet: () => json({ balance: 0, rows: [] }),
    customer_lockers: () => json([]),
    customer_locker_book: (b) => json({ ok: true, rentals: (b.p_codes as string[]).map((c, i) => ({ id: `r-${i}`, code: c })), left: LEFT }),
    customer_locker_drop: () => json({ ok: true, left: LEFT }),
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
  await page.goto('/lockers' + qs);
  const of = (fn: string) => calls.filter((c) => c.fn === fn).map((c) => c.body);
  return { errs, of };
}
const door = (page: Page, n: number | string) => page.locator(`#cab-grid .door[data-code="${n}"]`);
async function ready(page: Page) { await expect(door(page, 1)).toBeVisible(); }
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
  await page.fill('#ident', SARA.email);
  await page.fill('#spwd', 'Ride2Work');
  await page.click('#signin');
}

test('anyone sees the cabinet: 18 doors in three columns numbered across the rows, taken and out of service shut, never a name', async ({ page }) => {
  const { errs, of } = await open(page);
  await ready(page);
  await expect(page.locator('#days .pill')).toHaveText(['Tonight', 'Tue 17 Nov']);
  await expect(page.locator('#days .pill[data-v="2099-11-14"]')).toHaveAttribute('aria-checked', 'true');
  // the times, each with its price; the first one open is picked
  await expect(page.locator('#periods .opt b')).toHaveText(['6 PM – 8 PM', '9 PM – 11 PM', '6 PM – 11 PM']);
  await expect(page.locator('#periods .opt[data-v="early"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#periods .opt[data-v="early"]')).toContainText('\u2066⃁ 10\u2069');
  await expect(page.locator('#periods .opt[data-v="both"]')).toContainText('\u2066⃁ 15\u2069');
  const doors = page.locator('#cab-grid .door[data-code]');
  await expect(doors).toHaveCount(18);
  await expect(doors.locator('.num')).toHaveText(Array.from({ length: 18 }, (_, i) => String(i + 1)));
  // numbered across the rows: 1-2-3 on top, left to right; 4 under 1; 16-17-18 at the bottom
  const box = async (n: number) => (await door(page, n).boundingBox())!;
  const [b1, b2, b3, b4, b16, b18] = [await box(1), await box(2), await box(3), await box(4), await box(16), await box(18)];
  expect(Math.abs(b1.y - b2.y)).toBeLessThan(1); expect(Math.abs(b2.y - b3.y)).toBeLessThan(1);
  expect(b1.x).toBeLessThan(b2.x); expect(b2.x).toBeLessThan(b3.x);
  expect(Math.abs(b4.x - b1.x)).toBeLessThan(1); expect(b4.y).toBeGreaterThan(b1.y);
  expect(Math.abs(b16.x - b1.x)).toBeLessThan(1); expect(b16.y).toBeGreaterThan(b4.y);
  expect(Math.abs(b18.x - b3.x)).toBeLessThan(1);
  // taken for 6-8 PM (4, 7) and out of service (12): shut; 9 is taken only later on
  for (const n of [4, 7, 12]) await expect(door(page, n)).toBeDisabled();
  await expect(door(page, 4)).toHaveAttribute('aria-label', 'Locker 4, taken');
  await expect(door(page, 12)).toHaveAttribute('aria-label', 'Locker 12, out of service');
  await expect(door(page, 9)).toBeEnabled();
  await page.click('#periods .opt[data-v="late"]');
  await expect(door(page, 9)).toBeDisabled();
  await expect(door(page, 4)).toBeEnabled();
  await page.click('#periods .opt[data-v="both"]');
  for (const n of [4, 7, 9, 12]) await expect(door(page, n)).toBeDisabled();
  // a number missing leaves its place empty; a code that is not a number follows at the end
  expect(await page.evaluate(() => (window as unknown as { LockersForm: { cells: (u: unknown[]) => unknown[] } }).LockersForm.cells([{ code: '1' }, { code: '2' }, { code: '5' }, { code: 'B1' }])))
    .toEqual(['1', '2', null, null, '5', 'B1']);
  await expect(page.locator('#go')).toBeDisabled();
  expect(of('locker_evenings')).toEqual([{}]);
  expect(of('locker_board')[0]).toEqual({ p_day: D1 });
  expect(await page.locator('main').innerText()).not.toMatch(/Sara|Alharbi/);
  expect(errs).toEqual([]);
});

test('up to three lockers; a tap again puts one back; the sum says the numbers and the price', async ({ page }) => {
  await open(page);
  await ready(page);
  for (const n of [1, 2, 3]) await door(page, n).click();
  for (const n of [1, 2, 3]) await expect(door(page, n)).toHaveAttribute('aria-pressed', 'true');
  await door(page, 5).click();
  await expect(door(page, 5)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#f-cab .err')).toHaveText('Up to 3 lockers per account for each time.');
  await door(page, 2).click();
  await expect(door(page, 2)).toHaveAttribute('aria-pressed', 'false');
  await door(page, 5).click();
  await expect(door(page, 5)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pick-sum')).toHaveText('Lockers 1, 3, 5 · \u2066⃁ 30\u2069');
  await expect(page.locator('#go')).toBeEnabled();
  // another evening starts the cabinet again
  await page.click('#days .pill[data-v="2099-11-17"]');
  await expect(page.locator('#pick-sum')).toBeHidden();
  await expect(page.locator('#go')).toBeDisabled();
});

test("a locker's tag (?locker=L7) picks it on the first time it is free, and the address loses it", async ({ page }) => {
  const { errs } = await open(page, '?locker=L7');
  await ready(page);
  await expect(page.locator('#periods .opt[data-v="late"]')).toHaveAttribute('aria-checked', 'true'); // 6-8 PM has 7 taken
  await expect(door(page, 7)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pick-sum')).toHaveText('Locker 7 · \u2066⃁ 10\u2069');
  expect(page.url()).not.toContain('locker=');
  expect(errs).toEqual([]);
});

test('a tag whose locker is taken all evening picks it on the next evening; 07 reads 7', async ({ page }) => {
  await open(page, '?locker=07', { locker_board: (b) => json(board(String(b.p_day), { taken: b.p_day === D1 ? { e: ['7'], l: ['7'] } : { e: [], l: [] } })) });
  await ready(page);
  await expect(page.locator('#days .pill[data-v="2099-11-17"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#periods .opt[data-v="early"]')).toHaveAttribute('aria-checked', 'true');
  await expect(door(page, 7)).toHaveAttribute('aria-pressed', 'true');
});

test('a time that is over is not offered, and a full one is shut', async ({ page }) => {
  await open(page, '', { locker_board: (b) => json(board(String(b.p_day), { ended: { ...NOT_ENDED, early: true }, left: { ...LEFT, late: 0 } })) });
  await ready(page);
  await expect(page.locator('#periods .opt')).toHaveCount(2);
  await expect(page.locator('#periods .opt[data-v="late"]')).toBeDisabled();
  await expect(page.locator('#periods .opt[data-v="late"]')).toContainText('Full');
  await expect(page.locator('#periods .opt[data-v="both"]')).toHaveAttribute('aria-checked', 'true');
});

test('no evening with lockers, or an evening without them, says so', async ({ page }) => {
  await open(page, '', { locker_evenings: () => json({ one: 10, both: 15, evenings: [] }) });
  await expect(page.locator('#pick-notice')).toContainText('No evening has lockers right now.');
  await expect(page.locator('#f-cab')).toBeHidden();
  await expect(page.locator('#go')).toBeDisabled();
  const p2 = await page.context().newPage();
  await open(p2, '', { locker_board: () => json({ kind: '' }) });
  await expect(p2.locator('#pick-notice')).toContainText('No lockers this evening.');
  await expect(p2.locator('#f-cab')).toBeHidden();
});

test('a new rider: the lockers, the account, the review with the desk chosen (the wallet is short)', async ({ page }) => {
  const { errs, of } = await open(page);
  await ready(page);
  await door(page, 1).click();
  await door(page, 2).click();
  await page.click('#go');
  await signUp(page);
  await expect(page.locator('#s-review')).toBeVisible();
  await expect(page.locator('#acct-made')).toBeVisible();
  await expect(page.locator('#st-title')).toHaveText('Review and pay');
  const review = page.locator('#review');
  await expect(review).toContainText('Lockers1, 2');
  await expect(review).toContainText('Tonight · Saturday 14 November');
  await expect(review).toContainText('6 PM – 8 PM');
  await expect(review).toContainText('\u2066⃁ 20\u2069');
  await expect(page.locator('#pays [data-v="wallet"]')).toBeDisabled();
  await expect(page.locator('#pay-bal')).toHaveText('Balance \u2066⃁ 0\u2069');
  await expect(page.locator('#pays [data-v="desk"]')).toHaveAttribute('aria-checked', 'true');
  const su = of('customer_signup')[0];
  expect(su).toMatchObject({ p_name: 'Sara Al Harbi', p_email: 'sara.alharbi@gmail.com', p_phone: '+966552468013', p_height: 165, p_gender: 'female' });
  expect(of('customer_consents')).toHaveLength(1);
  expect(of('customer_set_emergency')[0]).toMatchObject({ p_name: 'Layla Alharbi', p_phone: '+966551234567', p_relation: 'sibling', p_token: 'tok-new' });
  // the evenings again with the session, so a Petromin night the rider is booked on can appear
  expect(of('locker_evenings')[1]).toEqual({ p_id: su.p_id, p_token: 'tok-new' });
  await page.click('#book');
  await expect(page.locator('#done-title')).toHaveText('Your lockers are reserved');
  await expect(page.locator('#done-sum')).toContainText('Pay at the desk when you collect the key');
  expect(of('customer_locker_book')[0]).toEqual({ p_id: su.p_id, p_token: 'tok-new', p_day: D1, p_period: 'early', p_codes: ['1', '2'], p_pay: 'desk' });
  expect(errs).toEqual([]);
});

test('the wallet: shut when it holds less than the total, open when it holds enough, shut on a Petromin night', async ({ page }) => {
  await open(page, '', {
    customer_wallet: () => json({ balance: 15, rows: [] }),
    locker_evenings: (b) => json(b.p_id ? { ...EVENINGS, evenings: [...EVENINGS.evenings, { day: PM, kind: 'pm' }] } : EVENINGS),
    locker_board: (b) => json(b.p_day === PM ? board(PM, { kind: 'pm', taken: { e: [], l: [] } }) : board(String(b.p_day))),
  });
  await ready(page);
  await expect(page.locator('#days .pill')).toHaveCount(2); // no Petromin night before signing in
  await door(page, 1).click();
  await door(page, 2).click();
  await page.click('#go');
  await signIn(page);
  await expect(page.locator('#s-review')).toBeVisible();
  await expect(page.locator('#pay-bal')).toHaveText('Balance \u2066⃁ 15\u2069');
  await expect(page.locator('#pays [data-v="wallet"]')).toBeDisabled(); // 20 to pay
  await page.click('#back-pick');
  await door(page, 2).click();
  await page.click('#go');
  await expect(page.locator('#pays [data-v="wallet"]')).toBeEnabled(); // 10 to pay
  await page.click('#pays [data-v="wallet"]');
  await expect(page.locator('#pays [data-v="wallet"]')).toHaveAttribute('aria-checked', 'true');
  // the Petromin night the rider is booked on: 7-9 PM only, never from the wallet
  await page.click('#back-pick');
  await expect(page.locator('#days .pill')).toHaveText(['Tonight', 'Tue 17 Nov', 'Wed 18 Nov · Petromin']);
  await page.click(`#days .pill[data-v="${PM}"]`);
  await expect(page.locator('#periods .opt b')).toHaveText(['7 PM – 9 PM']);
  await expect(page.locator('#periods .opt[data-v="pm"]')).toHaveAttribute('aria-checked', 'true');
  await door(page, 3).click();
  await page.click('#go');
  await expect(page.locator('#review')).toContainText('7 PM – 9 PM');
  await expect(page.locator('#pays [data-v="wallet"]')).toBeDisabled();
  await expect(page.locator('#pays [data-v="desk"]')).toHaveAttribute('aria-checked', 'true');
});

test('paid from the wallet: reserved, then the lockers held, the one picked among them', async ({ page }) => {
  let held: Body[] = [];
  const { errs, of } = await open(page, '', {
    customer_wallet: () => json({ balance: 100, rows: [] }),
    customer_lockers: () => json(held),
    customer_locker_book: (b) => {
      held = [{ id: 'r-1', booking_id: null, day: D1, period: 'early', status: 'reserved', price: 10, on_bill: false, pay: 'wallet', paid: true, code: '5' },
        { id: 'r-0', booking_id: 'q-9', day: D2, period: 'late', status: 'reserved', price: 10, on_bill: true, pay: null, paid: false, code: null },
        { id: 'r-old', booking_id: null, day: '2099-11-13', period: 'early', status: 'returned', price: 10, on_bill: false, pay: 'desk', paid: false, code: '2' }];
      return json({ ok: true, rentals: [{ id: 'r-1', code: '5' }], left: LEFT });
    },
  });
  await ready(page);
  await door(page, 5).click();
  await page.click('#go');
  await signIn(page);
  await expect(page.locator('#r-who')).toContainText('Signed in as Sara Alharbi');
  // both ways open: the rider chooses
  await expect(page.locator('#pays [aria-checked="true"]')).toHaveCount(0);
  await page.click('#book');
  await expect(page.locator('#f-pay .err')).toHaveText('Choose how to pay');
  await page.click('#pays [data-v="wallet"]');
  await page.click('#book');
  await expect(page.locator('#done-title')).toHaveText('Your locker is reserved');
  await expect(page.locator('#done-sum')).toContainText('Locker5');
  await expect(page.locator('#done-sum')).toContainText('Paid from your wallet');
  expect(of('customer_locker_book')[0]).toEqual({ p_id: SARA.id, p_token: 'tok-in', p_day: D1, p_period: 'early', p_codes: ['5'], p_pay: 'wallet' });
  const rows = page.locator('#mine-done .mine-row');
  await expect(rows).toHaveCount(2); // a locker handed back is not listed
  await expect(rows.nth(0)).toContainText('Locker 5');
  await expect(rows.nth(0)).toContainText('Tonight · 6 PM – 8 PM · Paid');
  await expect(rows.nth(0).locator('.mine-x')).toHaveText('Remove');
  await expect(rows.nth(1)).toContainText('Tue 17 Nov · 9 PM – 11 PM');
  await expect(rows.nth(1).locator('.mine-x')).toHaveCount(0); // on a booking: taken back from the booking, not here
  expect(await page.evaluate(() => sessionStorage.getItem('mm-lockers-pick'))).toBeNull();
  // Reserve another: the cabinet again, nothing picked
  await page.click('#again');
  await ready(page);
  await expect(page.locator('#cab-grid .door[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('#mine-pick .mine-row')).toHaveCount(2);
  expect(errs).toEqual([]);
});

test('a locker taken meanwhile: back to the cabinet, said, the cabinet read again', async ({ page }) => {
  let gone = false;
  const { of } = await open(page, '', {
    locker_board: (b) => json(board(String(b.p_day), gone ? { taken: { e: ['2', '4', '7'], l: ['9'] } } : {})),
    customer_locker_book: () => { gone = true; return refuse('LOCKER_TAKEN: 2'); },
  });
  await ready(page);
  await door(page, 1).click();
  await door(page, 2).click();
  await page.click('#go');
  await signIn(page);
  await page.click('#book');
  await expect(page.locator('#v-landing')).toBeVisible();
  await expect(page.locator('#f-cab .err')).toHaveText('Locker 2 was just taken. Pick another.');
  await expect(door(page, 2)).toBeDisabled();
  await expect(door(page, 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pick-sum')).toHaveText('Locker 1 · \u2066⃁ 10\u2069');
  expect(of('locker_board').length).toBeGreaterThanOrEqual(3);
});

test('the other refusals each have their words', async ({ page }) => {
  let answer = refuse('LOCKERS_FULL');
  await open(page, '', { customer_locker_book: () => answer, customer_wallet: () => json({ balance: 100, rows: [] }) });
  await ready(page);
  await door(page, 1).click();
  await page.click('#go');
  await signIn(page);
  await page.click('#pays [data-v="desk"]');
  await page.click('#book');
  await expect(page.locator('#f-cab .err')).toHaveText('The lockers for that time are all taken.');
  await page.click('#go');
  answer = refuse('LOCKER_LIMIT');
  await page.click('#book');
  await expect(page.locator('#banner')).toContainText('Up to 3 lockers per account for each time.');
  answer = refuse('WALLET_SHORT');
  await page.click('#pays [data-v="wallet"]');
  await page.click('#book');
  await expect(page.locator('#f-pay .err')).toHaveText('Not enough in the wallet.');
  answer = refuse('WALLET_NOT_OPEN');
  await page.click('#pays [data-v="wallet"]');
  await page.click('#book');
  await expect(page.locator('#f-pay .err')).toHaveText("This evening can't be paid from the wallet.");
  await expect(page.locator('#pays [data-v="wallet"]')).toBeDisabled();
  answer = refuse('LOCKER_OUT: 1');
  await page.click('#book');
  await expect(page.locator('#f-cab .err')).toHaveText('Locker 1 is out of service');
  await expect(page.locator('#go')).toBeDisabled();
  await door(page, 3).click();
  await page.click('#go');
  answer = refuse('LOCKER_NOT_OPEN');
  await page.click('#book');
  await expect(page.locator('#banner')).toContainText('That time is over or closed. Pick another.');
  await page.click('#go');
  answer = refuse('NOT_AUTHORIZED', '42501', 401);
  await page.click('#book');
  await expect(page.locator('#banner')).toContainText('You were signed out. Sign in again to reserve.');
  await expect(page.locator('#p-signin')).toBeVisible();
});

test('Remove: a locker not collected and with no booking, after a centred question; the wallet payment comes back', async ({ page }) => {
  let held: Body[] = [
    { id: 'r-1', booking_id: null, day: D1, period: 'both', status: 'reserved', price: 15, on_bill: false, pay: 'wallet', paid: true, code: '5' },
    { id: 'r-2', booking_id: null, day: D1, period: 'early', status: 'in_use', price: 10, on_bill: false, pay: 'desk', paid: false, code: '8' },
  ];
  const { errs, of } = await open(page, HANDED, {
    customer_lockers: () => json(held),
    customer_locker_drop: (b) => { held = held.filter((x) => x.id !== b.p_rental); return json({ ok: true, left: LEFT }); },
  });
  await ready(page);
  const rows = page.locator('#mine-pick .mine-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Locker 8'); // 6-8 PM before 6-11 PM
  await expect(rows.nth(0)).toContainText('In use');
  await expect(rows.nth(0).locator('.mine-x')).toHaveCount(0); // the key is with the rider
  await expect(rows.nth(1)).toContainText('Locker 5');
  await expect(rows.nth(1)).toContainText('Reserved');
  await rows.nth(1).locator('.mine-x').click();
  const dlg = page.locator('#rm .modal-box');
  await expect(dlg).toBeVisible();
  await expect(page.locator('#rm-title')).toHaveText('Remove locker 5?');
  await expect(page.locator('#rm-body')).toHaveText('The money goes back to your wallet.');
  const b = (await dlg.boundingBox())!, vp = page.viewportSize()!;
  expect(Math.abs(b.x + b.width / 2 - vp.width / 2)).toBeLessThan(2);
  expect(Math.abs(b.y + b.height / 2 - vp.height / 2)).toBeLessThan(2);
  await page.click('#rm-keep');
  await expect(page.locator('#rm')).toBeHidden();
  expect(of('customer_locker_drop')).toEqual([]);
  await rows.nth(1).locator('.mine-x').click();
  await page.click('#rm-go');
  await expect(page.locator('#rm')).toBeHidden();
  await expect(rows).toHaveCount(1);
  expect(of('customer_locker_drop')).toEqual([{ p_id: SARA.id, p_token: 'tok-handed', p_rental: 'r-1' }]);
  expect(of('customer_wallet').length).toBeGreaterThanOrEqual(2); // read again: the money is back
  expect(errs).toEqual([]);
});

test('a desk payment taken back asks without the wallet line', async ({ page }) => {
  await open(page, HANDED, { customer_lockers: () => json([{ id: 'r-3', booking_id: null, day: D2, period: 'late', status: 'reserved', price: 10, on_bill: false, pay: 'desk', paid: false, code: '11' }]) });
  await page.locator('#mine-pick .mine-x').click();
  await expect(page.locator('#rm-title')).toHaveText('Remove locker 11?');
  await expect(page.locator('#rm-body')).toBeHidden();
});

test('a forgotten password goes through the booking app, and the lockers picked wait for the way back', async ({ page }) => {
  const { of } = await open(page);
  await ready(page);
  await door(page, 3).click();
  await page.click('#go');
  await page.click('#ask-yes');
  await expect(page.locator('#si-other')).toHaveAttribute('href', `${BOOKING}?handoff=lockers&lang=en&auth=forgot`);
  await expect(page.locator('#si-other')).toHaveText('Forgot password?');
  await page.click('#si-other');
  await page.waitForURL(BOOKING + '**');
  // the booking app hands the rider back signed in (?code=): the review, with the locker picked before
  await page.goto('/lockers' + HANDED + '&lang=en');
  await expect(page.locator('#s-review')).toBeVisible();
  await expect(page.locator('#review')).toContainText('Locker3');
  expect(of('customer_handoff_redeem')).toHaveLength(1);
  expect(page.url()).not.toContain('code=');
});

test('Continue reads the cabinet again first: a locker reserved meanwhile is dropped there, and the account step waits', async ({ page }) => {
  let gone = false;
  const { of } = await open(page, '', { locker_board: (b) => json(board(String(b.p_day), gone ? { taken: { e: ['4', '5', '7'], l: [] } } : {})) });
  await ready(page);
  await door(page, 5).click();
  const reads = of('locker_board').length;
  gone = true;
  await page.click('#go');
  await expect(page.locator('#f-cab .err')).toHaveText('Locker 5 was just taken. Pick another.');
  await expect(door(page, 5)).toBeDisabled();
  await expect(page.locator('#p-ask')).toBeHidden(); // not on to the account
  expect(of('locker_board').length).toBe(reads + 1);
  // nothing taken meanwhile: Continue goes on
  await door(page, 6).click();
  await page.click('#go');
  await expect(page.locator('#p-ask')).toBeVisible();
});

test('the cabinet is read again every 15 seconds while seen, and a locker picked that went is dropped', async ({ page }) => {
  let gone = false;
  await page.clock.install({ time: NOW });
  const { of } = await open(page, '', { locker_board: (b) => json(board(String(b.p_day), gone ? { taken: { e: ['4', '5', '7'], l: [] } } : {})) });
  await ready(page);
  await door(page, 5).click();
  await door(page, 6).click();
  const reads = of('locker_board').length;
  gone = true;
  await page.clock.fastForward(16000);
  await expect(door(page, 5)).toBeDisabled();
  await expect(page.locator('#f-cab .err')).toHaveText('Locker 5 was just taken. Pick another.');
  await expect(page.locator('#pick-sum')).toHaveText('Locker 6 · \u2066⃁ 10\u2069');
  expect(of('locker_board').length).toBeGreaterThan(reads);
});

test('Arabic: right to left, the cabinet as it stands (1 on the left), prices and words in Arabic', async ({ page }) => {
  const { errs } = await open(page, '?lang=ar');
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#cab-label')).toHaveText('اختر خزانتك');
  await expect(page.locator('#days .pill').first()).toHaveText('الليلة');
  // the grid stays left to right in Arabic, as the real cabinet stands: 1-2-3 on the top row from the left
  const [b1, b2, b3] = [(await door(page, 1).boundingBox())!, (await door(page, 2).boundingBox())!, (await door(page, 3).boundingBox())!];
  expect(b1.x).toBeLessThan(b2.x); expect(b2.x).toBeLessThan(b3.x);
  expect(Math.abs(b1.y - b3.y)).toBeLessThan(1);
  await expect(door(page, 4)).toHaveAttribute('aria-label', 'الخزانة 4، محجوزة');
  await expect(door(page, 12)).toHaveAttribute('aria-label', 'الخزانة 12، خارج الخدمة');
  await door(page, 1).click();
  await door(page, 2).click();
  await expect(page.locator('#pick-sum')).toHaveText('الخزائن 1، 2 · \u2066⃁ 20\u2069');
  await page.click('#lang');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#pick-sum')).toHaveText('Lockers 1, 2 · \u2066⃁ 20\u2069');
  expect(errs).toEqual([]);
});

test('no emoji on the page, and no Google or Apple sign-in', async ({ page }) => {
  await open(page);
  await ready(page);
  const landing = await page.locator('body').innerText();
  await door(page, 1).click();
  await page.click('#go');
  await page.click('#ask-no');
  const signup = await page.locator('body').innerText();
  const options = await page.locator('#cc option, #em-cc option').allInnerTexts();
  for (const t of [landing, signup, ...options]) expect(t).not.toMatch(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u);
  expect(signup).not.toMatch(/Google|Apple/);
});
