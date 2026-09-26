import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Every page of the site opens, in English and in Arabic: the right language and direction, one
// heading, its search-engine tags, no script errors, and no serious accessibility problems (axe,
// WCAG 2.1 A/AA). An unknown address gets the site's own 404.
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const PAGES = ["/", "/about", "/club", "/experiences", "/workshop", "/help", "/events", "/journal", "/business", "/ambassadors", "/gallery", "/routes", "/privacy", "/terms", "/account", "/bikes"];

async function open(page: Page, path: string) {
  const errors: string[] = [];
  // The site's own errors only: an embedded third party (the Google Maps frame) is not ours to fail on.
  page.on("pageerror", (e) => { if (!/https?:\/\/(?!localhost)/.test(e.stack || "")) errors.push(e.message); });
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await page.route(/supabase\.co|cloudflareinsights\.com|challenges\.cloudflare\.com|google\.com\/maps|gstatic\.com|googleapis\.com/, (r) => r.abort());
  const res = await page.goto(path, { waitUntil: "networkidle" });
  return { res, errors };
}

async function axe(page: Page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const w = window as unknown as { axe: { run(d: Document, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
    const r = await w.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} x${v.nodes.length}`);
  });
}

for (const lang of ["en", "ar"] as const) {
  for (const path of PAGES) {
    test(`${path} in ${lang}`, async ({ page }) => {
      const { res, errors } = await open(page, `${path}?lang=${lang}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
      await expect(page.locator("h1:visible")).toHaveCount(1); // exactly one heading, on every screen
      if (path !== "/account") {
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`lang=${lang}$`));
        expect(await page.locator('link[rel="alternate"][hreflang]').count()).toBe(17);
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\/micromobility\.sa\//);
      }
      expect(errors, "script errors").toEqual([]);
      expect(await axe(page), "serious accessibility problems").toEqual([]);
    });
  }
  test(`an unknown address in ${lang} is the site's own 404`, async ({ page }) => {
    const { res } = await open(page, `/no-such-page?lang=${lang}`);
    expect(res?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator(".pg-missing h1")).toBeVisible();
  });
}

test("the sitemap names every page in every language, and robots points to it", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("<loc>https://micromobility.sa/club?lang=ar</loc>");
  expect((xml.match(/hreflang="zh-Hans"/g) || []).length).toBeGreaterThan(10);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap: https://micromobility.sa/sitemap.xml");
});

// The fleet's NFC tag pages (components/bikes/FleetBike.tsx): the stickers hold /b/42, which now
// lives at /bikes/42; a sticker nobody has linked to a bike is told so, in the language asked for.
// The server reads the live fleet for this; the browser's own calls are blocked as everywhere.
test("a tag's old address goes to its new one, permanently", async ({ request }) => {
  const res = await request.get("/b/42", { maxRedirects: 0 });
  expect([301, 308]).toContain(res.status());
  expect(res.headers()["location"]).toMatch(/\/bikes\/42$/);
});

test("an unlinked tag gets the unrecognised-tag page", async ({ page }) => {
  const { res, errors } = await open(page, "/bikes/999999?lang=en");
  expect(res?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("h1:visible")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText(/recognise this tag/);
  await expect(page.getByText("micromobility.sa/bikes/999999")).toBeVisible();
  expect(errors, "script errors").toEqual([]);
});

test("pages send the security headers", async ({ request }) => {
  const h = (await request.get("/about?lang=en")).headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'self'");
  expect(h["x-frame-options"]).toBe("SAMEORIGIN");
  expect(h["x-powered-by"]).toBeUndefined();
});
