import { test, expect } from '@playwright/test';
import { json, pickNight, details, bike, addRider, toCheck, agree } from './flow';
const S1 = { id: '2099-02-08-pw', title: "Petromin's Wednesdays", start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00', collect: '18:45', place: null };
const S2 = { id: '2099-02-15-pw', title: "Petromin's Wednesdays", start: '2099-02-15T19:00:00+03:00', end: '2099-02-15T21:00:00+03:00', collect: '18:45', place: null };

test('register, then edit the booking in place (it opens on its summary), then the confirmation survives a reload', async ({ page }) => {
  const edits: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/rider_lookup', (r) => r.abort()); // Edit asks the server first; with no answer the phone's copy is used
  await page.route('**/rest/v1/rpc/rider_register', (r) => r.fulfill(json({ ok: true, id: 1, match: 'none', resubmitted: false, booking_no: 'P-001', session: S1 })));
  await page.route('**/rest/v1/rpc/rider_edit', (r) => { edits.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, id: 1, match: 'none', resubmitted: true, booking_no: 'P-001', session: S2 })); });
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('/petromin');
  await pickNight(page);
  await details(page);
  await bike(page);
  await toCheck(page);
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#chip-booking-value')).toHaveText('P-001');
  await expect(page.locator('#edit')).toBeVisible();
  await expect(page.locator('#qr canvas')).toBeVisible();
  // The night's facts are on the ticket: when bikes are handed out, and where.
  await expect(page.locator('#tk-pickup-value')).toHaveText(/06:45/);
  await expect(page.locator('#tk-place-value')).toHaveText('Jeddah Corniche Circuit');
  await expect(page.locator('.done-note')).toBeHidden(); // no "show this screen" line under the ticket any more

  // Edit: the summary of the booking, every part with its Change.
  await page.click('#edit');
  await expect(page.locator('#form .title')).toHaveText('Edit your booking');
  await expect(page.locator('.step[data-step="5"]')).toBeVisible();
  await expect(page.locator('#cancel-edit')).toBeVisible();
  await expect(page.locator('#review')).toContainText('A-12');
  await expect(page.locator('#review')).toContainText('Amal Booked');
  await expect(page.locator('#review')).toContainText('175 cm · Hybrid');
  await expect(page.locator('#review .rv-change')).toHaveCount(4); // the company, the night, the rider, the bikes
  await expect(page.locator('#f-privacy')).toBeHidden(); // confirmed when they registered

  // Change the night: its step, then Continue comes straight back to the summary.
  await page.click('#review .rv-change[data-go="2"]');
  await expect(page.locator('#sessions .session').first()).toHaveAttribute('aria-checked', 'true');
  await page.locator('#sessions .session').nth(1).click();
  await page.click('#next');
  await expect(page.locator('.step[data-step="5"]')).toBeVisible();
  // And the height, the same way.
  await page.click('#review .rv-change[data-go="4"]');
  await expect(page.locator('#height')).toHaveValue('175');
  await expect(page.locator('#types .tile[data-v="Hybrid"]')).toHaveAttribute('aria-checked', 'true');
  await page.fill('#height', '180');
  await page.click('#next');
  await expect(page.locator('#review')).toContainText('180 cm · Hybrid');
  await expect(page.locator('#submit .submit-label')).toHaveText('Save changes');
  await expect(page.locator('#waiver')).not.toBeChecked(); // an edit asks for the waiver again
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(edits).toHaveLength(1);
  expect(edits[0]).toMatchObject({ p_booking_no: 'P-001', p_proof_phone: '+966512345678', p_badge: 'A-12', p_name: 'Amal Booked', p_height: 180, p_type: 'Hybrid', p_session_id: '2099-02-15-pw', p_company: 'Petromin', p_phone: '+966512345678', p_lang: 'en' });
  await expect(page.locator('#chip-session-value')).toContainText('15');
  await expect(page.locator('.done-note')).toHaveText('Your booking was updated.');
  await expect(page.locator('#form .title')).toHaveText('Petromin bike night');

  // A reload restores the confirmation with the edit button; Cancel goes back without saving.
  await page.reload();
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#chip-booking-value')).toHaveText('P-001');
  await expect(page.locator('#qr canvas')).toBeVisible();
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
  await page.route('**/rest/v1/rpc/rider_lookup', (r) => r.abort()); // Edit asks the server first; with no answer the phone's copy is used
  await page.route('**/rest/v1/rpc/rider_edit', (r) => r.fulfill(json(answer)));
  await page.addInitScript(() => localStorage.setItem('mm-petromin-registration', JSON.stringify({ badge: 'A-12', name: 'Amal Booked', company: 'Petromin', phone: '+966512345678', height: 175, type: 'Road', session: { id: '2099-02-08-pw', start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' }, bookingNo: 'P-001', submittedAt: '2099-02-01T10:00:00Z' })));
  await page.goto('/petromin');
  await expect(page.locator('#success')).toBeVisible();
  await page.click('#edit');
  await page.check('#waiver'); await page.click('#submit');
  await expect(page.locator('#banner')).toBeVisible();
  await expect(page.locator('#banner')).toContainText('already checked in');
  await expect(page.locator('#banner')).toBeFocused(); // the page goes to it, far above the button or not

  answer = { ok: false, error: 'duplicate' };
  await page.click('#submit');
  await expect(page.locator('#f-badge .err')).toHaveText('This badge is already registered for that session');
  await expect(page.locator('#f-badge')).toHaveClass(/invalid/);

  answer = { ok: false, error: 'notfound' };
  await page.click('#next'); await page.click('#next'); await page.click('#submit');
  await expect(page.locator('#banner')).toContainText('could not find your booking');
  await expect(page.locator('#form .title')).toHaveText('Petromin bike night');
  expect(await page.evaluate(() => localStorage.getItem('mm-petromin-registration'))).toBeNull();
});

test('an employee registers with companions as cards, sees the party on the confirmation, and edits it', async ({ page }) => {
  const regs: Record<string, unknown>[] = []; const edits: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  await page.route('**/rest/v1/rpc/rider_lookup', (r) => r.abort()); // Edit asks the server first; with no answer the phone's copy is used
  await page.route('**/rest/v1/rpc/rider_register', (r) => { regs.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, id: 1, match: 'none', resubmitted: false, booking_no: 'P-010', riders: 3, session: S1 })); });
  await page.route('**/rest/v1/rpc/rider_edit', (r) => { edits.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, id: 1, match: 'none', resubmitted: true, booking_no: 'P-010', riders: 2, session: S1 })); });
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('/petromin');
  await pickNight(page);
  await details(page, { badge: 'B-1', name: 'Basma Lead' });
  await bike(page, '170', 'Hybrid');
  await expect(page.locator('#riders .rider')).toHaveCount(0);
  await addRider(page, { name: 'Sara Ali', height: 160, type: 'Mountain' });
  // A companion without a bike type is not saved: the dialog says which box, and stays open.
  await page.click('#add-rider');
  await page.fill('#rd-name', 'Omar Ali'); await page.fill('#rd-height', '180');
  await page.click('#rd-save');
  await expect(page.locator('#rd-f-type')).toHaveClass(/invalid/);
  await expect(page.locator('#rider-dialog')).toBeVisible();
  await page.click('#rd-types .tile[data-v="Hybrid"]');
  await page.click('#rd-save');
  await expect(page.locator('#rider-dialog')).toBeHidden();
  await expect(page.locator('#riders .rider')).toHaveCount(2);
  await expect(page.locator('#riders .rider').nth(1).locator('.rider-head')).toHaveText('Rider 3');
  await expect(page.locator('#riders .rider').nth(0)).toContainText('Sara Ali');
  await expect(page.locator('#riders .rider').nth(0)).toContainText('160 cm · Mountain');
  await toCheck(page);
  await expect(page.locator('#review')).toContainText('Omar Ali');
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(regs).toHaveLength(1);
  expect(regs[0].p_riders).toEqual([{ name: 'Sara Ali', height: 160, type: 'Mountain' }, { name: 'Omar Ali', height: 180, type: 'Hybrid' }]);
  await expect(page.locator('#chip-riders')).toBeVisible();
  await expect(page.locator('#chip-riders-value')).toHaveText('3');
  await expect(page.locator('#riders-note')).toHaveText('Riding with: Sara Ali, Omar Ali');

  // Edit: the companions come back as cards; removing one asks first, then sends the shorter list.
  await page.click('#edit');
  await page.click('#review .rv-change[data-go="4"]');
  await expect(page.locator('#riders .rider')).toHaveCount(2);
  await page.locator('#riders .rider').nth(0).locator('.rider-change').click();
  await expect(page.locator('#rd-name')).toHaveValue('Sara Ali');
  await expect(page.locator('#rd-types .tile[data-v="Mountain"]')).toHaveAttribute('aria-checked', 'true');
  await page.click('#rd-cancel');
  await page.locator('#riders .rider').nth(1).locator('.rider-remove').click();
  await expect(page.locator('#ask-dialog')).toBeVisible();
  await expect(page.locator('#ask-text')).toHaveText('Remove Omar Ali from this booking?');
  await page.click('#ask-yes');
  await expect(page.locator('#riders .rider')).toHaveCount(1);
  await page.click('#next');
  await page.check('#waiver');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(edits).toHaveLength(1);
  expect(edits[0].p_riders).toEqual([{ name: 'Sara Ali', height: 160, type: 'Mountain' }]);
  await expect(page.locator('#chip-riders-value')).toHaveText('2');
  expect(errs).toEqual([]);
});

