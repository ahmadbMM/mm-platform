import { test, expect, type Page } from '@playwright/test';

// The emergency contact (the owner, 2026-10-07): the first contact is required on "Your details", its
// number may not be the employee's own; a second contact is optional, all three boxes or none, and
// neither the employee's number nor the first contact's. One pair covers the whole booking and goes to
// rider_register / rider_edit as p_emergency. A database before its migration (PGRST202) gets the call
// once more without it.
const S1 = { id: '2099-02-08-pw', title: "Petromin's Wednesdays", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' };
const json = (body: unknown, status = 200) => ({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });
const OK = { ok: true, id: 1, match: 'none', resubmitted: false, booking_no: 'P-001', riders: 1, session: S1 };
const SAVED = { badge: 'A-12', name: 'Amal Booked', company: 'Petromin', phone: '+966512345678', height: 175, type: 'Hybrid', session: { id: S1.id, start: S1.start, end: S1.end }, bookingNo: 'P-001', submittedAt: '2099-02-01T10:00:00Z' };
const PGRST202 = { code: 'PGRST202', details: null, hint: null, message: 'Could not find the function public.rider_edit(...) in the schema cache' };

async function toDetails(page: Page, lang = 'en') {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto(`/petromin?lang=${lang}`);
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', 'A-12'); await page.fill('#name', 'Amal Booked'); await page.fill('#phone', '512345678');
}
async function finish(page: Page) {
  await page.fill('#height', '175'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.check('#privacy'); await page.check('#waiver');
  await page.click('#submit');
}

test('the first contact is required: Continue stays on Your details until all three boxes are right', async ({ page }) => {
  const regs: unknown[] = [];
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(OK)); });
  await toDetails(page);
  await expect(page.locator('#f-em .em-title')).toHaveText('Emergency contact');
  await expect(page.locator('#em2')).toBeHidden();
  await page.click('#next');
  await expect(page.locator('#card')).toHaveAttribute('data-step', '2');
  await expect(page.locator('#f-em-name .err')).toHaveText('Enter your contact’s name.');
  await expect(page.locator('#f-em-phone .err')).toHaveText('Enter your contact’s mobile number.');
  await expect(page.locator('#f-em-rel .err')).toHaveText('Choose how they are related to you.');
  await expect(page.locator('#em-name')).toBeFocused();
  await expect(page.locator('#em-name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#em-rel')).toHaveAccessibleDescription('Choose how they are related to you.');

  // One word, or an initial, is not a name; a typed dash becomes a space.
  await page.fill('#em-name', 'Huda');
  await page.fill('#em-phone', '551112222');
  await page.selectOption('#em-rel', 'parent');
  await page.click('#next');
  await expect(page.locator('#card')).toHaveAttribute('data-step', '2');
  await expect(page.locator('#f-em-name .err')).toHaveText('Write your contact’s first and last name in full, not initials');
  await expect(page.locator('#f-em-phone')).not.toHaveClass(/invalid/);
  await expect(page.locator('#f-em-rel')).not.toHaveClass(/invalid/);
  await page.fill('#em-name', 'Huda Al-Harbi');
  await expect(page.locator('#em-name')).toHaveValue('Huda Al Harbi');
  await page.click('#next');
  await expect(page.locator('#card')).toHaveAttribute('data-step', '3');

  await finish(page);
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(1);
  expect((regs[0] as Record<string, unknown>).p_emergency).toEqual({ name: 'Huda Al Harbi', phone: '+966551112222', relation: 'parent' });
});

