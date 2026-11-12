import { test, expect } from '@playwright/test';
import { json, S1, SAVED } from './flow';

// Every word the form can show is in every language: the steps, the ticket, the dialogs and the messages its scripts
// write. Some translations equal the English word (French "Badge", Tagalog "Booking"), so the invariant is that the
// key is there, and the lines new on this form (its title, the waiver line, the cancel question) are translated.
const NEW = ['Dukan bike night', 'I have read the waiver and agree to it', 'Cancel booking {no}? You will lose your place.',
  'Register another', 'Other registrations on this phone', 'The ride waiver has changed. Reload this page to read and accept the new one.'];
const SCRIPT_WORDS = ['No upcoming sessions', 'Edit your booking', 'Save changes', 'Saving...', 'Your booking was updated.', 'Your details were updated.',
  'We could not find your booking. Please register again.', 'You have already checked in. Ask the desk to change your booking.', 'This session is no longer open',
  'Names can only contain letters, spaces and periods.', 'Write your first and last name in full, not initials', 'Bikes from {t}', 'Change', 'Cancel booking', 'Keep it',
  'Your booking was cancelled.', 'We could not save this. Please try again.', 'The desk has this booking. Ask the desk to cancel it.', 'The desk has this booking. Ask the desk to change it.',
  'Too many tries from this network. Try again in a few minutes.', 'We could not find a booking with this number and mobile number.', 'Too many submissions from this network',
  'This is not a mobile number for +{c}. Please check it.', 'Enter a valid mobile number', 'Jeddah Corniche Circuit', 'Language', 'Country code', 'Progress', 'Booking QR code'];

for (const lang of ['ar', 'ur', 'fr', 'es', 'pt', 'hi', 'ne', 'tl', 'bn', 'id', 'ms', 'de', 'ru', 'zh', 'ja']) {
  test(`every word on the form and the ticket reads in ${lang}`, async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.addInitScript((s) => localStorage.setItem('mm-dukan-registration', JSON.stringify(s)), SAVED);
    await page.goto(`/dukan?lang=${lang}`, { waitUntil: 'networkidle' });
    await expect(page.locator('#ticket')).toBeVisible();
    const { missing, same } = await page.evaluate(([fresh, words]) => {
      const w = window as unknown as { RiderRegistration?: { translations?: Record<string, Record<string, string>> } };
      const dict = w.RiderRegistration!.translations![document.documentElement.lang] || {};
      const root = document.querySelector('.mmf-dukan') || document.body;
      const keys = [...new Set([...Array.from(root.querySelectorAll('[data-t]')).map((e) => e.getAttribute('data-t')!), ...words, ...fresh])];
      return { missing: keys.filter((k) => !(k in dict)), same: fresh.filter((k) => dict[k] === k) };
    }, [NEW, SCRIPT_WORDS]);
    expect(missing, `keys with no ${lang} translation`).toEqual([]);
    expect(same, `new lines left in English for ${lang}`).toEqual([]);
    await expect(page.locator('#chip-booking-value')).toHaveText('D-004');
  });
}

test('Arabic names the company by its own name, the other scripts in its Latin letters', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  for (const [lang, title] of [['ar', 'ليلة دراجات الدكان'], ['ur', 'Dukan سائیکل نائٹ'], ['hi', 'Dukan साइकिल नाइट'], ['zh', 'Dukan 骑行之夜']]) {
    await page.goto(`/dukan?lang=${lang}`);
    await expect(page.locator('#form .title'), lang).toHaveText(title);
  }
});
