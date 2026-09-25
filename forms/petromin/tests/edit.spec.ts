import { test, expect } from '@playwright/test';
const S1 = { id: '2099-02-08-pw', title: "Petromin's Wednesdays", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' };
const S2 = { id: '2099-02-15-pw', title: "Petromin's Wednesdays", start: '2099-02-15T19:00:00+03:00', end: '2099-02-15T21:00:00+03:00' };
const json = (body: unknown) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('register, then edit the booking in place, then the confirmation survives a reload', async ({ page }) => {
  const edits: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json({ ok: true, id: 1, match: 'none', resubmitted: false, booking_no: 'P-001', session: S1 })));
  await page.route('**/rest/v1/rpc/rider_edit', (r) => { edits.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, id: 1, match: 'none', resubmitted: true, booking_no: 'P-001', session: S2 })); });
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('/petromin');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', 'A-12'); await page.fill('#name', 'Amal Booked'); await page.fill('#phone', '512345678');
  await page.click('#next');
  await page.fill('#height', '175'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.check('#privacy'); // the Privacy Notice confirmation a new registration needs
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#chip-booking-value')).toHaveText('P-001');
  await expect(page.locator('#edit')).toBeVisible();
  await expect(page.locator('#qr svg')).toBeVisible();
  await expect(page.locator('.qr-note')).toHaveText('Scan this code at the desk');

  // Edit: the form comes back filled in.
  await page.click('#edit');
  await expect(page.locator('#form .title')).toHaveText('Edit your booking');
  await expect(page.locator('#cancel-edit')).toBeVisible();
  await expect(page.locator('#sessions .session').first()).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#badge')).toHaveValue('A-12');
  await expect(page.locator('#phone')).toHaveValue('512345678');
  await expect(page.locator('#cc')).toHaveValue('966');
  await expect(page.locator('#height')).toHaveValue('175');
  await expect(page.locator('#types .tile[data-v="Hybrid"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#companies .company[data-v="Petromin"]')).toHaveAttribute('aria-checked', 'true');

  // Move to the second session and change the height, then save.
  await page.locator('#sessions .session').nth(1).click();
  await page.click('#next'); await page.click('#next');
  await page.fill('#height', '180');
  await expect(page.locator('#submit .submit-label')).toHaveText('Save changes');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(edits).toHaveLength(1);
  expect(edits[0]).toMatchObject({ p_booking_no: 'P-001', p_proof_phone: '+966512345678', p_badge: 'A-12', p_name: 'Amal Booked', p_height: 180, p_type: 'Hybrid', p_session_id: '2099-02-15-pw', p_company: 'Petromin', p_phone: '+966512345678' });
  await expect(page.locator('#chip-session-value')).toContainText('15');
  await expect(page.locator('.done-note')).toHaveText('Your booking was updated.');
  await expect(page.locator('#form .title')).toHaveText('Employees Bike Registration Form');

  // A reload restores the confirmation with the edit button; Cancel goes back without saving.
  await page.reload();
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#chip-booking-value')).toHaveText('P-001');
  await expect(page.locator('#qr svg')).toBeVisible();
  await page.click('#edit');
  await expect(page.locator('#form .title')).toHaveText('Edit your booking');
  await page.click('#cancel-edit');
  await expect(page.locator('#success')).toBeVisible();
  expect(edits).toHaveLength(1);
  expect(errs).toEqual([]);
});

