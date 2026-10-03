import { test, expect } from '@playwright/test';

// Names hold letters, spaces and periods, as on the rentals site: a dash becomes a space
// ("Al-Harbi" is "Al Harbi"), digits, emoji and other signs are dropped as they are typed, and a
// booking saved before the rule comes back without its dash.
const S1 = { id: '2099-02-08-pw', title: "Petromin's Wednesdays", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' };
const json = (body: unknown) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('a dash in a name becomes a space; digits and emoji go; what is sent has neither', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, id: 1, match: 'none', resubmitted: false, booking_no: 'P-001', riders: 2, session: S1 })); });
  await page.goto('/petromin?lang=en');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', 'A-12');
  await page.locator('#name').pressSequentially('Faisal Al-Harbi2');
  await expect(page.locator('#name')).toHaveValue('Faisal Al Harbi');
  // the reason is given under the box, and goes on its own
  await expect(page.locator('#f-name .err')).toHaveText('Names can only contain letters, spaces and periods.');
  await expect(page.locator('#f-name .err')).toBeHidden({ timeout: 6000 });
  await page.fill('#phone', '512345678');
  await page.click('#next');
  await page.fill('#height', '175'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.click('#add-rider');
  const companion = page.locator('#riders .rider').nth(0);
  await companion.locator('.rider-name input').fill('Sara Bin-Ali😀');
  await expect(companion.locator('.rider-name input')).toHaveValue('Sara Bin Ali');
  await expect(companion.locator('.rider-name .err')).toHaveText('Names can only contain letters, spaces and periods.');
  await companion.locator('.rider-height input').fill('160');
  await companion.locator('.tile[data-v="Mountain"]').click();
  await page.check('#privacy');
  await page.check('#waiver'); // the ride waiver every registration needs
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(1);
  expect(regs[0].p_name).toBe('Faisal Al Harbi');
  expect((regs[0].p_riders as { name: string }[])[0].name).toBe('Sara Bin Ali');
});

test('a booking saved with a dashed name reopens without the dash', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.addInitScript(() => localStorage.setItem('mm-petromin-registration', JSON.stringify({ badge: 'A-12', name: 'Amal Al-Booked', company: 'Petromin', phone: '+966512345678', height: 175, type: 'Hybrid', session: { id: '2099-02-08-pw', start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' }, bookingNo: 'P-001', riders: [{ name: 'Kerry-Ann', height: 160, type: 'Hybrid' }], submittedAt: '2099-02-01T10:00:00Z' })));
  await page.goto('/petromin?lang=en');
  await page.click('#edit');
  await expect(page.locator('#name')).toHaveValue('Amal Al Booked');
  await page.click('#next'); await page.click('#next');
  await expect(page.locator('#riders .rider').nth(0).locator('.rider-name input')).toHaveValue('Kerry Ann');
});

test('the reason reads in the page language, and an empty box still asks for the name', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/petromin?lang=ar');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.locator('#name').pressSequentially('محمد1');
  await expect(page.locator('#name')).toHaveValue('محمد');
  await expect(page.locator('#f-name .err')).toHaveText('يمكن أن يحتوي الاسم على حروف ومسافات ونقاط فقط.');
  await expect(page.locator('#f-name .err')).toBeHidden({ timeout: 6000 });
  await page.fill('#name', '');
  await page.click('#next');
  await expect(page.locator('#f-name .err')).toHaveText('أدخل اسمك الكامل');
});

test("the server's refusal of a name lands on the box it is about", async ({ page }) => {
  const answers = [{ ok: false, error: 'name_chars' }, { ok: false, error: 'rider_name_chars', rider: 2 }];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(answers.shift())));
  await page.goto('/petromin?lang=en');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', 'A-12'); await page.fill('#name', 'Faisal Harbi'); await page.fill('#phone', '512345678');
  await page.click('#next');
  await page.fill('#height', '175'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.click('#add-rider');
  const companion = page.locator('#riders .rider').nth(0);
  await companion.locator('.rider-name input').fill('Sara Ali');
  await companion.locator('.rider-height input').fill('160');
  await companion.locator('.tile[data-v="Mountain"]').click();
  await page.check('#privacy');
  await page.check('#waiver'); // the ride waiver every registration needs

  await page.click('#submit');
  await expect(page.locator('#f-name')).toBeVisible();
  await expect(page.locator('#f-name')).toHaveClass(/invalid/);
  await expect(page.locator('#f-name .err')).toHaveText('Names can only contain letters, spaces and periods.');
  await page.locator('#name').press('End'); await page.locator('#name').press('Space'); // any edit clears it
  await expect(page.locator('#f-name')).not.toHaveClass(/invalid/);
  await page.click('#next');

  await page.click('#submit');
  await expect(companion.locator('.rider-name')).toHaveClass(/invalid/);
  await expect(companion.locator('.rider-name .err')).toHaveText('Names can only contain letters, spaces and periods.');
  await companion.locator('.rider-name input').fill('');
  await page.click('#submit');
  await expect(companion.locator('.rider-name .err')).toHaveText("Enter the rider's full name");
});

test('a period after a letter stays ("Md. Rahman"); a stray one goes without a word, and what is sent keeps it', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, id: 1, match: 'none', resubmitted: false, booking_no: 'P-001', riders: 2, session: S1 })); });
  await page.goto('/petromin?lang=en');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', 'A-12');
  await page.locator('#name').pressSequentially('Md.. .Rahman');
  await expect(page.locator('#name')).toHaveValue('Md. Rahman');
  await expect(page.locator('#f-name')).not.toHaveClass(/invalid/);
  await page.fill('#phone', '512345678');
  await page.click('#next');
  await page.fill('#height', '175'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.click('#add-rider');
  const companion = page.locator('#riders .rider').nth(0);
  await companion.locator('.rider-name input').fill('Mohd. Ali');
  await expect(companion.locator('.rider-name input')).toHaveValue('Mohd. Ali');
  await companion.locator('.rider-height input').fill('160');
  await companion.locator('.tile[data-v="Mountain"]').click();
  await page.check('#privacy');
  await page.check('#waiver'); // the ride waiver every registration needs
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(1);
  expect(regs[0].p_name).toBe('Md. Rahman');
  expect((regs[0].p_riders as { name: string }[])[0].name).toBe('Mohd. Ali');
});
