import { expect, test, type Page } from "@playwright/test";

// The distance leaderboards (micromobility.sa/leaderboard; the booking app's distance-board.js, rentals migration
// 20261127180000): the four boards, men and women apart, a name only for a rider who switched it on (else "Member") and
// never with dashes, the Longest ride medals; signed in, the rider's own place, the name switch, Share, Add a distance
// with its checks and proof, and Your distances with Take back. Against stub-account-db.mjs (Sara Khalid, a woman,
// second on the women's Longest ride with Silver); every distance in kilometres and miles (2026-11-28). Nothing real is read or written.
const STUB = `http://127.0.0.1:${process.env.STUB_PORT || 8797}`;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

async function signIn(page: Page, lang = "en", cookie = true) {
  await page.request.post(`${STUB}/__reset`);
  const base = test.info().project.use.baseURL as string;
  await page.context().addCookies([
    ...(cookie ? [{ name: "mm_acct", value: "c-test~a1b2c3d4e5f6a7b8c9d0", url: base }] : []),
    { name: "NEXT_LOCALE", value: lang, url: base },
  ]);
}
type State = { boardPublic: boolean; claims: { id: number; km: number; status: string }[]; writes: { fn: string; a: Record<string, unknown> }[] };
const state = async (page: Page) => (await (await page.request.get(`${STUB}/__state`)).json()) as State;
const rows = (page: Page) => page.locator(".lb-row");

