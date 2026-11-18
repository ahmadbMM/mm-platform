import { test, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";

// Testimonials (the user, 2026-11-18): micromobility.sa/testimonials, the page where a signed-in rider writes one
// (/testimonials/write), and the ask after a rating of 9 or 10 in the rating's pop-up. The rider's routes
// (/api/testimonials/*) and the account's pop-up checks are stubbed here: nothing is read or written anywhere. The
// launch switch is off on the database these run against (the key is not there), so the public page is the empty,
// unindexed page with no link in the header.
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const MINE = (o: Record<string, unknown> = {}) => ({ ok: true, on: true, names: { full: "Sara Ahmed Ali", short: "Sara A." }, since: { year: 2025, rides: 12 }, items: [], ...o });

async function signedIn(page: Page) {
  await page.context().addCookies([{ name: "mm_acct", value: "cust1~tok_0123456789abcdef", url: String(test.info().project.use.baseURL) }]);
}
async function quiet(page: Page, pending: unknown = null) {
  await page.route(/cloudflareinsights\.com|challenges\.cloudflare\.com|google\.com\/maps|gstatic\.com|googleapis\.com/, (r) => r.abort());
  await page.route(/supabase\.co/, (r) => r.abort());
  await page.route("**/api/account/emergency", (r) => json(r, { signedIn: true, need: false, two: true }));
  await page.route("**/api/account/sport", (r) => json(r, { signedIn: true, need: false }));
  await page.route("**/api/account/birthday", (r) => json(r, { signedIn: true, on: false }));
  for (const p of ["pending-waiver", "pending-share", "pending-race-reg", "pending-club"]) await page.route(`**/api/account/${p}*`, (r) => json(r, { signedIn: true, pending: null }));
  await page.route("**/api/account/pending-rating*", (r) => json(r, { signedIn: true, pending }));
}
async function axe(page: Page, root = "body") {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async (sel) => {
    const w = window as unknown as { axe: { run(d: Element, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
    const r = await w.axe.run(document.querySelector(sel)!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} x${v.nodes.length}`);
  }, root);
}
/** A small PNG made here, w by h, one colour. */
function png(w: number, h: number): Buffer {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x3c)]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(Array(h).fill(row)))), chunk("IEND", Buffer.alloc(0))]);
}

test("the public page opens by its link while the switch is off: never indexed, no header link, Write yours", async ({ page }) => {
  await quiet(page);
  const res = await page.goto("/testimonials?lang=en", { waitUntil: "networkidle" });
  expect(res?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveText("What riders say");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('header a[href="/testimonials"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Write yours" })).toHaveAttribute("href", "/testimonials/write");
  expect(await axe(page)).toEqual([]);
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/testimonials");
});

test("signed out, the write page is the sign-in with the way to an account", async ({ page }) => {
  await quiet(page);
  await page.goto("/testimonials/write?lang=en");
  await expect(page.locator("h1")).toHaveText("Write a testimonial");
  await expect(page.getByRole("heading", { name: "Sign in to write one" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("a signed-in rider writes one: what it is about, stars, the words, a photo made small, the name as it shows, the tick", async ({ page }) => {
  await signedIn(page);
  await quiet(page);
  const sent: Record<string, unknown>[] = [];
  let mine = MINE();
  await page.route("**/api/testimonials/mine", (r) => json(r, mine));
  await page.route("**/api/testimonials/send", (r) => {
    const b = JSON.parse(r.request().postData() || "{}");
    sent.push(b);
    if (sent.length === 1) return json(r, { ok: false, error: "link" }, 409);
    mine = MINE({ items: [{ id: 41, about: b.about, stars: b.stars, body: b.body, name_mode: b.nameMode, display_name: "Sara A.", status: "pending", photo: true, source: "web", created_at: "2026-11-18T10:00:00Z" }] });
    return json(r, { ok: true, id: 41, status: "pending", body: b.body, display_name: "Sara A." });
  });
  await page.goto("/testimonials/write?lang=en");
  const form = page.locator("form.tm-form");
  await expect(form).toBeVisible();
  // the name choices are the account's own, exactly as they would show, plus Anonymous; the since line while named
  expect(await form.locator(".tm-radios").nth(1).locator("label").allTextContents()).toEqual(["Sara Ahmed Ali", "Sara A.", "Anonymous"]);
  await expect(form.locator(".tm-preview")).toHaveText("Rider since 2025 · 12 rides");
  await form.getByRole("radio", { name: "Anonymous" }).check();
  await expect(form.locator(".tm-preview")).toHaveCount(0);
  await form.getByRole("radio", { name: "Sara A." }).check();
  // what the page can check itself, before anything is sent
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByRole("alert")).toHaveText("Choose what it is about.");
  await form.getByRole("radio", { name: "Saturday community ride" }).check();
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByRole("alert")).toHaveText("Choose your stars.");
  await form.getByRole("radio", { name: "5 out of 5 stars" }).check();
  await form.getByRole("textbox").fill("Too short");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByRole("alert")).toHaveText("Write between 20 and 800 characters.");
  await form.getByRole("textbox").fill("Every Saturday with this crew is the best part of my week. Thank you!");
  await expect(form.locator(".tm-count")).toHaveText("69 / 800");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByRole("alert")).toHaveText("Tick the box to let MicroMobility publish it.");
  expect(sent).toEqual([]);
  // a photo of 3000 x 2000 goes as a JPEG made small
  await form.locator('input[type="file"]').setInputFiles({ name: "ride.png", mimeType: "image/png", buffer: png(3000, 2000) });
  await expect(form.locator(".tm-photo-pick img")).toBeVisible();
  await form.getByRole("checkbox", { name: "MicroMobility may publish this testimonial on its website" }).check();
  // the database's refusal, in words
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByRole("alert")).toHaveText("Links can't be sent.");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("status")).toHaveText("Thank you. It goes up once our team has reviewed it.");
  expect(sent).toHaveLength(2);
  const b = sent[1];
  expect(b).toMatchObject({ body: "Every Saturday with this crew is the best part of my week. Thank you!", stars: 5, about: "saturday", nameMode: "short", consent: true, source: "web", lang: "en" });
  expect(String(b.photo)).toMatch(/^data:image\/jpeg;base64,/);
  expect(String(b.photo).length).toBeLessThanOrEqual(600_000);
  const size = await page.evaluate((src) => new Promise<number[]>((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.src = src; }), String(b.photo));
  expect(size).toEqual([1200, 800]);
  // the form starts again; the rider's own below, waiting
  await expect(form.getByRole("textbox")).toHaveValue("");
  const item = page.locator(".tm-mine-item");
  await expect(item).toHaveCount(1);
  await expect(item.locator(".tm-status")).toHaveText("Waiting for review");
  expect(await axe(page, "main")).toEqual([]);
});

test("the rider's own: states in words, Delete asks once more, then it goes", async ({ page }) => {
  await signedIn(page);
  await quiet(page);
  const items = [
    { id: 1, about: "session", stars: 4, body: "Great evening at the circuit with friendly staff.", name_mode: "anon", display_name: null, status: "published", photo: false, source: "web" },
    { id: 2, about: "learn", stars: 5, body: "Learned to ride in two lessons, thank you so much.", name_mode: "full", display_name: "Sara Ahmed Ali", status: "rejected", photo: false, source: "web" },
    { id: 3, about: "event", stars: 5, body: "The run was so well organised from start to end.", name_mode: "short", display_name: "Sara A.", status: "hidden", photo: false, source: "rating" },
  ];
  let deleted: unknown[] = [];
  await page.route("**/api/testimonials/mine", (r) => json(r, MINE({ on: false, items: items.filter((x) => !deleted.includes(x.id)) })));
  await page.route("**/api/testimonials/delete", (r) => { const id = JSON.parse(r.request().postData() || "{}").id; deleted = [...deleted, id]; return json(r, { ok: true }); });
  await page.goto("/testimonials/write?lang=en");
  const list = page.locator(".tm-mine-item");
  await expect(list).toHaveCount(3);
  expect(await list.locator(".tm-status").allTextContents()).toEqual(["Published", "Not published", "Not published"]);
  await expect(list.nth(0).locator(".tm-mine-name")).toHaveText("Anonymous");
  await list.nth(1).getByRole("button", { name: "Delete" }).click();
  await expect(list.nth(1).getByRole("button")).toHaveText("Tap again to delete");
  expect(deleted).toEqual([]);
  await list.nth(1).getByRole("button", { name: "Tap again to delete" }).click();
  await expect(list).toHaveCount(2);
  expect(deleted).toEqual([2]);
});

test("a database without testimonials yet: the write page says so", async ({ page }) => {
  await signedIn(page);
  await quiet(page);
  await page.route("**/api/testimonials/mine", (r) => json(r, { ok: false, error: "absent" }, 404));
  await page.goto("/testimonials/write?lang=en");
  await expect(page.getByText("This is not available yet.")).toBeVisible();
});

// The ask after a high rating, in the rating's pop-up
const PENDING = { entryId: "e1", name: "Saturday Social Ride", when: "Saturday 14 November", form: "rental", noBike: true, rgLow: 8, run: false, session: false, about: "saturday" };
async function rateTen(page: Page, o: { on?: boolean; note?: string } = {}) {
  let rated = false;
  const sent: Record<string, unknown>[] = [];
  await signedIn(page);
  await page.route(/cloudflareinsights\.com|challenges\.cloudflare\.com|google\.com\/maps|gstatic\.com|googleapis\.com|supabase\.co/, (r) => r.abort());
  await page.route("**/api/account/emergency", (r) => json(r, { signedIn: true, need: false, two: true }));
  await page.route("**/api/account/sport", (r) => json(r, { signedIn: true, need: false }));
  await page.route("**/api/account/birthday", (r) => json(r, { signedIn: true, on: false }));
  for (const p of ["pending-waiver", "pending-share", "pending-race-reg", "pending-club"]) await page.route(`**/api/account/${p}*`, (r) => json(r, { signedIn: true, pending: null }));
  await page.route("**/api/account/pending-rating*", (r) => json(r, { signedIn: true, pending: rated ? null : PENDING }));
  await page.route("**/api/account/rate", (r) => { rated = true; return json(r, { ok: true }); });
  await page.route("**/api/account/rating-fin", (r) => json(r, { fin: null }));
  await page.route("**/api/testimonials/mine", (r) => json(r, MINE({ on: o.on ?? true })));
  await page.route("**/api/testimonials/send", (r) => { sent.push(JSON.parse(r.request().postData() || "{}")); return json(r, { ok: true, id: 9, status: "pending" }); });
  await page.goto("/?lang=en");
  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible();
  await dlg.locator(".rg-scale button", { hasText: /^10$/ }).click();
  if (o.note) await dlg.locator(".rr-note textarea").fill(o.note);
  await dlg.locator("button[type=submit]").click();
  return { dlg, sent };
}

test("a 10 with the switch on asks to share it: the comment to start from, five stars, the name, the tick", async ({ page }) => {
  const { dlg, sent } = await rateTen(page, { note: "Loved every minute of the ride, the crew was amazing." });
  await expect(dlg.getByRole("heading")).toHaveText("Share this as a testimonial?");
  await expect(dlg.locator(".tm-stars")).toHaveAttribute("aria-label", "5 out of 5 stars");
  await expect(dlg.getByRole("textbox")).toHaveValue("Loved every minute of the ride, the crew was amazing.");
  const box = await dlg.boundingBox(), vp = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - vp.width / 2)).toBeLessThan(2); // centred, as every pop-up
  expect(await axe(page, "[role=dialog]")).toEqual([]);
  await dlg.getByRole("button", { name: "Send" }).click();
  await expect(dlg.getByRole("alert")).toHaveText("Tick the box to let MicroMobility publish it.");
  await dlg.getByRole("checkbox").check();
  await dlg.getByRole("button", { name: "Send" }).click();
  await expect(dlg.getByRole("status")).toHaveText("Thank you. It goes up once our team has reviewed it.");
  expect(sent).toEqual([{ body: "Loved every minute of the ride, the crew was amazing.", stars: 5, about: "saturday", nameMode: "short", consent: true, photo: null, source: "rating", entry: "e1", lang: "en" }]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Not now skips it; with the switch off nothing is asked", async ({ page }) => {
  const { dlg, sent } = await rateTen(page);
  await expect(dlg.getByRole("heading")).toHaveText("Share this as a testimonial?");
  await dlg.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(sent).toEqual([]);
});

test("with the switch off a 10 is thanked and the pop-up goes, as before", async ({ page }) => {
  const { dlg } = await rateTen(page, { on: false });
  await expect(dlg.getByRole("status")).toHaveText("Thanks for rating your ride.");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
