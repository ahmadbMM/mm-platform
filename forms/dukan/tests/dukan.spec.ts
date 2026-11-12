import { test, expect } from '@playwright/test';
import { json, S1, S2, BOOKED, pickNight, details, agree, register, toCheck, wordsOnPage, OTHER_COMPANY } from './flow';
import { setLang } from './lang';

// The Dukan form (the user, 2026-11-12: "create a registration page for dukan employees ... only ask them for their name
// and phone number and the booking number starts with d"): the partner nights, one rider a registration, the name and
// the mobile number only, a D- number, Dukan's look, and never another company's name or a price.

test('a registration sends the name and mobile number on the partner night as Dukan, and shows its D- number', async ({ page }) => {
  const regs: Record<string, unknown>[] = []; const asked: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => { asked.push(r.request().postDataJSON()); return r.fulfill(json([S1, S2])); });
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(BOOKED('D-001'))); });
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('/dukan?lang=en');
  await expect.poll(() => asked[0]).toEqual({ p_source: 'petromin' }); // the website's page runs the form after hydration
  // Three steps: the night, the rider, Check and agree; no badge, company, height, bike or companion anywhere.
  await expect(page.locator('#stepper .stepper-item')).toHaveText(['Session', 'Your details', 'Check and agree']);
  for (const id of ['badge', 'height', 'types', 'companies', 'riders', 'add-rider', 'rider-dialog']) await expect(page.locator(`#${id}`), id).toHaveCount(0);
  await pickNight(page);
  await expect(page.locator('.step[data-step="2"] input:not([type=hidden])')).toHaveCount(2);
  await details(page, { name: 'Faisal Al Harbi' });
  await expect(page.locator('#review .rv')).toHaveCount(2);
  await expect(page.locator('#review')).toContainText('Faisal Al Harbi');
  await expect(page.locator('#review')).toContainText('+966 512345678');
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(1);
  expect(regs[0]).toEqual({ p_badge: '', p_name: 'Faisal Al Harbi', p_height: null, p_type: null, p_source: 'petromin', p_phone: '+966512345678', p_session_id: S1.id, p_company: 'Dukan', p_riders: [], p_waiver: '2026-10-v3', p_lang: 'en', p_privacy: 'dukan-2026-11-12' });
  await expect(page.locator('#chip-booking-value')).toHaveText('D-001');
  await expect(page.locator('#tk-name')).toHaveText('Faisal Al Harbi');
  // The desk's scanner reads MMP-<letter>-<digits>, as on a Petromin ticket.
  await expect(page.locator('#qr canvas')).toHaveAttribute('data-code', 'MMP-D-001');
  // Billed to Dukan: no amount anywhere on the ticket.
  await expect(page.locator('#success')).not.toContainText(/\bSAR\b|﷼|[Pp]rice|\d+(\.\d+)?\s?(SR|ر\.س)/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mm-dukan-registration') || 'null')?.bookingNo)).toBe('D-001');
  expect(await page.evaluate(() => localStorage.getItem('mm-petromin-registration'))).toBeNull();
  expect(errs).toEqual([]);
});

test('the same phone on the same night again keeps its number and says the details were updated', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json({ ...BOOKED('D-007'), resubmitted: true })));
  await page.goto('/dukan?lang=en');
  await register(page);
  await expect(page.locator('#chip-booking-value')).toHaveText('D-007');
  await expect(page.locator('.done-note')).toHaveText('Your details were updated.');
});

