import { test, expect, type Page } from '@playwright/test';

// The ride waiver (owner, 2026-10-03): nobody registers, and no edit is saved, without ticking it.
// The calls carry p_waiver '2026-10-v3', and are never sent again without it.
const S1 = { id: '2099-02-08-pw', title: "Petromin's Wednesdays", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' };
const json = (body: unknown, status = 200) => ({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });
const PGRST202 = { code: 'PGRST202', details: 'Searched for the function public.rider_register with parameters ... p_waiver ...', hint: null, message: 'Could not find the function public.rider_register(...) in the schema cache' };
const OK = { ok: true, id: 1, match: 'none', resubmitted: false, booking_no: 'P-001', session: S1 };
const SAVED = { badge: 'A-12', name: 'Amal Booked', company: 'Petromin', phone: '+966512345678', height: 175, type: 'Hybrid', session: { id: S1.id, start: S1.start, end: S1.end }, bookingNo: 'P-001', submittedAt: '2099-02-01T10:00:00Z' };

async function fillToLastStep(page: Page, lang = 'en') {
  await page.goto(`/petromin?lang=${lang}`);
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', 'A-12'); await page.fill('#name', 'Amal Booked'); await page.fill('#phone', '512345678');
  await page.click('#next');
  await page.fill('#height', '175'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.check('#privacy');
}

test('a registration without the waiver is refused and nothing is sent; ticked, rider_register gets p_waiver', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(OK)); });
  await fillToLastStep(page);
  await expect(page.locator('#f-waiver .label')).toHaveText('Ride waiver');
  await expect(page.locator('#waiver')).not.toBeChecked();
  await page.click('#submit');
  await expect(page.locator('#f-waiver')).toHaveClass(/invalid/);
  await expect(page.locator('#f-waiver .err')).toHaveText('Please accept the waiver to continue.');
  await expect(page.locator('#waiver')).toBeFocused();
  expect(regs).toHaveLength(0);

  await page.check('#waiver');
  await expect(page.locator('#f-waiver')).not.toHaveClass(/invalid/);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(1);
  expect(regs[0].p_waiver).toBe('2026-10-v3');
});

test('an edit needs the waiver too, and rider_edit gets p_waiver', async ({ page }) => {
  const edits: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_edit', (r) => { edits.push(r.request().postDataJSON()); return r.fulfill(json({ ...OK, resubmitted: true })); });
  await page.addInitScript((s) => localStorage.setItem('mm-petromin-registration', JSON.stringify(s)), SAVED);
  await page.goto('/petromin?lang=en');
  await page.click('#edit');
  await page.click('#next'); await page.click('#next');
  await expect(page.locator('#f-waiver')).toBeVisible();
  await page.click('#submit');
  await expect(page.locator('#f-waiver .err')).toHaveText('Please accept the waiver to continue.');
  expect(edits).toHaveLength(0);
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(edits).toHaveLength(1);
  expect(edits[0]).toMatchObject({ p_booking_no: 'P-001', p_waiver: '2026-10-v3' });
});

test('a PGRST202 is never retried without p_waiver (the database takes it since 2026-10-03)', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(PGRST202, 404)); });
  await fillToLastStep(page);
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#banner')).toBeVisible();
  await expect(page.locator('#success')).toBeHidden();
  expect(regs).toHaveLength(1);
  expect(regs[0].p_waiver).toBe('2026-10-v3');
});

test('any other server error is not retried', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json({ code: '42501', message: 'permission denied' }, 401)); });
  await fillToLastStep(page);
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#banner')).toBeVisible();
  expect(regs).toHaveLength(1);
});

test("the server's {error:'waiver'} shows the waiver message on the box", async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json({ ok: false, error: 'waiver' })));
  await fillToLastStep(page, 'ar');
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#f-waiver')).toHaveClass(/invalid/);
  await expect(page.locator('#f-waiver .err')).toHaveText('يرجى الموافقة على الإقرار للمتابعة.');
  await expect(page.locator('#waiver')).toBeFocused();
  await expect(page.locator('#success')).toBeHidden();
});

test('the full waiver text reads in English and Arabic, Arabic right to left', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await fillToLastStep(page, 'en');
  const text = page.locator('#waiver-text');
  await expect(text).toContainText('You cannot book any ride or activity');
  await expect(text).toContainText('injury, fracture, illness, loss, theft or damage');
  await expect(text).toContainText('The bike is returned in the condition it was received.');
  await expect(page.locator('#f-waiver .privacy-check')).toHaveText('I have read the waiver and agree to it on behalf of every rider on this registration');

  await fillToLastStep(page, 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#f-waiver .label')).toHaveText('إقرار الركوب');
  await expect(text).toContainText('لا يمكنك حجز أي رحلة أو نشاط');
  await expect(text).toContainText('أي إصابة أو كسر أو مرض أو فقدان أو سرقة أو تلف');
  await expect(page.locator('#f-waiver .privacy-check')).toHaveText('قرأت الإقرار وأوافق عليه نيابةً عن كل راكب في هذا التسجيل');
});

for (const lang of ['ar', 'fr', 'es', 'pt', 'hi', 'ne', 'tl', 'bn']) {
  test(`every waiver string has a ${lang} translation`, async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.goto(`/petromin?lang=${lang}`, { waitUntil: 'networkidle' });
    const { missing, same } = await page.evaluate(() => {
      const w = window as unknown as { RiderRegistration?: { translations?: Record<string, Record<string, string>> } };
      const dict = w.RiderRegistration!.translations![document.documentElement.lang] || {};
      const keys = Array.from(document.querySelectorAll('#f-waiver [data-t]')).map((e) => e.getAttribute('data-t')!);
      keys.push('Please accept the waiver to continue.');
      // The title may equal the English one (Tagalog "Ride waiver"); the text, agree line and message may not.
      return { missing: keys.filter((k) => !(k in dict)), same: keys.filter((k) => k !== 'Ride waiver' && dict[k] === k) };
    });
    expect(missing, `keys with no ${lang} translation`).toEqual([]);
    expect(same, `keys left in English for ${lang}`).toEqual([]);
  });
}
