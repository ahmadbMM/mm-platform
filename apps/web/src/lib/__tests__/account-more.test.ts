import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import AccountPage from "../../app/[locale]/account/[[...part]]/page";
import AccMenu, { type MenuGroup, type MenuRow } from "@/components/account/AccMenu";
import { AccUpdates, RideNews, UpdatesRow, type UpdView } from "@/components/account/AccNotify";
import AccLearn from "@/components/account/AccLearn";
import BadgeCelebrate from "@/components/account/BadgeCelebrate";
import CompanyLink from "@/components/account/CompanyLink";
import { AccCompany } from "@/components/account/AccPages";
import { NOTIFY_WORDS } from "@/components/account/Notify.words";
import { LEARN_WORDS } from "@/components/account/LearnLadder.words";
import { TM_ASK_WORDS } from "@/components/account/TestimonialAsk.words";
import { FIX_GATE_WORDS } from "@/components/account/FixGate.words";
import { LOCALE_CODES } from "@/i18n/locales";
import { ACC_PAGES, accountRoute, parentOf } from "../account-menu";
import { rideNewsOf, unreadOf, updateWhere, updatesOf, updLang } from "../account-notify";
import { ladderOf, learnerName, levelsOf, skillName } from "../learn-ladder";
import { BDG_FRESH_MS, cheersOf, eventDays, fresh, pickCheer, storeKey, type Cheer, type CheerStore } from "../badge-cheer";
import { companyCode, companyKept, companyParked, COMPANY_KEEP_MS } from "../company-link";
import { tmAskTitle, tmOldArgs, tmOldAsk, tmOldEnded } from "../testimonials";
import type { BadgeItem, RecordSession } from "../ride-record";
import type { TicketRow } from "../tickets";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";
import { GET as badgeNewGet, POST as badgeNewPost } from "../../app/api/account/badge-new/route";
import { POST as consentsPost } from "../../app/api/account/consents/route";
import { GET as tmAskGet, POST as tmAskPost } from "../../app/api/account/testimonial-ask/route";
import { GET as pendingFixGet } from "../../app/api/account/pending-fix/route";
import { GET as appSigninGet } from "../../app/api/account/app-signin/route";

// The booking app's Account pieces the website gained on 2026-11-19 (the owner, 2026-10-01: everything a customer sees or
// does in the booking app is also on the main website): Notifications (Ride news) and Updates, Learn to ride, the
// new-badge pop-up, the one-time ask about an old comment and the company challenge's join link. Nothing real is read or
// written: every database function is answered here.
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const ABSENT = () => json({ code: "PGRST202", message: "Could not find the function" }, 404);
const pad = (n: number) => String(n).padStart(2, "0");
const day = (n: number) => { const d = new Date(Date.now() + 3 * 3600e3); d.setUTCDate(d.getUTCDate() + n); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const PROFILE = { name: "Sara Khalid", email: "sara@example.com", phone: "+966500000001", height: 168, type_preference: "Hybrid", birth_date: "1994-03-02",
  country: "Saudi Arabia", city: "Jeddah", nationality: "Saudi Arabia", gender: "female", photo: null };
const SKILLS = [
  { key: "b1", level: 1, name: { en: "Glide with feet up", ar: "الانزلاق" } }, { key: "b2", level: 1, name: { en: "Look ahead" } },
  { key: "p1", level: 2, name: { en: "Start from a stop" } }, { key: "s1", level: 3, name: { en: "Brake to a stop" } }, { key: "c1", level: 4, name: { en: "One lap" } },
];

function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
async function draw(part: string[] | undefined, answer: (fn: string, body: Record<string, unknown>) => Response | null = () => null, locale = "en", signedIn = true) {
  jar.account = signedIn ? "c1~a1b2c3d4e5f6a7b8c9d0" : "";
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const fn = /\/rpc\/([a-z0-9_]+)/.exec(String(url))?.[1] ?? "";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    const a = fn ? answer(fn, body) : null;
    if (a) return a;
    if (fn === "customer_profile") return json([PROFILE]);
    if (fn === "customer_about") return json([{ profession: "Architect", workplace: "", heard_from: "instagram", sign_in: null }]);
    if (fn === "customer_deletion_request") return json({ requested_at: null });
    if (fn === "my_bookings" || fn === "list_sessions") return json([]);
    if (fn) return ABSENT();
    return json([]);
  });
  vi.stubGlobal("fetch", f);
  const p = await AccountPage({ params: Promise.resolve({ locale, part }), searchParams: Promise.resolve({}) });
  return { p, f, asked: (fn: string) => f.mock.calls.filter((c) => String(c[0]).endsWith(`/rpc/${fn}`)) };
}
const menuOf = (p: unknown) => findAll(p, AccMenu)[0]?.props as { groups: MenuGroup[]; current: string | null } | undefined;
const rowOf = (p: unknown, id: string): MenuRow | undefined => menuOf(p)?.groups.flatMap((g) => g.rows).find((r) => r.id === id);

