import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import AccountPage from "../../app/[locale]/account/[[...part]]/page";
import SignIn from "@/components/account/SignIn";
import SignOut from "@/components/account/SignOut";
import RideRecord from "@/components/account/RideRecord";
import SportCard from "@/components/account/SportCard";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";

// The account page when the database does not answer in time (bug hunt 2026-11-10): a session that could not be checked
// is said so, not met with the sign-in form, and bookings that could not be read are said so, not "no rides" with every
// ride badge not earned. An answer is a refusal only when it comes: a session the booking app no longer accepts is an
// empty list (customer_profile), and an account with no bookings an empty list too (my_bookings).
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const PROFILE = () => json([{ name: "Test Rider", email: "rider@example.test", phone: "+966500000000" }]);
const TIMEOUT = () => json({ code: "57014", message: "canceling statement due to statement timeout" }, 500);
const FAILED = "Something went wrong at our end. Check your connection and try again.";

/** Every element of `type` in a tree a page returned, its own children unrendered. */
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
/** The words written in a tree a page returned, components left undrawn. */
function words(n: unknown, out: string[] = []): string[] {
  if (typeof n === "string") out.push(n);
  else if (Array.isArray(n)) for (const x of n) words(x, out);
  else if (isValidElement(n)) words((n.props as { children?: unknown }).children, out);
  return out;
}
/** The account page signed in, each database function answered by `answer` (an empty list when it gives none). */
async function page(answer: (fn: string) => Response | null, part?: string[]) {
  jar.account = "c1~a1b2c3d4e5f6a7b8c9d0";
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const fn = /\/rpc\/([a-z0-9_]+)/.exec(String(url))?.[1] ?? "";
    const a = fn ? answer(fn) : null;
    if (a) return a;
    if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
    return json([]);
  }));
  const p = await AccountPage({ params: Promise.resolve({ locale: "en", part }), searchParams: Promise.resolve({}) });
  return { p, text: words(p).join(" ") };
}

beforeEach(() => {
  resetRides(); resetSiteContent();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { jar.account = ""; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the account page when a read fails", () => {
  it("a session that could not be checked is said so, with the page once more and Sign out - never the sign-in form", async () => {
    const { p, text } = await page((fn) => (fn === "customer_profile" ? TIMEOUT() : null));
    expect(findAll(p, SignIn)).toHaveLength(0);
    expect(findAll(p, SignOut)).toHaveLength(1);
    expect(text).toContain("Please try again in a moment.");
    expect(findAll(p, "a").some((a) => (a.props as { href?: string }).href === "/account")).toBe(true);
  });
  it("a session the booking app no longer accepts is asked to sign in again", async () => {
    const { p } = await page(() => null);
    expect(findAll(p, SignIn)).toHaveLength(1);
  });
  it("bookings that could not be read are said so: not 'no rides', and Stats and Badges show no record", async () => {
    for (const part of [undefined, ["stats"], ["badges"]]) {
      const { p, text } = await page((fn) => (fn === "customer_profile" ? PROFILE() : fn === "my_bookings" ? TIMEOUT() : null), part);
      expect(text, String(part)).toContain(FAILED);
      expect(text, String(part)).not.toContain("No rides booked yet");
      expect(findAll(p, RideRecord), String(part)).toHaveLength(0);
    }
  });
  it("an account with no bookings is told it has none, as before", async () => {
    const { p, text } = await page((fn) => (fn === "customer_profile" ? PROFILE() : null));
    expect(text).toContain("No rides booked yet");
    expect(text).not.toContain(FAILED);
    const stats = await page((fn) => (fn === "customer_profile" ? PROFILE() : null), ["stats"]);
    expect(findAll(stats.p, RideRecord)).toHaveLength(1);
    expect(findAll(p, SignOut)).toHaveLength(1);
  });
  it("a sport list that cannot be read keeps the rider's own added sport, so Save does not drop it", async () => {
    const SPORT = () => json([{ competes: true, federations: ["cycling", "x_padbol"], other: null, asked: true }]);
    const { p } = await page((fn) => (fn === "customer_profile" ? PROFILE() : fn === "customer_sport" ? SPORT() : fn === "sport_option_list" ? TIMEOUT() : null));
    const card = findAll(p, SportCard);
    expect(card).toHaveLength(1);
    const props = card[0].props as { initial: { feds: string[] }; added: { code: string }[] };
    expect(props.initial.feds).toContain("x_padbol");
    expect(props.added.map((o) => o.code)).toEqual(["x_padbol"]);
  });
});
