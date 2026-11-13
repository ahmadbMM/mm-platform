import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps from "@/components/experiences/ExperienceSteps";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import { PAGES } from "@/content";
import { WAIVER_VERSIONS, waiverCopy } from "@/content/waivers";
import { clientDict, serverL } from "@/i18n/dicts";
import { TRANSLATED } from "@/i18n/locales";
import { makeL } from "@/i18n/tx";
import { IG_HANDLE, igClean, igOf, igUrl } from "../instagram";
import { resetRides, resetSessionColumns, toSession } from "../rides";
import { resetSiteContent } from "../site";
import { placeLink, ticketCue, ticketRow, ticketSession, type TicketRow } from "../tickets";
import { waiverKind, waiverVersion } from "../waiver";
import { GET, POST } from "../../app/api/account/pending-waiver/route";
import ExperiencesPage from "../../app/[locale]/experiences/page";
import EventsPage from "../../app/[locale]/events/page";

// cookies() is a request's; here it holds the account's cookie a test sets, or none, and whether the booking app's members'
// check (community_member) says that account is a community member.
const jar = vi.hoisted(() => ({ account: "", member: false }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));
// The steps open on the event cards (useState(1)); a test draws a later step, or an open dialog, by handing the component's
// first states in order: the step, the event, the date, the kind, the dialog. Each render takes them once.
const states = vi.hoisted(() => ({ queue: [] as unknown[] }));
vi.mock("react", async (importOriginal) => {
  const R = await importOriginal<typeof import("react")>();
  return { ...R, useState: ((v: unknown) => R.useState(states.queue.length ? states.queue.shift() : v)) as typeof R.useState };
});
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// The Farm House Night's own waiver and its venue's Instagram, as the booking app's 46689058 has them (the user,
// 2026-11-13: "update all waivers especially the nawar farm house session", "add the insta account to the session of
// the farmhouse"): a farm night is agreed under farm-2026-11-v1 (the farm, its animals, the food, the family on the
// booking), its words the server's (content/farm-words.ts), handed by the waiver pop-up to the signed-in booker of that
// night alone; the session carries @thefarmhouse.jed (bike_slots._ig), a row on its Details and a link on its ticket,
// which only a community member sees with the rest of the night. The ride, swim and activity waivers' v4: waiver.test.ts.
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const ACCOUNT = `c1~${TOKEN}`;
const MAP = "https://maps.app.goo.gl/BYteRL5JCueWZUEs6";
const FH = {
  id: "2099-11-19-fh", session_date: "2099-11-19", day: "Thursday", status: "open", event_kind: "community", ride_kind: "farm",
  title: "Nawar Farm House Night", title_ar: "ليلة مزرعة نوار", open_to_all: false, paid_ride: false, needs_approval: true, hide_queue: true,
  price: null, capacity: 60, spots: 60, bike_slots: '{"_time":"16:30 - 20:30","_ig":"thefarmhouse.jed"}', location: "Little Farmhouse, Dhahban",
  meet_url: MAP, description: null, cancelled_at: null, draft: false, opens_at: null,
};
const SAT = { id: "2099-11-21", session_date: "2099-11-21", day: "Saturday", status: "open", event_kind: "community", ride_kind: "saturday", title: null, open_to_all: false, paid_ride: false, needs_approval: true, hide_queue: true, capacity: 120, bike_slots: '{"_time":"05:45 - 06:15"}', location: null, meet_url: null };
const IG_URL = "https://www.instagram.com/thefarmhouse.jed";

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
const db = (sessions: unknown[]) => vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/rpc/list_sessions")) return json(sessions);
  if (url.includes("/rpc/community_member")) return json(!!jar.account && jar.member);
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
type Props = Parameters<typeof ExperienceSteps>[0];
const experiences = async (sessions: unknown[], locale = "en") => {
  resetRides();
  vi.stubGlobal("fetch", db(sessions));
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }) });
  return (findAll(page, ExperienceSteps)[0] as ReactElement<Props>).props;
};
const draw = (props: Props, ...first: unknown[]) => {
  states.queue = [...first];
  try { return renderToStaticMarkup(createElement(ExperienceSteps, props)); } finally { states.queue = []; }
};
const comm = (p: Props) => p.events.find((e) => e.key === "community")!;
const text = (html: string | undefined) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