beforeEach(() => {
  resetRides(); resetSiteContent();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { jar.account = ""; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the words", () => {
  it("are there in all 16 languages, every key with its placeholders, no emoji", () => {
    for (const [name, W] of [["notify", NOTIFY_WORDS], ["learn", LEARN_WORDS], ["tm ask", TM_ASK_WORDS], ["fix", FIX_GATE_WORDS]] as const) {
      const en = W.en as Record<string, string>, keys = Object.keys(en).sort();
      for (const l of LOCALE_CODES) {
        const x = W[l] as Record<string, string>;
        expect(Object.keys(x).sort(), `${name} ${l}`).toEqual(keys);
        for (const k of keys) {
          expect(x[k], `${name} ${l}.${k}`).toBeTruthy();
          expect((x[k].match(/\{\d\}/g) ?? []).sort(), `${name} ${l}.${k}`).toEqual((en[k].match(/\{\d\}/g) ?? []).sort());
        }
      }
      expect(JSON.stringify(W)).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    // the booking app's own words where it speaks the language
    expect(NOTIFY_WORDS.ar.notifications).toBe("الإشعارات");
    expect(NOTIFY_WORDS.ar.updates).toBe("التحديثات");
    expect(LEARN_WORDS.ar.title).toBe("تعلّم ركوب الدراجة");
    expect(TM_ASK_WORDS.en).toEqual({ askT: "May we publish your words?", askYes: "Publish it", askNo: "No thanks" });
    expect(FIX_GATE_WORDS.en).toEqual({ kicker: "Account check-up", title: "A few details for your account", add: "Add details", logOut: "Log out" });
  });
});

describe("Notifications and Updates", () => {
  it("reads the server's answers safely", () => {
    expect(rideNewsOf({ ride_news: true, privacy_version: "x" })).toBe(true);
    expect(rideNewsOf({ ride_news: null })).toBeNull();
    expect(rideNewsOf(null)).toBeNull();
    expect(unreadOf({ ok: true, n: 3, comm: 1 })).toBe(3);
    expect(unreadOf({ ok: true, n: 0 })).toBe(0);
    expect(unreadOf({ ok: false, error: "denied" })).toBeNull();
    expect(updatesOf({ ok: true, rows: [{ id: 5, kind: "reminder", title: " Tomorrow ", body: "Ride at 8", at: "2026-11-18T10:00:00Z", url: "/my-bookings?tk=e1", unread: true }, null, { kind: "odd" }] }))
      .toEqual([{ id: 5, kind: "reminder", title: "Tomorrow", body: "Ride at 8", at: "2026-11-18T10:00:00Z", url: "/my-bookings?tk=e1", unread: true },
        { id: -2, kind: "info", title: "", body: "", at: "", url: "", unread: false }]);
    expect(updatesOf({ ok: false })).toBeNull();
    expect(updLang("ar")).toBe("ar");
    expect(updLang("ms")).toBe("ms");
    expect(updLang("de")).toBe("en");
  });
  it("sends a row where the app's would go, on this site", () => {
    const claim = "0123456789abcdef0123456789abcdef";
    const club = { club: true };
    expect(updateWhere(`/?claim=${claim.toUpperCase()}`, club)).toEqual({ to: "claim", href: `/?claim=${claim}` });
    expect(updateWhere("/my-bookings?tk=e-1", club)).toEqual({ to: "bookings", href: "/bookings" });
    expect(updateWhere("/my-bookings", club)).toEqual({ to: "bookings", href: "/bookings" });
    expect(updateWhere("https://experiences.micromobility.sa/account/badges", club)).toEqual({ to: "account", href: "/account/badges" });
    expect(updateWhere("/account/company", club)).toEqual({ to: "account", href: "/account/company" });
    expect(updateWhere("/account/nope", club)).toEqual({ to: "account", href: "/account" });
    expect(updateWhere("/members?src=push&hv=suggest", club)).toEqual({ to: "community", href: "/club" });
    expect(updateWhere("/members?src=push", { club: false })).toBeNull(); // the club page switched off: no link
    expect(updateWhere("/", club)).toEqual({ to: "reserve", href: "/experiences" });
    expect(updateWhere("/reserve", club)).toEqual({ to: "reserve", href: "/experiences" });
    expect(updateWhere("https://volunteer.micromobility.sa/shifts", club)).toEqual({ to: "vol", href: "https://volunteer.micromobility.sa/shifts" });
    expect(updateWhere("https://evil.example/account", club)).toBeNull();
    expect(updateWhere("http://experiences.micromobility.sa/account", club)).toBeNull();
    expect(updateWhere("/staff/queue", club)).toBeNull();
    expect(updateWhere("", club)).toBeNull();
  });
  it("has its pages at their own addresses; Updates' Back returns to Notifications", () => {
    for (const p of ["notifications", "updates", "learn"]) expect(accountRoute([p])).toEqual({ view: "account", page: p });
    expect(ACC_PAGES).toContain("notifications");
    expect(parentOf("updates")).toBe("notifications");
    expect(parentOf("personal")).toBeNull();
  });
  it("puts Notifications first under Settings: the unread count, else ride news On or Off; no row when neither answers", async () => {
    const on = await draw(undefined, (fn) => (fn === "customer_consents" ? json({ ride_news: true, privacy_version: "2026-11-18" }) : fn === "customer_updates_unread" ? json({ ok: true, n: 0 }) : null));
    const settings = menuOf(on.p)?.groups.find((g) => g.id === "settings");
    expect(settings?.rows[0]).toMatchObject({ id: "notifications", label: "Notifications", icon: "bell", href: "/account/notifications", value: { text: "On", add: false } });
    // a read only: nothing is recorded (no privacy version, no answer to ride news)
    expect(JSON.parse(String(on.asked("customer_consents")[0][1]?.body))).toMatchObject({ p_privacy: null, p_ride_news: null });
    const off = await draw(undefined, (fn) => (fn === "customer_consents" ? json({ ride_news: false }) : null));
    expect(rowOf(off.p, "notifications")?.value?.text).toBe("Off");
    const unread = await draw(undefined, (fn) => (fn === "customer_consents" ? json({ ride_news: true }) : fn === "customer_updates_unread" ? json({ ok: true, n: 4 }) : null));
    expect(rowOf(unread.p, "notifications")?.value?.text).toBe("4");
    const none = await draw(undefined);
    expect(rowOf(none.p, "notifications")).toBeUndefined();
    // the list itself is read only on its page: reading it marks every row read
    expect(unread.asked("customer_updates")).toHaveLength(0);
  });
  it("draws Notifications: the way to Updates with its count, then Ride news as it is on file", async () => {
    const { p } = await draw(["notifications"], (fn) => (fn === "customer_consents" ? json({ ride_news: false }) : fn === "customer_updates_unread" ? json({ ok: true, n: 2 }) : null), "ar");
    expect((findAll(p, UpdatesRow)[0]?.props as { unread: number }).unread).toBe(2);
    expect(findAll(p, RideNews)[0]?.props).toMatchObject({ initial: false, errConn: expect.any(String) });
    expect((findAll(p, RideNews)[0]?.props as { w: { rideNews: string } }).w.rideNews).toBe("أخبار الجولات");
    expect(menuOf(p)?.current).toBe("notifications");
  });
  it("lists the updates newest first in the page's language, each with where it leads; the menu then counts none", async () => {
    const claim = "0123456789abcdef0123456789abcdef";
    const { p, asked } = await draw(["updates"], (fn) => {
      if (fn === "customer_updates") return json({ ok: true, rows: [
        { id: 9, kind: "waitlist", title: "A place is free", body: "Claim it", at: new Date().toISOString(), url: `/?claim=${claim}`, unread: true },
        { id: 8, kind: "note", title: "From the team", body: "See you", at: `${day(-3)}T09:00:00Z`, url: "/members?src=push", unread: false },
        { id: 7, kind: "info", title: "Volunteers needed", body: "", at: `${day(-5)}T09:00:00Z`, url: "https://volunteer.micromobility.sa", unread: false },
        { id: 6, kind: "change", title: "Time changed", body: "", at: `${day(-6)}T09:00:00Z`, url: null, unread: false },
      ] });
      if (fn === "customer_updates_unread") return json({ ok: true, n: 1 });
      if (fn === "customer_consents") return json({ ride_news: true });
      return null;
    }, "fr");
    expect(JSON.parse(String(asked("customer_updates")[0][1]?.body))).toMatchObject({ p_lang: "fr" });
    const rows = (findAll(p, AccUpdates)[0]?.props as { rows: UpdView[] }).rows;
    expect(rows.map((r) => [r.id, r.kind, r.unread, r.to?.href ?? null, r.to?.out ?? null])).toEqual([
      [9, "waitlist", true, `/?claim=${claim}`, false], [8, "note", false, null, null], [7, "info", false, "https://volunteer.micromobility.sa", true], [6, "change", false, null, null]]);
    expect(rows[0].day).toBe(NOTIFY_WORDS.fr.today); // the booking app's own word
    expect(rows[0].to?.label).toBe("Prendre votre place");
    expect(menuOf(p)?.current).toBe("notifications"); // Updates is under Notifications
    expect(rowOf(p, "notifications")?.value?.text).toBe("Activé"); // read now: none unread, so ride news
  });
  it("says so when the list could not be read, and shows it empty for a database without it", async () => {
    const failed = await draw(["updates"], (fn) => (fn === "customer_updates" ? json({ message: "boom" }, 500) : null));
    expect(findAll(failed.p, AccUpdates)).toHaveLength(0);
    expect(JSON.stringify(findAll(failed.p, "p").map((x) => x.props))).toContain("Something went wrong");
    const absent = await draw(["updates"]);
    expect((findAll(absent.p, AccUpdates)[0]?.props as { rows: unknown[] }).rows).toEqual([]);
  });
});

describe("Learn to ride", () => {
  const LADDER = { ok: true, skills: SKILLS, learners: [
    { who: "self", name: null, feedback: "Great balance", ticked: { b1: "2026-11-10T10:00:00Z", b2: "2026-11-12T10:00:00Z", p1: "2026-11-12T11:00:00Z" } },
    { who: "child", name: "Omar", feedback: "", ticked: {} },
  ] };
  it("reads the ladder and works out each level as the app does", () => {
    const d = ladderOf(LADDER)!;
    expect(d.learners).toHaveLength(2);
    const lv = levelsOf(d, d.learners[0]);
    expect(lv.map((x) => [x.n, x.on, x.skills.length, x.done, x.at])).toEqual([
      [1, 2, 2, true, "2026-11-12T10:00:00Z"], [2, 1, 1, true, "2026-11-12T11:00:00Z"], [3, 0, 1, false, ""], [4, 0, 1, false, ""]]);
    expect(learnerName(d.learners[0], 0, "Sara Khalid", "Learner {0}")).toBe("Sara Khalid");
    expect(learnerName(d.learners[1], 1, "Sara Khalid", "Learner {0}")).toBe("Omar");
    expect(learnerName({ who: "child", name: null, feedback: "", ticked: {} }, 2, "Sara", "Learner {0}")).toBe("Learner 3");
    expect(skillName(d.skills[0], "ar")).toBe("الانزلاق");
    expect(skillName(d.skills[1], "ar")).toBe("Look ahead");
    // a level with no skill is never complete; anything else is no ladder
    expect(levelsOf({ skills: [], learners: [] }, d.learners[0]).every((x) => !x.done)).toBe(true);
    expect(ladderOf({ ok: false, error: "denied" })).toBeNull();
    expect(ladderOf({ ok: true, skills: [{ key: "x", level: 9, name: {} }], learners: [] })).toEqual({ skills: [], learners: [] });
  });
  it("shows its row only for an account whose sign-up has a lesson, and its page the ladder", async () => {
    const none = await draw(undefined, (fn) => (fn === "learn_ladder" ? json({ ok: true, skills: [], learners: [] }) : null));
    expect(rowOf(none.p, "learn")).toBeUndefined();
    const { p } = await draw(undefined, (fn) => (fn === "learn_ladder" ? json(LADDER) : null));
    expect(rowOf(p, "learn")).toMatchObject({ label: "Learn to ride", icon: "bike", href: "/account/learn" });
    const pg = await draw(["learn"], (fn) => (fn === "learn_ladder" ? json(LADDER) : null));
    const props = findAll(pg.p, AccLearn)[0]?.props as { own: string; saturday: string; ladder: { learners: unknown[] } };
    expect(props.own).toBe("Sara Khalid");
    expect(props.ladder.learners).toHaveLength(2);
    expect(props.saturday).toMatch(/^https:\/\/experiences\.micromobility\.sa\/\?ev=community&lang=en$/);
    const gone = await draw(["learn"]);
    expect(findAll(gone.p, AccLearn)).toHaveLength(0);
  });
});

describe("the new-badge pop-up", () => {
  const NOW = Date.parse("2026-11-19T12:00:00Z");
  const mem = (): CheerStore & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, get: (k) => m.get(k) ?? null, set: (k, v) => { m.set(k, v); return true; } }; };
  const C = (slug: string, kind: Cheer["kind"], at: string | null): Cheer => ({ slug, icon: "medal", color: "green", name: slug, how: "", about: "", kind, at });
  it("is fresh for three days", () => {
    expect(fresh("2026-11-17T12:00:01Z", NOW)).toBe(true);
    expect(fresh(new Date(NOW - BDG_FRESH_MS).toISOString(), NOW)).toBe(false);
    expect(fresh("2026-11-17", NOW)).toBe(true); // a day counts from its midnight, as the app reads it
    expect(fresh("2026-11-16", NOW)).toBe(false);
    expect(fresh(null, NOW)).toBe(false);
  });
  it("pops the newest badge staff gave while it is new, once on this device", () => {
    const s = mem();
    const list = [C("spirit", "given", "2026-11-18T09:00:00Z"), C("champion", "given", "2026-11-10T09:00:00Z")];
    expect(pickCheer(list, { who: "k", store: s, rode: null, filled: false, pulse: false, now: NOW })?.slug).toBe("spirit");
    expect(pickCheer(list, { who: "k", store: s, rode: null, filled: false, pulse: false, now: NOW })).toBeNull();
    // an old one never pops on a new device
    expect(pickCheer([C("champion", "given", "2026-11-10T09:00:00Z")], { who: "k", store: mem(), rode: null, filled: false, pulse: false, now: NOW })).toBeNull();
    // no storage: never, rather than on every visit
    const refuse: CheerStore = { get: () => null, set: () => false };
    expect(pickCheer(list, { who: "k", store: refuse, rode: null, filled: false, pulse: false, now: NOW })).toBeNull();
  });
  it("pops an event's badge within three days of its session, Race Ready only after the rider's own save, a Recruiter level only on a rise this device saw", () => {
    const s = mem();
    const o = { who: "k", store: s, rode: null as number | null, filled: false, pulse: false, now: NOW };
    expect(pickCheer([C("run_for_her", "event", "2026-11-10")], o)).toBeNull();
    expect(pickCheer([C("run_for_her", "event", "2026-11-18")], o)?.slug).toBe("run_for_her");
    expect(pickCheer([C("run_for_her", "event", "2026-11-18")], o)).toBeNull(); // once
    expect(pickCheer([C("complete_profile", "profile", null)], o)).toBeNull(); // arrived full: not news
    expect(pickCheer([C("complete_profile", "profile", null)], { ...o, filled: true })?.slug).toBe("complete_profile");
    // the first count a device sees is only noted; a rise past a level pops it
    expect(pickCheer([C("recruiter", "recruiter", null)], { ...o, rode: 1 })).toBeNull();
    expect(s.m.get("mm_bdg_recn_k")).toBe("1");
    const list3 = [C("recruiter", "recruiter", null), C("recruiter_3", "recruiter", null)];
    expect(pickCheer(list3, { ...o, rode: 3 })?.slug).toBe("recruiter_3");
    expect(s.m.get("mm_bdg_recn_k")).toBe("3");
    // a Community badge is the pulse's while it answers
    expect(pickCheer([C("challenge_12", "given", "2026-11-19T08:00:00Z")], { ...o, store: mem(), pulse: true })).toBeNull();
    expect(pickCheer([C("challenge_12", "given", "2026-11-19T08:00:00Z")], { ...o, store: mem(), pulse: false })?.slug).toBe("challenge_12");
  });
  it("dates an event's badge by its first session (Blood Donor by the donation) and lists only earned ones that may pop", () => {
    const row = (id: string, sessionId: string, date: string, status: string): TicketRow & { donated?: boolean } => ({ id, sessionId, date, status } as unknown as TicketRow);
    const sessions = new Map<string, RecordSession>([["r1", { kind: "runher", freeRide: true }], ["r2", { kind: "runher", freeRide: true }], ["b1", { kind: "blood", freeRide: true }], ["s1", { kind: "snd96", freeRide: true }]]);
    const days = eventDays([row("e1", "r2", "2026-11-18", "done"), row("e2", "r1", "2026-11-11", "done"), row("e3", "b1", "2026-11-17", "done"), row("e4", "s1", "2026-09-23", "active"), row("e5", "2026-11-14-fh", "2026-11-14", "done"), row("e6", "2026-11-28-tp", "2026-11-28", "active")],
      sessions, new Map([["e3", "2026-11-17T15:00:00Z"]]));
    expect(days).toEqual({ national_day_96: "2026-09-23", run_for_her: "2026-11-11", blood_donor: "2026-11-17T15:00:00Z", blood_visitor: "2026-11-17", farmhouse_night: "2026-11-14", tee_painting: "2026-11-28" });
    const it = (slug: string, on: boolean, o: Partial<BadgeItem> = {}): BadgeItem => ({ slug, icon: "m", color: "green", on, p: null, given: null, season: null, manual: false, row: null, lv: null, lvN: 0, nx: null, ...o });
    const list = cheersOf([
      it("run_for_her", true), it("first_lap", true), it("spirit", true, { given: { at: "2026-11-18T09:00:00Z", note: "Thanks" } }), it("victory_lap", false),
      it("recruiter_3", true, { lv: [it("recruiter", true), it("recruiter_3", true), it("recruiter_5", false)] }),
    ], days, (x) => [`N:${x.slug}`, "how", ""], (at) => `given ${at}`);
    expect(list.map((c) => [c.slug, c.kind, c.at])).toEqual([["run_for_her", "event", "2026-11-11"], ["spirit", "given", "2026-11-18T09:00:00Z"], ["recruiter_3", "recruiter", null], ["recruiter", "recruiter", null]]);
    expect(list[1].given).toEqual({ line: "given 2026-11-18T09:00:00Z", note: "Thanks" });
    expect(storeKey("c1")).toBe(storeKey("c1"));
    expect(storeKey("c1")).not.toContain("c1");
  });
  it("is on every account view, told whether the profile is short of full", async () => {
    const { p } = await draw(undefined);
    expect(findAll(p, BadgeCelebrate)[0]?.props).toEqual({ locale: "en", short: true }); // no photo
    const full = await draw(["stats"], (fn) => (fn === "customer_profile" ? json([{ ...PROFILE, photo: "https://x/p.jpg" }]) : null));
    expect(findAll(full.p, BadgeCelebrate)[0]?.props).toEqual({ locale: "en", short: false });
  });
  it("is read by /api/account/badge-new: staff's badge given yesterday, the pulse's Community badge marked seen by POST", async () => {
    const given = new Date(Date.now() - 864e5).toISOString();
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const fn = /\/rpc\/([a-z0-9_]+)/.exec(String(url))?.[1] ?? "";
      calls.push(fn);
      if (fn === "my_bookings") return json([]);
      if (fn === "customer_my_badges") return json([{ slug: "spirit", at: given, note: "For the help" }]);
      if (fn === "badge_catalog") return json([{ slug: "spirit", name: "Team spirit" }]);
      if (fn === "hub_pulse") return json({ ok: true, member: true, fresh: [] });
      if (fn === "customer_profile") return json([PROFILE]);
      if (fn === "hub_seen") return json(null);
      return ABSENT();
    }));
    const req = (init: RequestInit = {}) => new Request("https://micromobility.sa/api/account/badge-new?locale=en", { ...init, headers: { cookie: "mm_acct=c1~a1b2c3d4e5f6a7b8c9d0", origin: "https://micromobility.sa", ...(init.headers ?? {}) } });
    const b = await (await badgeNewGet(req())).json() as { ok: boolean; items: Cheer[]; pulse: boolean; community: null; who: string };
    expect(b.ok).toBe(true);
    expect(b.pulse).toBe(true);
    expect(b.community).toBeNull();
    expect(b.who).toBe(storeKey("c1"));
    expect(b.items.find((c) => c.slug === "spirit")).toMatchObject({ kind: "given", at: given, given: { note: "For the help" } });
    expect(b.items.find((c) => c.slug === "spirit")?.given?.line).toMatch(/^Given by the MicroMobility team · /);
    const seen = await badgeNewPost(req({ method: "POST", body: JSON.stringify({ seen: ["challenge_3", "bad slug!"] }) }));
    expect(await seen.json()).toEqual({ ok: true });
    expect(calls).toContain("hub_seen");
    expect(await (await badgeNewGet(new Request("https://micromobility.sa/api/account/badge-new"))).json()).toEqual({ signedIn: false });
  });
});

