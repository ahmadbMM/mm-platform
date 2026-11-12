import { test, expect, type Page } from '@playwright/test';
import { json, S1, SAVED, BOOKED, toCheck } from './flow';

// The Privacy Notice (Personal Data Protection Law, Arts. 12-13): readable beside a required "I have read the Privacy
// Notice" box on the last step (and from the form's own footer on its own page). A new registration does not go through
// without the box; editing a booking does not ask again. This form's notice is its own: the two details it asks, Dukan as
// the employer, and no other company named.
async function toNotice(page: Page) {
  await toCheck(page);
  await page.locator('#f-privacy [data-privacy-open]').click();
}

test('the notice says what is collected, who receives it, where it is kept', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/dukan?lang=en');
  await toNotice(page);
  const d = page.locator('#privacy-dialog');
  await expect(d).toBeVisible();
  await expect(d.locator('#pv-title')).toHaveText('Privacy Notice');
  await expect(d.locator('#pv-body')).toContainText('Full name, mobile number');
  await expect(d.locator('#pv-body')).not.toContainText(/Badge|Height|Companion/i);
  await expect(d.locator('#pv-body')).toContainText('Your employer (Dukan): the names of the riders on its rides, and nothing else');
  await expect(d.locator('#pv-body')).toContainText('Frankfurt, Germany');
  await expect(d.locator('#pv-body')).toContainText('micromobility.sa/privacy');
  await expect(d.locator('#pv-body')).not.toContainText(/Petromin|Petrolube|Supabase|Cloudflare/);
  await expect(d.locator('#pv-note')).toBeHidden();
  await d.locator('#pv-close').click();
  await expect(d).toBeHidden();
});

test('Arabic reads the Arabic text; French reads the English under a note', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/dukan?lang=ar');
  await toNotice(page);
  await expect(page.locator('#pv-title')).toHaveText('إشعار الخصوصية');
  await expect(page.locator('#pv-body')).toContainText('ما يجمعه هذا النموذج ولماذا');
  await expect(page.locator('#pv-body')).toContainText('صاحب عملك (الدكان)');
  await expect(page.locator('#pv-note')).toBeHidden();
  await page.locator('#pv-close').click();

  await page.goto('/dukan?lang=fr');
  await toNotice(page);
  await expect(page.locator('#pv-title')).toHaveText('Avis de confidentialité');
  await expect(page.locator('#pv-note')).toHaveText('Cet avis est disponible en anglais et en arabe.');
  await expect(page.locator('#pv-body')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#pv-body')).toContainText('Who we are');
});

test('a registration does not go through until the notice is confirmed, and sends the notice it confirmed', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(BOOKED())); });
  await page.goto('/dukan?lang=en');
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
  expect(regs[0]).toMatchObject({ p_privacy: 'dukan-2026-11-12', p_waiver: '2026-10-v3' });
});

test('editing a booking does not ask again', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_lookup', (r) => r.abort());
  await page.addInitScript((s) => localStorage.setItem('mm-dukan-registration', JSON.stringify(s)), SAVED);
  await page.goto('/dukan?lang=en');
  await page.click('#edit');
  await expect(page.locator('#f-waiver')).toBeVisible();
  await expect(page.locator('#f-privacy')).toBeHidden();
});
