import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { json, pickCompany, pickNight, details, bike, toCheck, agree, register, shownWords, OTHER_COMPANY } from './flow';
import { setLang } from './lang';

// Dukan's employees on the Petromin page (the owner, 2026-11-13: "for dukan ask them for their height and bike type
// too"; before that, micromobility.sa/dukan of 2026-11-12): the partner nights, one rider a registration, the name and
// mobile number, the height and the bike, a D- number, and from the pick on Dukan's look and no other company's name.
const S1 = { id: '2099-02-08-pw', title: "Petromin's Circuit Night", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00', collect: '18:45', place: null };
const S2 = { id: '2099-02-15-pw', title: "Petromin's Wednesdays", start: '2099-02-15T19:00:00+03:00', end: '2099-02-15T21:00:00+03:00', collect: '18:45', place: null };
const BOOKED = (no = 'D-001', session: object = S1) => ({ ok: true, booking_no: no, riders: 1, resubmitted: false, session });
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

test('@webkit a Dukan registration sends the name, mobile, height and bike on the partner night as Dukan, and shows its D- number', async ({ page }) => {
  const regs: Record<string, unknown>[] = []; const asked: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => { asked.push(r.request().postDataJSON()); return r.fulfill(json([S1, S2])); });
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(BOOKED('D-001'))); });
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('/petromin?lang=en');
  await expect.poll(() => asked[0]).toEqual({ p_source: 'petromin' }); // the website's page runs the form after hydration
  await pickNight(page, 0, 'Dukan');
  // The details: a name and a mobile number, no badge.
  await expect(page.locator('#f-badge')).toBeHidden();
  await expect(page.locator('.step[data-pane="details"] input:not([type=hidden]):visible')).toHaveCount(2);
  await details(page, { name: 'Faisal Al Harbi' });
  // Height and bike: both asked, Hybrid or Mountain, nobody to ride with.
  await expect(page.locator('.step[data-pane="bike"] .step-title')).toHaveText('Height and bike');
  await expect(page.locator('#f-riders')).toBeHidden();
  await expect(page.locator('#types .tile:visible')).toHaveText(['Hybrid', 'Mountain']);
  await page.click('#next');
  await expect(page.locator('#f-height .err')).toHaveText('Enter your height in cm (100 to 250)');
  await expect(page.locator('#f-type .err')).toHaveText('Choose a bike type');
  await expect(page.locator('.step[data-pane="bike"]')).toBeVisible();
  await bike(page, '168', 'Mountain');
  await toCheck(page);
  await expect(page.locator('#review .rv')).toHaveCount(3); // the night, the rider, the bike: the company is not a question left to change
  await expect(page.locator('#review')).toContainText('Faisal Al Harbi');
  await expect(page.locator('#review')).toContainText('+966 512345678');
  await expect(page.locator('#review')).toContainText('168 cm · Mountain');
  await expect(page.locator('#waiver-label')).toHaveText('I have read the waiver and agree to it');
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(1);
  expect(regs[0]).toEqual({ p_badge: '', p_name: 'Faisal Al Harbi', p_height: 168, p_type: 'Mountain', p_source: 'petromin', p_phone: '+966512345678', p_session_id: S1.id, p_company: 'Dukan', p_riders: [], p_waiver: '2026-10-v3', p_lang: 'en', p_privacy: 'dukan-2026-11-13' });
  await expect(page.locator('#chip-booking-value')).toHaveText('D-001');
  await expect(page.locator('#tk-name')).toHaveText('Faisal Al Harbi');
  await expect(page.locator('#tk-type-value')).toHaveText('Mountain');
  await expect(page.locator('#chip')).toBeHidden(); // no badge
  await expect(page.locator('#chip-company')).toBeHidden();
  // The desk's scanner reads MMP-<letter>-<digits>, as on a Petromin ticket.
  await expect(page.locator('#qr canvas')).toHaveAttribute('data-code', 'MMP-D-001');
  // Billed to Dukan: no amount anywhere on the ticket.
  expect(await page.locator('#success').innerText()).not.toMatch(/\bSAR\b|﷼|[Pp]rice|\d+(\.\d+)?\s?(SR|ر\.س)/);
  expect(await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('mm-petromin-registration') || 'null'); return d && [d.bookingNo, d.kind, d.company]; })).toEqual(['D-001', 'dukan', 'Dukan']);
  expect(errs).toEqual([]);
});