describe("Ride news", () => {
  it("is changed through /api/account/consents, which records the answer and nothing else", async () => {
    const sent: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => { const a = JSON.parse(String(init?.body)); sent.push(a); return json({ ride_news: a.p_ride_news, privacy_version: "2026-11-18" }); }));
    const req = (body: unknown, origin = "https://micromobility.sa") => new Request("https://micromobility.sa/api/account/consents", { method: "POST", body: JSON.stringify(body), headers: { cookie: "mm_acct=c1~a1b2c3d4e5f6a7b8c9d0", origin, "content-type": "application/json" } });
    expect(await (await consentsPost(req({ rideNews: false }))).json()).toEqual({ ok: true, rideNews: false });
    expect(sent[0]).toEqual({ p_id: "c1", p_token: "a1b2c3d4e5f6a7b8c9d0", p_privacy: null, p_ride_news: false });
    expect((await consentsPost(req({ rideNews: "yes" }))).status).toBe(400);
    expect((await consentsPost(req({ rideNews: true }, "https://evil.example"))).status).toBe(403);
  });
});

describe("the one-time ask about an old comment", () => {
  const MINE = { ok: true, on: true, names: { full: "Sara Khalid", short: "Sara K." }, since: { year: 2025, rides: 4 }, items: [],
    ask: { entry_id: "e-old", body: "The best ride of my life, the team was wonderful all morning.", rating: 10, date: "2026-10-03", about: "saturday", title: null, title_ar: null } };
  it("reads the ask, names an untitled ride by its kind, and reads an answer", () => {
    const a = tmOldAsk(MINE)!;
    expect(a).toEqual({ entry: "e-old", body: MINE.ask.body, date: "2026-10-03", about: "saturday", title: null, titleAr: null });
    expect(tmAskTitle(a, "en", { saturday: "Saturday community ride" })).toBe("Saturday community ride");
    expect(tmAskTitle({ ...a, title: "Night ride", titleAr: "جولة ليلية" }, "ar", {})).toBe("جولة ليلية");
    expect(tmAskTitle({ ...a, about: "other" }, "en", { other: "Something else" })).toBe("");
    expect(tmOldAsk({ ...MINE, on: false })).toBeNull(); // the switch off: never asked
    expect(tmOldAsk({ ...MINE, ask: null })).toBeNull();
    expect(tmOldArgs({ entry: "e-old", yes: true, nameMode: "short", consent: true })).toEqual({ p_entry: "e-old", p_yes: true, p_name_mode: "short", p_consent: true });
    expect(tmOldArgs({ entry: "e-old", yes: false })).toEqual({ p_entry: "e-old", p_yes: false, p_name_mode: "short", p_consent: false });
    expect(tmOldArgs({ entry: "e-old", yes: true, nameMode: "nick" })).toBeNull();
    expect(tmOldArgs({ entry: "bad id!", yes: false })).toBeNull();
    for (const v of [{ ok: true }, { ok: false, error: "done" }, { ok: false, error: "entry" }, { ok: false, error: "off" }]) expect(tmOldEnded(v)).toBe(true);
    expect(tmOldEnded({ ok: false, error: "consent" })).toBe(false);
  });
  it("is served by /api/account/testimonial-ask: the ride and its day in the page's language, and the answer", async () => {
    const sent: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const fn = /\/rpc\/([a-z0-9_]+)/.exec(String(url))?.[1] ?? "";
      if (fn === "testimonial_mine") return json(MINE);
      if (fn === "testimonial_old_answer") { sent.push(JSON.parse(String(init?.body))); return json(sent.length === 1 ? { ok: true, id: 12 } : { ok: false, error: "consent" }); }
      return ABSENT();
    }));
    const req = (init: RequestInit = {}, q = "?locale=en") => new Request(`https://micromobility.sa/api/account/testimonial-ask${q}`, { ...init, headers: { cookie: "mm_acct=c1~a1b2c3d4e5f6a7b8c9d0", origin: "https://micromobility.sa" } });
    const b = await (await tmAskGet(req())).json() as { ask: { entry: string; meta: string }; names: unknown; on: boolean };
    expect(b.on).toBe(true);
    expect(b.ask.entry).toBe("e-old");
    expect(b.ask.meta).toMatch(/^Saturday community ride · /);
    expect(b.names).toEqual({ full: "Sara Khalid", short: "Sara K." });
    const yes = await tmAskPost(req({ method: "POST", body: JSON.stringify({ entry: "e-old", yes: true, nameMode: "full", consent: true }) }));
    expect(await yes.json()).toEqual({ ok: true });
    expect(sent[0]).toMatchObject({ p_id: "c1", p_entry: "e-old", p_yes: true, p_name_mode: "full", p_consent: true });
    const again = await tmAskPost(req({ method: "POST", body: JSON.stringify({ entry: "e-old", yes: true, nameMode: "full", consent: true }) }));
    expect(await again.json()).toEqual({ ok: false, error: "consent" });
    expect(await (await tmAskGet(new Request("https://micromobility.sa/api/account/testimonial-ask"))).json()).toEqual({ signedIn: false });
  });
});

