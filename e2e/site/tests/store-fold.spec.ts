import { test, expect, type Page } from "@playwright/test";

// The store's first screen keeps its products in it (the user, 2026-11-18: "do all" of the store and Experiences mobile
// report, SM02-B, SM03-B, SM08-B): the first price on /store sits above y 600 on a 393 x 659 phone (an iPhone 15 with
// Safari's bars), and the first product starts above y 700 on a 1280 x 800 laptop, in English and in Arabic. Measured
// in a real browser, so a heading, a lead line or a row of tiles that grows again fails here. The store is the site's
// own only while staff have it open (store.open with payments on); while /store forwards to the Salla shop there is
// nothing of ours to measure, and the test says so and stops.
const BUDGETS = [
  { name: "the first price on a 393 x 659 phone is above y 600", viewport: { width: 393, height: 659 }, phone: true, at: ".st-card-price", y: 600 },
  { name: "the first product on a 1280 x 800 laptop starts above y 700", viewport: { width: 1280, height: 800 }, phone: false, at: ".st-card", y: 700 },
] as const;

async function openStore(page: Page, lang: "en" | "ar") {
  await page.route(/supabase\.co|cloudflareinsights\.com|challenges\.cloudflare\.com|google\.com\/maps|gstatic\.com|googleapis\.com/, (r) => r.abort());
  const res = await page.goto(`/store?lang=${lang}`, { waitUntil: "networkidle" });
  return res !== null && new URL(page.url()).origin === new URL(String(test.info().project.use.baseURL)).origin && (await page.locator(".st-grid").count()) > 0;
}

for (const b of BUDGETS) {
  test.describe(b.name, () => {
    test.use({ viewport: b.viewport, isMobile: b.phone, hasTouch: b.phone, deviceScaleFactor: b.phone ? 3 : 1 });
    for (const lang of ["en", "ar"] as const) {
      test(lang, async ({ page }) => {
        // one browser is enough: the budgets name their own screens
        test.skip(test.info().project.name !== "desktop", "measured once, in Chromium");
        test.skip(!(await openStore(page, lang)), "the store is not open: /store forwards to the Salla shop");
        const box = await page.locator(b.at).first().boundingBox();
        expect(box, `${b.at} is drawn`).not.toBeNull();
        expect(Math.round(box!.y + (b.phone ? box!.height : 0)), `${b.at} ends at`).toBeLessThanOrEqual(b.y);
      });
    }
  });
}
