import { test, expect } from '@playwright/test';

// The tab showed the browser's blank page icon: the form carried no icon of its own, so the
// browser asked the origin for /favicon.ico - and the origin forwards everything that is not
// this one path, so the answer was a redirect to another company's site. The mark is carried
// inline, like every other image here: the Worker serves one path and nothing beside it, so a
// linked file would be fetched from that same forward.
test('the tab carries the Micromobility mark, inline', async ({ page }) => {
  await page.goto('/petromin', { waitUntil: 'domcontentloaded' });
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveCount(1);
  const href = (await icon.getAttribute('href')) || '';
  expect(href.startsWith('data:image/png;base64,')).toBe(true);

  // It is a real PNG, square, and small enough to be worth inlining.
  const png = await page.evaluate(async (h) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = h; });
    return { w: img.naturalWidth, h: img.naturalHeight, bytes: Math.round((h.length - 22) * 0.75) };
  }, href);
  expect(png.w).toBe(png.h);
  expect(png.w).toBeGreaterThanOrEqual(32);
  expect(png.bytes).toBeLessThan(20000);

  // Nothing is left for the browser to fetch from the origin.
  const html = await page.content();
  expect(/(?:src|href)="(?!data:|https?:)[^"]*\.(?:png|jpe?g|webp|avif|svg)"/.test(html)).toBe(false);
});
