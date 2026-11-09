import type { Page } from '@playwright/test';

// The page built on its own has a language menu (#lang, the website's sixteen); the website's page for it has the site's
// globe instead, which loads the page again in the language picked. A spec that switches between English and Arabic
// mid-way does it the way the menu does, on either page.
export async function flipLang(page: Page) {
  const next = (await page.evaluate(() => document.documentElement.lang)) === 'ar' ? 'en' : 'ar';
  if (await page.locator('#lang').count()) return void (await page.selectOption('#lang', next));
  await page.evaluate((c) => (window as unknown as { SaturdayForm: { setLang(c: string, save: boolean): void } }).SaturdayForm.setLang(c, false), next);
}
