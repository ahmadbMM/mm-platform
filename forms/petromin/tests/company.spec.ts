import { test, expect } from '@playwright/test';
import { json, pickCompany, pickNight, details, bike, toCheck, agree, register, stubAccount, guestBook } from './flow';
import { setLang } from './lang';

// One page for four kinds of rider (the owner, 2026-11-13: "merge the petromin page with dukan page all under /petromin
// make the first step to select the company"): the first step asks the company, and what follows depends on the pick.
const S1 = { id: '2099-02-08-pw', title: "Petromin's Circuit Night", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00', collect: '18:45', place: null };
const S2 = { id: '2099-02-15-pw', title: "Petromin's Wednesdays", start: '2099-02-15T19:00:00+03:00', end: '2099-02-15T21:00:00+03:00', collect: '18:45', place: null };
const BOOKED = (no: string) => ({ ok: true, booking_no: no, riders: 1, resubmitted: false, session: S1 });
const GUEST_BOOKED = { ok: true, resubmitted: false, booking_no: 'I-003', invite_no: 'I-003', ref: 'MMC-41-abcdef', status: 'waiting', name: 'Sara Alharbi', phone: '+966512345678', type: 'Hybrid', company: 'Aramco Trading', price: 75, session: S1 };

test('@webkit the first step asks the company: four tiles, the owner\'s question, and Continue needs a pick', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin?lang=en');
  await expect(page.locator('.step[data-step="1"] .step-title')).toHaveText('Which company are you an employee for?');
  const tiles = page.locator('#companies .company');
  expect(await tiles.evaluateAll((bs) => bs.map((b) => b.getAttribute('data-v')))).toEqual(['Petromin', 'Petrolube', 'Dukan', 'Guest']);
  await expect(tiles.nth(3)).toHaveText('Guest/Other');
  expect(await page.locator('#companies .company img').evaluateAll((im) => im.every((i) => (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(page.locator('#stepper .stepper-label')).toHaveText(['Company', 'Session', 'Your details', 'Bike', 'Check and agree']);
  await expect(page.locator('#find')).toBeVisible(); // Find my booking is on the first step
  await expect(page.locator('#back')).toBeHidden();
  await page.click('#next');
  await expect(page.locator('#f-company')).toHaveClass(/invalid/);
  await expect(page.locator('#f-company .err')).toHaveText('Choose your company');
  await expect(page.locator('.step[data-step="1"]')).toBeVisible();
  // Both wordings are the page's own in another language, never the English left in.
  for (const lang of ['ar', 'ur', 'fr', 'ja', 'bn']) {
    await setLang(page, lang);
    await expect(page.locator('.step[data-step="1"] .step-title'), lang).not.toHaveText('Which company are you an employee for?');
    await expect(tiles.nth(3), lang).not.toHaveText('Guest/Other');
    await expect(tiles.nth(3), lang).not.toHaveText('');
  }
  await setLang(page, 'ar');
  await expect(page.locator('.step[data-step="1"] .step-title')).toHaveText('ما الشركة التي أنت موظف لديها؟');
  await expect(tiles.nth(3)).toHaveText('ضيف/أخرى');
});

test('the company picked on the first step is the registration\'s: the details step no longer asks it', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(BOOKED('P-009'))); });
  await page.goto('/petromin?lang=en');
  await pickNight(page, 0, 'Petrolube');
  await expect(page.locator('.step[data-pane="details"] #companies')).toHaveCount(0);
  await expect(page.locator('.step[data-pane="details"] input:not([type=hidden])')).toHaveCount(3); // badge, name, mobile
  await details(page);
  await bike(page);
  await toCheck(page);
  await expect(page.locator('#review')).toContainText('Petrolube');
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#chip-booking-value')).toHaveText('P-009');
  expect(regs[0]).toMatchObject({ p_company: 'Petrolube', p_badge: 'A-12', p_source: 'petromin' });
  await expect(page.locator('#chip-company-value')).toHaveText('Petrolube');
});