beforeEach(() => {
  resetRides(); resetSiteContent(); resetSessionColumns();
  jar.account = ""; jar.member = false;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); states.queue = []; });

describe("the Farm House Night's own waiver (farm-2026-11-v1)", () => {
  const fh = ticketSession(FH)!;
  it("is the one a farm night is agreed under, never the activity waiver", () => {
    expect(waiverKind(fh)).toBe("farm");
    expect(waiverVersion(fh)).toBe("farm-2026-11-v1");
    expect(WAIVER_VERSIONS.farm).toBe("farm-2026-11-v1");
    expect(waiverKind({ ...fh, kind: "yoga" })).toBe("activity");
  });
  it("says the booking app's words: the farm, its animals, the food, damage, and the family each kept and supervised", () => {
    const en = waiverCopy("farm", makeL("en", null)), ar = waiverCopy("farm", makeL("ar", null));
    expect(en.title).toBe("Farm House Night waiver");
    expect(en.agree).toBe("I have read the waiver and agree for myself and on behalf of everyone on this booking");
    expect(en.body).toMatch(/^You cannot book the Farm House Night until you have read and agreed to this waiver\./);
    for (const x of ["animals that can bite, kick or scratch", "wash my hands afterwards", "any allergy or dietary need before eating",
      "any damage that I or anyone on my booking causes", "I accept this waiver on behalf of each of them as well as myself",
      "I will keep them with me and supervise them at all times", "including any injury, illness, allergic reaction, loss, theft or damage"]) expect(en.body, x).toContain(x);
    expect(ar.title).toBe("إقرار ليلة المزرعة");
    expect(ar.agree).toBe("قرأت الإقرار وأوافق عن نفسي ونيابةً عن كل شخص في هذا الحجز");
    expect(ar.body).toMatch(/^لا يمكنك حجز ليلة المزرعة إلا بعد قراءة هذا الإقرار والموافقة عليه\./);
    expect(ar.body).toContain("وسأبقيه معي وأشرف عليه طوال الوقت");
    // every language says it in its own words, never the English
    for (const l of TRANSLATED) {
      const c = waiverCopy("farm", serverL(l));
      for (const k of ["title", "body", "agree"] as const) expect(c[k], `${l}.${k}`).not.toBe(en[k]);
    }
    expect(waiverCopy("farm", serverL("fr")).title).toBe("Décharge de la Soirée à la ferme"); // the booking app's own
  });
  it("is in no public place: not the Website editor's schema, not any language's browser dictionary", () => {
    const words = /Farm House Night waiver|You cannot book the Farm House Night|animals that can bite/;
    expect(JSON.stringify(PAGES)).not.toMatch(words);
    for (const l of TRANSLATED) expect(JSON.stringify(Object.keys(clientDict(l) ?? {})), l).not.toMatch(words);
  });

  describe("the waiver pop-up (api/account/pending-waiver)", () => {
    const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=${ACCOUNT}`, "content-type": "application/json" };
    const get = (q: string) => GET(new Request(`https://micromobility.sa/api/account/pending-waiver?${q}`, { headers: HEADERS }));
    const post = (body: unknown) => POST(new Request("https://micromobility.sa/api/account/pending-waiver", { method: "POST", headers: HEADERS, body: JSON.stringify(body) }));
    const row = (id: string, name: string, num: number) => ({ id, session_id: FH.id, session_date: FH.session_date, status: "waiting", customer_id: "c1", queue_num: num, name, waiver_version: null, approval: "pending", group_id: "g1" });
    const fam = [row("q1", "Sara Haddad", 4), row("q2", "Lina Haddad", 5)];
    const route = (accept: Response = json(2)) => vi.fn(async (url: string) =>
      url.includes("/rpc/my_bookings") ? json(fam) : url.includes("/rpc/list_sessions?") ? json([FH]) : url.includes("/rpc/customer_accept_waiver") ? accept : json([]));
    it("asks the desk-added family's booker for the farm's own waiver, its arrival and dinner, the family by name", async () => {
      vi.stubGlobal("fetch", route());
      const b = await (await get("locale=en")).json();
      expect(b.pending).toMatchObject({
        sessionId: FH.id, version: "farm-2026-11-v1", kind: "farm", copy: waiverCopy("farm", makeL("en", null)), name: "Nawar Farm House Night",
        time: "Arrival 4:30 PM · Dinner 8:30 PM", venue: "Little Farmhouse, Dhahban", ridersLabel: "Participants",
        riders: [{ name: "Sara Haddad", num: null }, { name: "Lina Haddad", num: null }],
      });
      const ar = await (await get("locale=ar")).json();
      expect(ar.pending.copy.title).toBe("إقرار ليلة المزرعة");
    });
    it("records the farm's version, and answers changed to a pop-up that showed another kind's", async () => {
      const f = route();
      vi.stubGlobal("fetch", f);
      expect(await (await post({ sessionId: FH.id, version: "farm-2026-11-v1" })).json()).toEqual({ ok: true });
      const call = f.mock.calls.find(([u]) => String(u).includes("customer_accept_waiver")) as unknown as [string, RequestInit];
      expect(JSON.parse(String(call[1].body))).toMatchObject({ p_session_id: FH.id, p_version: "farm-2026-11-v1" });
      for (const v of ["activity-2026-11-v4", "activity-2026-10-v3"]) expect((await post({ sessionId: FH.id, version: v })).status, v).toBe(409);
    });
  });
});

