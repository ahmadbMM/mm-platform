import { test, expect } from './flow';

// The form's own page carries its tab icon inline (it is one address and nothing beside it): MicroMobility's mark, the
// Petromin form's own icon. The website's page has the website's own icon (playwright.site.config.ts skips this).
test("the tab carries MicroMobility's mark, inline", async ({ page }) => {
  await page.goto('/petromin-invite', { waitUntil: 'domcontentloaded' });
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveCount(1);
  const href = (await icon.getAttribute('href')) || '';
  expect(href.startsWith('data:image/png;base64,')).toBe(true);
  const png = await page.evaluate(async (h) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = h; });
    return { w: img.naturalWidth, h: img.naturalHeight, bytes: Math.round((h.length - 22) * 0.75) };
  }, href);
  expect(png.w).toBe(png.h);
  expect(png.w).toBeGreaterThanOrEqual(32);
  expect(png.bytes).toBeLessThan(20000);
  // Nothing is left for the browser to fetch from the origin but the fonts.
  const html = await page.content();
  expect(/(?:src|href)="(?!data:|https?:)[^"]*\.(?:png|jpe?g|webp|avif|svg)"/.test(html)).toBe(false);
  expect(/<script\b[^>]*\bsrc=/.test(html)).toBe(false);
});
