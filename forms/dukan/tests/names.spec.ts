import { test, expect } from '@playwright/test';
import { json, S1, SAVED, BOOKED, pickNight, toCheck, agree } from './flow';

// Names hold letters, spaces and periods, as on the rentals site: a dash becomes a space ("Al-Harbi" is "Al Harbi"),
// digits, emoji and other signs are dropped as they are typed, every word has two letters, and a booking saved before
// the rule comes back without its dash.

test('a dash in a name becomes a space; digits and emoji go; what is sent has neither', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(BOOKED())); });
  await page.goto('/dukan?lang=en');
  await pickNight(page);
  await page.locator('#name').pressSequentially('Faisal Al-Harbi2');
  await expect(page.locator('#name')).toHaveValue('Faisal Al Harbi');
  // the reason is given under the box, and goes on its own
  await expect(page.locator('#f-name .err')).toHaveText('Names can only contain letters, spaces and periods.');
  await expect(page.locator('#f-name .err')).toBeHidden({ timeout: 6000 });
  await page.fill('#name', 'Faisal Al-Harbi😀❤️'); // a picked emoji leaves its variation selector behind
  await expect(page.locator('#name')).toHaveValue('Faisal Al Harbi');
  await page.fill('#phone', '512345678');
  await page.click('#next');
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs[0].p_name).toBe('Faisal Al Harbi');
});

test('a booking saved with a dashed name reopens without the dash', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_lookup', (r) => r.abort());
  await page.addInitScript((s) => localStorage.setItem('mm-dukan-registration', JSON.stringify({ ...s, name: 'Amal Al-Booked' })), SAVED);
  await page.goto('/dukan?lang=en');
  await page.click('#edit');
  await expect(page.locator('#review')).toContainText('Amal Al Booked');
  await page.click('#review .rv-change[data-go="2"]');
  await expect(page.locator('#name')).toHaveValue('Amal Al Booked');
});

test('the reason reads in the page language, and an empty box still asks for the name', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/dukan?lang=ar');
  await pickNight(page);
  await page.locator('#name').pressSequentially('محمد1');
  await expect(page.locator('#name')).toHaveValue('محمد');
  await expect(page.locator('#f-name .err')).toHaveText('يمكن أن يحتوي الاسم على حروف ومسافات ونقاط فقط.');
  await expect(page.locator('#f-name .err')).toBeHidden({ timeout: 6000 });
  await page.fill('#name', '');
  await page.click('#next');
  await expect(page.locator('#f-name .err')).toHaveText('أدخل اسمك الكامل');
});

test('one word or an initial is refused on the second step; a period after a letter stays', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json(BOOKED())); });
  await page.goto('/dukan?lang=en');
  await pickNight(page);
  await page.fill('#phone', '512345678');
  await page.fill('#name', 'Amal');
  await page.click('#next');
  await expect(page.locator('#f-name .err')).toHaveText('Enter your full name');
  await page.fill('#name', 'Faisal H');
  await page.click('#next');
  await expect(page.locator('#f-name .err')).toHaveText('Write your first and last name in full, not initials');
  await expect(page.locator('.step[data-step="2"]')).toBeVisible();
  await page.fill('#name', '');
  await page.locator('#name').pressSequentially('Md.. .Rahman');
  await expect(page.locator('#name')).toHaveValue('Md. Rahman');
  await page.click('#next');
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs[0].p_name).toBe('Md. Rahman');
});

test("the server's refusals of a name land on the box: characters, and a short word (why: short)", async ({ page }) => {
  const answers = [{ ok: false, error: 'name_chars' }, { ok: false, error: 'name_chars', why: 'short' }, { ok: false, error: 'name' }];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(answers.shift())));
  await page.goto('/dukan?lang=en');
  await toCheck(page, { name: 'Faisal Harbi' });
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#f-name')).toBeVisible();
  await expect(page.locator('#f-name')).toHaveClass(/invalid/);
  await expect(page.locator('#f-name .err')).toHaveText('Names can only contain letters, spaces and periods.');
  await page.locator('#name').press('End'); await page.locator('#name').press('Space'); // any edit clears it
  await expect(page.locator('#f-name')).not.toHaveClass(/invalid/);
  await page.click('#next');
  await page.click('#submit');
  await expect(page.locator('#f-name .err')).toHaveText('Write your first and last name in full, not initials');
  await page.click('#next');
  await page.click('#submit');
  await expect(page.locator('#f-name .err')).toHaveText('Enter your full name');
});
