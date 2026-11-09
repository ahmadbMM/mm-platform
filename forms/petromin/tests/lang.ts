import type { Page } from '@playwright/test';

// The form's own page has its language picker (#lang); the website's page for the form has the site's globe instead,
// which loads the page again in the language picked. A spec that switches language mid-way does it the way the picker
// does, on either page.
export async function setLang(page: Page, code: string) {
  if (await page.locator('#lang').count()) await page.selectOption('#lang', code);
  else await page.evaluate((c) => (window as unknown as { RiderRegistration: { applyLang(c: string): void } }).RiderRegistration.applyLang(c), code);
}
