import type { Page } from '@playwright/test';

// The page built on its own has a button that switches between English and Arabic (#lang); the website's page for it
// has the site's globe instead, which loads the page again in the language picked. A spec that switches language
// mid-way does it the way the button does, on either page.
export async function flipLang(page: Page) {
  if (await page.locator('#lang').count()) return page.click('#lang');
  await page.evaluate(() => {
    const next = document.documentElement.lang === 'ar' ? 'en' : 'ar';
    (window as unknown as { DefeForm: { setLang(c: string, save: boolean): void } }).DefeForm.setLang(next, false);
  });
}