test("the contact's number cannot be the employee's own, nor the second contact the first's", async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(OK)); });
  await toDetails(page);
  await page.fill('#em-name', 'Huda Contact'); await page.selectOption('#em-rel', 'spouse');
  await page.fill('#em-phone', '0512345678'); // the employee's 512345678, typed with its 0
  await page.click('#next');
  await expect(page.locator('#card')).toHaveAttribute('data-step', '2');
  await expect(page.locator('#f-em-phone .err')).toHaveText('Your contact’s number can’t be your own.');
  await expect(page.locator('#em-phone')).toBeFocused();
  // The employee's number with its country code, typed under another code, is still the employee's.
  await page.selectOption('#em-cc', '971');
  await page.fill('#em-phone', '0512345678');
  await page.click('#next');
  await expect(page.locator('#f-em-phone .err')).toHaveText('Your contact’s number can’t be your own.');
  await page.selectOption('#em-cc', '966');
  await page.fill('#em-phone', '551112222');

  await page.click('#add-em2');
  await expect(page.locator('#em2')).toBeVisible();
  await expect(page.locator('#add-em2')).toBeHidden();
  await expect(page.locator('#em2-name')).toBeFocused();
  await page.fill('#em2-name', 'Omar Contact'); await page.fill('#em2-phone', '551112222'); await page.selectOption('#em2-rel', 'friend');
  await page.click('#next');
  await expect(page.locator('#f-em2-phone .err')).toHaveText('The second contact’s number must be different from the first.');
  await expect(page.locator('#f-em-phone')).not.toHaveClass(/invalid/);
  await page.fill('#em2-phone', '512345678');
  await page.click('#next');
  await expect(page.locator('#f-em2-phone .err')).toHaveText('Your contact’s number can’t be your own.');
  await page.fill('#em2-phone', '553334444');
  await page.click('#next');
  await finish(page);
  await expect(page.locator('#success')).toBeVisible();
  expect(regs[0].p_emergency).toEqual({ name: 'Huda Contact', phone: '+966551112222', relation: 'spouse', name2: 'Omar Contact', phone2: '+966553334444', relation2: 'friend' });
});

test('the second contact is optional: all three boxes or none, and Remove leaves it out', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(OK)); });
  await toDetails(page);
  await page.fill('#em-name', 'Huda Contact'); await page.fill('#em-phone', '551112222'); await page.selectOption('#em-rel', 'sibling');
  await page.click('#add-em2');
  await expect(page.getByRole('button', { name: 'Remove Second emergency contact', exact: true })).toBeVisible();
  await page.fill('#em2-name', 'Omar Contact'); // name only: the number and relation are asked for
  await page.click('#next');
  await expect(page.locator('#card')).toHaveAttribute('data-step', '2');
  await expect(page.locator('#f-em2-phone .err')).toHaveText('Enter your contact’s mobile number.');
  await expect(page.locator('#f-em2-rel .err')).toHaveText('Choose how they are related to you.');
  await expect(page.locator('#f-em2-name')).not.toHaveClass(/invalid/);
  await page.click('#em2-remove');
  await expect(page.locator('#em2')).toBeHidden();
  await expect(page.locator('#add-em2')).toBeVisible();
  await page.click('#next');
  await expect(page.locator('#card')).toHaveAttribute('data-step', '3');
  await finish(page);
  await expect(page.locator('#success')).toBeVisible();
  expect(regs[0].p_emergency).toEqual({ name: 'Huda Contact', phone: '+966551112222', relation: 'sibling' });
  // Opened and left empty is the same as none.
  await page.click('#another');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await expect(page.locator('#em-name')).toHaveValue(''); // the next person gives their own
  await expect(page.locator('#em2')).toBeHidden();
});

test('an edit shows the saved contacts, sends them as p_emergency, and a booking saved without one is asked for it', async ({ page }) => {
  const edits: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_edit', (r) => { edits.push(r.request().postDataJSON()); return r.fulfill(json({ ...OK, resubmitted: true })); });
  const withEm = { ...SAVED, emergency: { name: 'Huda Contact', phone: '+971501234567', relation: 'spouse', name2: 'Omar Contact', phone2: '+966553334444', relation2: 'colleague' } };
  await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mm-petromin-registration', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } }, withEm);
  await page.goto('/petromin?lang=en');
  await page.click('#edit');
  await page.click('#next');
  await expect(page.locator('#em-name')).toHaveValue('Huda Contact');
  await expect(page.locator('#em-cc')).toHaveValue('971');
  await expect(page.locator('#em-phone')).toHaveValue('501234567');
  await expect(page.locator('#em-rel')).toHaveValue('spouse');
  await expect(page.locator('#em2')).toBeVisible();
  await expect(page.locator('#em2-name')).toHaveValue('Omar Contact');
  await expect(page.locator('#em2-rel')).toHaveValue('colleague');
  await page.click('#next');
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(edits[0].p_emergency).toEqual(withEm.emergency);

  // A booking from before the contact was asked: the edit asks for it on Your details.
  await page.evaluate((s) => localStorage.setItem('mm-petromin-registration', JSON.stringify(s)), SAVED);
  await page.reload();
  await page.click('#edit');
  await page.click('#next');
  await expect(page.locator('#em-name')).toHaveValue('');
  await expect(page.locator('#em2')).toBeHidden();
  await page.click('#next');
  await expect(page.locator('#card')).toHaveAttribute('data-step', '2');
  await expect(page.locator('#f-em-name')).toHaveClass(/invalid/);
  expect(edits).toHaveLength(1);
});

