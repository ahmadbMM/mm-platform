import { test, expect } from '@playwright/test';

// The Privacy Notice (Personal Data Protection Law, Arts. 12-13): readable from the footer and
// beside a required "I have read the Privacy Notice" box on the last step. A new registration
// does not go through without the box; editing a booking does not ask again.
const S1 = { id: '2099-02-08-pw', title: "Petromin's Wednesdays", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' };
const json = (body: unknown) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('the footer opens the notice: what is collected, who receives it, where it is kept', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin?lang=en');
  await page.locator('footer [data-privacy-open]').click();
  const d = page.locator('#privacy-dialog');
  await expect(d).toBeVisible();
  await expect(d.locator('#pv-title')).toHaveText('Privacy Notice');
  await expect(d.locator('#pv-body')).toContainText('Badge number, company');
  await expect(d.locator('#pv-body')).toContainText('the names of the riders on its rides, and nothing else');
  await expect(d.locator('#pv-body')).toContainText('Mumbai, India');
  await expect(d.locator('#pv-note')).toBeHidden();
  await d.locator('#pv-close').click();
  await expect(d).toBeHidden();
});

test('Arabic reads the Arabic text; French reads the English under a note', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin?lang=ar');
  await page.locator('footer [data-privacy-open]').click();
  await expect(page.locator('#pv-title')).toHaveText('إشعار الخصوصية');
  await expect(page.locator('#pv-body')).toContainText('ما يجمعه هذا النموذج ولماذا');
  await expect(page.locator('#pv-note')).toBeHidden();
  await page.locator('#pv-close').click();

  await page.goto('/petromin?lang=fr');
  await page.locator('footer [data-privacy-open]').click();
  await expect(page.locator('#pv-title')).toHaveText('Avis de confidentialité');
  await expect(page.locator('#pv-note')).toHaveText('Cet avis est disponible en anglais et en arabe.');
  await expect(page.locator('#pv-body')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#pv-body')).toContainText('Who we are');
});

test('a registration does not go through until the notice is confirmed', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, id: 1, match: 'none', resubmitted: false, booking_no: 'P-001', session: S1 })); });
  await page.goto('/petromin?lang=en');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', 'A-12'); await page.fill('#name', 'Amal Booked'); await page.fill('#phone', '512345678');
  await page.click('#next');
  await page.fill('#height', '175'); await page.click('#types .tile[data-v="Hybrid"]');
  // the notice link beside the box opens it without ticking the box
  await page.locator('#f-privacy [data-privacy-open]').click();
  await expect(page.locator('#privacy-dialog')).toBeVisible();
  await page.locator('#pv-close').click();
  await expect(page.locator('#privacy')).not.toBeChecked();

  await page.click('#submit');
  await expect(page.locator('#f-privacy')).toHaveClass(/invalid/);
  await expect(page.locator('#f-privacy .err')).toHaveText('Please confirm you’ve read the Privacy Notice.');
  expect(regs).toHaveLength(0);

  await page.check('#privacy');
  await expect(page.locator('#f-privacy')).not.toHaveClass(/invalid/);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(1);
});

test('editing a booking does not ask again', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.addInitScript(() => localStorage.setItem('mm-petromin-registration', JSON.stringify({ badge: 'A-12', name: 'Amal Booked', company: 'Petromin', phone: '+966512345678', height: 175, type: 'Hybrid', session: { id: '2099-02-08-pw', start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' }, bookingNo: 'P-001', submittedAt: '2099-02-01T10:00:00Z' })));
  await page.goto('/petromin?lang=en');
  await page.click('#edit');
  await page.click('#next'); await page.click('#next');
  await expect(page.locator('#f-privacy')).toBeHidden();
});