test('@webkit the page wears Dukan from the pick on, and Petromin\'s page again on the way back to the first step', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(BOOKED())));
  await page.goto('/petromin?lang=en');
  const html = page.locator('html');
  // On the first step, even with Dukan's tile picked, the page is still Petromin's.
  await page.click('#companies .company[data-v="Dukan"]');
  await expect(html).not.toHaveAttribute('data-co', 'dukan');
  await expect(page.locator('#form .title')).toHaveText('Petromin bike night');
  await page.click('#next');
  await expect(html).toHaveAttribute('data-co', 'dukan');
  const marks = page.locator('.partners:not([hidden]) img');
  await expect(marks).toHaveCount(2);
  await expect(marks.nth(0)).toHaveAttribute('alt', 'MicroMobility');
  await expect(marks.nth(1)).toHaveAttribute('alt', 'Dukan');
  expect(await marks.evaluateAll((im) => im.every((i) => (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(page.locator('#form .title')).toHaveText('Dukan bike night');
  await expect(page.locator('#next')).toHaveCSS('background-color', 'rgb(27, 117, 99)');
  await expect(page.locator('#next')).toHaveCSS('color', 'rgb(255, 255, 255)');
  expect(await page.locator('#form .title').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Rubik/);
  await page.locator('#sessions .session').first().click();
  await expect(page.locator('#sessions .session').first()).toHaveCSS('border-top-color', 'rgb(27, 117, 99)');
  // Back to the company: all four again, in the page's first look; forward again, Dukan's.
  await page.click('#back');
  await expect(html).not.toHaveAttribute('data-co', 'dukan');
  await expect(page.locator('#companies .company:visible')).toHaveCount(4);
  await expect(page.locator('#next')).toHaveCSS('background-color', 'rgb(7, 122, 75)');
  await page.click('#next');
  await expect(html).toHaveAttribute('data-co', 'dukan');
  await page.click('#next');
  await page.locator('#name').focus();
  await expect(page.locator('#name')).toHaveCSS('border-top-color', 'rgb(27, 117, 99)');
  await details(page);
  await bike(page);
  await expect(page.locator('#types .tile[aria-checked="true"]')).toHaveCSS('background-color', 'rgb(27, 117, 99)');
  await toCheck(page);
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#chip-booking-value')).toHaveCSS('color', 'rgb(27, 117, 99)');
  await expect(page.locator('#ticket .ticket-mark')).toBeVisible();
  await setLang(page, 'ar');
  await expect(page.locator('#success .title')).toHaveText('تم تسجيلك');
  // Register another starts at the company again, in the page's first look.
  await page.click('#another');
  await expect(page.locator('.step[data-step="1"]')).toBeVisible();
  await expect(html).not.toHaveAttribute('data-co', 'dukan');
  await expect(page.locator('#companies .company[aria-checked="true"]')).toHaveCount(0);
});

for (const lang of ['en', 'ar', 'ur', 'hi', 'bn']) {
  test(`after Dukan is picked the page never names another company, nor the night's title (${lang})`, async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
    await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(BOOKED('D-002', { id: S1.id, title: S1.title, start: S1.start, end: S1.end }))));
    await page.goto(`/petromin?lang=${lang}`);
    await pickCompany(page, 'Dukan');
    await expect(page.locator('#sessions .session')).toHaveCount(2);
    const seen: string[] = [await shownWords(page)];
    await expect(page.locator('#sessions .session-date').first()).not.toContainText(/Circuit Night|Wednesdays/);
    await pickNight(page);
    seen.push(await shownWords(page));
    await details(page);
    seen.push(await shownWords(page));
    await bike(page);
    await toCheck(page);
    seen.push(await shownWords(page));
    await page.locator('#f-privacy [data-privacy-open]').click();
    await expect(page.locator('#pv-body')).toContainText(lang === 'ar' ? 'الطول ونوع الدراجة' : 'Height, bike type');
    seen.push(await shownWords(page));
    await page.click('#pv-close');
    await page.click('#waiver-open');
    seen.push(await shownWords(page));
    await page.click('#waiver-close');
    await agree(page);
    await page.click('#submit');
    await expect(page.locator('#success')).toBeVisible();
    await expect(page.locator('#chip-booking-value')).toHaveText('D-002');
    seen.push(await shownWords(page));
    // The calendar file is Dukan's too: its title, its maker, and no address that names the page.
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#calendar')]);
    expect(dl.suggestedFilename()).toBe('dukan-D-002.ics');
    seen.push(readFileSync(await dl.path(), 'utf8'));
    // The find and cancel dialogs.
    await page.click('#cancel-booking');
    seen.push(await shownWords(page));
    await page.click('#ask-no');
    const all = seen.join('\n');
    expect(all).not.toMatch(OTHER_COMPANY);
    expect(all).not.toMatch(/Circuit Night|Wednesdays/);
    // nor the services the database and the page run on: the full notice it links to names them
    expect(all).not.toMatch(/Supabase|Cloudflare/);
    expect(all).toMatch(/Dukan|الدكان|D-002/);
  });
}