test("signed out: the board's places, distances, opted-in names or Member, the medals, and nothing of the rider's own", async ({ page }) => {
  await signIn(page, "en", false);
  await page.goto("/leaderboard?b=longest&g=female");
  await expect(page.locator("h1")).toHaveText("Leaderboards");
  await expect(page.locator(".lb-sw").first().locator("button")).toHaveText(["Longest ride", "This month", "Lifetime", "This year"]);
  await expect(rows(page).locator(".lb-nm")).toHaveText(["Noor A.", "Member", "Member"]);
  await expect(rows(page).locator(".lb-r")).toHaveText(["1", "2", "2"]); // equal distances share a place
  await expect(rows(page).locator(".lb-km")).toHaveText(["120 km · 74.6 mi", "90.5 km · 56.2 mi", "90.5 km · 56.2 mi"]);
  await expect(rows(page).locator("svg.bdg-race")).toHaveCount(2);
  await expect(page.locator(".lb-me")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add a distance" })).toHaveCount(0);
  // men: a name never shows with dashes
  await page.getByRole("button", { name: "Men", exact: true }).click();
  await expect(rows(page).locator(".lb-nm")).toHaveText(["Omar Al Harbi K.", "Member"]);
});

test("signed in: the own place with its medal, You on the row, the name switch, the boards, Share and Your distances", async ({ page }) => {
  await signIn(page);
  await page.goto("/leaderboard");
  // the rider's own gender's board, Longest ride first
  await expect(page.getByRole("button", { name: "Women", exact: true })).toHaveAttribute("aria-pressed", "true");
  const me = page.locator(".lb-me");
  await expect(me.locator(".lb-me-r")).toHaveText("#2");
  await expect(me.locator(".lb-me-km")).toHaveText("90.5 km · 56.2 mi");
  await expect(me.locator("svg.bdg-race text").first()).toHaveText("#2");
  await expect(rows(page).locator(".lb-nm")).toHaveText(["Noor A.", "You", "Member"]);
  await expect(page.locator(".lb-row.mine")).toHaveCount(1);
  await expect(me.getByRole("button", { name: "Share" })).toBeVisible();
  await expect(page.locator(".lb-ci")).toHaveText([/64 km · 39.8 mi\s*One ride.*Added by our team/s]);
  // the switch: off, then on, saved
  const sw = me.getByRole("switch", { name: /Show my name on the leaderboards/ });
  await expect(sw).not.toBeChecked();
  await sw.check({ force: true });
  await expect(sw).toBeChecked();
  await expect.poll(async () => (await state(page)).boardPublic).toBe(true);
  // Lifetime: not ranked, so the rider's own kilometres, no place and no Share
  await page.getByRole("button", { name: "Lifetime", exact: true }).click();
  await expect(page.locator(".lb-sub")).toHaveText("Kilometres ridden");
  await expect(me.locator(".lb-me-r")).toHaveCount(0);
  await expect(me.locator(".lb-me-km")).toHaveText("640 km · 397.7 mi");
  await expect(me.getByRole("button", { name: "Share" })).toHaveCount(0);
  // Share on Longest ride opens the picture's pop-up
  await page.getByRole("button", { name: "Longest ride", exact: true }).click();
  await me.getByRole("button", { name: "Share" }).click();
  await expect(page.locator("dialog.shr-dlg")).toBeVisible();
  await expect(page.locator("dialog.shr-dlg img")).toHaveAttribute("alt", /Longest ride · 90\.5 km · 56\.2 mi · #2 · Women/);
  await page.locator("dialog.shr-dlg").getByRole("button", { name: "Close" }).click();
  await expect(page.locator("dialog.shr-dlg")).toHaveCount(0);
});

test("Add a distance: the checks in the app's words, a PDF as proof, sent for approval, then taken back", async ({ page }) => {
  await signIn(page);
  await page.goto("/leaderboard");
  await page.getByRole("button", { name: "Add a distance" }).click();
  const d = page.locator("dialog.bdr-dlg");
  await expect(d).toBeVisible();
  // centred
  const box = (await d.boundingBox())!, vp = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2);
  await expect(d.getByRole("group").getByRole("button")).toHaveText(["One ride", "A total over dates"]);
  await d.getByRole("button", { name: "Send for approval" }).click();
  await expect(d.getByRole("alert")).toHaveText("Enter 1 to 300 km for one ride, or up to 50,000 km for a total.");
  await d.getByLabel("Distance (km)").fill("80");
  await d.getByRole("button", { name: "Send for approval" }).click();
  await expect(d.getByRole("alert")).toHaveText("Add a picture or a PDF (2 MB at most) that shows the distance.");
  await d.locator('input[type="file"]').setInputFiles({ name: "strava.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(d.locator(".bdr-fname")).toHaveText("strava.pdf");
  await d.getByLabel("Comment (optional)").fill("Corniche and back");
  await d.getByRole("button", { name: "Send for approval" }).click();
  await expect(d).toBeHidden();
  await expect(page.locator(".lb-said")).toHaveText("Sent. Our team will check it.");
  const w = (await state(page)).writes.find((x) => x.fn === "customer_distance_claim")!;
  expect(w.a).toMatchObject({ p_kind: "ride", p_km: 80, p_from: null, p_note: "Corniche and back", p_proof_name: "strava.pdf", p_token: "a1b2c3d4e5f6a7b8c9d0" });
  expect(String(w.a.p_proof)).toMatch(/^data:application\/pdf;base64,JVBER/);
  const mine = page.locator(".lb-ci").first();
  await expect(mine).toContainText("80 km · 49.7 mi");
  await expect(mine.locator(".lb-pill")).toHaveText("Waiting");
  await mine.getByRole("button", { name: "Take back" }).click();
  await expect(page.locator(".lb-ci")).toHaveCount(1);
  expect((await state(page)).claims.some((c) => c.status === "pending")).toBe(false);
});

test("in Arabic: the app's own words, right to left, digits in Latin", async ({ page }) => {
  await signIn(page, "ar");
  await page.goto("/leaderboard");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("h1")).toHaveText("لوحات المتصدرين");
  await expect(rows(page).locator(".lb-nm")).toHaveText(["Noor A.", "أنت", "عضو"]);
  await expect(rows(page).locator(".lb-km").first()).toHaveText("120 كم · 74.6 ميل");
  await expect(page.locator(".lb-me .lb-me-r")).toHaveText("#2");
});
