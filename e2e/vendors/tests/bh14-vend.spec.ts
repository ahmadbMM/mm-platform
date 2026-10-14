// Bug hunt 2026-10-14 (vendors): the database's BAD_INPUT (seats outside 1-2000, a turnout outside
// 0-1000) reaches the page as a 400 said on its field, not as "something went wrong"; a sign-out the
// server never got says so and leaves the venue signed in (its cookie still is).
import { expect, test, type APIRequestContext } from "@playwright/test";
import { signIn } from "./sign-in";

const STUB = Number(process.env.STUB_PORT || 8799);
const stub = (request: APIRequestContext, path: string, data: Record<string, unknown> = {}) =>
  request.post(`http://127.0.0.1:${STUB}${path}`, { data }).then((r) => r.json());

test.describe("@bh14 vendors", () => {
  test.beforeEach(async ({ request }, info) => {
    info.setTimeout(150_000); // room for one wait on the sign-in meter (sign-in.ts)
    await stub(request, "/__reset");
    await stub(request, "/__ready", { role: "owner" });
  });

  test("seats the database refuses (BAD_INPUT) are said on the seats field", async ({ page }) => {
    await signIn(page, "Breakfast2026");
    await page.getByRole("navigation").getByRole("link", { name: "Venue" }).click();
    // The page checks 1-2000 itself, so the out-of-range count is put into the request on its way.
    await page.route("**/api/rpc/vendor_profile_save", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      body.p_data.seats = "5000";
      await route.continue({ postData: JSON.stringify(body) });
    });
    const answered = page.waitForResponse((r) => r.url().endsWith("/api/rpc/vendor_profile_save"));
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const res = await answered;
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ error: "BAD_INPUT" });
    await expect(page.getByText("Seats must be a whole number between 1 and 2000.")).toBeVisible();
    await expect(page.getByLabel("Seats", { exact: true })).toBeFocused();
    await expect(page.getByText("Something went wrong on our side")).toHaveCount(0);
  });

  test("a sign-out the server never got says so and stays signed in; the next one signs out", async ({ page }) => {
    await signIn(page, "Breakfast2026");
    await expect(page.getByRole("heading", { name: "Breakfast calendar" })).toBeVisible();
    await page.route("**/api/logout", (route) => route.abort());
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("We could not reach the server");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await page.unroute("**/api/logout");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});