describe("the company challenge's join link", () => {
  it("keeps a code a week, cleaned as the code box cleans it", () => {
    expect(companyCode(" acme-2026! ")).toBe("ACME2026");
    expect(companyCode("x".repeat(20))).toBe("X".repeat(12));
    const now = Date.parse("2026-11-19T12:00:00Z");
    expect(companyParked(companyKept("ACME", now), now + 1000)).toBe("ACME");
    expect(companyParked(companyKept("ACME", now), now + COMPANY_KEEP_MS + 1)).toBe("");
    expect(companyParked("not json", now)).toBe("");
    expect(companyParked(null, now)).toBe("");
  });
  it("is kept on the signed-out page and joined with on Company challenge, which shows even with no challenge open", async () => {
    const out = await draw(["company"], () => null, "en", false);
    expect(findAll(out.p, CompanyLink)[0]?.props).toEqual({ signedIn: false, onPage: true });
    const { p } = await draw(["company"], (fn) => (fn === "company_challenge_mine" ? json({ ok: true, rows: [], open: false }) : null));
    expect(findAll(p, CompanyLink)[0]?.props).toEqual({ signedIn: true, onPage: true });
    expect(findAll(p, AccCompany)[0]?.props).toMatchObject({ rows: [], open: false, empty: "Nothing here yet." });
    const home = await draw(undefined);
    expect(findAll(home.p, CompanyLink)[0]?.props).toEqual({ signedIn: true, onPage: false });
  });
});