test('Edit opens a Dukan booking on its summary and saves it as Dukan\'s, with its height and bike', async ({ page }) => {
  const edits: Record<string, unknown>[] = [];
  const SAVED = { kind: 'dukan', name: 'Amal Booked', company: 'Dukan', phone: '+966512345678', height: 168, type: 'Hybrid', session: { id: S1.id, start: S1.start, end: S1.end, collect: '18:45', place: null }, bookingNo: 'D-004', submittedAt: '2099-02-01T10:00:00Z' };
  await page.addInitScript((s) => localStorage.setItem('mm-petromin-registration', JSON.stringify(s)), SAVED);
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/rider_lookup', (r) => r.fulfill(json({ ok: true, booking_no: 'D-004', badge: 'DK512345678', name: 'Amal Booked', company: 'Dukan', phone: '+966512345678', height: 168, type: 'Hybrid', session: S1, riders: [], more: [] })));
  await page.route('**/rest/v1/rpc/rider_edit', (r) => { edits.push(r.request().postDataJSON()); return r.fulfill(json(BOOKED('D-004'))); });
  await page.goto('/petromin?lang=en');
  await expect(page.locator('#chip-booking-value')).toHaveText('D-004');
  await expect(page.locator('html')).toHaveAttribute('data-co', 'dukan');
  await page.click('#edit');
  await expect(page.locator('.step[data-pane="check"]')).toBeVisible();
  await expect(page.locator('#form .title')).toHaveText('Edit your booking');
  await expect(page.locator('#review .rv')).toHaveCount(3);
  await expect(page.locator('#review')).toContainText('168 cm · Hybrid');
  await expect(page.locator('#review')).not.toContainText(/Circuit Night/);
  await expect(page.locator('#f-privacy')).toBeHidden();
  // Change the bike: its step, then Continue comes straight back to the summary.
  await page.click('#review .rv-change[data-go="4"]');
  await page.click('#types .tile[data-v="Mountain"]');
  await page.click('#next');
  await expect(page.locator('.step[data-pane="check"]')).toBeVisible();
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('.done-note')).toHaveText('Your booking was updated.');
  expect(edits[0]).toEqual({ p_booking_no: 'D-004', p_proof_phone: '+966512345678', p_badge: '', p_name: 'Amal Booked', p_height: 168, p_type: 'Mountain', p_session_id: S1.id, p_company: 'Dukan', p_phone: '+966512345678', p_riders: [], p_waiver: '2026-10-v3', p_lang: 'en', p_from_session: S1.id });
  // While it was edited the other kinds of rider could not be picked on the first step.
  await page.click('#edit');
  await page.click('#back'); await page.click('#back'); await page.click('#back'); await page.click('#back');
  await expect(page.locator('.step[data-step="1"]')).toBeVisible();
  await expect(page.locator('#companies .company[data-v="Dukan"]')).toBeEnabled();
  for (const co of ['Petromin', 'Petrolube', 'Guest']) await expect(page.locator(`#companies .company[data-v="${co}"]`)).toBeDisabled();
});

test('Dukan\'s own Privacy Notice opens from its steps, says the height and bike are asked, and its version is 2026-11-13', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin?lang=en');
  await pickNight(page, 0, 'Dukan');
  await details(page);
  await bike(page);
  await toCheck(page);
  await page.locator('#f-privacy [data-privacy-open]').click();
  const body = page.locator('#pv-body');
  await expect(body).toContainText('Last updated: 13 November 2026');
  await expect(body).toContainText('Height, bike type');
  await expect(body).toContainText('To give you a bike that fits');
  await expect(body).toContainText('Your employer (Dukan)');
  await expect(body).not.toContainText(/Petromin|Petrolube|Badge/);
  await page.click('#pv-close');
  await setLang(page, 'ar');
  await page.locator('#f-privacy [data-privacy-open]').click();
  await expect(body).toContainText('آخر تحديث: 13 نوفمبر 2026');
  await expect(body).toContainText('الطول ونوع الدراجة');
});

test('Dukan\'s steps and ticket pass an accessibility check, in English and Arabic', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(BOOKED())));
  for (const lang of ['en', 'ar']) {
    await page.goto(`/petromin?lang=${lang}`);
    expect(await axe(page), `${lang} the company`).toEqual([]);
    await page.click('#next'); // no company: its message showing
    expect(await axe(page), `${lang} the company with its message`).toEqual([]);
    await pickCompany(page, 'Dukan');
    await expect(page.locator('#sessions .session')).toHaveCount(1);
    expect(await axe(page), `${lang} the night`).toEqual([]);
    await pickNight(page);
    await page.click('#next'); // nothing filled in: every message showing
    expect(await axe(page), `${lang} the details with their messages`).toEqual([]);
    await details(page);
    await page.click('#next');
    expect(await axe(page), `${lang} height and bike with their messages`).toEqual([]);
    await bike(page);
    await toCheck(page);
    expect(await axe(page), `${lang} check and agree`).toEqual([]);
    await agree(page);
    await page.click('#submit');
    await expect(page.locator('#success')).toBeVisible();
    expect(await axe(page), `${lang} ticket`).toEqual([]);
    await page.evaluate(() => localStorage.clear());
  }
});

test('register goes all the way for Dukan with the helper every spec uses', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json({ ...BOOKED('D-007'), resubmitted: true })));
  await page.goto('/petromin?lang=en');
  await register(page, { company: 'Dukan' });
  await expect(page.locator('#chip-booking-value')).toHaveText('D-007');
  await expect(page.locator('.done-note')).toHaveText('Your details were updated.'); // the same phone on the same night again
});