test('rider_edit on a database without p_emergency yet is tried once more without it', async ({ page }) => {
  const edits: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_edit', (r) => {
    const body = r.request().postDataJSON() as Record<string, unknown>; edits.push(body);
    return 'p_emergency' in body ? r.fulfill(json(PGRST202, 404)) : r.fulfill(json({ ...OK, resubmitted: true }));
  });
  await page.addInitScript((s) => localStorage.setItem('mm-petromin-registration', JSON.stringify(s)), { ...SAVED, emergency: { name: 'Huda Contact', phone: '+966551112222', relation: 'spouse' } });
  await page.goto('/petromin?lang=en');
  await page.click('#edit');
  await page.click('#next'); await page.click('#next');
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(edits).toHaveLength(2);
  expect(edits[0].p_emergency).toEqual({ name: 'Huda Contact', phone: '+966551112222', relation: 'spouse' });
  expect(edits[1]).not.toHaveProperty('p_emergency');
  expect({ ...edits[1], p_emergency: edits[0].p_emergency }).toEqual(edits[0]);
});

test("the database's refusal of a contact (BAD_INPUT) is shown on its box, in the page language", async ({ page }) => {
  let answer = { code: '22023', details: 'em_self', hint: 'second', message: 'BAD_INPUT' };
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(answer, 400)));
  await toDetails(page, 'ar');
  await expect(page.locator('#f-em .em-title')).toHaveText('جهة اتصال للطوارئ');
  await expect(page.locator('label[for="em-name"]')).toHaveText('اسم جهة الاتصال');
  await expect(page.locator('#em-rel option[value="sibling"]')).toHaveText('الأخ أو الأخت');
  await expect(page.locator('#add-em2')).toHaveText('إضافة جهة اتصال ثانية (اختياري)');
  await page.fill('#em-name', 'Huda Contact'); await page.fill('#em-phone', '551112222'); await page.selectOption('#em-rel', 'spouse');
  await page.click('#add-em2');
  await page.fill('#em2-name', 'Omar Contact'); await page.fill('#em2-phone', '553334444'); await page.selectOption('#em2-rel', 'friend');
  await page.click('#next');
  await finish(page);
  await expect(page.locator('#card')).toHaveAttribute('data-step', '2');
  await expect(page.locator('#f-em2-phone .err')).toHaveText('لا يمكن أن يكون رقم جهة الاتصال هو رقمك.');
  await expect(page.locator('#success')).toBeHidden();
  answer = { code: '22023', details: 'em_relation', hint: '', message: 'BAD_INPUT' };
  await page.click('#next');
  await page.click('#submit');
  await expect(page.locator('#f-em-rel .err')).toHaveText('اختر صلة القرابة.');
  await expect(page.locator('#em-rel')).toBeFocused();
});

for (const lang of ['ar', 'ur', 'fr', 'es', 'pt', 'hi', 'ne', 'tl', 'bn']) {
  test(`every emergency contact string has a ${lang} translation`, async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.goto(`/petromin?lang=${lang}`, { waitUntil: 'networkidle' });
    const { missing, same } = await page.evaluate(() => {
      const w = window as unknown as { RiderRegistration?: { translations?: Record<string, Record<string, string>> } };
      const dict = w.RiderRegistration!.translations![document.documentElement.lang] || {};
      const keys = Array.from(new Set(Array.from(document.querySelectorAll('#f-em [data-t]')).map((e) => e.getAttribute('data-t')!)));
      keys.push('Your contact’s number can’t be your own.', 'Write your contact’s first and last name in full, not initials', 'The second contact’s number must be different from the first.');
      // Some words are the same as the English one in a language (French "Parent", Tagalog "Emergency contact").
      const ok = ['Parent', 'Emergency contact'];
      return { missing: keys.filter((k) => !(k in dict)), same: keys.filter((k) => ok.indexOf(k) < 0 && dict[k] === k) };
    });
    expect(missing, `keys with no ${lang} translation`).toEqual([]);
    expect(same, `keys left in English for ${lang}`).toEqual([]);
  });
}
