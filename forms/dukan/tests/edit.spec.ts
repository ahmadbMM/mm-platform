import { test, expect } from '@playwright/test';
import { json, S1, S2, SAVED, BOOKED, register } from './flow';

test('register, then edit the booking in place (it opens on its summary), then the confirmation survives a reload', async ({ page }) => {
  const edits: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/rider_lookup', (r) => r.abort()); // Edit asks the server first; with no answer the phone's copy is used
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json(BOOKED('D-001'))));
  await page.route('**/rest/v1/rpc/rider_edit', (r) => { edits.push(r.request().postDataJSON()); return r.fulfill(json({ ...BOOKED('D-001', S2), resubmitted: true })); });
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('/dukan');
  await register(page);
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#chip-booking-value')).toHaveText('D-001');
  await expect(page.locator('#qr canvas')).toBeVisible();
  await expect(page.locator('#tk-place-value')).toHaveText('Jeddah Corniche Circuit');
  await expect(page.locator('.done-note')).toBeHidden();

  // Edit: the summary of the booking, every part with its Change.
  await page.click('#edit');
  await expect(page.locator('#form .title')).toHaveText('Edit your booking');
  await expect(page.locator('.step[data-step="3"]')).toBeVisible();
  await expect(page.locator('#cancel-edit')).toBeVisible();
  await expect(page.locator('#review')).toContainText('Amal Booked');
  await expect(page.locator('#review .rv-change')).toHaveCount(2);
  await expect(page.locator('#f-privacy')).toBeHidden(); // confirmed when they registered

  // Change the night: its step, then Continue comes straight back to the summary.
  await page.click('#review .rv-change[data-go="1"]');
  await expect(page.locator('#sessions .session').first()).toHaveAttribute('aria-checked', 'true');
  await page.locator('#sessions .session').nth(1).click();
  await page.click('#next');
  await expect(page.locator('.step[data-step="3"]')).toBeVisible();
  // And the name, the same way.
  await page.click('#review .rv-change[data-go="2"]');
  await expect(page.locator('#name')).toHaveValue('Amal Booked');
  await expect(page.locator('#phone')).toHaveValue('512345678');
  await page.fill('#name', 'Amal Booked Again');
  await page.click('#next');
  await expect(page.locator('#review')).toContainText('Amal Booked Again');
  await expect(page.locator('#submit .submit-label')).toHaveText('Save changes');
  await expect(page.locator('#waiver')).not.toBeChecked(); // an edit asks for the waiver again
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(edits).toHaveLength(1);
  expect(edits[0]).toEqual({ p_booking_no: 'D-001', p_proof_phone: '+966512345678', p_badge: '', p_name: 'Amal Booked Again', p_height: null, p_type: null, p_session_id: S2.id, p_company: 'Dukan', p_phone: '+966512345678', p_riders: [], p_waiver: '2026-10-v3', p_lang: 'en', p_from_session: S1.id });
  await expect(page.locator('#chip-session-value')).toContainText('15');
  await expect(page.locator('.done-note')).toHaveText('Your booking was updated.');
  await expect(page.locator('#form .title')).toHaveText('Dukan bike night');

  // A reload restores the confirmation with the edit button; Cancel goes back without saving.
  await page.reload();
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#chip-booking-value')).toHaveText('D-001');
  await expect(page.locator('#tk-name')).toHaveText('Amal Booked Again');
  await page.click('#edit');
  await expect(page.locator('#form .title')).toHaveText('Edit your booking');
  await page.click('#cancel-edit');
  await expect(page.locator('#success')).toBeVisible();
  expect(edits).toHaveLength(1);
  expect(errs).toEqual([]);
});

test('Edit starts from the booking as the server holds it now', async ({ page }) => {
  const asks: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/rider_lookup', (r) => { asks.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, booking_no: 'D-004', company: 'Dukan', name: 'Amal Renamed', phone: '+966512345678', checked_in: false, session: S1, riders: [] })); });
  await page.addInitScript((s) => localStorage.setItem('mm-dukan-registration', JSON.stringify(s)), SAVED);
  await page.goto('/dukan?lang=en');
  await page.click('#edit');
  await expect(page.locator('#review')).toContainText('Amal Renamed');
  expect(asks[0]).toEqual({ p_booking_no: 'D-004', p_phone: '+966512345678', p_session_id: S1.id });
});

test('an edit the server refuses is explained: checked in, the desk has it, not found', async ({ page }) => {
  let answer: Record<string, unknown> = { ok: false, error: 'checked_in' };
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/rider_lookup', (r) => r.abort());
  await page.route('**/rest/v1/rpc/rider_edit', (r) => r.fulfill(json(answer)));
  await page.addInitScript((s) => localStorage.setItem('mm-dukan-registration', JSON.stringify(s)), SAVED);
  await page.goto('/dukan');
  await expect(page.locator('#success')).toBeVisible();
  await page.click('#edit');
  await page.check('#waiver'); await page.click('#submit');
  await expect(page.locator('#banner')).toBeVisible();
  await expect(page.locator('#banner')).toContainText('already checked in');
  await expect(page.locator('#banner')).toBeFocused(); // the page goes to it, far above the button or not

  answer = { ok: false, error: 'desk' };
  await page.click('#submit');
  await expect(page.locator('#banner')).toContainText('The desk has this booking. Ask the desk to change it.');

  answer = { ok: false, error: 'phone' };
  await page.click('#submit');
  await expect(page.locator('.step[data-step="2"]')).toBeVisible();
  await expect(page.locator('#f-phone')).toHaveClass(/invalid/);
  await expect(page.locator('#f-phone .err')).toHaveText('Enter a valid mobile number');

  answer = { ok: false, error: 'notfound' };
  await page.click('#next'); await page.click('#submit');
  await expect(page.locator('#banner')).toContainText('could not find your booking');
  await expect(page.locator('#form .title')).toHaveText('Dukan bike night');
  expect(await page.evaluate(() => localStorage.getItem('mm-dukan-registration'))).toBeNull();
});

test('a night that is no longer open sends the rider back to pick another', async ({ page }) => {
  let nights = [S1, S2];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json(nights)));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { nights = [S2]; return r.fulfill(json({ ok: false, error: 'session' })); });
  await page.goto('/dukan?lang=en');
  await register(page);
  await expect(page.locator('.step[data-step="1"]')).toBeVisible();
  await expect(page.locator('#f-session .err')).toHaveText('This session is no longer open');
  await expect(page.locator('#sessions .session')).toHaveCount(1);
});
