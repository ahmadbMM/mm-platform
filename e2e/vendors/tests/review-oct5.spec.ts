// The 2026-10-05 review of the portal, in a browser: an address the portal does not have answers a
// page in both languages, "Skip to content" moves the focus without touching the address (the hash is
// the router), a signed-out load asks "who am I" without an error in the console, and bookings and
// open dates past 400 days are read, 400 days a call (the stub refuses more, as the database does).
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
  page.on("console", (m) => { if (m.type() === "error" || /Content Security Policy|Refused to/i.test(m.text())) seen.push(m.text()); });
  page.on("pageerror", (e) => seen.push(String(e)));
  return seen;
}

async function ready(page: Page, request: APIRequestContext) {
  await stub(request, "/__ready", { role: "owner" });
  await signIn(page, "Breakfast2026");
  await expect(page.getByRole("heading", { name: "Breakfast calendar" })).toBeVisible();
}

test("an address the portal does not have answers 404 with a page in both languages, and leads back", async ({ page, request }) => {
  const res = await request.get("/calendar");
  expect(res.status()).toBe(404);
  expect(res.headers()["content-type"]).toContain("text/html");
  expect(res.headers()["content-security-policy"]).toContain("default-src 'self'");
  const body = await res.text();
  expect(body).toContain("Page not found");
  expect(body).toContain("الصفحة غير موجودة");

  const errors = watch(page);
  await page.goto("/no/such/page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible();
  await page.getByRole("link", { name: "Go to the vendor portal" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(errors.filter((e) => !/status of 404/.test(e))).toEqual([]);
});

test("a signed-out load asks who it is without an error in the console", async ({ page }) => {
  const errors = watch(page);
  const me = page.waitForResponse((r) => r.url().endsWith("/api/rpc/vendor_me"));
  await page.goto("/");
  const res = await me;
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ signedIn: false });
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0); // a first visit is not "your session has ended"
  expect(errors).toEqual([]);
});

test("Skip to content moves the focus to the page and leaves the address alone, in both languages", async ({ page, request }) => {
  await ready(page, request);
  await page.getByRole("navigation").getByRole("link", { name: "My bookings" }).click();
  await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();
  const skip = page.getByRole("link", { name: "Skip to content" });
  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#bookings$/);
  await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();
  await expect(page.locator("main#main")).toBeFocused();
  await page.getByRole("button", { name: "Switch to Arabic" }).click();
  await expect(page.locator("a.skip")).toHaveText("انتقل إلى المحتوى");
});

test("a booking and an open date past 400 days, on a plan reaching 730: seen, cancellable, requestable", async ({ page, request }) => {
  const errors = watch(page);
  const far = await stub(request, "/__far") as { booked: string; open: string };
  const asked: { p_from: string; p_to: string }[] = [];
  page.on("request", (r) => { if (r.url().endsWith("/api/rpc/vendor_calendar")) asked.push(r.postDataJSON()); });
  await ready(page, request);

  await page.getByRole("button", { name: "Request dates" }).first().click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.locator(`select option[value="${far.open}"]`)).toHaveCount(1);
  await dlg.getByRole("button", { name: "Close" }).first().click();

  await page.getByRole("navigation").getByRole("link", { name: "My bookings" }).click();
  await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();
  const card = page.locator(".booking.bs-confirmed");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const rows = await stub(request, "/__bookings") as { day: string; status: string }[];
  expect(rows).toEqual([expect.objectContaining({ day: far.booked, status: "cancelled" })]);

  const span = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;
  expect(asked.length).toBeGreaterThan(0);
  for (const a of asked) expect(span(a.p_from, a.p_to)).toBeLessThanOrEqual(400);
  expect(asked.some((a) => a.p_to >= far.open)).toBe(true);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});