test('the pick orders the steps: an employee\'s are the night, the details and the bike; a guest\'s the account, the night and the bike', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin?lang=en');
  const labels = page.locator('#stepper .stepper-label');
  await page.click('#companies .company[data-v="Guest"]');
  await expect(labels).toHaveText(['Company', 'Your account', 'Session', 'Bike', 'Check and agree']);
  await page.click('#companies .company[data-v="Dukan"]');
  await expect(labels).toHaveText(['Company', 'Session', 'Your details', 'Bike', 'Check and agree']);
  await page.click('#companies .company[data-v="Guest"]');
  await page.click('#next');
  await expect(page.locator('.step[data-pane="account"]')).toBeVisible();
  await expect(page.locator('#ac-ask-q')).toHaveText('Do you have a MicroMobility account?');
  await expect(page.locator('#next')).toBeHidden(); // the question's two answers are its buttons
  // Back to the first step: every company again.
  await page.click('#back');
  await expect(page.locator('#companies .company')).toHaveCount(4);
  for (const co of ['Petromin', 'Petrolube', 'Dukan', 'Guest']) await expect(page.locator(`#companies .company[data-v="${co}"]`)).toBeVisible();
  await pickCompany(page, 'Petromin');
  await expect(page.locator('.step[data-pane="session"]')).toBeVisible();
  await expect(page.locator('#sessions .session-date')).toContainText("Petromin's Circuit Night"); // the employees' own name for the night
});

test('form steps are counted by the kind of rider, the company step on its own', async ({ page }) => {
  // A test browser counts nothing (navigator.webdriver); this one stands in for a rider's phone.
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  let steps: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/form_step', (r) => { steps.push(r.request().postDataJSON()); return r.fulfill(json(null)); });
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(BOOKED(r.request().postDataJSON().p_company === 'Dukan' ? 'D-001' : 'P-001'))));
  await page.route('**/rest/v1/rpc/petromin_guest_book', (r) => r.fulfill(json(GUEST_BOOKED)));
  await stubAccount(page);
  const seen = () => steps.map((s) => `${s.p_form} ${s.p_step}:${s.p_event}${s.p_field ? ':' + s.p_field : ''}`);
  const done = () => steps.filter((s) => s.p_event === 'done' && s.p_form !== 'pmhome').length;

  // Petromin's employee: the company step is 'pmhome', the rest 'petromin' 1 to 4 as before the company step.
  await page.goto('/petromin?lang=en');
  await page.click('#next'); // no company: refused
  await pickCompany(page, 'Petromin');
  await page.click('#next'); // no night: refused
  await pickNight(page);
  await details(page);
  await bike(page);
  await toCheck(page);
  await page.click('#submit'); // no boxes ticked
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  await expect.poll(done).toBe(1);
  expect(seen()).toEqual(['pmhome 1:view', 'pmhome 1:error:company', 'pmhome 1:done:petromin', 'petromin 1:view', 'petromin 1:error:session', 'petromin 2:view', 'petromin 3:view',
    'petromin 4:view', 'petromin 4:error:privacy', 'petromin 4:error:waiver', 'petromin 4:done']);
  expect(steps.every((s) => s.p_lang === 'en')).toBe(true);

  // Dukan's employee: 'pmdukan', the same four steps.
  steps = []; await page.evaluate(() => localStorage.clear()); await page.goto('/petromin?lang=en');
  await register(page, { company: 'Dukan' });
  await expect(page.locator('#chip-booking-value')).toHaveText('D-001');
  await expect.poll(done).toBe(1);
  expect(seen()).toEqual(['pmhome 1:view', 'pmhome 1:done:dukan', 'pmdukan 1:view', 'pmdukan 2:view', 'pmdukan 3:view', 'pmdukan 4:view', 'pmdukan 4:done']);

  // An invited guest: 'pmguest', 1 the account, 2 the night, 3 the bike, 4 Check and agree.
  steps = []; await page.evaluate(() => localStorage.clear()); await page.goto('/petromin?lang=en');
  await guestBook(page);
  await expect(page.locator('#chip-booking-value')).toHaveText('I-003');
  await expect.poll(done).toBe(1);
  expect(seen()).toEqual(['pmhome 1:view', 'pmhome 1:done:guest', 'pmguest 1:view', 'pmguest 2:view', 'pmguest 3:view', 'pmguest 4:view', 'pmguest 4:done']);
});

