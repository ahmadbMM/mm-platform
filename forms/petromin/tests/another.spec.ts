import { test, expect } from '@playwright/test';

// One phone, several people. Edit changes the booking on the screen (its session, its people), so a
// second person registers through "Register another": a fresh form, the first confirmation kept on
// the phone (a reload or Cancel shows it again), and afterwards both reachable, the other one listed
// under the confirmation.
const S1 = { id: '2099-02-08-pw', title: "Petromin's Wednesdays", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' };
const S2 = { id: '2099-02-15-pw', title: "Petromin's Wednesdays", start: '2099-02-15T19:00:00+03:00', end: '2099-02-15T21:00:00+03:00' };
const json = (body: unknown, status = 200) => ({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });
const SAVED = { badge: 'A-12', name: 'Amal Booked', company: 'Petromin', phone: '+966512345678', height: 175, type: 'Hybrid', session: { id: S1.id, start: S1.start, end: S1.end }, bookingNo: 'P-001', emergency: { name: 'Huda Contact', phone: '+966551112222', relation: 'spouse' }, submittedAt: '2099-02-01T10:00:00Z' };

test('Register another starts a fresh form and keeps the first confirmation; both stay on the phone', async ({ page }) => {
  const regs: Record<string, unknown>[] = []; const edits: unknown[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, id: 2, match: 'none', resubmitted: false, booking_no: 'P-002', session: S2 })); });
  await page.route('**/rest/v1/rpc/rider_edit', (r) => { edits.push(r.request().postDataJSON()); return r.fulfill(json({ ok: false, error: 'notfound' })); });
  await page.addInitScript((s) => { if (!localStorage.getItem('mm-petromin-registration')) localStorage.setItem('mm-petromin-registration', JSON.stringify(s)); }, SAVED);
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('/petromin?lang=en');
  await expect(page.locator('#chip-booking-value')).toHaveText('P-001');
  await expect(page.locator('#another')).toHaveText('Register another');
  await expect(page.locator('#others')).toBeHidden();

  // A fresh form, nothing of the first booking in it, and Cancel back to it.
  await page.click('#another');
  await expect(page.locator('#form .title')).toHaveText('Employees Bike Registration Form');
  await expect(page.locator('#sessions .session[aria-checked="true"]')).toHaveCount(0);
  await expect(page.locator('#badge')).toHaveValue('');
  await expect(page.locator('#name')).toHaveValue('');
  await expect(page.locator('#cancel-edit')).toBeVisible();
  await page.click('#cancel-edit');
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#chip-booking-value')).toHaveText('P-001');

  // A reload in the middle of the new form shows the first confirmation: nothing was replaced.
  await page.click('#another');
  await page.reload();
  await expect(page.locator('#chip-booking-value')).toHaveText('P-001');

  await page.click('#another');
  await page.locator('#sessions .session').nth(1).click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petrolube"]');
  await page.fill('#badge', 'B-7'); await page.fill('#name', 'Basma Second'); await page.fill('#phone', '512345679');
  await page.fill('#em-name', 'Huda Contact'); await page.fill('#em-phone', '551112222'); await page.selectOption('#em-rel', 'spouse');
  await page.click('#next');
  await page.fill('#height', '165'); await page.click('#types .tile[data-v="Mountain"]');
  await expect(page.locator('#privacy')).not.toBeChecked(); // the next person confirms the notice for themselves
  await expect(page.locator('#f-privacy')).toBeVisible();
  await page.check('#privacy'); await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#chip-booking-value')).toHaveText('P-002');
  await expect(page.locator('#cancel-edit')).toBeHidden();
  expect(regs).toHaveLength(1);
  expect(regs[0]).toMatchObject({ p_badge: 'B-7', p_name: 'Basma Second', p_session_id: S2.id, p_company: 'Petrolube' });
  expect(edits).toHaveLength(0); // the first booking was never touched

  // The first one is listed under the new confirmation, after a reload too, and a tap shows it.
  await expect(page.locator('#others-list .other')).toHaveText(['P-001 · Amal Booked']);
  await page.reload();
  await expect(page.locator('#chip-booking-value')).toHaveText('P-002');
  await page.locator('#others-list .other').click();
  await expect(page.locator('#chip-booking-value')).toHaveText('P-001');
  await expect(page.locator('#tk-name')).toHaveText('Amal Booked');
  await expect(page.locator('#others-list .other')).toHaveText(['P-002 · Basma Second']);
  await page.reload();
  await expect(page.locator('#chip-booking-value')).toHaveText('P-001');
  expect(errs).toEqual([]);
});

test('a confirmation whose ride is over gives way to one of the other registrations still ahead', async ({ page }) => {
  const past = { ...SAVED, bookingNo: 'P-009', session: { id: 'x', start: '2020-01-01T19:00:00+03:00', end: '2020-01-01T21:00:00+03:00' } };
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.addInitScript(([cur, kept]) => {
    localStorage.setItem('mm-petromin-registration', JSON.stringify(cur));
    localStorage.setItem('mm-petromin-kept', JSON.stringify([kept]));
  }, [past, SAVED]);
  await page.goto('/petromin?lang=en');
  await expect(page.locator('#chip-booking-value')).toHaveText('P-001');
  await expect(page.locator('#others')).toBeHidden();
});

const WORDS = ['Register another', 'Other registrations on this phone',
  'The ride waiver has changed. Reload this page to read and accept the new one.',
  'This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.'];
for (const lang of ['ar', 'ur', 'fr', 'es', 'pt', 'hi', 'ne', 'tl', 'bn']) {
  test(`Register another, the phone's other registrations and the new refusals read in ${lang}`, async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.goto(`/petromin?lang=${lang}`, { waitUntil: 'networkidle' });
    const { missing, same } = await page.evaluate((keys) => {
      const w = window as unknown as { RiderRegistration?: { translations?: Record<string, Record<string, string>> } };
      const dict = w.RiderRegistration!.translations![document.documentElement.lang] || {};
      return { missing: keys.filter((k) => !(k in dict)), same: keys.filter((k) => dict[k] === k) };
    }, WORDS);
    expect(missing, `keys with no ${lang} translation`).toEqual([]);
    expect(same, `keys left in English for ${lang}`).toEqual([]);
  });
}

test('a waiver the database no longer takes, and a paid booking moved to another price, are said in the page language', async ({ page }) => {
  const refuse = (message: string) => json({ code: 'P0001', details: null, hint: null, message }, 400);
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(refuse('WAIVER_OUTDATED')));
  await page.route('**/rest/v1/rpc/rider_edit', (r) => r.fulfill(refuse('PAID_MOVE')));
  await page.goto('/petromin?lang=ar');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', 'A-12'); await page.fill('#name', 'Amal Booked'); await page.fill('#phone', '512345678');
  await page.fill('#em-name', 'Huda Contact'); await page.fill('#em-phone', '551112222'); await page.selectOption('#em-rel', 'spouse');
  await page.click('#next');
  await page.fill('#height', '175'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.check('#privacy'); await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#banner .banner-text')).toHaveText('تغيّر إقرار الركوب. أعد تحميل هذه الصفحة لقراءة الإقرار الجديد والموافقة عليه.');
  await expect(page.locator('#success')).toBeHidden();

  await page.evaluate((s) => localStorage.setItem('mm-petromin-registration', JSON.stringify(s)), SAVED);
  await page.goto('/petromin?lang=en');
  await page.click('#edit');
  await page.locator('#sessions .session').nth(1).click();
  await page.click('#next'); await page.click('#next');
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#banner .banner-text')).toHaveText('This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.');
});
