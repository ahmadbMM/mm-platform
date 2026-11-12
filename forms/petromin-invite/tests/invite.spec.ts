import { test, expect, json, S1, S2, booking, pickNight, details, bike, agree, register, toCheck, wordsOnPage, OTHER_COMPANY } from './flow';
import { setLang } from './lang';

// Petromin's invited guests (the owner, 2026-11-12): the partner nights, one rider a booking, the name, the mobile number
// and a bike type (Hybrid or Mountain), an I- number, a walk-in booking on the night's list whose ticket carries the
// booking's own code (ref) for the desk's scanner and the fare paid at the desk, Petromin's look, and no company named
// but MicroMobility and Petromin.

test('a booking sends the night, the name, the mobile number and the bike, and shows its I- number, its fare and its ref as the QR', async ({ page }) => {
  const regs: Record<string, unknown>[] = []; const asked: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => { asked.push(r.request().postDataJSON()); return r.fulfill(json([S1, S2])); });
  await page.route('**/rest/v1/rpc/petromin_invite_book', booking(regs, 'I-001'));
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('/petromin-invite?lang=en');
  await expect.poll(() => asked[0]).toEqual({ p_source: 'petromin' }); // the website's page runs the form after hydration
  // Four steps: the night, the guest, the bike, Check and agree; no badge, company, height or companion anywhere.
  await expect(page.locator('#stepper .stepper-item')).toHaveText(['Session', 'Your details', 'Bike', 'Check and agree']);
  for (const id of ['badge', 'height', 'companies', 'riders', 'add-rider', 'rider-dialog']) await expect(page.locator(`#${id}`), id).toHaveCount(0);
  await pickNight(page);
  await expect(page.locator('.step[data-step="2"] input:not([type=hidden])')).toHaveCount(2);
  await details(page, { name: 'Faisal Al Harbi' });
  // Hybrid and Mountain, as the Petromin form offers them: no Road.
  await expect(page.locator('#types .tile')).toHaveText(['Hybrid', 'Mountain']);
  await page.click('#next'); // no bike picked
  await expect(page.locator('#f-type')).toHaveClass(/invalid/);
  await expect(page.locator('#f-type .err')).toHaveText('Choose a bike type');
  await bike(page, 'Mountain');
  await expect(page.locator('#review .rv')).toHaveCount(3);
  await expect(page.locator('#review')).toContainText('Faisal Al Harbi');
  await expect(page.locator('#review')).toContainText('+966 512345678');
  await expect(page.locator('#review')).toContainText('Mountain');
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(1);
  expect(regs[0]).toEqual({ p_session_id: S1.id, p_name: 'Faisal Al Harbi', p_phone: '+966512345678', p_type: 'Mountain', p_waiver: '2026-10-v3', p_privacy: 'pminvite-2026-11-12' });
  await expect(page.locator('#chip-booking-value')).toHaveText('I-001');
  await expect(page.locator('#success .title')).toHaveText('You are registered');
  await expect(page.locator('#tk-status')).toBeHidden();
  await expect(page.locator('#tk-name')).toHaveText('Faisal Al Harbi');
  await expect(page.locator('#tk-type-value')).toHaveText('Mountain');
  // The desk's scanner reads the booking's own code, exactly as the server gave it: never MMP-<number>.
  await expect(page.locator('#qr canvas')).toHaveAttribute('data-code', 'MMC-08-001abc');
  // The fare paid at the desk, as a field of the ticket: the riyal sign for the eye, "SAR" for a screen reader.
  await expect(page.locator('#tk-price')).toBeVisible();
  await expect(page.locator('#tk-price .tl')).toHaveText('Price');
  await expect(page.locator('#tk-price-value')).toHaveText(/^\S\s?SAR 57\.50$/);
  await expect(page.locator('#tk-price-value .amt-sign')).toHaveText(String.fromCharCode(0x20c1));
  await expect(page.locator('#tk-price-value .amt-sign')).toHaveAttribute('aria-hidden', 'true');
  // The night's hours on the ticket, by its day and time.
  await expect(page.locator('#chip-session-value')).toHaveText(/Feb 8.*07:00 PM – 09:00 PM/);
  // Fields only: no line telling the guest where or how to pay.
  await expect(page.locator('#success')).not.toContainText(/booth|pay at|when you arrive/i);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mm-pminvite-booking') || 'null')?.bookingNo)).toBe('I-001');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mm-pminvite-booking') || 'null')?.ref)).toBe('MMC-08-001abc');
  for (const k of ['mm-petromin-registration', 'mm-dukan-registration']) expect(await page.evaluate((x) => localStorage.getItem(x), k)).toBeNull();
  expect(errs).toEqual([]);
});

