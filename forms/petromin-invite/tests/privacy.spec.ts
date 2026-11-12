import type { Page } from '@playwright/test';
import { test, expect, json, S1, SAVED, booking, toCheck } from './flow';

// The Privacy Notice (Personal Data Protection Law, Arts. 12-13): readable beside a required "I have read the Privacy
// Notice" box on the last step (and from the form's own footer on its own page). A new booking does not go through
// without the box; editing a booking does not ask again. This form's notice is its own: what a guest gives (name,
// mobile, bike type, the night, the versions agreed to), kept as the booking records are, no company named but
// MicroMobility and Petromin, and no hosting service named.
async function toNotice(page: Page) {
  await toCheck(page);
  await page.locator('#f-privacy [data-privacy-open]').click();
}

test('the notice says what is collected, who receives it, where it is kept, and for how long', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin-invite?lang=en');
  await toNotice(page);
  const d = page.locator('#privacy-dialog');
  await expect(d).toBeVisible();
  await expect(d.locator('#pv-title')).toHaveText('Privacy Notice');
  const body = d.locator('#pv-body');
  await expect(body).toContainText('Full name, mobile number');
  await expect(body).toContainText('Bike type');
  await expect(body).toContainText('Session');
  await expect(body).toContainText('The versions of the ride waiver and of this notice you agreed to');
  await expect(body).toContainText('bike nights Petromin invites you to');
  await expect(body).toContainText('kept as our other booking records are');
  await expect(body).not.toContainText(/Badge|Height|Companion|employer|billing your/i);
  await expect(body).toContainText('Frankfurt, Germany');
  await expect(body).toContainText('micromobility.sa/privacy');
  await expect(body.locator('a[href="https://micromobility.sa/privacy"]')).toHaveCount(1);
  await expect(body).not.toContainText(/Dukan|Petrolube|Supabase|Cloudflare/);
  await expect(d.locator('#pv-note')).toBeHidden();
  await d.locator('#pv-close').click();
  await expect(d).toBeHidden();
});

test('Arabic reads the Arabic text; French reads the English under a note', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin-invite?lang=ar');
  await toNotice(page);
  await expect(page.locator('#pv-title')).toHaveText('إشعار الخصوصية');
  await expect(page.locator('#pv-body')).toContainText('ما يجمعه هذا النموذج ولماذا');
  await expect(page.locator('#pv-body')).toContainText('تدعوك إليها بترومين');
  await expect(page.locator('#pv-body')).toContainText('نوع الدراجة');
  await expect(page.locator('#pv-note')).toBeHidden();
  await page.locator('#pv-close').click();

  await page.goto('/petromin-invite?lang=fr');
  await toNotice(page);
  await expect(page.locator('#pv-title')).toHaveText('Avis de confidentialité');
  await expect(page.locator('#pv-note')).toHaveText('Cet avis est disponible en anglais et en arabe.');
  await expect(page.locator('#pv-body')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#pv-body')).toContainText('Who we are');
});

test('a booking does not go through until the notice is confirmed, and sends the notice it confirmed', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_book', booking(regs));
  await page.goto('/petromin-invite?lang=en');
  await toCheck(page);
  // the notice link beside the box opens it without ticking the box
  await page.locator('#f-privacy [data-privacy-open]').click();
  await expect(page.locator('#privacy-dialog')).toBeVisible();
  await page.locator('#pv-close').click();
  await expect(page.locator('#privacy')).not.toBeChecked();

  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#f-privacy')).toHaveClass(/invalid/);
  await expect(page.locator('#f-privacy .err')).toHaveText('Please confirm you’ve read the Privacy Notice.');
  expect(regs).toHaveLength(0);

  await page.check('#privacy');
  await expect(page.locator('#f-privacy')).not.toHaveClass(/invalid/);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(1);
  expect(regs[0]).toMatchObject({ p_privacy: 'pminvite-2026-11-12', p_waiver: '2026-10-v3' });
});

test("the server's {error:'privacy'} shows the box's message", async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_book', (r) => r.fulfill(json({ ok: false, error: 'privacy' })));
  await page.goto('/petromin-invite?lang=en');
  await toCheck(page);
  await page.check('#privacy'); await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#f-privacy')).toHaveClass(/invalid/);
  await expect(page.locator('#success')).toBeHidden();
});

test('editing a booking does not ask again', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => r.abort());
  await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), SAVED);
  await page.goto('/petromin-invite?lang=en');
  await page.click('#edit');
  await expect(page.locator('#f-waiver')).toBeVisible();
  await expect(page.locator('#f-privacy')).toBeHidden();
});
