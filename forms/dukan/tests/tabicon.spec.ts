import { test, expect } from '@playwright/test';

// The form's own page carries its tab icon inline (it is one address and nothing beside it): Dukan's mark, drawn as an
// SVG so it stays sharp at 16 px. The website's page has the website's own icon (playwright.site.config.ts skips this).
test("the tab carries Dukan's mark, inline", async ({ page }) => {
  await page.goto('/dukan', { waitUntil: 'domcontentloaded' });
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveCount(1);
  const href = (await icon.getAttribute('href')) || '';
  expect(href.startsWith('data:image/svg+xml;base64,')).toBe(true);
  const svg = Buffer.from(href.split(',')[1], 'base64').toString('utf8');
  expect(svg).toContain('#1b7563'); // the green D
  expect(svg).toContain('#ec2f04'); // the orange-red diamond
  const size = await page.evaluate(async (h) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = h; });
    return { w: img.naturalWidth, h: img.naturalHeight };
  }, href);
  expect(size.w).toBe(size.h);
  // Nothing is left for the browser to fetch from the origin but the fonts.
  const html = await page.content();
  expect(/(?:src|href)="(?!data:|https?:)[^"]*\.(?:png|jpe?g|webp|avif|svg)"/.test(html)).toBe(false);
  expect(/<script\b[^>]*\bsrc=/.test(html)).toBe(false);
});
