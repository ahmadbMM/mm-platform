import { test, expect, json, S1, SAVED } from './flow';

// Every word the form can show is in every language: the steps, the ticket, the dialogs and the messages its scripts
// write. Some translations equal the English word (Tagalog "Booking", "SAR" everywhere but Arabic), so the invariant is
// that the key is there, and the lines new on this form (its title, the waiver line, the cancel question, the waitlist
// words) are translated.
const NEW = ['Petromin Ride Night: Invited Guests', 'I have read the waiver and agree to it', 'Cancel booking {no}? You will lose your place.',
  'Register another', 'Other registrations on this phone', 'The ride waiver has changed. Reload this page to read and accept the new one.',
  'On the waitlist', "You're on the waitlist", 'That bike type is closed for this ride. Choose another.', 'Bike type', 'Choose a bike type', 'Price'];
const SCRIPT_WORDS = ['No upcoming sessions', 'Edit your booking', 'Save changes', 'Saving...', 'Your booking was updated.', 'Your details were updated.',
  'We could not find your booking. Please register again.', 'You have already checked in. Ask the desk to change your booking.', 'This session is no longer open',
  'Names can only contain letters, spaces and periods.', 'Write your first and last name in full, not initials', 'Bikes from {t}', 'Change', 'Cancel booking', 'Keep it',
  'Your booking was cancelled.', 'We could not save this. Please try again.', 'Too many tries from this network. Try again in a few minutes.',
  'We could not find a booking with this number and mobile number.', 'Too many submissions from this network', 'This is not a mobile number for +{c}. Please check it.',
  'Enter a valid mobile number', 'Jeddah Corniche Circuit', 'Language', 'Country code', 'Progress', 'Booking QR code', 'Hybrid', 'Mountain', 'Bike', 'SAR',
  "You're on the waitlist", 'You are registered', 'Your registration for {d} is confirmed.'];

for (const lang of ['ar', 'ur', 'fr', 'es', 'pt', 'hi', 'ne', 'tl', 'bn', 'id', 'ms', 'de', 'ru', 'zh', 'ja']) {
  test(`every word on the form and the ticket reads in ${lang}`, async ({ page }) => {
    await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
    await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), SAVED);
    await page.goto(`/petromin-invite?lang=${lang}`, { waitUntil: 'networkidle' });
    await expect(page.locator('#ticket')).toBeVisible();
    const { missing, same } = await page.evaluate(([fresh, words]) => {
      const w = window as unknown as { RiderRegistration?: { translations?: Record<string, Record<string, string>> } };
      const dict = w.RiderRegistration!.translations![document.documentElement.lang] || {};
      const root = document.querySelector('.mmf-petromin-invite') || document.body;
      const keys = [...new Set([...Array.from(root.querySelectorAll('[data-t]')).map((e) => e.getAttribute('data-t')!), ...words, ...fresh])];
      return { missing: keys.filter((k) => !(k in dict)), same: fresh.filter((k) => dict[k] === k) };
    }, [NEW, SCRIPT_WORDS]);
    expect(missing, `keys with no ${lang} translation`).toEqual([]);
    expect(same, `new lines left in English for ${lang}`).toEqual([]);
    await expect(page.locator('#chip-booking-value')).toHaveText('I-004');
  });
}

test('the title names Petromin as the Petromin form does: its own script where that form writes it so, else Latin letters', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  for (const [lang, title] of [['ar', 'ليلة دراجات بترومين: الضيوف المدعوون'], ['ur', 'پیٹرومن سائیکل نائٹ: مدعو مہمان'], ['hi', 'पेट्रोमिन साइकिल नाइट: आमंत्रित अतिथि'], ['zh', 'Petromin 骑行之夜：受邀嘉宾'], ['de', 'Petromin-Radabend: geladene Gäste']]) {
    await page.goto(`/petromin-invite?lang=${lang}`);
    await expect(page.locator('#form .title'), lang).toHaveText(title);
  }
});

test('the price reads in every language as the website writes it: the sign left of the number, and the word for a screen reader', async ({ page }) => {
  await page.route('**/rest/v1/rpc/rider_sessions', (r) => r.fulfill(json([S1])));
  await page.addInitScript((s) => localStorage.setItem('mm-pminvite-booking', JSON.stringify(s)), { ...SAVED, price: 75 });
  for (const [lang, word] of [['en', 'SAR'], ['ar', 'ريال'], ['ur', 'SAR']]) {
    await page.goto(`/petromin-invite?lang=${lang}`);
    await expect(page.locator('#tk-price-value .sr'), lang).toHaveText(word);
    await expect(page.locator('#tk-price-value bdi'), lang).toHaveAttribute('dir', 'ltr');
    expect(await page.locator('#tk-price-value bdi').textContent(), lang).toBe(String.fromCharCode(0x20c1) + word + ' 75');
  }
});
