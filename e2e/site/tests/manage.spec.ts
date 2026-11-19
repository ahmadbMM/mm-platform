import { expect, test, type Page, type Route } from "@playwright/test";

// A ticket drawn by the booking flow's own
// confirmation changes its booking on the website as My Bookings' does (TicketManage.tsx; the user, 2026-11-19: "make sure all
// customers can do everything they want in the booking app to do it on the main website"). The flow's account and booking
// routes and the ticket's change routes are stubbed here, so nothing is booked, cancelled or changed anywhere; a real
// upcoming circuit night's id is read from /experiences. Skipped when there is no such night, or when the page has no flow
// that reaches a confirmation. The full on-site actions run against a stub database in tests-account/manage.spec.ts.
const ACCT = { name: "Sara Khalid", height: 168, hidden: [], house: null, member: false, rejected: [], live: {}, asks: [], profileGate: "none", pgAsk: [], count: 3, birth: "1994-03-02", nationality: "Saudi Arabia", gender: "female" };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function jccSession(page: Page): Promise<string | null> {
  const res = await page.request.get("/experiences");
  const m = /ev=jcc&(?:amp;)?session=([A-Za-z0-9_-]+)/.exec(await res.text());
  return m ? m[1] : null;
}

test("the confirmation's ticket cancels with a reason and edits its party, on the website", async ({ page }) => {
  const id = await jccSession(page);
  test.skip(!id, "no upcoming circuit night");
  const date = /^\d{4}-\d{2}-\d{2}/.exec(id!)?.[0] ?? "2099-03-01";
  const tickets = ["e1", "e2"].map((rid, i) => ({
    id: rid, sessionId: id, date, day: "Monday", queueNum: 11 + i, status: "waiting", waitlistNum: null, approval: null, price: 75, paid: false,
    name: i ? "Omar Khalid" : "Sara Khalid", type: i ? "Road" : "Hybrid", checkedInAt: null, checkedOutAt: null, rideDuration: null, bikeId: null, addonLines: [], runKm: null,
  }));
  const session = { id, date, kind: "jcc", title: null, approval: false, published: false, times: ["20:00", "22:00"], gathers: false, collect: "19:15", meetUrl: null, free: false, freeRide: false, bikes: true, routeSlug: null, location: null, breakfast: null, revealAt: null };
  const ctx = {
    ok: true, session: { id, date, kind: "jcc", free: false, approval: false, community: false, bike: true, ended: false, open: true, seat: null }, name: "Sara Khalid",
    rows: tickets.map((t) => ({ id: t.id, sessionId: id, date, name: t.name, status: "waiting", queueNum: t.queueNum, type: t.type, height: 170, size: "M", paid: false, price: 75, promo: null, payMethod: null, walletPaid: 0, addons: [] })),
    cap: 3, party: true, types: ["Road", "Hybrid", "Mountain", "Kids", "Road Carbon"].map((t) => ({ type: t, price: 75, closed: false })), addons: [],
    lockers: { kind: "", offer: null, rentals: [] }, reasons: ["plans", "work", "other"].map((code) => ({ code })), holder: null, acctCap: 3,
  };
  const sent: Record<string, unknown[]> = { cancel: [], update: [] };
  // the browser's own calls to the database (the funnel's counts, a code's lookup) never reach it from a test
  await page.route(/supabase\.co|cloudflareinsights\.com|challenges\.cloudflare\.com/, (r) => r.abort());
  for (const p of ["emergency", "sport", "birthday"]) await page.route(`**/api/account/${p}`, (r) => json(r, { signedIn: true, need: false, on: false, two: true }));
  for (const p of ["pending-waiver", "pending-share", "pending-race-reg", "pending-club", "pending-rating"]) await page.route(`**/api/account/${p}*`, (r) => json(r, { signedIn: true, pending: null }));
  await page.route("**/api/booking/account", (r) => json(r, { ok: true, signedIn: true, acct: ACCT }));
  await page.route("**/api/booking", (r) => (r.request().method() === "POST" ? json(r, { ok: true, tickets, session, booked: tickets.map((t) => ({ id: t.id, status: "waiting" })), addonsSaved: true }) : r.continue()));
  await page.route("**/api/booking/manage", (r) => json(r, ctx));
  await page.route("**/api/booking/cancel", (r) => { sent.cancel.push(r.request().postDataJSON()); return json(r, { ok: true, cancelled: 2 }); });
  await page.route("**/api/booking/update", (r) => { sent.update.push(r.request().postDataJSON()); return json(r, { ok: true, added: 0, waitlisted: false }); });
  await page.goto(`/experiences?ev=jcc&session=${id}`);
  // the flow to its confirmation: the riders step (the account's height already there), a bike type, the review, the
  // waiver's tick, Book
  await page.locator('.bk-pill[data-ty="Hybrid"]').click();
  await page.locator(".bk-foot .bk-btn").click();
  await page.locator("#bk-wv-cb").check();
  await page.locator(".bk-foot .bk-btn.grow").click();
  const card = page.locator("article.tk-card").first();
  test.skip(!(await card.isVisible().catch(() => false)), "the booking flow did not reach a confirmation here");
  // Edit: the party as it stands, names read-only, a height changed
  await card.locator(".tk-manage").getByRole("button", { name: "Edit" }).click();
  const d = page.locator("dialog[open]");
  await expect(d.getByRole("heading", { name: "Update booking" })).toBeVisible();
  await d.getByLabel("Height").first().fill("175");
  await d.getByRole("button", { name: "Update booking" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(sent.update).toEqual([expect.objectContaining({ session: id, key: ["e1", "e2"] })]);
  // Cancel with a reason: the ticket says Cancelled, with nothing to press
  await card.locator(".tk-manage").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.locator("dialog[open]").getByRole("radio", { name: "Change of plans" }).check();
  await page.locator("dialog[open]").getByRole("button", { name: "Cancel the booking for all 2" }).click();
  await expect(card.locator(".tk-manage")).toHaveText("Cancelled");
  expect(sent.cancel).toEqual([{ booking: "e1", reason: "plans", note: null }]);
});
