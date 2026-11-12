import { test, expect } from '@playwright/test';
import { json, S1, BOOKED, pickNight, agree } from './flow';

// Digits typed on an Arabic keyboard are digits, the phone picker is the owner's order, and a number typed with its
// country code keeps the code once.

test('a phone typed in Arabic digits goes through, and reaches the server as digits', async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { sent.push(r.request().postDataJSON()); return r.fulfill(json(BOOKED())); });
  await page.goto('/dukan', { waitUntil: 'networkidle' });
  await pickNight(page);
  await page.fill('#name', 'Faisal Al Harbi'); await page.fill('#phone', '٠٥١٢٣٤٥٦٧٨');
  await page.click('#next');
  await expect(page.locator('#f-phone')).not.toHaveClass(/invalid/);
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#ticket')).toBeVisible();
  expect(sent[0]).toMatchObject({ p_phone: '+966512345678', p_badge: '' });
});

test('the phone picker: the Gulf first, then A to Z with Saudi Arabia again in its place, one code for both, no Israel', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/dukan', { waitUntil: 'networkidle' });
  for (const sel of ['#cc', '#fd-cc']) {
    const opts = await page.locator(`${sel} option`).evaluateAll((os) => os.map((o) => [(o as HTMLOptionElement).textContent, (o as HTMLOptionElement).selected, (o as HTMLOptionElement).value]));
    const isos = opts.map(([t]) => String(t).split(' ')[0]);
    expect(isos.slice(0, 6), sel).toEqual(['SA', 'AE', 'BH', 'KW', 'OM', 'QA']);
    expect(isos.slice(6), sel).toEqual([...isos.slice(6)].sort());
    expect(isos.filter((x) => x === 'SA'), sel).toHaveLength(2);
    expect(isos, sel).not.toContain('IL');
    expect(opts.map((o) => o[2]), sel).not.toContain('972');
    expect(opts.filter(([, on]) => on), sel).toEqual([['SA +966', true, '966']]);
  }
  await pickNight(page);
  const last = await page.locator('#cc option').evaluateAll((os) => os.map((o) => o.textContent).lastIndexOf('SA +966'));
  await page.locator('#cc').selectOption({ index: 1 });
  await page.locator('#cc').selectOption({ index: last });
  await expect(page.locator('#cc')).toHaveValue('966');
});

test('a number typed with its country code but no + or 00 keeps the code once', async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.route('**/rest/v1/rpc/rider_register', (r) => { sent.push(r.request().postDataJSON()); return r.fulfill(json(BOOKED())); });
  await page.goto('/dukan', { waitUntil: 'networkidle' });
  const e164 = (code: string, typed: string) => page.evaluate(([c, t]) => {
    (document.getElementById('cc') as HTMLSelectElement).value = c;
    (document.getElementById('phone') as HTMLInputElement).value = t;
    return (window as unknown as { RiderRegistration: { getPhone(): string } }).RiderRegistration.getPhone();
  }, [code, typed]);
  for (const [code, typed, want] of [
    ['971', '971501234567', '+971501234567'],
    ['971', '0501234567', '+971501234567'],
    ['91', '919876543210', '+919876543210'],
    ['44', '07911123456', '+447911123456'],
    ['966', '966512345678', '+966512345678'],
  ]) expect(await e164(code, typed), `${code} ${typed}`).toBe(want);

  await pickNight(page);
  await page.fill('#name', 'Faisal Al Harbi');
  await page.selectOption('#cc', '971');
  await page.fill('#phone', '971501234567');
  await page.click('#next');
  await expect(page.locator('#f-phone')).not.toHaveClass(/invalid/);
  await agree(page);
  await page.click('#submit');
  await expect(page.locator('#ticket')).toBeVisible();
  expect(sent[0]).toMatchObject({ p_phone: '+971501234567' });
});

test('a number too short for the database is refused on the second step', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.goto('/dukan?lang=en');
  await pickNight(page);
  await page.fill('#name', 'Amal Booked');
  await page.locator('#cc').selectOption('1');
  await page.fill('#phone', '123456');
  await page.click('#next');
  await expect(page.locator('#f-phone')).toHaveClass(/invalid/);
  await expect(page.locator('.step[data-step="2"]')).toBeVisible();
});
