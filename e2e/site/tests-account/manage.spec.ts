import { expect, test, type Page } from "@playwright/test";

// A ticket's own changes on Bookings, made on the website (the user, 2026-11-19: "make sure all customers can do everything
// they want in the booking app to do it on the main website"; components/booking/TicketManage.tsx): Cancel with the booking
// app's reasons, Leave waitlist, Edit of the party, Add-ons, the locker's Change, Remove and Add a locker, and Reschedule,
// against stub-account-db.mjs's "manage" scene: Sara Khalid and Omar Khalid on the circuit night in five days (an energy
// gel on Sara's row, her locker 7 for 9-11 PM), Sara on the waitlist of the night in six, two more open nights to move to.
// Every change lands in the stub's memory, never in a real database. MANAGE_SHOTS=<dir> also saves the screenshots.
const STUB = `http://127.0.0.1:${process.env.STUB_PORT || 8797}`;
type Booking = { id: string; status: string; session_id: string; cancel_reason?: string; cancel_note?: string; addons?: string; height?: number; type_preference?: string; name: string };
type State = { bookings: Booking[]; writes: { fn: string; a: Record<string, unknown> }[]; lockers: { id: string; booking_id: string | null; status: string; period: string; code: string }[]; stock: Record<string, number> };

async function signIn(page: Page, lang = "en") {
  await page.request.post(`${STUB}/__reset`, { data: { scene: "manage" } });
  const base = test.info().project.use.baseURL as string;
  await page.context().addCookies([
    { name: "mm_acct", value: "c-test~a1b2c3d4e5f6a7b8c9d0", url: base },
    { name: "NEXT_LOCALE", value: lang, url: base },
  ]);
}
const state = async (page: Page) => (await (await page.request.get(`${STUB}/__state`)).json()) as State;
const writes = async (page: Page, fn: string) => (await state(page)).writes.filter((w) => w.fn === fn).map((w) => w.a);
const party = (page: Page) => page.locator("article.tk-card", { hasText: "Omar Khalid" });
const waitlisted = (page: Page) => page.locator("article.tk-card", { hasText: "Leave waitlist" });
const dialog = (page: Page) => page.locator("dialog[open]");
async function open(page: Page) {
  await page.goto("/bookings");
  await expect(party(page).locator(".tk-manage")).toBeVisible();
  // the booking's read lands: the buttons that wait for it (Add-ons, Add a locker) show
  await expect(party(page).getByRole("button", { name: "Add-ons" })).toBeVisible();
}

test("Cancel asks why, says the party goes with it, needs Other's words, and cancels every rider with the reason", async ({ page }) => {
  await signIn(page);
  await open(page);
  await party(page).locator(".tk-manage").getByRole("button", { name: "Cancel", exact: true }).click();
  const d = dialog(page);
  await expect(d.getByRole("heading", { name: "Why are you cancelling?" })).toBeVisible();
  await expect(d).toContainText("This cancels the booking for all 2 riders.");
  await expect(d.getByRole("radio")).toHaveCount(9);
  const go = d.getByRole("button", { name: "Cancel the booking for all 2" });
  await go.click();
  await expect(d.getByRole("alert")).toHaveText("Choose a reason above.");
  await d.getByRole("radio", { name: "Other" }).check();
  await go.click();
  await expect(d.getByRole("alert")).toHaveText("Write the reason in the box above.");
  await d.getByPlaceholder("Tell us the reason").fill("My flight changed");
  await go.click();
  await expect(dialog(page)).toHaveCount(0);
  const s = await state(page);
  for (const id of ["e-jcc1", "e-jcc2"]) expect(s.bookings.find((b) => b.id === id)).toMatchObject({ status: "cancelled", cancel_reason: "other", cancel_note: "My flight changed" });
  // Sara's gel goes back to stock (she held a place); her locker goes with the booking
  expect(await writes(page, "customer_addon_stock")).toEqual([expect.objectContaining({ p_items: [{ id: "gel1", delta: 1 }] })]);
  expect(s.lockers.find((l) => l.booking_id === "e-jcc1")?.status).toBe("cancelled");
  // the page is drawn again: the night is one quiet Cancelled by you row, its ticket gone
  await expect(party(page)).toHaveCount(0);
  await expect(page.locator(".tk-cx-list > li")).toHaveCount(2);
});

