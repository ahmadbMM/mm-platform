import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import AccountPage from "../../app/[locale]/account/[[...part]]/page";
import BookingsPage from "../../app/[locale]/bookings/page";
import AccMenu, { type MenuGroup, type MenuRow, type MenuTile } from "@/components/account/AccMenu";
import { Appointment, AccPurchases, AccWorkshop } from "@/components/account/AccLists";
import { AccPersonal, AccRiding } from "@/components/account/AccDetails";
import { AccDelete } from "@/components/account/AccPages";
import TicketCard from "@/components/booking/TicketCard";
import { ACC_WORDS, accWords } from "@/components/account/AccountMenu.words";
import { BOOKINGS_WORD } from "@/components/site/Bookings.words";
import { LOCALE_CODES } from "@/i18n/locales";
import { ACC_PAGES, accHref, accountRoute, detailValues, lcLabel, missing, missValue } from "../account-menu";
import { pastJobs, riyadhParts, upcomingJobs, workshopJobsOf } from "../workshop-mine";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";

// My Account as the booking app's menu (the user, 2026-11-19: "i want the account page to be very similar on main for it
// on booking app") and Bookings, the one place for everything ahead ("unified place to have all upcoming appointments
// for everything"). The page is drawn signed in with every database function answered here; nothing is read or written.
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const ABSENT = () => json({ code: "PGRST202", message: "Could not find the function" }, 404);
const pad = (n: number) => String(n).padStart(2, "0");
const day = (n: number) => { const d = new Date(Date.now() + 3 * 3600e3); d.setUTCDate(d.getUTCDate() + n); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const PROFILE = { name: "Sara Khalid", email: "sara@example.com", phone: "+966500000001", height: 168, type_preference: "Hybrid", birth_date: "1994-03-02",
  country: "Saudi Arabia", city: "Jeddah", nationality: "Saudi Arabia", gender: "female", photo: null };

function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
/** The page signed in, each function answered by `answer` (else as a default rider's, or absent). */
async function draw(part: string[] | undefined | "bookings", answer: (fn: string, body: Record<string, unknown>) => Response | null = () => null, locale = "en") {
  jar.account = "c1~a1b2c3d4e5f6a7b8c9d0";
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const fn = /\/rpc\/([a-z0-9_]+)/.exec(String(url))?.[1] ?? "";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    const a = fn ? answer(fn, body) : null;
    if (a) return a;
    if (fn === "customer_profile") return json([PROFILE]);
    if (fn === "customer_about") return json([{ profession: "Architect", workplace: "", heard_from: "instagram", sign_in: null }]);
    if (fn === "customer_emergency") return json([{ emergency_name: "Ali Saleh", emergency_phone: "+966500000002", emergency_relation: "sibling", emergency2_name: null }]);
    if (fn === "customer_wallet") return json({ balance: 70, rows: [] });
    if (fn === "customer_referral") return json({ ok: true, on: true, code: "K7MQ2X" });
    if (fn === "customer_deletion_request") return json({ requested_at: null });
    if (fn === "customer_purchases") return json([]);
    if (fn === "my_bookings" || fn === "list_sessions") return json([]);
    if (fn) return ABSENT();
    return json([]);
  });
  vi.stubGlobal("fetch", f);
  const p = part === "bookings"
    ? await BookingsPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) })
    : await AccountPage({ params: Promise.resolve({ locale, part }), searchParams: Promise.resolve({}) });
  return { p, asked: (fn: string) => f.mock.calls.filter((c) => String(c[0]).includes(`/rpc/${fn}`)).length };
}
const menuOf = (p: unknown) => findAll(p, AccMenu)[0]?.props as { tiles: MenuTile[]; groups: MenuGroup[]; current: string | null; logOut: string; del: MenuRow | null } | undefined;
const rowOf = (p: unknown, id: string) => menuOf(p)?.groups.flatMap((g) => g.rows).find((r) => r.id === id);

