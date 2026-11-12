import { test, expect, json, S1, S2, SAVED, LOOKED, booking, register } from './flow';

// Edit goes through petromin_invite_book with the booking's number and night (p_from_no, p_from_session): the same night
// updates that booking, another night makes the booking there and cancels this one in the same call. The mobile number
// is the booking's proof and its key: an edit shows it and never changes it.

test('book, then edit the booking (it opens on its summary): the phone is locked, the call names the booking it changes', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => r.abort()); // Edit asks the server first; with no answer the phone's copy is used
  // the first is the booking, the second the edit that moves it to the other night (a booking there, its own number)
  await page.route('**/rest/v1/rpc/petromin_invite_book', (r) => {
    const a = r.request().postDataJSON() as Record<string, unknown>; regs.push(a);
    const moved = regs.length > 1;
    return r.fulfill(json({ ok: true, resubmitted: false, booking_no: moved ? 'I-009' : 'I-001', invite_no: moved ? 'I-009' : 'I-001', ref: moved ? 'MMC-15-moved1' : 'MMC-08-first1', status: 'waiting', name: a.p_name, phone: a.p_phone, type: a.p_type, price: 57.5, session: moved ? S2 : S1 }));
  });
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('/petromin-invite');
  await register(page);
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#chip-booking-value')).toHaveText('I-001');
  await expect(page.locator('#qr canvas')).toHaveAttribute('data-code', 'MMC-08-first1');
  await expect(page.locator('.done-note')).toBeHidden();

  // Edit: the summary of the booking, every part with its Change.
  await page.click('#edit');
  await expect(page.locator('#form .title')).toHaveText('Edit your booking');
  await expect(page.locator('.step[data-step="4"]')).toBeVisible();
  await expect(page.locator('#cancel-edit')).toBeVisible();
  await expect(page.locator('#review')).toContainText('Amal Booked');
  await expect(page.locator('#review .rv-change')).toHaveCount(3);
  await expect(page.locator('#f-privacy')).toBeHidden(); // confirmed when they booked

  // The details: the name changes, the mobile number is shown and cannot be.
  await page.click('#review .rv-change[data-go="2"]');
  await expect(page.locator('#name')).toHaveValue('Amal Booked');
  await expect(page.locator('#phone')).toHaveValue('512345678');
  await expect(page.locator('#phone')).toHaveJSProperty('readOnly', true);
  await expect(page.locator('#cc')).toBeDisabled();
  await page.locator('#phone').pressSequentially('999', { timeout: 2000 }).catch(() => {});
  await expect(page.locator('#phone')).toHaveValue('512345678');
  await page.fill('#name', 'Amal Booked Again');
  await page.click('#next');
  await expect(page.locator('#review')).toContainText('Amal Booked Again');
  // The bike, the same way.
  await page.click('#review .rv-change[data-go="3"]');
  await expect(page.locator('#types .tile[data-v="Hybrid"]')).toHaveAttribute('aria-checked', 'true');
  await page.click('#types .tile[data-v="Mountain"]');
  await page.click('#next');
  // And the night: Continue comes straight back to the summary.
  await page.click('#review .rv-change[data-go="1"]');
  await expect(page.locator('#sessions .session').first()).toHaveAttribute('aria-checked', 'true');
  await page.locator('#sessions .session').nth(1).click();
  await page.click('#next');
  await expect(page.locator('.step[data-step="4"]')).toBeVisible();
  await expect(page.locator('#submit .submit-label')).toHaveText('Save changes');
  await expect(page.locator('#waiver')).not.toBeChecked(); // an edit asks for the waiver again
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(2);
  expect(regs[1]).toEqual({ p_session_id: S2.id, p_name: 'Amal Booked Again', p_phone: '+966512345678', p_type: 'Mountain', p_waiver: '2026-10-v3', p_privacy: 'pminvite-2026-11-12', p_from_no: 'I-001', p_from_session: S1.id });
  // The booking on the other night: its own number and code.
  await expect(page.locator('#chip-booking-value')).toHaveText('I-009');
  await expect(page.locator('#qr canvas')).toHaveAttribute('data-code', 'MMC-15-moved1');
  await expect(page.locator('#chip-session-value')).toContainText('15');
  await expect(page.locator('#tk-type-value')).toHaveText('Mountain');
  await expect(page.locator('.done-note')).toHaveText('Your booking was updated.');
  await expect(page.locator('#form .title')).toHaveText('Petromin Ride Night: Invited Guests');
  // The old night's booking was cancelled with the move: it is not kept on the phone as another booking.
  await expect(page.locator('#others')).toBeHidden();
  // A new booking after the edit types its number again.
  await page.click('#another');
  await expect(page.locator('#phone')).toHaveJSProperty('readOnly', false);
  await expect(page.locator('#cc')).toBeEnabled();
  await page.click('#cancel-edit');

  // A reload restores the confirmation with the edit button; Cancel goes back without saving.
  await page.reload();
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#chip-booking-value')).toHaveText('I-009');
  await expect(page.locator('#tk-name')).toHaveText('Amal Booked Again');
  await page.click('#edit');
  await expect(page.locator('#form .title')).toHaveText('Edit your booking');
  await page.click('#cancel-edit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(2);
  expect(errs).toEqual([]);
});

