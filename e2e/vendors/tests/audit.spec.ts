// The 2026-10-04 portal audit in a browser: the temporary password first (MUST_CHANGE), sign-in
// refusals (TEMP_EXPIRED, LOCKED, RATE_LIMIT), sign-out ending the session, roles, cancelling (one
// date, a whole pattern, the 48-hour reason), several dates and a monthly pattern, the venue's
// details, the breakfast brief, Arabic plurals, Insights, Team and the privacy notice.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { signIn } from "./sign-in";

const STUB = Number(process.env.STUB_PORT || 8799);
const stub = (request: APIRequestContext, path: string, data: Record<string, unknown> = {}) =>
  request.post(`http://127.0.0.1:${STUB}${path}`, { data }).then((r) => r.json());

test.beforeEach(async ({ request }, info) => {
  info.setTimeout(150_000); // room for one wait on the sign-in meter (sign-in.ts)
  await stub(request, "/__reset");
});

function watch(page: Page): string[] {
  const seen: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) seen.push(m.text()); });
  page.on("pageerror", (e) => seen.push(String(e)));
  return seen;
}


/** Signed in with the password already changed, in a role. */
async function ready(page: Page, request: APIRequestContext, role = "owner") {
  await stub(request, "/__ready", { role });
  await signIn(page, "Breakfast2026");
  await expect(page.getByRole("heading", { name: "Breakfast calendar" })).toBeVisible();
}

const isPhone = (page: Page) => (page.viewportSize()?.width || 0) < 760;

test("the server refuses everything but the password change while a temporary password is in use", async ({ page }) => {
  await signIn(page, "Temp1234");
  await expect(page.getByRole("heading", { name: "Choose your own password" })).toBeVisible();
  const answer = await page.evaluate(async () => {
    const r = await fetch("/api/rpc/vendor_calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_from: "2026-01-01", p_to: "2026-01-31" }) });
    return { status: r.status, body: await r.json() };
  });
  expect(answer).toEqual({ status: 403, body: { error: "MUST_CHANGE" } });
  // A password the policy refuses is said plainly.
  await page.getByLabel("New password", { exact: true }).fill("micromobility");
  await page.getByLabel("Confirm new password").fill("micromobility");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("This password is too common.")).toBeVisible();
});

test("sign-in says why: an expired temporary password, a paused login, too many tries from this connection", async ({ page, request }) => {
  const errors = watch(page);
  await stub(request, "/__expire");
  await signIn(page, "Temp1234");
  await expect(page.getByRole("alert")).toContainText("This temporary password has expired");
  // Forgot your password opens with the login typed in for MicroMobility.
  const forgot = page.locator("details.forgot");
  await expect(forgot).toHaveAttribute("open", "");
  await expect(forgot.getByRole("link", { name: "Email" })).toHaveAttribute("href", /^mailto:info@micromobility\.sa\?subject=.+&body=.*cafe%40example\.com/);
  await expect(forgot.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/966566668818\?text=.*cafe%40example\.com/);

  await stub(request, "/__lock");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("try again in 15 minutes");

  await page.route("**/api/login", (r) => r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "RATE_LIMIT" }) }));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Too many tries from this connection");
  expect(errors.filter((e) => !/status of (401|429|400)/.test(e))).toEqual([]);
});