beforeEach(() => {
  resetRides(); resetSiteContent();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { jar.account = ""; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the addresses", () => {
  it("are the menu, the record's two parts, and one per page by the booking app's ids; anything else is no page", () => {
    expect(accountRoute(undefined)).toEqual({ view: "account", page: null });
    expect(accountRoute(["stats"])).toEqual({ view: "stats", page: null });
    for (const p of ACC_PAGES) expect(accountRoute([p])).toEqual({ view: "account", page: p });
    for (const s of [["nope"], ["personal", "x"], ["account"]]) expect(accountRoute(s)).toBeNull();
    expect(accHref("account")).toBe("/account");
    expect(accHref("purchases")).toBe("/account/purchases");
    for (const p of ["personal", "contact", "residence", "emergency", "riding", "sport", "about", "wallet", "invite", "ambassador", "volunteer", "purchases", "company", "delete"]) {
      expect(ACC_PAGES, p).toContain(p);
    }
  });
});

describe("what a row says", () => {
  const w = accWords("en");
  it("is what the page lacks, in amber, as the booking app's _accMiss says it", () => {
    expect(missing({ name: "A B", photo: null, birth_date: "" }, ["photo", "name", "birth_date"])).toEqual(["photo", "birth_date"]);
    expect(missValue({ name: "A B" }, ["photo", "name", "birth_date"], w, "en")).toEqual({ text: "Add profile photo and birth date", add: true });
    expect(missValue({ type_preference: "Any", height: 170 }, ["type_preference", "height"], w, "en")?.text).toBe("Add bike type preference");
    expect(missValue({ email: "x@y.z", phone: "+966500000000" }, ["email", "phone"], w, "en")).toBeNull();
    expect(lcLabel("Profile photo", "fr")).toBe("profile photo");
    expect(lcLabel("صورة الملف", "ar")).toBe("صورة الملف");
  });
  it("else the value on file", () => {
    const v = detailValues({ ...PROFILE, photo: "https://x/p.jpg" }, { profession: "Architect" }, w, "en", (c) => c);
    expect(v.personal).toEqual({ text: "Sara Khalid", add: false });
    expect(v.contact).toMatchObject({ text: "+966500000001", add: false, ltr: true });
    expect(v.residence.text).toBe("Jeddah");
    expect(v.riding.text).toBe("Hybrid · 168 cm");
    expect(v.about.text).toBe("Architect");
  });
});

describe("the words", () => {
  it("are there in all 16 languages, with every key and its values intact", () => {
    const keys = Object.keys(ACC_WORDS.en).sort();
    for (const l of LOCALE_CODES) {
      expect(Object.keys(ACC_WORDS[l]).sort(), l).toEqual(keys);
      for (const k of keys) {
        const v = ACC_WORDS[l][k as keyof typeof ACC_WORDS.en];
        expect(v, `${l}.${k}`).toBeTruthy();
        expect((v.match(/\{\d\}/g) ?? []).sort(), `${l}.${k}`).toEqual((ACC_WORDS.en[k as keyof typeof ACC_WORDS.en].match(/\{\d\}/g) ?? []).sort());
      }
      expect(BOOKINGS_WORD[l], l).toBeTruthy();
    }
    expect(ACC_WORDS.ar.personal).toBe("البيانات الشخصية"); // the booking app's own
    // no emoji anywhere (the owner's rule)
    expect(JSON.stringify(ACC_WORDS)).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("the menu", () => {
  it("has the tiles, the groups in the app's order, Log out, and Delete my account last", async () => {
    const { p } = await draw(undefined);
    const m = menuOf(p);
    expect(m?.tiles.map((t) => [t.id, t.value])).toEqual([["wallet", "70"], ["invite", "K7MQ2X"]]);
    expect(m?.groups.map((g) => g.title)).toEqual(["Your details", "Activity", "Settings"]);
    expect(m?.groups[0].rows.map((r) => r.id)).toEqual(["personal", "contact", "residence", "emergency", "riding", "about"]);
    // (Help, Club card and Write a testimonial lead to pages staff switch on: none is on here, no content being read)
    expect(m?.groups[2].rows.map((r) => r.id)).toEqual(["language", "password", "support"]);
    expect(m?.logOut).toBe("Log out");
    expect(m?.del).toMatchObject({ id: "delete", red: true, href: "/account/delete" });
    expect(rowOf(p, "personal")?.value).toEqual({ text: "Add profile photo", add: true });
    expect(rowOf(p, "emergency")?.value).toEqual({ text: "Ali Saleh", add: false });
    expect(rowOf(p, "support")).toMatchObject({ href: "https://wa.me/966579543997", out: true });
    expect(m?.current).toBeNull();
  });
  it("shows a row the app shows only for some accounts only for them", async () => {
    const plain = await draw(undefined, (fn) => (fn === "customer_purchases" ? ABSENT() : fn === "customer_emergency" ? ABSENT() : null));
    expect(rowOf(plain.p, "purchases")).toBeUndefined(); // a database without the function: no row
    expect(rowOf(plain.p, "emergency")).toBeUndefined();
    expect(rowOf(plain.p, "ambassador")).toBeUndefined();
    expect(rowOf(plain.p, "volunteer")).toBeUndefined();
    expect(rowOf(plain.p, "company")).toBeUndefined();
    expect(rowOf(plain.p, "workshop")).toBeDefined(); // the website's own: always there, empty until the function is
    const more = await draw(undefined, (fn) => (
      fn === "ambassador_mine" ? json({ ok: true, ambassador: true, code: "SARA10", status: "active", earned: 40, balance: 10, uses: 3 })
        : fn === "volunteer_me" ? json({ hours: 6, status: "active" })
          : fn === "company_challenge_mine" ? json({ ok: true, rows: [{ id: 1, company: "Acme", starts_on: day(-3), ends_on: day(20), state: "on", mine: 2 }], open: true })
            : fn === "customer_emergency" ? json([{ emergency_name: "", emergency_phone: "", emergency_relation: "" }])
              : fn === "customer_deletion_request" ? json({ requested_at: "2026-11-01T10:00:00Z" }) : null));
    expect(rowOf(more.p, "ambassador")?.value).toMatchObject({ text: "SARA10" });
    expect(rowOf(more.p, "volunteer")?.value?.text).toBe("6 hours");
    expect(rowOf(more.p, "company")?.value?.text).toBe("Acme");
    expect(rowOf(more.p, "emergency")?.value).toEqual({ text: "Add a contact", add: true });
    expect(menuOf(more.p)?.del?.value).toEqual({ text: "Requested", add: true });
  });
  it("opens a page beside it: Personal details when none is picked, else the one at the address, its row the current one", async () => {
    const home = await draw(undefined);
    expect(findAll(home.p, AccPersonal)).toHaveLength(1);
    const riding = await draw(["riding"], (fn) => (fn === "customer_blood_type" ? json("B-") : null));
    expect(menuOf(riding.p)?.current).toBe("riding");
    const r = findAll(riding.p, AccRiding)[0]?.props as { initial: { type: string; height: string }; blood: { value: string } | null };
    expect(r.initial).toEqual({ type: "Hybrid", height: "168" });
    expect(r.blood?.value).toBe("B-");
    expect(findAll(riding.p, AccPersonal)).toHaveLength(0);
    // the blood type is read only on its page
    expect(home.asked("customer_blood_type")).toBe(0);
    const del = await draw(["delete"]);
    expect(findAll(del.p, AccDelete)).toHaveLength(1);
  });
  it("speaks the reader's language: Arabic from the booking app's words", async () => {
    const { p } = await draw(undefined, () => null, "ar");
    expect(menuOf(p)?.groups.map((g) => g.title)).toEqual(["بياناتك", "النشاط", "الإعدادات"]);
    expect(rowOf(p, "personal")?.value?.text).toBe("أضف صورة الملف");
  });
});

describe("Purchases and Workshop appointments", () => {
  it("lists the purchases with their total, a refunded one struck through and not counted", async () => {
    const { p } = await draw(["purchases"], (fn) => (fn === "customer_purchases" ? json([
      { id: "p1", at: "2026-11-01T18:00:00Z", name: "Water", qty: 2, price: 3, pay: "paid" },
      { id: "p2", at: "2026-10-01T18:00:00Z", name: "Gloves", qty: 1, price: 45, pay: "paid", refunded: true },
      { id: "p3", at: "2026-10-01T18:00:00Z", name: "meta", category: "__cardmeta__", qty: 1, price: 0 },
    ]) : null));
    const props = findAll(p, AccPurchases)[0]?.props as { rows: { name: string; refunded: boolean }[]; total: number };
    expect(props.rows.map((r) => [r.name, r.refunded])).toEqual([["Water", false], ["Gloves", true]]);
    expect(props.total).toBe(6);
    expect(rowOf(p, "purchases")?.value?.text).toBe("6");
  });
  it("lists the workshop appointments, upcoming then past; a database without the function shows the page empty", async () => {
    const jobs = [
      { id: 42, ref: "W-0042", status: "confirmed", service: "Full service", preferred_date: day(3), preferred_time: "17:00" },
      { id: 50, ref: "W-0050", status: "new", service: "Tune-up", preferred_date: day(1), preferred_time: null, scheduled_for: `${day(6)}T14:00:00Z` },
      { id: 17, ref: "W-0017", status: "completed", service: "Tune-up", preferred_date: day(-25) },
      { id: 18, ref: "W-0018", status: "cancelled", service: "Wheel true", preferred_date: day(4) },
    ];
    const { p } = await draw(["workshop"], (fn) => (fn === "customer_workshop_jobs" ? json(jobs) : null));
    const props = findAll(p, AccWorkshop)[0]?.props as { up: { ref: string; time: string | null }[]; past: { ref: string }[] };
    expect(props.up.map((j) => j.ref)).toEqual(["W-0042", "W-0050"]);
    expect(props.up[1].time).toBe("17:00"); // the time staff booked, in Riyadh
    expect(props.past.map((j) => j.ref)).toEqual(["W-0018", "W-0017"]);
    const none = await draw(["workshop"]);
    const n = findAll(none.p, AccWorkshop)[0]?.props as { up: unknown[]; past: unknown[]; empty: string };
    expect([n.up, n.past, n.empty]).toEqual([[], [], "Nothing here yet."]);
  });
  it("reads a workshop row safely", () => {
    expect(workshopJobsOf([{ id: "7", status: "ready" }, null, { status: "x" }])).toEqual([
      { id: 7, ref: "W-0007", status: "ready", service: "", date: null, time: null, lane: "dropoff", price: null, bike: null, sent: null }]);
    expect(riyadhParts("2026-11-20T21:30:00Z")).toEqual({ date: "2026-11-21", time: "00:30" });
    const j = workshopJobsOf([{ id: 1, status: "in_workshop" }, { id: 2, status: "completed", preferred_date: "2026-11-30" }]);
    expect(upcomingJobs(j, "2026-11-19").map((x) => x.id)).toEqual([1]);
    expect(pastJobs(j, "2026-11-19").map((x) => x.id)).toEqual([2]);
  });
});

describe("Bookings", () => {
  const SESS = (id: string, date: string, time: string, kind: Record<string, unknown> = { event_kind: "regular" }) => ({ id, session_date: date, day: "Monday", title: null,
    bike_slots: JSON.stringify({ _time: time }), needs_approval: false, hide_queue: true, meet_url: null, paid_ride: true, open_to_all: true, status: "open", ...kind });
  const ROW = (id: string, s: string, date: string, o: Record<string, unknown> = {}) => ({ id, session_id: s, session_date: date, session_day: "Monday", status: "waiting", queue_num: 3, price: 75, paid: false, name: "Sara Khalid", type_preference: "Hybrid", ...o });
  it("puts every booking ahead in one list, soonest first: tickets among the workshop, lockers, volunteer shifts and lessons", async () => {
    const { p } = await draw("bookings", (fn) => {
      if (fn === "my_bookings") return json([ROW("e1", "s-a", day(2)), ROW("e2", "s-b", day(5)), ROW("e3", "s-old", day(-12), { status: "done", rating_detail: {} })]);
      if (fn === "list_sessions") return json([SESS("s-a", day(2), "20:00-22:00"), SESS("s-b", day(5), "20:00-22:00"), SESS("s-old", day(-12), "20:00-22:00")]);
      if (fn === "customer_workshop_jobs") return json([{ id: 42, ref: "W-0042", status: "confirmed", service: "Full service", preferred_date: day(2), preferred_time: "17:00" }, { id: 9, status: "completed", preferred_date: day(-2) }]);
      if (fn === "customer_lockers") return json([{ id: "lk", booking_id: null, day: day(4), period: "both", code: "B7", status: "reserved", paid: true }]);
      if (fn === "volunteer_me") return json({ hours: 0, mine: [{ id: 1, title: "Blood Donation", date: day(8), time: "16:00", status: "accepted" }, { id: 2, title: "Old", date: day(-3), status: "done" }] });
      if (fn === "learn_ladder") return json({ ok: true, learners: [{ who: "child", name: "Omar", lesson_at: `${day(3)}T13:00:00Z` }] });
      return null;
    });
    const grid = findAll(p, "div").find((d) => (d.props as { className?: string }).className === "tk-grid bk-grid");
    const kids = (grid?.props as { children: unknown[] }).children.flat().filter(isValidElement) as ReactElement[];
    const seq = kids.map((k) => (k.type === TicketCard ? `ticket:${(k.props as { rows: { id: string }[] }).rows[0].id}` : k.type === Appointment ? `appt:${(k.props as { kind: string }).kind}` : String(k.type)));
    // the workshop at 17:00 before the ride at 20:00 on the same day; the lesson the day after; past ones left out
    expect(seq).toEqual(["appt:Workshop", "ticket:e1", "appt:Learn to ride", "appt:Your lockers", "ticket:e2", "appt:Volunteering"]);
    expect(findAll(p, "h2").map((h) => (h.props as { children: unknown }).children)).toContain("Past rides");
  });
  it("with nothing ahead says so, as before, with the way to the dates", async () => {
    const { p } = await draw("bookings");
    expect(JSON.stringify(findAll(p, "p").map((x) => x.props))).toContain("No rides booked yet");
  });
});