test('an edit on the same night sends that night as both, and keeps the number', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => r.fulfill(json(LOOKED)));
  await page.route('**/rest/v1/rpc/petromin_invite_book', booking(regs, 'I-004', { resubmitted: true }));
  await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), SAVED);
  await page.goto('/petromin-invite?lang=en');
  await page.click('#edit');
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs[0]).toEqual({ p_session_id: S1.id, p_name: 'Amal Booked', p_phone: '+966512345678', p_type: 'Hybrid', p_waiver: '2026-10-v3', p_privacy: 'pminvite-2026-11-12', p_from_no: 'I-004', p_from_session: S1.id });
  await expect(page.locator('#chip-booking-value')).toHaveText('I-004');
  await expect(page.locator('.done-note')).toHaveText('Your booking was updated.');
});

test('Edit starts from the booking as the server holds it now', async ({ page }) => {
  const asks: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => { asks.push(r.request().postDataJSON()); return r.fulfill(json({ ...LOOKED, name: 'Amal Renamed', type: 'Mountain' })); });
  await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), SAVED);
  await page.goto('/petromin-invite?lang=en');
  await page.click('#edit');
  await expect(page.locator('#review')).toContainText('Amal Renamed');
  await expect(page.locator('#review')).toContainText('Mountain');
  expect(asks.at(-1)).toEqual({ p_invite_no: 'I-004', p_phone: '+966512345678', p_session_id: S1.id });
});

test('a booking checked in is not opened for an edit: the desk changes it', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => r.fulfill(json({ ...LOOKED, checked_in: true })));
  await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), SAVED);
  await page.goto('/petromin-invite?lang=en');
  await page.click('#edit');
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('.done-note')).toHaveText('You have already checked in. Ask the desk to change your booking.');
});

test('an edit the server refuses is explained: checked in, the phone, not found', async ({ page }) => {
  let answer: Record<string, unknown> = { ok: false, error: 'checked_in', invite_no: 'I-004' };
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => r.abort());
  await page.route('**/rest/v1/rpc/petromin_invite_book', (r) => r.fulfill(json(answer)));
  await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), SAVED);
  await page.goto('/petromin-invite');
  await expect(page.locator('#success')).toBeVisible();
  await page.click('#edit');
  await page.check('#waiver'); await page.click('#submit');
  await expect(page.locator('#banner')).toBeVisible();
  await expect(page.locator('#banner')).toContainText('already checked in');
  await expect(page.locator('#banner')).toBeFocused(); // the page goes to it, far above the button or not

  answer = { ok: false, error: 'phone' };
  await page.click('#submit');
  await expect(page.locator('.step[data-step="2"]')).toBeVisible();
  await expect(page.locator('#f-phone')).toHaveClass(/invalid/);
  await expect(page.locator('#f-phone .err')).toHaveText('Enter a valid mobile number');

  answer = { ok: false, error: 'notfound' };
  await page.click('#next'); await page.click('#submit');
  await expect(page.locator('#banner')).toContainText('could not find your booking');
  await expect(page.locator('#form .title')).toHaveText('Petromin Ride Night: Invited Guests');
  await expect(page.locator('#phone')).toHaveJSProperty('readOnly', false); // no longer an edit: a new booking types its number
  expect(await page.evaluate(() => localStorage.getItem('mm-pminvite-booking'))).toBeNull();
});

test('a night that is no longer open sends the guest back to pick another', async ({ page }) => {
  let nights = [S1, S2];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json(nights)));
  await page.route('**/rest/v1/rpc/petromin_invite_book', (r) => { nights = [S2]; return r.fulfill(json({ ok: false, error: 'session' })); });
  await page.goto('/petromin-invite?lang=en');
  await register(page);
  await expect(page.locator('.step[data-step="1"]')).toBeVisible();
  await expect(page.locator('#f-session .err')).toHaveText('This session is no longer open');
  await expect(page.locator('#sessions .session')).toHaveCount(1);
});

test('a bike the desk gave that the form does not offer (Road) is chosen again on an edit', async ({ page }) => {
  const regs: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/petromin_invite_lookup', (r) => r.fulfill(json({ ...LOOKED, type: 'Road' })));
  await page.route('**/rest/v1/rpc/petromin_invite_book', booking(regs, 'I-004', { resubmitted: true }));
  await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), SAVED);
  await page.goto('/petromin-invite?lang=en');
  await page.click('#edit');
  await expect(page.locator('.step[data-step="3"]')).toBeVisible();
  await expect(page.locator('#types .tile[aria-checked="true"]')).toHaveCount(0);
  await page.click('#types .tile[data-v="Hybrid"]');
  await page.click('#next');
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs[0]).toMatchObject({ p_type: 'Hybrid', p_from_no: 'I-004' });
});