test('a night that is full: the booking is on its waitlist, said plainly on the ticket, with no place in the line', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_book', booking(regs, 'I-031', { status: 'waitlist' }));
  await page.goto('/petromin-invite?lang=en');
  await register(page);
  await expect(page.locator('#success .title')).toHaveText("You're on the waitlist");
  await expect(page.locator('#tk-status')).toBeVisible();
  await expect(page.locator('#tk-status')).toHaveText('On the waitlist');
  await expect(page.locator('#result')).toBeHidden(); // never "confirmed"
  await expect(page.locator('#chip-booking-value')).toHaveText('I-031');
  await expect(page.locator('#success')).not.toContainText(/in line|position|#\d|number \d/i);
  await setLang(page, 'ar');
  await expect(page.locator('#tk-status')).toHaveText('في قائمة الانتظار');
  await expect(page.locator('#success .title')).toHaveText('أنت في قائمة الانتظار');
  // A place comes free: the phone's copy is brought up to date when the page opens again.
  await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => r.fulfill(json({ ok: true, booking_no: 'I-031', invite_no: 'I-031', ref: 'MMC-08-031abc', company: null, name: 'Amal Booked', phone: '+966512345678', type: 'Hybrid', status: 'waiting', checked_in: false, price: 57.5, paid: false, session: S1, more: [], riders: [] })));
  await page.goto('/petromin-invite?lang=en');
  await expect(page.locator('#tk-status')).toBeHidden();
  await expect(page.locator('#success .title')).toHaveText('You are registered');
});

test('the same phone on the same night again keeps its number and says the details were updated', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_book', booking([], 'I-007', { resubmitted: true }));
  await page.goto('/petromin-invite?lang=en');
  await register(page);
  await expect(page.locator('#chip-booking-value')).toHaveText('I-007');
  await expect(page.locator('.done-note')).toHaveText('Your details were updated.');
});

for (const lang of ['en', 'ar', 'ur', 'hi', 'bn']) {
  test(`the page names no company but MicroMobility and Petromin, nor the night's title (${lang})`, async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
    await page.route('**/rest/v1/rpc/petromin_invite_book', booking([], 'I-002'));
    await page.goto(`/petromin-invite?lang=${lang}`);
    await expect(page.locator('#sessions .session')).toHaveCount(2);
    const seen: string[] = [await wordsOnPage(page)];
    await expect(page.locator('#sessions .session-date').first()).not.toContainText(/Circuit Night|Wednesdays/);
    await pickNight(page);
    seen.push(await wordsOnPage(page));
    await details(page);
    seen.push(await wordsOnPage(page));
    await bike(page);
    seen.push(await wordsOnPage(page));
    await page.locator('#f-privacy [data-privacy-open]').click();
    seen.push(await wordsOnPage(page));
    await page.click('#pv-close');
    await page.click('#waiver-open');
    seen.push(await wordsOnPage(page));
    await page.click('#waiver-close');
    await agree(page);
    await page.click('#submit');
    await expect(page.locator('#success')).toBeVisible();
    await expect(page.locator('#chip-booking-value')).toHaveText('I-002');
    seen.push(await wordsOnPage(page));
    const all = seen.join('\n');
    expect(all).not.toMatch(OTHER_COMPANY);
    expect(all).not.toMatch(/Circuit Night|Wednesdays/);
    // nor the services the database and the page run on: the full notice it links to names them
    expect(all).not.toMatch(/Supabase|Cloudflare/);
    const dict = await page.evaluate(() => JSON.stringify((window as unknown as { RiderRegistration: { translations: unknown } }).RiderRegistration.translations));
    expect(dict).not.toMatch(OTHER_COMPANY);
  });
}