test('Edit starts from the booking as the server holds it: the desk\'s companions are listed, never sent back', async ({ page }) => {
  const edits: Record<string, unknown>[] = []; const asks: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1, S2])));
  // Since the phone saved it, a companion was added on another phone (Omar) and one by the desk (Sara, no height, a Road bike).
  await page.route('**/rest/v1/rpc/rider_lookup', (r) => {
    asks.push(r.request().postDataJSON());
    return r.fulfill(json({ ok: true, booking_no: 'P-001', company: 'Petromin', badge: 'A-12', name: 'Amal Booked', phone: '+966512345678', height: 176, type: 'Hybrid', checked_in: false, session: S1,
      riders: [{ name: 'Omar Ali', height: 180, type: 'Hybrid', desk: false }, { name: 'Sara Ali', height: null, type: 'Road', desk: true }] }));
  });
  await page.route('**/rest/v1/rpc/rider_edit', (r) => { edits.push(r.request().postDataJSON()); return r.fulfill(json({ ok: true, id: 1, match: 'none', resubmitted: true, booking_no: 'P-001', session: S1 })); });
  await page.addInitScript(() => localStorage.setItem('mm-petromin-registration', JSON.stringify({ badge: 'A-12', name: 'Amal Booked', company: 'Petromin', phone: '+966512345678', height: 175, type: 'Hybrid', session: { id: '2099-02-08-pw', start: '2099-02-08T19:00:00+03:00', end: '2099-02-08T21:00:00+03:00' }, bookingNo: 'P-001', riders: [], submittedAt: '2099-02-01T10:00:00Z' })));
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('/petromin?lang=en');
  await page.click('#edit');
  await expect(page.locator('#review')).toContainText('176 cm');
  await expect(page.locator('#review')).toContainText('Omar Ali');
  await expect(page.locator('#review')).toContainText('Sara Ali');
  await expect(page.locator('#review')).not.toContainText('NaN');
  expect(asks[0]).toEqual({ p_booking_no: 'P-001', p_phone: '+966512345678', p_session_id: S1.id });
  // The desk's companion is a card without Change or Remove.
  await page.click('#review .rv-change[data-go="4"]');
  await expect(page.locator('#riders .rider')).toHaveCount(2);
  await expect(page.locator('#riders .rider').nth(1)).toContainText('Sara Ali');
  await expect(page.locator('#riders .rider').nth(1).locator('.rider-change')).toHaveCount(0);
  await page.click('#next');
  await page.check('#waiver'); await page.click('#submit');
  await expect(page.locator('.done-note')).toHaveText('Your booking was updated.');
  expect(edits[0].p_riders).toEqual([{ name: 'Omar Ali', height: 180, type: 'Hybrid' }]);
  await expect(page.locator('#chip-riders-value')).toHaveText('3');
  expect(errs).toEqual([]);
});