describe("a session's venue on Instagram (bike_slots._ig)", () => {
  it("reads a handle as the booking app does: an @ or an instagram.com address taken off, anything Instagram would refuse is none", () => {
    for (const v of ["thefarmhouse.jed", "@thefarmhouse.jed", "@@thefarmhouse.jed", " https://www.instagram.com/thefarmhouse.jed/?hl=en ", "http://instagram.com/thefarmhouse.jed#top", "https://WWW.INSTAGRAM.COM/thefarmhouse.jed"]) {
      expect(igClean(v), v).toBe("thefarmhouse.jed");
    }
    expect(igOf('{"_time":"16:30 - 20:30","_ig":"@thefarmhouse.jed"}')).toBe("thefarmhouse.jed");
    expect(igOf({ _ig: "https://www.instagram.com/the_farm.house/" })).toBe("the_farm.house");
    for (const v of ['{"_ig":"the farm"}', '{"_ig":"far-m"}', `{"_ig":"${"a".repeat(31)}"}`, '{"_ig":""}', "{}", "not json", null, undefined, 42, '{"_ig":"<script>"}']) expect(igOf(v), String(v)).toBeNull();
    expect(IG_HANDLE.test("a".repeat(30))).toBe(true);
    expect(igUrl("thefarmhouse.jed")).toBe(IG_URL);
  });
  it("rides with the session the site reads, and the ticket's", () => {
    expect(toSession(FH)?.ig).toBe("thefarmhouse.jed");
    expect(ticketSession(FH)?.ig).toBe("thefarmhouse.jed");
    expect("ig" in toSession(SAT)!).toBe(false);
    expect("ig" in ticketSession(SAT)!).toBe(false);
  });
  it("is a row on the farm's Details, a link to its profile in a new tab, for a community member", async () => {
    jar.account = ACCOUNT; jar.member = true;
    const p = await experiences([FH, SAT]);
    const ev = comm(p), s = ev.sessions.find((x) => x.kind === "farm")!;
    expect(s.info.ig).toEqual({ label: "Instagram", handle: "thefarmhouse.jed", url: IG_URL });
    const dialog = /<dialog .*<\/dialog>/.exec(draw(p, 2, ev, null, null, { ev, s }))?.[0] ?? "";
    expect(dialog).toMatch(new RegExp(`<dt>Instagram</dt><dd><a class="xs-info-ig" href="${IG_URL.replace(/[.]/g, "\\.")}" target="_blank" rel="noopener noreferrer" aria-label="Instagram @thefarmhouse\\.jed"><svg class="xs-ig-ic" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2\\.2`));
    expect(dialog).toContain('<bdi dir="ltr">@thefarmhouse.jed</bdi></a></dd>');
    // after where it is, as the booking app's _infoFacts has it
    expect(text(dialog).indexOf("Instagram @thefarmhouse.jed")).toBeGreaterThan(text(dialog).indexOf("Where Little Farmhouse, Dhahban"));
    expect(dialog).not.toMatch(/\p{Extended_Pictographic}/u);
    // a date that carries none has no such row
    const sat = ev.sessions.find((x) => x.kind === "saturday")!;
    expect(sat.info.ig).toBeUndefined();
    expect(/<dialog .*<\/dialog>/.exec(draw(p, 2, ev, null, null, { ev, s: sat }))?.[0]).not.toContain("Instagram");
  });
  it("is never shown to anyone else: no word of it on Experiences or Events for a visitor signed out or a non-member", async () => {
    for (const [account, member] of [["", false], [ACCOUNT, false]] as const) {
      jar.account = account; jar.member = member;
      const p = await experiences([FH, SAT]);
      expect(JSON.stringify(p)).not.toContain("thefarmhouse");
      for (const html of [draw(p, 1), draw(p, 2, comm(p))]) expect(html).not.toContain("thefarmhouse");
      resetRides();
      vi.stubGlobal("fetch", db([FH, SAT]));
      const ev = await EventsPage({ params: Promise.resolve({ locale: "en" }) });
      expect(renderToStaticMarkup((ev.props as { children: ReactElement }).children)).not.toContain("thefarmhouse");
    }
  });

  describe("on the member's ticket (My Account)", () => {
    const fh = ticketSession(FH)!;
    const base = { session_id: fh.id, session_date: fh.date, session_day: "Thursday", status: "waiting", queue_num: 4, price: 0, paid: false, type_preference: "None", approval: "pending", group_id: "g1" };
    const rows = [ticketRow({ ...base, id: "q1abcdef", name: "Sara Haddad" })!];
    const card = (r: TicketRow[], o: { past?: boolean; ar?: boolean; s?: typeof fh } = {}) => {
      const s = o.s ?? fh;
      return renderToStaticMarkup(createElement(TicketCard, {
        locale: o.ar ? "ar" : "en", today: o.past ? fh.date : "2099-11-10", rows: r, session: s, name: "Nawar Farm House Night", cue: ticketCue(r, s, null), t: o.ar ? TICKET.ar : TICKET.en,
        gather: "Gathering", start: "Start", typeName: (x: string) => x, past: o.past,
        links: { edit: null, manage: "https://book.example.test/?tab=bookings", place: placeLink(s, "https://dir.example.test/jcc") }, now: Date.parse("2099-11-10T09:00:00Z"),
      }));
    };
    it("links the venue's Instagram under the place, in a new tab, named for a screen reader", () => {
      const html = card(rows);
      expect(html).toMatch(/<span class="tk-venue">Little Farmhouse, Dhahban<\/span><\/p><p class="tk-ig-row"><a class="tk-ig" href="https:\/\/www\.instagram\.com\/thefarmhouse\.jed" target="_blank" rel="noopener noreferrer" aria-label="Instagram @thefarmhouse\.jed"><svg [^>]*aria-hidden="true"[^>]*><path d="M12 2\.2[^"]*"><\/path><\/svg><bdi dir="ltr">@thefarmhouse\.jed<\/bdi><\/a><\/p>/);
      expect(card(rows, { ar: true })).toContain('aria-label="إنستغرام @thefarmhouse.jed"');
      expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    });
    it("leaves it off a past card and a session without one", () => {
      expect(card([ticketRow({ ...base, id: "q1abcdef", name: "Sara Haddad", status: "done" })!], { past: true })).not.toContain("tk-ig");
      expect(card(rows, { s: ticketSession({ ...FH, bike_slots: '{"_time":"16:30 - 20:30"}' })! })).not.toContain("tk-ig");
    });
  });
});