describe("details the account owes (the booking app's 3ebaf706)", () => {
  const req = (path: string, signedIn = true) => new Request(`https://micromobility.sa${path}`, { headers: signedIn ? { cookie: "mm_acct=c1~a1b2c3d4e5f6a7b8c9d0" } : {} });
  it("are counted by /api/account/pending-fix from customer_fix_fields; none for a database without it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(["birth_date", "whatsapp", "birth_date", "bad key!"])));
    expect(await (await pendingFixGet(req("/api/account/pending-fix"))).json()).toEqual({ signedIn: true, owed: 2, asks: ["birth_date", "whatsapp"] });
    vi.stubGlobal("fetch", vi.fn(async () => ABSENT()));
    expect(await (await pendingFixGet(req("/api/account/pending-fix"))).json()).toEqual({ signedIn: true, owed: 0, asks: [] });
    expect(await (await pendingFixGet(req("/api/account/pending-fix", false))).json()).toEqual({ signedIn: false });
  });
  it("Add details opens the booking app staff set, signed in by a one-time code, in the visitor's language", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/rpc/customer_handoff_create") ? json("ab".repeat(24)) : json([]))));
    const r = await appSigninGet(req("/api/account/app-signin?lang=ar"));
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe(`https://experiences.micromobility.sa/?lang=ar&signin=${"ab".repeat(24)}`);
    const out = await appSigninGet(req("/api/account/app-signin?lang=xx", false));
    expect(out.headers.get("location")).toBe("https://experiences.micromobility.sa/");
  });
});

describe("where the check-up's Add details goes (lib/fix-pages.ts)", () => {
  it("opens the first owed detail's own page here, and the booking app for a password or a key this site does not know", async () => {
    const { fixPageFor, onFixPage } = await import("../fix-pages");
    expect(fixPageFor(["nationality"])).toBe("/account/personal");
    expect(fixPageFor(["whatsapp", "birth_date"])).toBe("/account/contact");
    expect(fixPageFor(["instagram"])).toBe("/account/about");
    expect(fixPageFor(["sport"])).toBe("/account/sport");
    expect(fixPageFor(["nationality", "password"])).toBeNull();
    expect(fixPageFor(["tag_saturday"])).toBeNull();
    expect(fixPageFor([])).toBeNull();
    expect(onFixPage("/account/personal", ["nationality"])).toBe(true);
    expect(onFixPage("/account/personal/", ["birth_date", "whatsapp"])).toBe(true);
    expect(onFixPage("/bookings", ["nationality"])).toBe(false);
    expect(onFixPage("/account/password", ["password"])).toBe(false);
  });
});