test('the confirmations the old pages left on the phone join this page once: a Dukan ticket and a guest\'s booking still show', async ({ page }) => {
  const DUKAN = { name: 'Dana Old', company: 'Dukan', phone: '+966512345670', session: { id: S1.id, start: S1.start, end: S1.end, collect: '18:45', place: null }, bookingNo: 'D-004', submittedAt: '2099-02-01T10:00:00Z' };
  const INVITE = { name: 'Ghada Old', phone: '+966512345671', type: 'Mountain', status: 'waiting', price: 75, ref: 'MMC-12-aaaaaa', session: { id: S2.id, start: S2.start, end: S2.end, collect: '18:45', place: null }, bookingNo: 'I-002', submittedAt: '2099-02-01T10:00:00Z' };
  await page.addInitScript(([d, i]) => {
    if (sessionStorage.getItem('seeded')) return; // once: a reload must find what the page itself kept
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('mm-dukan-registration', JSON.stringify(d));
    localStorage.setItem('mm-pminvite-booking', JSON.stringify(i));
  }, [DUKAN, INVITE]);
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.goto('/petromin?lang=en');
  // The guest's booking shows (the last one taken in), the Dukan ticket is listed under it.
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#chip-booking-value')).toHaveText('I-002');
  await expect(page.locator('#qr canvas')).toHaveAttribute('data-code', 'MMC-12-aaaaaa');
  await expect(page.locator('#tk-price-value')).toContainText('75');
  await expect(page.locator('#edit')).toBeHidden(); // made on the old page, with no account: cancelled here, not changed
  await expect(page.locator('#cancel-booking')).toBeVisible();
  await expect(page.locator('#others-list .other')).toHaveText(['D-004 · Dana Old']);
  expect(await page.evaluate(() => ['mm-dukan-registration', 'mm-dukan-kept', 'mm-pminvite-booking', 'mm-pminvite-kept'].map((k) => localStorage.getItem(k)))).toEqual([null, null, null, null]);
  // The Dukan ticket, in Dukan's look, with its code as the desk scans it.
  await page.click('#others-list .other');
  await expect(page.locator('#chip-booking-value')).toHaveText('D-004');
  await expect(page.locator('html')).toHaveAttribute('data-co', 'dukan');
  await expect(page.locator('#qr canvas')).toHaveAttribute('data-code', 'MMP-D-004');
  await expect(page.locator('#edit')).toBeVisible();
  await expect(page.locator('#others-list .other')).toHaveText(['I-002 · Ghada Old']);
  // A reload keeps both, from this page's own store.
  await page.reload();
  await expect(page.locator('#chip-booking-value')).toHaveText('D-004');
  await expect(page.locator('html')).toHaveAttribute('data-co', 'dukan');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mm-petromin-registration') || 'null')?.kind)).toBe('dukan');
});