test("switching the language keeps what was typed on the sign-in form", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email or mobile number").fill("cafe@example.com");
  await page.getByLabel("Password", { exact: true }).fill("half typed");
  await page.getByRole("button", { name: "Switch to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("input[name=login]")).toHaveValue("cafe@example.com");
  await expect(page.locator("input[name=password]")).toHaveValue("half typed");
});

test("signing out ends the session on the server: the old cookie no longer works", async ({ page, request }) => {
  await ready(page, request);
  expect((await stub(request, "/__sessions")).n).toBe(1);
  const cookie = (await page.context().cookies()).find((c) => c.name === "mm_vendor")!;
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect((await stub(request, "/__sessions")).n).toBe(0);
  const origin = new URL(page.url()).origin;
  const res = await request.post("/api/rpc/vendor_me", { headers: { Cookie: `mm_vendor=${cookie.value}`, Origin: origin, "Content-Type": "application/json" }, data: {} });
  expect(res.status()).toBe(401);
});

test("a confirmed breakfast inside 48 hours: the policy, a reason required, and the late mark", async ({ page, request }) => {
  await stub(request, "/__book", { day: "tomorrow", status: "confirmed" });
  await ready(page, request);
  await page.getByRole("navigation").getByRole("link", { name: "My bookings" }).click();
  const card = page.locator(".booking").first();
  await expect(card.getByRole("heading", { name: "Breakfast brief" })).toBeVisible();
  await expect(card).toContainText("12 riders booked");
  await expect(card).toContainText(/Riders gather at 5:45\s?am; the ride starts at 6:15\s?am\./i);
  await expect(card).toContainText(/Expected at your venue: about 7:45\s?am to 8:45\s?am\./i);
  await expect(card.getByRole("link", { name: "+966 56 666 8818" })).toHaveAttribute("href", "tel:+966566668818");
  await expect(card).toContainText("No offer yet.");
  await card.getByRole("button", { name: "Cancel" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg).toContainText("less than 48 hours away");
  await expect(dlg).toContainText("Cancellation policy:");
  await dlg.getByRole("button", { name: "Cancel booking" }).click();
  await expect(dlg.getByText("tell us why you are cancelling")).toBeVisible();
  await expect(dlg.getByLabel("Reason (required)")).toBeFocused();
  await dlg.getByLabel("Reason (required)").fill("The kitchen is closed for repairs");
  await dlg.getByRole("button", { name: "Cancel booking" }).click();
  await expect(dlg).toBeHidden();
  await expect(page.locator(".booking").first()).toContainText("Late cancellation");
  const rows = await stub(request, "/__bookings") as { status: string; late_cancel: boolean; cancel_reason: string }[];
  expect(rows[0]).toMatchObject({ status: "cancelled", late_cancel: true, cancel_reason: "The kitchen is closed for repairs" });
});

test("cancelling a whole monthly pattern is the owner's; a manager cancels one date", async ({ page, request }) => {
  await stub(request, "/__book", { offset: 20, status: "pending", series: true });
  await stub(request, "/__book", { offset: 50, status: "pending", series: true });
  await ready(page, request);
  await page.getByRole("navigation").getByRole("link", { name: "My bookings" }).click();
  await page.locator(".booking").first().getByRole("button", { name: "Cancel" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Cancel this and all later dates of the pattern").check();
  await dlg.getByRole("button", { name: "Cancel booking" }).click();
  await expect(dlg).toBeHidden();
  await expect(page.locator("#live")).toHaveText("Cancelled 2 dates.");
  const rows = await stub(request, "/__bookings") as { status: string }[];
  expect(rows.map((r) => r.status)).toEqual(["cancelled", "cancelled"]);
  // The focus goes back where it was (the button is gone, so to the page).
  await page.getByRole("button", { name: "Sign out" }).click();

  await stub(request, "/__reset");
  await stub(request, "/__book", { offset: 20, status: "pending", series: true });
  await ready(page, request, "manager");
  await page.getByRole("navigation").getByRole("link", { name: "My bookings" }).click();
  await page.locator(".booking").first().getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog").getByLabel("Cancel this and all later dates of the pattern")).toHaveCount(0);
});

test("a viewer reads only: no Request, no Cancel, no details form, no Team", async ({ page, request }) => {
  await stub(request, "/__book", { offset: 20, status: "confirmed" });
  await ready(page, request, "viewer");
  await expect(page.getByRole("button", { name: "Request dates" })).toHaveCount(0);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Team" })).toHaveCount(0);
  await page.getByRole("navigation").getByRole("link", { name: "My bookings" }).click();
  await expect(page.getByText("Your login can view the bookings.")).toBeVisible();
  await expect(page.locator(".booking").first().getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await page.getByRole("navigation").getByRole("link", { name: "Venue" }).click();
  await expect(page.getByText("Only the venue's owner can change these details.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
});

test("several dates at once, and a monthly pattern", async ({ page, request }) => {
  await stub(request, "/__recurring");
  await ready(page, request);
  const opener = page.getByRole("button", { name: "Request dates" }).first();
  await opener.click();
  let dlg = page.getByRole("dialog");
  await dlg.getByLabel("Several dates").check();
  const picks = dlg.locator(".picks button");
  await picks.nth(0).click();
  await picks.nth(1).click();
  await dlg.getByRole("button", { name: "Check dates" }).click();
  await expect(dlg.getByText("2 of 2 dates can be requested.")).toBeVisible();
  await dlg.getByRole("button", { name: "Send request" }).click();
  await expect(dlg.getByText("Requested 2 dates.")).toBeVisible();
  await dlg.getByRole("button", { name: "Done" }).click();
  await expect(dlg).toBeHidden();

  await page.getByRole("button", { name: "Request dates" }).first().click();
  dlg = page.getByRole("dialog");
  await dlg.getByLabel("Repeat monthly").check();
  await dlg.getByRole("button", { name: "Check dates" }).click();
  await expect(dlg.locator(".verdicts li").first()).toBeVisible();
  await dlg.getByRole("button", { name: "Send request" }).click();
  await expect(dlg.getByText(/^Requested \d+ dates?\./)).toBeVisible();
  await dlg.getByRole("button", { name: "Done" }).click();
  const rows = await stub(request, "/__bookings") as { kind: string; series_id: number | null }[];
  expect(rows.filter((r) => r.kind === "multi")).toHaveLength(2);
  expect(rows.filter((r) => r.kind === "recurring").length).toBeGreaterThan(0);
  expect(rows.filter((r) => r.kind === "recurring").every((r) => r.series_id !== null)).toBe(true);
});

test("closing a dialog gives the focus back to the button that opened it", async ({ page, request }) => {
  await ready(page, request);
  const opener = page.locator(".page-head").getByRole("button", { name: "Request dates" });
  await opener.click();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).first().click();
  await expect(opener).toBeFocused();
});

test("the venue's details: the phone saved as +966..., a phone that is not one refused at the field", async ({ page, request }) => {
  await ready(page, request);
  await page.getByRole("navigation").getByRole("link", { name: "Venue" }).click();
  await page.getByLabel("Contact mobile").fill("call me");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Enter a mobile number")).toBeVisible();
  await expect(page.getByLabel("Contact mobile")).toBeFocused();
  await page.getByLabel("Contact mobile").fill("050 123 4567");
  await page.getByLabel("Contact email").fill("Owner@Harbour.example");
  await page.getByLabel("Offer for riders (English)").fill("15% off breakfast");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".venue-cols form").first().locator(".msg")).toContainText("Saved.");
  await expect(page.getByLabel("Contact mobile")).toHaveValue("+966501234567");
  // The offer is in the breakfast brief.
  await stub(request, "/__book", { offset: 20, status: "confirmed" });
  await page.getByRole("navigation").getByRole("link", { name: "My bookings" }).click();
  await expect(page.locator(".brief").first()).toContainText("Your offer for riders: 15% off breakfast");
});

test("Arabic counts take Arabic plural forms; a pending date says when we answer and how many others asked", async ({ page, request }) => {
  await stub(request, "/__book", { offset: 20, status: "confirmed" });
  await stub(request, "/__book", { offset: 40, status: "pending", others: 2 });
  await ready(page, request);
  await page.getByRole("navigation").getByRole("link", { name: "My bookings" }).click();
  const pending = page.locator(".booking.bs-pending").first();
  await expect(pending).toContainText("MicroMobility answers by");
  await expect(pending).toContainText("2 other venues have asked for this date.");
  await page.getByRole("button", { name: "Switch to Arabic" }).click();
  await expect(page.locator(".booking.bs-confirmed .brief").first()).toContainText("12 درّاجًا مسجّلًا");
  await expect(page.locator(".booking.bs-pending").first()).toContainText("طلب مكانان آخران هذا التاريخ أيضًا.");
  expect(await page.locator("main").innerText()).not.toMatch(/[٠-٩]/);
});

test("Insights, Team and the privacy notice", async ({ page, request }) => {
  const errors = watch(page);
  await stub(request, "/__past");
  await ready(page, request);
  await page.getByRole("navigation").getByRole("link", { name: "Insights" }).click();
  await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
  const stats = page.getByRole("list", { name: "Insights" });
  await expect(stats.locator(".stat").first()).toContainText("Breakfasts hosted");
  await expect(stats.locator(".stat").first()).toContainText("1");
  await expect(page.getByRole("table")).toContainText("12");

  await page.getByRole("navigation").getByRole("link", { name: "Team" }).click();
  await expect(page.getByRole("table")).toContainText("Viewer (read only)");
  await expect(page.getByRole("table")).toContainText("(you)");
  await page.getByRole("button", { name: "Sign out other devices" }).click();
  await expect(page.locator("main").getByText("Other devices signed out: 0.")).toBeVisible();

  await page.getByRole("link", { name: "Privacy notice" }).click();
  await expect(page.getByRole("heading", { name: "Privacy notice for venue logins" })).toBeVisible();
  await expect(page.getByText("Draft: this notice is waiting for MicroMobility's approval")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  // Signed out, the footer still leads to it, and back to sign-in.
  await page.getByRole("link", { name: "Privacy notice" }).click();
  await expect(page.getByRole("heading", { name: "Privacy notice for venue logins" })).toBeVisible();
  await page.getByRole("link", { name: "Back to the portal" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a phone lists the next open Saturdays of the coming months after the month's own", async ({ page, request }) => {
  test.skip(!isPhone(page), "the rolling list is the phone's");
  await ready(page, request);
  await expect(page.getByRole("heading", { name: "Next open Saturdays" })).toBeVisible();
  const next = page.locator("ol.cal-next > li");
  await expect(next.first()).toBeVisible();
  expect(await next.count()).toBeLessThanOrEqual(4);
});
