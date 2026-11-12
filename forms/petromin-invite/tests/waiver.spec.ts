import type { Page } from '@playwright/test';
import { test, expect, json, S1, SAVED, booking, toCheck } from './flow';

// The ride waiver (owner, 2026-10-03): nobody books, and no edit is saved, without ticking it. The call carries
// p_waiver '2026-10-v3', and is never sent again without it.
const PGRST202 = { code: 'PGRST202', details: 'Searched for the function public.petromin_invite_book with parameters ...', hint: null, message: 'Could not find the function public.petromin_invite_book(...) in the schema cache' };

async function fillToLastStep(page: Page, lang = 'en') {
  await page.goto(`/petromin-invite?lang=${lang}`);
  await toCheck(page);
  await page.check('#privacy');
}

test('a booking without the waiver is refused and nothing is sent; ticked, petromin_invite_book gets p_waiver', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_book', booking(regs));
  await fillToLastStep(page);
  await expect(page.locator('#waiver-open')).toHaveText('Read the waiver');
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

test('an edit needs the waiver too, and gets p_waiver', async ({ page }) => {
  const edits: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => r.abort());
  await page.route('**/rest/v1/rpc/petromin_invite_book', booking(edits, 'I-004', { resubmitted: true }));
  await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), SAVED);
  await page.goto('/petromin-invite?lang=en');
  await page.click('#edit');
  await expect(page.locator('#f-waiver')).toBeVisible();
  await page.click('#submit');
  await expect(page.locator('#f-waiver .err')).toHaveText('Please accept the waiver to continue.');
  expect(edits).toHaveLength(0);
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(edits).toHaveLength(1);
  expect(edits[0]).toMatchObject({ p_from_no: 'I-004', p_waiver: '2026-10-v3' });
});

test('a call the database does not know yet (PGRST202) is never sent again without its arguments', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_book', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(PGRST202, 404)); });
  await fillToLastStep(page);
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#banner .banner-text')).toHaveText('We could not save this. Please try again.');
  await expect(page.locator('#success')).toBeHidden();
  expect(regs).toHaveLength(1);
  expect(regs[0]).toMatchObject({ p_waiver: '2026-10-v3', p_privacy: 'pminvite-2026-11-12' });
});

test('any other server error is not retried', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_book', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json({ code: '42501', message: 'permission denied' }, 401)); });
  await fillToLastStep(page);
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#banner')).toBeVisible();
  expect(regs).toHaveLength(1);
});

test("the server's {error:'waiver'} shows the waiver message on the box; a WAIVER_OUTDATED says to reload", async ({ page }) => {
  let answer: { body: unknown; status: number } = { body: { ok: false, error: 'waiver' }, status: 200 };
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_book', (r) => r.fulfill(json(answer.body, answer.status)));
  await fillToLastStep(page, 'ar');
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#f-waiver')).toHaveClass(/invalid/);
  await expect(page.locator('#f-waiver .err')).toHaveText('يرجى الموافقة على الإقرار للمتابعة.');
  await expect(page.locator('#waiver')).toBeFocused();
  await expect(page.locator('#success')).toBeHidden();
  answer = { body: { code: 'P0001', details: null, hint: null, message: 'WAIVER_OUTDATED' }, status: 400 };
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#banner .banner-text')).toHaveText('تغيّر إقرار الركوب. أعد تحميل هذه الصفحة لقراءة الإقرار الجديد والموافقة عليه.');
});

test('the full waiver text reads in English and Arabic, Arabic right to left, and the agree line is the guest\'s own', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await fillToLastStep(page, 'en');
  const text = page.locator('#waiver-text');
  await expect(text).toBeHidden();
  await page.click('#waiver-open');
  await expect(page.locator('#waiver-dialog')).toBeVisible();
  await expect(page.locator('#waiver-title')).toHaveText('Ride waiver');
  await expect(text).toContainText('You cannot book any ride or activity');
  await expect(text).toContainText('The bike is returned in the condition it was received.');
  await page.click('#waiver-close');
  await expect(page.locator('#waiver-dialog')).toBeHidden();
  await expect(page.locator('#f-waiver .privacy-check')).toHaveText('I have read the waiver and agree to it');

  await fillToLastStep(page, 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.click('#waiver-open');
  await expect(page.locator('#waiver-title')).toHaveText('إقرار الركوب');
  await expect(text).toContainText('لا يمكنك حجز أي رحلة أو نشاط');
  await page.click('#waiver-close');
  await expect(page.locator('#f-waiver .privacy-check')).toHaveText('قرأت الإقرار وأوافق عليه');
});

test("Urdu reads right to left, with the booking app's Urdu waiver", async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await fillToLastStep(page, 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
  if (await page.locator('#lang').count()) await expect(page.locator('#lang')).toHaveValue('ur');
  await expect(page.locator('#form .title')).toHaveText('پیٹرومن سائیکل نائٹ: مدعو مہمان');
  await page.click('#waiver-open');
  await expect(page.locator('#waiver-title')).toHaveText('رائیڈ ویور');
  await expect(page.locator('#waiver-text')).toContainText('اس اقرار نامے کو پڑھ کر اس سے اتفاق کیے بغیر');
});

for (const lang of ['ar', 'ur', 'fr', 'es', 'pt', 'hi', 'ne', 'tl', 'bn', 'id', 'ms', 'de', 'ru', 'zh', 'ja']) {
  test(`every waiver string has a ${lang} translation`, async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.goto(`/petromin-invite?lang=${lang}`, { waitUntil: 'networkidle' });
    const { missing, same } = await page.evaluate(() => {
      const w = window as unknown as { RiderRegistration?: { translations?: Record<string, Record<string, string>> } };
      const dict = w.RiderRegistration!.translations![document.documentElement.lang] || {};
      const keys = Array.from(document.querySelectorAll('#f-waiver [data-t], #waiver-dialog [data-t]')).map((e) => e.getAttribute('data-t')!);
      keys.push('Please accept the waiver to continue.');
      // The title may equal the English one (Tagalog "Ride waiver"); the text, agree line and message may not.
      return { missing: keys.filter((k) => !(k in dict)), same: keys.filter((k) => k !== 'Ride waiver' && dict[k] === k) };
    });
    expect(missing, `keys with no ${lang} translation`).toEqual([]);
    expect(same, `keys left in English for ${lang}`).toEqual([]);
  });
}