test("Leave waitlist on a booking all on the waitlist: the same reasons, the button says so, nothing goes back to stock", async ({ page }) => {
  await signIn(page);
  await open(page);
  await waitlisted(page).locator(".tk-manage").getByRole("button", { name: "Leave waitlist" }).click();
  const d = dialog(page);
  await expect(d).not.toContainText("This cancels the booking for all");
  await d.getByRole("radio", { name: "Change of plans" }).check();
  await d.getByRole("button", { name: "Leave waitlist" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect((await state(page)).bookings.find((b) => b.id === "e-wl1")).toMatchObject({ status: "cancelled", cancel_reason: "plans" });
  expect(await writes(page, "customer_addon_stock")).toEqual([]);
});

test("Edit: names on the booking stay read-only, heights and bike types change, a rider added needs a name and the waiver", async ({ page }) => {
  await signIn(page);
  await open(page);
  await party(page).locator(".tk-manage").getByRole("button", { name: "Edit" }).click();
  const d = dialog(page);
  await expect(d.getByRole("heading", { name: "Update booking" })).toBeVisible();
  const names = d.getByLabel("Rider’s full name");
  await expect(names).toHaveCount(2);
  await expect(names.nth(0)).toHaveValue("Sara Khalid");
  await expect(names.nth(1)).toHaveAttribute("readonly", "");
  // no "Any" for a rider; the fares on the pills
  await expect(d.getByRole("radiogroup").first().getByRole("radio")).toHaveCount(5);
  await expect(d.getByText("Any", { exact: true })).toHaveCount(0);
  const heights = d.getByLabel("Height");
  await heights.nth(1).fill("175");
  await d.getByRole("radiogroup").nth(1).getByRole("radio", { name: /Mountain/ }).check();
  await d.getByRole("button", { name: "Increase number of bikes" }).click();
  await expect(names).toHaveCount(3);
  await expect(names.nth(2)).not.toHaveAttribute("readonly", "");
  // the waiver for the rider added, right above the button, which waits for its tick
  const save = d.getByRole("button", { name: "Update booking" });
  await expect(save).toBeDisabled();
  await expect(d.getByRole("checkbox")).toBeVisible();
  await d.getByRole("checkbox").check();
  await save.click();
  await expect(d.getByRole("alert")).toHaveText("Enter a height between 100 and 250 cm.");
  await heights.nth(2).fill("170");
  await d.getByRole("radiogroup").nth(2).getByRole("radio", { name: /Kids/ }).check();
  await save.click();
  await expect(d.getByRole("alert")).toHaveText("Kids bikes are for riders up to 144 cm");
  await heights.nth(2).fill("140");
  await names.nth(2).fill("lina-al khalid");
  await save.click();
  await expect(dialog(page)).toHaveCount(0);
  const upd = await writes(page, "customer_booking_update");
  expect(upd).toEqual([expect.objectContaining({ p_entry_id: "e-jcc2", p_patch: { height: 175, size: "M", type_preference: "Mountain" } })]);
  const made = await writes(page, "customer_create_booking");
  expect(made).toHaveLength(1);
  expect(made[0].p_entries).toEqual([expect.objectContaining({ name: "Lina Al Khalid", height: 140, type_preference: "Kids", session_id: "s-jcc", waiver_version: "2026-11-v4", status: "waiting" })]);
  // drawn again with the third rider
  await expect(party(page)).toContainText("Lina Al Khalid");
});

test("Add-ons: whose, then each item's stepper, saved one tap at a time with the stock following", async ({ page }) => {
  await signIn(page);
  await open(page);
  await party(page).getByRole("button", { name: "Add-ons" }).click();
  const d = dialog(page);
  await expect(d.getByRole("heading", { name: "Edit add-ons" })).toBeVisible();
  await expect(d.getByRole("radio")).toHaveCount(2); // Sara and Omar
  const bar = d.locator("li.mg-ad", { hasText: "Salted Caramel Protein Bar" });
  await bar.getByRole("button", { name: /Increase quantity/ }).click();
  await expect(bar.locator(".mg-step > span")).toHaveText("1");
  await expect(d.locator(".mg-tot")).toContainText("27");
  const upd = await writes(page, "customer_booking_update");
  expect(JSON.parse(String((upd[0].p_patch as { addons: string }).addons))).toEqual([{ id: "gel1", qty: 1, p: 12 }, { id: "locker", qty: 1, p: 10 }, { id: "bar1", qty: 1 }]);
  expect(await writes(page, "customer_addon_stock")).toEqual([expect.objectContaining({ p_items: [{ id: "bar1", delta: -1 }] })]);
  // the gel comes off again
  await d.locator("li.mg-ad", { hasText: "Orange Energy Gel" }).getByRole("button", { name: /Decrease quantity/ }).click();
  await expect(d.locator("li.mg-ad", { hasText: "Orange Energy Gel" }).locator(".mg-step > span")).toHaveText("0");
  await d.getByRole("button", { name: "Done" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect((await state(page)).stock).toEqual({ gel1: 6, bar1: 8 });
});

test("The locker: Change its time and door on the cabinet, Remove it, then Add a locker on the booking", async ({ page }) => {
  await signIn(page);
  await open(page);
  const line = party(page).locator(".tk-lk-line");
  await expect(line).toContainText("9 PM - 11 PM · 7");
  await line.getByRole("button", { name: "Change" }).click();
  let d = dialog(page);
  await expect(d.getByRole("radio", { name: /9 PM - 11 PM/ })).toHaveAttribute("aria-checked", "true");
  await d.getByRole("radio", { name: /6 PM - 11 PM/ }).click();
  // the cabinet, 1 top left whatever the language; 3 taken, 9 out of service, 14 missing, the rider's own 7 picked
  const cab = d.locator(".tk-lk-cab");
  await expect(cab).toHaveAttribute("dir", "ltr");
  await expect(cab.getByRole("button", { name: "Locker 3 · Full" })).toBeDisabled();
  await expect(cab.getByRole("button", { name: "Locker 9 · Out of service" })).toBeDisabled();
  await expect(cab.getByRole("button", { name: "Locker 7", exact: true })).toHaveAttribute("aria-pressed", "true");
  await cab.getByRole("button", { name: "Locker 5", exact: true }).click();
  await d.getByRole("button", { name: "Save" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await writes(page, "customer_locker_change")).toEqual([expect.objectContaining({ p_period: "both", p_code: "5" })]);
  await expect(line).toContainText("6 PM - 11 PM · 5");
  await line.getByRole("button", { name: "Remove" }).click();
  d = dialog(page);
  await expect(d.getByRole("heading", { name: "Remove the locker from this booking?" })).toBeVisible();
  await d.getByRole("button", { name: "Remove" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await writes(page, "customer_locker_cancel")).toEqual([expect.objectContaining({ p_booking_ids: ["e-jcc1"] })]);
  await expect(party(page).locator(".tk-lk-line")).toHaveCount(0);
  await party(page).getByRole("button", { name: "Add a locker" }).click();
  d = dialog(page);
  await d.getByRole("radio", { name: /6 PM - 8 PM/ }).click();
  await d.locator(".tk-lk-cab").getByRole("button", { name: "Locker 2", exact: true }).click();
  // the terms open in a pop-up of their own
  await d.getByRole("button", { name: "locker terms" }).click();
  await expect(page.locator("dialog[open]").last().getByRole("heading", { name: "Locker terms" })).toBeVisible();
  await page.locator("dialog[open]").last().locator(".tk-dlg-acts").getByRole("button", { name: "Close" }).click();
  await d.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await writes(page, "customer_locker_reserve")).toEqual([expect.objectContaining({ p_booking_ids: ["e-jcc1"], p_period: "early", p_codes: ["2"] })]);
  await expect(party(page).locator(".tk-lk-line")).toContainText("6 PM - 8 PM · 2");
});

test("Reschedule lists the other open circuit nights and moves the whole booking", async ({ page }) => {
  await signIn(page);
  await open(page);
  await party(page).getByRole("button", { name: "Reschedule" }).click();
  const d = dialog(page);
  await expect(d.getByRole("heading", { name: "Move your booking" })).toBeVisible();
  await expect(d).toContainText("Pick another session to move all your riders to.");
  const opts = d.locator(".mg-rs-o");
  await expect(opts).toHaveCount(2); // the night in seven days and the one in nine; never the full one, the Saturday ride or its own
  await expect(opts.first()).toContainText("Available");
  await opts.first().click();
  await expect(dialog(page)).toHaveCount(0);
  const s = await state(page);
  for (const id of ["e-jcc1", "e-jcc2"]) expect(s.bookings.find((b) => b.id === id)?.session_id).toBe("s-jcc2");
});

test("Arabic: the dialogs speak the booking app's Arabic", async ({ page }) => {
  await signIn(page, "ar");
  await page.goto("/bookings");
  await party(page).locator(".tk-manage").getByRole("button", { name: "إلغاء", exact: true }).click();
  await expect(dialog(page).getByRole("heading", { name: "ما سبب الإلغاء؟" })).toBeVisible();
  await expect(dialog(page)).toContainText("سيُلغى الحجز لجميع المشاركين (2).");
  await expect(dialog(page).getByRole("button", { name: "إبقاء الحجز" })).toBeVisible();
});

// The screenshots the owner looks at (MANAGE_SHOTS=<dir>): the manage row and each dialog, at 390 and 1280, English and Arabic.
test("screenshots", async ({ page }, info) => {
  const dir = process.env.MANAGE_SHOTS;
  test.skip(!dir || info.project.name !== "desktop", "only with MANAGE_SHOTS, once");
  for (const lang of ["en", "ar"]) for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    await signIn(page, lang);
    await open(page).catch(() => page.goto("/bookings"));
    await party(page).locator(".tk-manage").waitFor();
    await party(page).scrollIntoViewIfNeeded();
    const shot = (what: string) => page.screenshot({ path: `${dir}/manage-${what}-${lang}-${width}.png` });
    await party(page).screenshot({ path: `${dir}/manage-ticket-${lang}-${width}.png` });
    const btn = (en: string, ar: string) => party(page).locator(".tk-manage, .tk-lk-line").getByRole("button", { name: lang === "ar" ? ar : en, exact: true });
    await btn("Cancel", "إلغاء").click();
    await dialog(page).locator(".mg-cr-opt").last().click();
    await shot("cancel");
    await page.keyboard.press("Escape");
    await btn("Edit", "تعديل").click();
    await dialog(page).locator(".mg-step button").last().click();
    await dialog(page).locator(".mg-wv").waitFor();
    await shot("edit");
    await page.keyboard.press("Escape");
    await party(page).locator(".tk-manage button").nth(2).click(); // Add-ons
    await dialog(page).locator(".mg-ad").first().waitFor();
    await shot("addons");
    await page.keyboard.press("Escape");
    await party(page).locator(".tk-lk-line button").first().click(); // the locker's Change
    await dialog(page).locator(".tk-lk-cab").waitFor();
    await shot("locker");
    await page.keyboard.press("Escape");
    await party(page).locator(".tk-manage button").nth(1).click(); // Reschedule
    await dialog(page).locator(".mg-rs-o").first().waitFor();
    await shot("move");
    await page.keyboard.press("Escape");
  }
});