test('an edit the server refuses is explained: checked in, not found, duplicate badge', async ({ page }) => {
  let answer: Record<string, unknown> = { ok: false, error: 'checked_in' };
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/rider_edit', (r) => r.fulfill(json(answer)));
  await page.addInitScript(() => localStorage.setItem('mm-petromin-registration', JSON.stringify({ badge: 'A-12', name: 'Amal Booked', company: 'Petromin', phone: '+966512345678', height: 175, type: 'Road', session: { id: '2099-02-08-pw', start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' }, bookingNo: 'P-001', submittedAt: '2099-02-01T10:00:00Z' })));
  await page.goto('/petromin');
  await expect(page.locator('#success')).toBeVisible();
  await page.click('#edit');
  await page.click('#next'); await page.click('#next'); await page.click('#submit');
  await expect(page.locator('#banner')).toBeVisible();
  await expect(page.locator('#banner')).toContainText('already checked in');

  answer = { ok: false, error: 'duplicate' };
  await page.click('#submit');
  await expect(page.locator('#f-badge .err')).toHaveText('This badge is already registered for that session');
  await expect(page.locator('#f-badge')).toHaveClass(/invalid/);

  answer = { ok: false, error: 'notfound' };
  await page.click('#next'); await page.click('#submit');
  await expect(page.locator('#banner')).toContainText('could not find your booking');
  await expect(page.locator('#form .title')).toHaveText('Employees Bike Registration Form');
  expect(await page.evaluate(() => localStorage.getItem('mm-petromin-registration'))).toBeNull();
});

test('an employee registers with companions, sees the party on the confirmation, and edits it', async ({ page }) => {
  const regs: Record<string, unknown>[] = []; const edits: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, id: 1, match: 'none', resubmitted: false, booking_no: 'P-010', riders: 3, session: S1 })); });
  await page.route('**/rest/v1/rpc/rider_edit', (r) => { edits.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, id: 1, match: 'none', resubmitted: true, booking_no: 'P-010', riders: 2, session: S1 })); });
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('/petromin');
  await page.locator('#sessions .session').first().click();
  await page.click('#next');
  await page.click('#companies .company[data-v="Petromin"]');
  await page.fill('#badge', 'B-1'); await page.fill('#name', 'Basma Lead'); await page.fill('#phone', '512345678');
  await page.click('#next');
  await page.fill('#height', '170'); await page.click('#types .tile[data-v="Hybrid"]');
  await page.check('#privacy'); // the Privacy Notice confirmation a new registration needs
  await expect(page.locator('#riders .rider')).toHaveCount(0);
  await page.click('#add-rider');
  await page.click('#add-rider');
  await expect(page.locator('#riders .rider')).toHaveCount(2);
  await expect(page.locator('#riders .rider').nth(1).locator('.rider-head b')).toHaveText('Rider 3');
  await page.locator('#riders .rider').nth(0).locator('.rider-name input').fill('Sara Ali');
  await page.locator('#riders .rider').nth(0).locator('.rider-height input').fill('160');
  await page.locator('#riders .rider').nth(0).locator('.tile[data-v="Mountain"]').click();
  await page.locator('#riders .rider').nth(1).locator('.rider-name input').fill('Omar Ali');
  await page.locator('#riders .rider').nth(1).locator('.rider-height input').fill('180');
  // A missing bike type on a companion stops the submit and points at that row.
  await page.click('#submit');
  await expect(page.locator('#riders .rider').nth(1).locator('.rider-type')).toHaveClass(/invalid/);
  expect(regs).toHaveLength(0);
  await page.locator('#riders .rider').nth(1).locator('.tile[data-v="Hybrid"]').click();
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(1);
  expect(regs[0].p_riders).toEqual([{ name: 'Sara Ali', height: 160, type: 'Mountain' }, { name: 'Omar Ali', height: 180, type: 'Hybrid' }]);
  await expect(page.locator('#chip-riders')).toBeVisible();
  await expect(page.locator('#chip-riders-value')).toHaveText('3');
  await expect(page.locator('#riders-note')).toHaveText('Riding with: Sara Ali, Omar Ali');

  // Edit: the companions come back; dropping one sends the shorter list.
  await page.click('#edit');
  await page.click('#next'); await page.click('#next');
  await expect(page.locator('#riders .rider')).toHaveCount(2);
  await expect(page.locator('#riders .rider').nth(0).locator('.rider-name input')).toHaveValue('Sara Ali');
  await expect(page.locator('#riders .rider').nth(0).locator('.tile[data-v="Mountain"]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('#riders .rider').nth(1).locator('.rider-remove').click();
  await expect(page.locator('#riders .rider')).toHaveCount(1);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(edits).toHaveLength(1);
  expect(edits[0].p_riders).toEqual([{ name: 'Sara Ali', height: 160, type: 'Mountain' }]);
  await expect(page.locator('#chip-riders-value')).toHaveText('2');
  expect(errs).toEqual([]);
});