test('Find my booking asks the right list for the number: an I- the guests\', a D- or P- the registrations\'; a bare number takes the picked company\'s letter', async ({ page }) => {
  const asked: Array<[string, Record<string, unknown>]> = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_lookup', (r) => {
    const b = r.request().postDataJSON(); asked.push(['rider_lookup', b]);
    if (b.p_booking_no === 'D-007') return r.fulfill(json({ ok: true, booking_no: 'D-007', badge: 'DK512345678', name: 'Dana Dukan', company: 'Dukan', phone: '+966512345678', height: 168, type: 'Mountain', session: S1, riders: [], more: [] }));
    return r.fulfill(json({ ok: false, error: 'notfound' }));
  });
  await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => {
    asked.push(['petromin_invite_lookup', r.request().postDataJSON()]);
    return r.fulfill(json({ ok: true, booking_no: 'I-012', invite_no: 'I-012', ref: 'MMC-9-bbbbbb', company: null, account: false, name: 'Ghada Old', phone: '+966512345678', type: 'Hybrid', status: 'waiting', checked_in: false, price: 75, paid: false, session: S1, more: [], riders: [] }));
  });
  await page.goto('/petromin?lang=en');
  const find = async (no: string) => { await page.click('#find'); await page.fill('#fd-no', no); await page.fill('#fd-phone', '512345678'); await page.click('#fd-go'); };
  // No company picked: a bare number is a P-.
  await expect(page.locator('#fd-no')).toHaveAttribute('placeholder', 'P-001');
  await find('7');
  await expect(page.locator('#fd-miss')).toHaveText('We could not find a booking with this number and mobile number.');
  expect(asked.pop()).toEqual(['rider_lookup', { p_booking_no: 'P-007', p_phone: '+966512345678' }]);
  await page.click('#fd-cancel');
  // Dukan picked: a bare number is a D-, and the booking found shows in Dukan's look.
  await page.click('#companies .company[data-v="Dukan"]');
  await expect(page.locator('#fd-no')).toHaveAttribute('placeholder', 'D-001');
  await find('7');
  await expect(page.locator('#chip-booking-value')).toHaveText('D-007');
  expect(asked.pop()).toEqual(['rider_lookup', { p_booking_no: 'D-007', p_phone: '+966512345678' }]);
  await expect(page.locator('html')).toHaveAttribute('data-co', 'dukan');
  await expect(page.locator('#tk-type-value')).toHaveText('Mountain');
  // A guest's number, from the ticket's own Register another: the guests' lookup, and no Edit for a booking with no account.
  await page.click('#another');
  await expect(page.locator('.step[data-step="1"]')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-co', 'dukan');
  await page.click('#companies .company[data-v="Guest"]');
  await expect(page.locator('#fd-no')).toHaveAttribute('placeholder', 'I-001');
  await find('12');
  await expect(page.locator('#chip-booking-value')).toHaveText('I-012');
  expect(asked.pop()).toEqual(['petromin_invite_lookup', { p_invite_no: 'I-012', p_phone: '+966512345678' }]);
  await expect(page.locator('#qr canvas')).toHaveAttribute('data-code', 'MMC-9-bbbbbb');
  await expect(page.locator('#edit')).toBeHidden();
  await expect(page.locator('#chip-company')).toBeHidden();
  await expect(page.locator('#others-list .other')).toHaveText(['D-007 · Dana Dukan']);
});

test.describe('on a 320 px phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test('the company step, a guest\'s account and Dukan\'s steps are never wider than the screen', async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(BOOKED('D-001'))));
    await stubAccount(page, { owes: ['nationality', 'birth_date'], emergency: false });
    const wide = async () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    for (const lang of ['en', 'de', 'ar']) {
      await page.goto(`/petromin?lang=${lang}`);
      expect(await wide(), `${lang} company`).toBe(false);
      await pickCompany(page, 'Guest');
      expect(await wide(), `${lang} the question`).toBe(false);
      await page.click('#ac-no');
      await page.click('#ac-create-btn'); // every message showing
      expect(await wide(), `${lang} create account`).toBe(false);
      await page.click('.ac-to-signin');
      await page.fill('#ac-ident', 'sara.alharbi@gmail.com'); await page.fill('#ac-spwd', 'ridewithme9');
      await page.click('#ac-signin-btn');
      await expect(page.locator('#ac-details')).toBeVisible();
      await expect(page.locator('#f-ac-birth')).toBeVisible();
      expect(await wide(), `${lang} signed in, with what the account owes`).toBe(false);
    }
    await page.goto('/petromin?lang=en');
    await register(page, { company: 'Dukan' });
    await expect(page.locator('#success')).toBeVisible();
    expect(await wide(), 'Dukan ticket').toBe(false);
  });
});