for (const lang of ['en', 'ar', 'ur', 'hi', 'bn']) {
  test(`the page never names another company, nor the night's title (${lang})`, async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
    await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(BOOKED('D-002', { id: S1.id, title: S1.title, start: S1.start, end: S1.end }))));
    await page.goto(`/dukan?lang=${lang}`);
    await expect(page.locator('#sessions .session')).toHaveCount(2);
    const seen: string[] = [await wordsOnPage(page)];
    await expect(page.locator('#sessions .session-date').first()).not.toContainText(/Circuit Night|Wednesdays/);
    await pickNight(page);
    seen.push(await wordsOnPage(page));
    await details(page);
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
    await expect(page.locator('#chip-booking-value')).toHaveText('D-002');
    seen.push(await wordsOnPage(page));
    const all = seen.join('\n');
    expect(all).not.toMatch(OTHER_COMPANY);
    expect(all).not.toMatch(/Circuit Night|Wednesdays/);
    // nor the services the database and the page run on: the full notice it links to names them
    expect(all).not.toMatch(/Supabase|Cloudflare/);
    // nor the other company's words for the night in the scripts' dictionary
    const dict = await page.evaluate(() => JSON.stringify((window as unknown as { RiderRegistration: { translations: unknown } }).RiderRegistration.translations));
    expect(dict).not.toMatch(OTHER_COMPANY);
  });
}

test('the page wears Dukan: both marks over the form, its green on the buttons and focus, its name as the title', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(BOOKED())));
  await page.goto('/dukan?lang=en');
  await expect(page.locator('.partners img')).toHaveCount(2);
  await expect(page.locator('.partners img').nth(0)).toHaveAttribute('alt', 'MicroMobility');
  await expect(page.locator('.partners img').nth(1)).toHaveAttribute('alt', 'Dukan');
  expect(await page.locator('.partners img').evaluateAll((im) => im.every((i) => (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(page.locator('#form .title')).toHaveText('Dukan bike night');
  await expect(page.locator('#next')).toHaveCSS('background-color', 'rgb(27, 117, 99)');
  await expect(page.locator('#next')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.locator('#sessions .session').first().click();
  await expect(page.locator('#sessions .session').first()).toHaveCSS('border-top-color', 'rgb(27, 117, 99)');
  await page.locator('#find').focus();
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); // a keyboard focus, so :focus-visible
  await expect(page.locator('#find')).toHaveCSS('outline-color', 'rgb(27, 117, 99)');
  await page.click('#next');
  await page.locator('#name').focus();
  await expect(page.locator('#name')).toHaveCSS('border-top-color', 'rgb(27, 117, 99)');
  await details(page);
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#chip-booking-value')).toHaveCSS('color', 'rgb(27, 117, 99)');
  await expect(page.locator('#ticket .ticket-mark')).toBeVisible();
  await setLang(page, 'ar');
  await expect(page.locator('#success .title')).toHaveText('تم تسجيلك');
  await page.click('#another');
  await expect(page.locator('#form .title')).toHaveText('ليلة دراجات الدكان');
});

test('form steps are counted as the form\'s own: 1 the night, 2 the details, 3 Check and agree', async ({ page }) => {
  // A test browser counts nothing (navigator.webdriver); this one stands in for a rider's phone.
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  const steps: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/form_step', (r) => { steps.push(r.request().postDataJSON()); return r.fulfill(json(null)); });
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(BOOKED())));
  await page.goto('/dukan?lang=en');
  await page.click('#next'); // no night: refused
  await pickNight(page);
  await page.click('#next'); // nothing filled in
  await details(page);
  await page.click('#submit'); // no boxes ticked
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  await expect.poll(() => steps.filter((s) => s.p_event === 'done').length).toBe(1);
  const seen = steps.map((s) => `${s.p_step}:${s.p_event}${s.p_field ? ':' + s.p_field : ''}`);
  expect(steps.every((s) => s.p_form === 'dukan' && s.p_lang === 'en')).toBe(true);
  expect(seen).toEqual(['1:view', '1:error:session', '2:view', '2:error:name', '2:error:phone', '3:view', '3:error:privacy', '3:error:waiver', '3:done']);
});

test('one rider a registration: Register another starts a fresh form for the next person', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(BOOKED(regs.length === 1 ? 'D-001' : 'D-002'))); });
  await page.goto('/dukan?lang=en');
  await register(page);
  await page.click('#another');
  await expect(page.locator('#name')).toHaveValue('');
  await toCheck(page, { name: 'Basma Second', phone: '512345679' });
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#chip-booking-value')).toHaveText('D-002');
  expect(regs.map((r) => r.p_riders)).toEqual([[], []]);
  await expect(page.locator('#others-list .other')).toHaveText(['D-001 · Amal Booked']);
});