test("the page wears Petromin's form's look: MicroMobility's mark beside Petromin's logo, its green and neon, its title", async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_book', booking([]));
  await page.goto('/petromin-invite?lang=en');
  await expect(page.locator('.partners img')).toHaveCount(2);
  await expect(page.locator('.partners img').nth(0)).toHaveAttribute('alt', 'MicroMobility');
  await expect(page.locator('.partners img').nth(1)).toHaveAttribute('alt', 'Petromin');
  expect(await page.locator('.partners img').evaluateAll((im) => im.every((i) => (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(page.locator('#form .title')).toHaveText('Petromin Ride Night: Invited Guests');
  await expect(page.locator('#next')).toHaveCSS('background-color', 'rgb(7, 122, 75)');
  await page.locator('#sessions .session').first().click();
  await expect(page.locator('#sessions .session').first()).toHaveCSS('border-top-color', 'rgb(7, 122, 75)');
  await page.locator('#find').focus();
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); // a keyboard focus, so :focus-visible
  await expect(page.locator('#find')).toHaveCSS('outline-color', 'rgb(7, 122, 75)');
  await page.click('#next');
  await details(page);
  // The picked bike is dark with Petromin's form's neon, as on its own bike step.
  await page.click('#types .tile[data-v="Hybrid"]');
  await expect(page.locator('#types .tile[data-v="Hybrid"]')).toHaveCSS('color', 'rgb(3, 255, 137)');
  await page.click('#next');
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#chip-booking-value')).toHaveCSS('color', 'rgb(7, 122, 75)');
  await setLang(page, 'ar');
  await expect(page.locator('#success .title')).toHaveText('تم تسجيلك');
  await page.click('#another');
  await expect(page.locator('#form .title')).toHaveText('ليلة دراجات بترومين: الضيوف المدعوون');
});

test("form steps are counted as the form's own: 1 the night, 2 the details, 3 the bike, 4 Check and agree", async ({ page }) => {
  // A test browser counts nothing (navigator.webdriver); this one stands in for a guest's phone.
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  const steps: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/form_step', (r) => { steps.push(r.request().postDataJSON()); return r.fulfill(json(null)); });
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_book', booking([]));
  await page.goto('/petromin-invite?lang=en');
  await page.click('#next'); // no night: refused
  await pickNight(page);
  await page.click('#next'); // nothing filled in
  await details(page);
  await page.click('#next'); // no bike
  await bike(page);
  await page.click('#submit'); // no boxes ticked
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  await expect.poll(() => steps.filter((s) => s.p_event === 'done').length).toBe(1);
  const seen = steps.map((s) => `${s.p_step}:${s.p_event}${s.p_field ? ':' + s.p_field : ''}`);
  expect(steps.every((s) => s.p_form === 'pminvite' && s.p_lang === 'en')).toBe(true);
  expect(seen).toEqual(['1:view', '1:error:session', '2:view', '2:error:name', '2:error:phone', '3:view', '3:error:type', '4:view', '4:error:privacy', '4:error:waiver', '4:done']);
});

test('one rider a booking: Register another starts a fresh form for the next guest', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_book', booking(regs, (n) => (n === 1 ? 'I-001' : 'I-002')));
  await page.goto('/petromin-invite?lang=en');
  await register(page);
  await page.click('#another');
  await expect(page.locator('#name')).toHaveValue('');
  await expect(page.locator('#types .tile[aria-checked="true"]')).toHaveCount(0);
  await toCheck(page, { name: 'Basma Second', phone: '512345679', type: 'Mountain' });
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#chip-booking-value')).toHaveText('I-002');
  expect(regs.map((r) => [r.p_name, r.p_type])).toEqual([['Amal Booked', 'Hybrid'], ['Basma Second', 'Mountain']]);
  await expect(page.locator('#others-list .other')).toHaveText(['I-001 · Amal Booked']);
});

test('a bike type the night no longer takes, closed or full, sends the guest back to the bike', async ({ page }) => {
  const answers = [{ ok: false, error: 'type_full' }, { ok: false, error: 'type_closed' }, { ok: false, error: 'type' }];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_book', (r) => r.fulfill(json(answers.shift())));
  await page.goto('/petromin-invite?lang=en');
  await register(page);
  await expect(page.locator('.step[data-step="3"]')).toBeVisible();
  await expect(page.locator('#f-type .err')).toHaveText('That bike type is closed for this ride. Choose another.');
  await page.click('#types .tile[data-v="Mountain"]');
  await expect(page.locator('#f-type')).not.toHaveClass(/invalid/);
  await page.click('#next');
  await page.click('#submit');
  await expect(page.locator('#f-type .err')).toHaveText('That bike type is closed for this ride. Choose another.');
  await page.click('#next');
  await page.click('#submit');
  await expect(page.locator('#f-type .err')).toHaveText('Choose a bike type');
});
