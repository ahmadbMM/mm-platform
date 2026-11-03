import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type FC, type ReactElement, type ReactNode } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { PAGES } from "@/content";
import { BLOOD_NAME, bloodName, bloodPlate, bloodWords } from "@/content/blood-words";
import { WAIVER_VERSIONS, waiverCopy } from "@/content/waivers";
import { T as TICKET } from "@/components/booking/tickets.text";
import TicketCard from "@/components/booking/TicketCard";
import ExperienceSteps from "@/components/experiences/ExperienceSteps";
import ShareGate, { type PendingShare } from "@/components/account/ShareGate";
import WaiverGate, { type PendingWaiver } from "@/components/account/WaiverGate";
import { TxProvider } from "@/i18n/TxProvider";
import { clientDict, serverL, serverLocalize } from "@/i18n/dicts";
import { LOCALE_CODES } from "@/i18n/locales";
import source from "@/i18n/source.json";
import { makeL } from "@/i18n/tx";
import de from "@/i18n/tx/de.json";
import { bloodRewards, isBloodId, rewardGood, type BloodReward } from "../blood";
import { isNonBike, NON_BIKE_KINDS } from "../bike-kinds";
import { EVENT_CARDS, EVENT_OF, bookingAt, dateText, eventCards, infoPlace, infoPlaces, infoPrice, infoTimes, membersOnlyDate, membersOnlyEvent, rentsBikes, type DateTexts } from "../event-info";
import { memberArea } from "../members";
import { formOf, questionKeys, ratingNoBike, rideWord } from "../rating";
import { badgeList, recordRows, rideStats, type BadgeData, type RecordSession } from "../ride-record";
import { kindNames, resetRides, rideKind, sessionName, toSession, type RideKind } from "../rides";
import { pendingShares, sharesDetails } from "../share";
import { resetSiteContent } from "../site";
import { bloodDone, countdownMoments, fmtClock, icsFor, icsPlace, meetsAt, placeLink, ticketRoute, ticketRow, ticketSession, ticketStages, venueOf, venueText, type TicketRow } from "../tickets";
import { waiverKind, waiverVersion } from "../waiver";
import { walletDue } from "../wallet";
import AccountPage from "../../app/[locale]/account/page";
import EventsPage from "../../app/[locale]/events/page";
import ExperiencesPage from "../../app/[locale]/experiences/page";
import { GET as shareGet, POST as sharePost } from "../../app/api/account/pending-share/route";
import { GET as waiverGet, POST as waiverPost } from "../../app/api/account/pending-waiver/route";

// cookies() is a request's; here it holds the account's cookie a test sets, or none.
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const Tx = TxProvider as FC<{ locale: string; dict: Record<string, string> | null; children?: ReactNode }>;

// The Blood Donation event (the owner, 2026-11-03; rentals migration 20261103180000_blood_donation): at the Jeddah
// Corniche Circuit, open to everyone, free, no bikes, one place per account, handed to the booking app with ?ev=blood.
// Above all it stays out of sight until a session row with ride_kind 'blood' exists. As the booking app makes the session:
const BD = {
  id: "2099-11-05-bd", session_date: "2099-11-05", day: "Thursday", status: "open", event_kind: "community", ride_kind: "blood", title: null,
  open_to_all: true, paid_ride: false, needs_approval: false, hide_queue: true, price: null, capacity: 100000, spots: 100000, bike_slots: '{"_time":"17:00 - 23:00"}',
  location: "JCC", meet_url: "https://maps.app.goo.gl/bloodexample", description: null,
};
const JCC = { id: "2099-11-08", session_date: "2099-11-08", day: "Sunday", status: "open", event_kind: null, ride_kind: null, title: null, capacity: 40, bike_slots: '{"_time":"21:00 - 23:00"}', location: "JCC", meet_url: null };
const CIRCUIT_MAP = "https://maps.app.goo.gl/jcc";
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const EN = makeL("en", null), AR = makeL("ar", null);
const bw = bloodWords(EN);
/** Words that mean riding a bike, as non-cycling.test.ts looks for them. */
const CYCLING = /\b(ride|rides|rider|riders|riding|bike|bikes|cycling|cyclist|gowes|pesepeda|bersepeda|kayuhan|penunggang|basikal|Fahrt|Ausfahrt|Fahrer|Rad|vélo|cycliste|sortie|bici|ciclista|recorrido|passeio|bicicleta|заезд|велосипед|райдер)\b|رحلة|جولة|راكب|دراجة|रा[इई]ड|রাইড|رائیڈ|骑|自転車|ライド/iu;

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const absent = () => json({ code: "PGRST202", message: "Could not find the function" }, 404);
/** Every element of `type` in a tree a page returned, its own children unrendered. */
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
/** A page's database: the sessions through list_sessions, nothing for anything else. */
const db = (sessions: unknown[], more: (url: string) => Response | null = () => null) => vi.fn(async (url: string, init?: RequestInit) => {
  const m = more(url);
  if (m) return m;
  if (url.includes("/rpc/list_sessions")) return json(sessions);
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
const experiences = async (sessions: unknown[], locale = "en") => {
  vi.stubGlobal("fetch", db(sessions));
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }) });
  const steps = findAll(page, ExperienceSteps)[0] as ReactElement<Parameters<typeof ExperienceSteps>[0]>;
  return { page, steps, html: renderToStaticMarkup(steps) };
};
const eventsPage = async (sessions: unknown[], locale = "en") => {
  vi.stubGlobal("fetch", db(sessions));
  const page = await EventsPage({ params: Promise.resolve({ locale }) });
  return { page, html: renderToStaticMarkup((page.props as { children: ReactElement }).children) };
};

beforeEach(() => {
  jar.account = "";
  resetRides(); resetSiteContent();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

// ── Hidden until a session exists ────────────────────────────────────────────────────────────────────────────
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.name === "__tests__" || e.name === "node_modules") return [];
  return e.isDirectory() ? sourceFiles(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : [];
});
/** A file's code without its comments: what can reach a visitor. */
const code = (f: string) => readFileSync(f, "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l.replace(/\s\/\/\s.*$/, ""))).join("\n");
/** Every word that says the event, in a language, and the files that carry its look. */
const named = (l: string) => {
  const tx = serverL(l), b = bloodWords(tx), w = waiverCopy("blood", tx);
  return [b.name, b.cause, b.plateAlt, ...b.rules, b.infoTitle, b.infoPdf, b.numLabel, b.rewardNote, b.rewardTitle, b.rewardUsed, b.gate.kicker, b.gate.sub, b.share.kicker, b.share.title, b.share.sub, b.share.note, b.share.agree, w.title, w.body, w.agree];
};
const MARKS = ["blood-partners", "ev-blood", "ab-blood", "xs-bld", "bld-plate", "bld-sum", "blood-info", "blood-donation-poster", "ev=blood", "AABB"];

describe("with no session of the kind, nothing names the event", () => {
  for (const l of ["en", "ar", "de", "ur"]) {
    it(`on Experiences, in what the page draws and in everything it hands the browser (${l})`, async () => {
      const { page, steps, html } = await experiences([JCC], l);
      expect(steps.props.events.map((e) => e.key)).toEqual(["jcc", "community"]);
      expect(steps.props.events.some((e) => e.blood)).toBe(false);
      // JSON of the tree: every prop the page gives a browser component, which is what the page's payload holds
      const handed = JSON.stringify(page);
      for (const w of [...named(l), ...MARKS]) {
        expect(html, w).not.toContain(w);
        expect(handed, w).not.toContain(w);
      }
    });
    it(`on Events (${l})`, async () => {
      const { page, html } = await eventsPage([JCC], l);
      const handed = JSON.stringify(page);
      for (const w of [...named(l), ...MARKS]) {
        expect(html, w).not.toContain(w);
        expect(handed, w).not.toContain(w);
      }
    });
  }
  it("nor with no session at all, or a blood session already closed", async () => {
    expect((await experiences([])).html).not.toContain("blood-partners");
    resetRides();
    expect((await experiences([{ ...BD, status: "closed" }])).steps.props.events.map((e) => e.key)).toEqual(["jcc", "community"]);
    resetRides();
    expect((await experiences([{ ...BD, id: "2001-11-05-bd", session_date: "2001-11-05" }])).steps.props.events.map((e) => e.key)).toEqual(["jcc", "community"]);
    expect(eventCards([{ kind: "jcc" as const }], { member: true, petromin: true }).map((c) => c.card.key)).not.toContain("blood");
  });
  it("in the Website editor's schema, which anyone may read (api/site-schema)", () => {
    const schema = JSON.stringify(PAGES);
    for (const w of [...named("en"), "King Fahd", "Ministry of", "bldTitle", "bldName"]) expect(schema, w).not.toContain(w);
  });
  it("in the dictionary every page's browser is sent", () => {
    const client = new Set((source as { client: string[] }).client);
    for (const w of named("en")) expect(client.has(w), w).toBe(false);
    const sent = clientDict("de") as Record<string, string>;
    for (const w of named("de")) expect(Object.values(sent), w).not.toContain(w);
  });
  it("in any code but the server's words: the browser's code holds no name, host or line of it", () => {
    const WORDS: [RegExp, string][] = [[/Blood Donation|Give blood|Ministry of|King Fahd|Armed Forces|Donor number/, "content/blood-words.ts"], [/Giving blood is voluntary/, "content/waivers.ts"]];
    for (const [re, home] of WORDS) expect(sourceFiles(SRC).filter((f) => re.test(code(f))).map((f) => f.slice(SRC.length + 1)), String(re)).toEqual([home]);
  });
  it("in anything a browser component can import: its words and its poster are the server's alone", () => {
    const isClient = (f: string) => /^\s*["']use client["']/.test(readFileSync(f, "utf8"));
    const target = (from: string, spec: string) => {
      const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
      if (!base) return null;
      for (const ext of [".tsx", ".ts", ".json", ""]) if (existsSync(base + ext) && /\.(tsx?|json)$/.test(base + ext)) return base + ext;
      return null;
    };
    const seen = new Set<string>();
    const walk = (f: string) => {
      if (seen.has(f)) return;
      seen.add(f);
      if (f.endsWith(".json")) return;
      const s = readFileSync(f, "utf8");
      if (/^\s*["']use server["']/.test(s)) return; // a server action: the browser holds only a reference to it
      for (const m of s.matchAll(/^\s*(?:import|export)\s+(?!type\s)([^;]*?)\s*from\s+["']([^"']+)["']/gm)) {
        const only = /^\{([^}]*)\}$/.exec(m[1].trim());
        if (only && only[1].split(",").every((x) => !x.trim() || /^type\s/.test(x.trim()))) continue;
        const t = target(f, m[2]);
        if (t) walk(t);
      }
    };
    for (const f of sourceFiles(SRC)) if (isClient(f)) walk(f);
    expect(seen.size).toBeGreaterThan(50);
    expect(seen.has(join(SRC, "content/blood-words.ts"))).toBe(false);
    expect(seen.has(join(SRC, "content/blood-info.json"))).toBe(false);
    expect(seen.has(join(SRC, "components/booking/TicketCard.tsx"))).toBe(false);
  });
  it("and no page of its own", () => {
    expect(readdirSync(join(SRC, "app/[locale]")).filter((x) => /blood|donat/i.test(x))).toEqual([]);
  });
});

// ── The kind ─────────────────────────────────────────────────────────────────────────────────────────────────
describe("the kind (lib/rides.ts)", () => {
  it("is a kind of its own, never read as the Saturday ride, and a circuit night only off the community events", () => {
    expect(rideKind({ event_kind: "community", ride_kind: "blood" })).toBe("blood");
    expect(rideKind({ event_kind: null, ride_kind: "blood" })).toBe("jcc");
  });
  it("reads the session: open to everyone, free, a window, no bikes, no price", () => {
    expect(toSession(BD)).toMatchObject({ id: BD.id, kind: "blood", members: false, free: true, times: ["17:00", "23:00"], gather: false, price: null, seats: null, collect: null, approval: false, capacity: 100000, location: "JCC", meetUrl: BD.meet_url });
    // a price on the row is never read
    expect(toSession({ ...BD, price: 50 })).toMatchObject({ price: null });
  });
  it("is named by the server's words, in the page's language, a title of the English name too", () => {
    const en = { ...kindNames({}), blood: bloodName(EN) }, ar = { ...kindNames({}), blood: bloodName(AR) };
    expect(kindNames({ bldName: "x" }).blood).toBe(""); // no field of the Website editor
    expect(BLOOD_NAME).toBe("Blood Donation");
    expect(sessionName({ kind: "blood", title: null }, en, en, false)).toBe("Blood Donation");
    expect(sessionName({ kind: "blood", title: null }, ar, en, true)).toBe("التبرع بالدم");
    expect(sessionName({ kind: "blood", title: "Blood Donation" }, ar, en, true)).toBe("التبرع بالدم");
    expect(sessionName({ kind: "blood", title: "Our own title" }, ar, en, true)).toBe("Our own title");
  });
  it("knows a session by its id", () => {
    for (const id of ["2026-11-05-bd", "2026-11-05-bd-2"]) expect(isBloodId(id), id).toBe(true);
    for (const id of ["2026-11-05", "2026-11-05-bdx", "2026-11-06-ah", "", null, undefined]) expect(isBloodId(id), String(id)).toBe(false);
  });
});

describe("no bikes, no wallet, no ride counted", () => {
  it("is a kind without a bike, by its kind or by its id", () => {
    expect(NON_BIKE_KINDS.has("blood")).toBe(true);
    expect(rentsBikes("blood")).toBe(false);
    expect(isNonBike("blood")).toBe(true);
    expect(isNonBike(null, "2026-11-05-bd")).toBe(true);
    expect(isNonBike(null, "2026-11-05-bdx")).toBe(false);
  });
  it("never pays from a wallet, whatever the row says", () => {
    expect(walletDue([{ id: "a", paid: false, status: "waiting", price: 50 }], "blood", false, 0)).toBeNull();
    expect(walletDue([{ id: "a", paid: false, status: "waiting", price: 50 }], "jcc", false, 0)).not.toBeNull();
  });
  it("its rating says session and asks no bike question, even when the session did not load", () => {
    expect(rideWord("blood")).toBe("session");
    expect(rideWord(undefined, "2026-11-05-bd")).toBe("session");
    expect(ratingNoBike(false, null, "2026-11-05-bd")).toBe(true);
    expect(questionKeys(formOf("blood"), { noBike: ratingNoBike(false, { kind: "blood", bikes: false }, "x") })).toEqual(["service", "experience"]);
  });
  it("is never a ride on Your rides and earns no badge", () => {
    const empty: BadgeData = { catalog: [], weeks: null, seasons: [], mine: [] };
    const rows = recordRows([{ id: "a", session_id: BD.id, session_date: BD.session_date, status: "done", paid: false, queue_num: 1, type_preference: "None" }]);
    const ses = new Map<string, RecordSession>([[BD.id, { kind: "blood" as RideKind, freeRide: true, approval: false }]]);
    expect(rideStats(rows, ses, "2099-11-07")).toBeNull();
    expect(badgeList(rows, ses, empty, "2099-11-07", null).flatMap((x) => x.lv ?? [x]).filter((x) => x.on).map((x) => x.slug)).toEqual([]);
  });
  it("is left out of the Club's lists of rides", () => {
    const a = memberArea({ status: 200, message: "", data: { ok: true, member: true, first_name: "T",
      last: [{ date: "2099-11-05", title: "", kind: "blood", rated: false }, { date: "2099-11-01", title: "", kind: "saturday", rated: true }],
      upcoming: [{ id: BD.id, date: "2099-11-05", title: "", kind: "blood", time: "17:00 - 23:00", booked: false }, { id: "s", date: "2099-11-07", title: "", kind: "saturday", time: "05:45 - 06:15", booked: false }] } });
    expect(a).toMatchObject({ ok: true, member: true });
    if (a.ok && a.member) {
      expect(a.last.map((r) => r.kind)).toEqual(["saturday"]);
      expect(a.upcoming.map((r) => r.id)).toEqual(["s"]);
    }
  });
});

// ── Experiences and Events ───────────────────────────────────────────────────────────────────────────────────
describe("on Experiences, once a session exists", () => {
  it("has a card of its own, after Petromin Days and before Victory Lap, as on the booking app's landing", () => {
    expect(EVENT_CARDS.map((c) => c.key).slice(0, 3)).toEqual(["petromin", "blood", "vlap"]);
    expect(EVENT_CARDS.find((c) => c.key === "blood")).toEqual({ key: "blood", p: "bld", always: false });
    expect(EVENT_OF.blood).toBe("blood");
    const all = [{ id: "v", kind: "vlap" as const }, { id: BD.id, kind: "blood" as const }, { id: "s", kind: "saturday" as const }];
    expect(eventCards(all, { member: false, petromin: false }).map((c) => c.card.key)).toEqual(["blood", "vlap", "jcc", "community"]);
    // never among the community rides
    expect(eventCards(all, { member: true, petromin: false }).find((c) => c.card.key === "community")?.sessions.map((x) => x.id)).toEqual(["s"]);
    expect(membersOnlyEvent("blood")).toBe(false);
    expect(membersOnlyDate({ members: false, kind: "blood" })).toBe(false);
  });
  it("draws the plate, its name, when and where, its tagline, the four rules and its About link, and no price", async () => {
    const { steps, html } = await experiences([BD, JCC]);
    expect(steps.props.events.map((e) => e.key)).toEqual(["blood", "jcc", "community"]);
    expect(html).toMatch(/Thu,? 5 Nov/); // as this machine's Intl writes the short day
    for (const w of ["xs-event ev-blood", "/site/blood-partners.webp", 'width="1503"', "Blood Donation", "5 PM – 11 PM", "Jeddah Corniche Circuit", "Give blood. Ride free.", "Age 18 or over", "Weight 50 kg or more", "Bring your national ID or Iqama", "Sleep well and eat a healthy meal two hours before", "xs-about ab-blood"]) expect(html, w).toContain(w);
    expect(html).toContain('alt="Health Services at the Ministry of Defense, Ministry of Sport, Jeddah Corniche Circuit"');
    const card = html.slice(html.indexOf("xs-event ev-blood"), html.indexOf("xs-about ab-blood"));
    for (const no of ["SAR", "Complimentary", "Free", "﷼", "⃁"]) expect(card, no).not.toContain(no);
    // a button holds phrasing content alone
    expect(card).not.toMatch(/<(p|div|ul|li)\b/);
  });
  it("hands the booking to the app on its own event, and its date never says a price, the free word or the places left", async () => {
    const { steps } = await experiences([{ ...BD, capacity: 3 }]);
    const e = steps.props.events.find((x) => x.key === "blood")!;
    expect(bookingAt("https://book.example/", e.key, e.sessions[0].id)).toBe("https://book.example/?ev=blood&session=2099-11-05-bd");
    expect(e).toMatchObject({ title: "Blood Donation", meta: "", logo: "", note: "", about: "" });
    expect(e.sessions[0]).toMatchObject({ kind: "blood", name: "Blood Donation", free: false, paid: false, members: false, event: false, seatPrice: null, meta: [], route: null, breakfast: null });
    expect(e.sessions[0].info).toMatchObject({ text: "", who: "Everyone", price: null, places: null, collect: null, place: "Jeddah Corniche Circuit", map: BD.meet_url, distance: null });
  });
  it("gives its About the hospital's poster in Arabic and English, whatever the page's language", async () => {
    const { steps } = await experiences([BD], "de");
    const b = steps.props.events.find((x) => x.key === "blood")!.blood!;
    expect(b.info.title).toBe((de as Record<string, string>)["Before you donate"]);
    expect(b.info.pdf.url).toBe("https://micromobilityrentals.pages.dev/assets/blood-donation-poster.pdf");
    for (const l of ["ar", "en"] as const) {
      expect(b.info.poster[l].sections).toHaveLength(15);
      expect(b.info.poster[l].source).toBe("*AABB");
    }
    expect(b.info.poster.en.sections[0].h).toBe("Blood donation");
    expect(b.info.poster.ar.sections[0].h).toBe("التبرع بالدم");
  });
  it("reads from the right: its plate and its words in Arabic and Urdu", async () => {
    const ar = (await experiences([BD], "ar")).html;
    for (const w of ["/site/blood-partners-rtl.webp", "التبرع بالدم", "تبرّع بدمك واركب مجانًا.", "العمر 18 سنة فأكثر", "حلبة كورنيش جدة"]) expect(ar, w).toContain(w);
    expect(ar).not.toContain("/site/blood-partners.webp");
    resetRides();
    expect((await experiences([BD], "ur")).html).toContain("/site/blood-partners-rtl.webp");
    expect(bloodPlate("en")).toBe("/site/blood-partners.webp");
    expect(bloodPlate("de")).toBe("/site/blood-partners.webp");
  });
  it("lines up with its neighbours: an ordinary card's padding, its About link where every plain card has it", () => {
    const css = readFileSync(join(SRC, "components/experiences/experiences.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /\.(xs-event\.ev-blood|xs-about\.ab-blood)/.test(m[1])).map((m) => m[2]);
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(r).not.toMatch(/padding|inset|(^|[\s;])bottom:|min-height|(^|[\s;])height:/);
    expect(css).toMatch(/\.xs-events\s*\{[^}]*grid-auto-rows:\s*1fr/); // equal rows
  });
  it("its facts come from the plain rules", () => {
    const s = toSession(BD)!;
    expect(infoPrice(s, { free: "Complimentary", seat: null, from: "from SAR 57.5" })).toBeNull();
    expect(infoPlaces({ ...s, left: 3 }, { waitlist: "Waitlist", left1: "{0} spot left", leftN: "{0} spots left" })).toBeNull();
    expect(infoPlaces({ ...s, left: 0 }, { waitlist: "Waitlist", left1: "{0} spot left", leftN: "{0} spots left" })).toBe("Waitlist");
    const words = { meetingPoint: "Meeting point", venueCircuit: "Jeddah Corniche Circuit", venueJyc: "Jeddah Yacht Club" };
    expect(infoPlace(s, words, "https://dir")).toEqual({ name: "Jeddah Corniche Circuit", map: BD.meet_url });
    expect(infoPlace({ ...s, location: null, meetUrl: null }, words, "https://dir")).toEqual({ name: "Jeddah Corniche Circuit", map: "https://dir" });
    // never the circuit's words ("Collect your bike"): its Details are its poster
    expect(dateText(s, { aboutJcc: "Collect your bike from {collect}." } as DateTexts, infoTimes(s, (t) => fmtClock(t, "en")))).toBe("");
  });
});

describe("on Events, once a session exists", () => {
  it("is listed in its crimson with its line and venue, booked on its own event, never a price or the free word", async () => {
    const { html } = await eventsPage([BD]);
    for (const w of ["Blood Donation", "--kind:#b3122a", "Give blood. Ride free.", "Jeddah Corniche Circuit", "Open to everyone", "ev=blood&amp;session=2099-11-05-bd", "5 PM – 11 PM"]) expect(html, w).toContain(w);
    for (const no of ["Complimentary", "Community event", "SAR"]) expect(html, no).not.toContain(no);
    // for search engines too: at the circuit, no price
    const ld = /<script[^>]*ld\+json[^>]*>(.*?)<\/script>/s.exec(html)?.[1] ?? "";
    expect(ld).toContain("Blood Donation");
    expect(ld).toContain("Jeddah Corniche Circuit");
    expect(ld).not.toMatch(/"price"/);
  });
});

// ── The ticket on My Account ─────────────────────────────────────────────────────────────────────────────────
describe("its ticket on My Account", () => {
  const s = ticketSession(BD)!;
  const entry = (o: Record<string, unknown> = {}) => ticketRow({ id: "bd1abcdef", session_id: BD.id, session_date: BD.session_date, session_day: "Thursday", status: "waiting", queue_num: 12, price: 0, paid: false, name: "Test Donor", type_preference: "None", ...o })!;
  const card = (rows: TicketRow[], o: { rewards?: Map<string, BloodReward> | null; past?: boolean; locale?: string; today?: string; session?: typeof s | undefined; noSession?: boolean } = {}) => {
    const locale = o.locale ?? "en", tx = serverL(locale);
    return renderToStaticMarkup(createElement(TicketCard, {
      locale, today: o.today ?? "2099-11-01", rows, session: o.noSession ? undefined : s, name: bloodName(tx), cue: null, t: serverLocalize(TICKET, locale), gather: "Gathering", start: "Start", typeName: (x: string) => x,
      links: { edit: "https://book.example.test/?ev=blood", manage: "https://book.example.test/?tab=bookings", place: placeLink(s, CIRCUIT_MAP) },
      now: Date.parse("2099-11-01T09:00:00Z"), wallet: { bookingId: "bd1abcdef", groupIds: ["bd1abcdef"] }, past: o.past ?? false, balance: 500,
      blood: { words: bloodWords(tx), rewards: o.rewards ?? null },
    }));
  };
  const reward = (o: Partial<BloodReward> = {}) => new Map([["bd1abcdef", { code: "BD-ABC123", expiresAt: "2099-12-05", used: false, ...o }]]);

  it("has no bikes and no route, a window, the circuit and the map on its row", () => {
    expect(s).toMatchObject({ kind: "blood", bikes: false, gathers: false, approval: false, free: true, freeRide: true, times: ["17:00", "23:00"] });
    expect(venueText(venueOf(s), TICKET.en)).toBe("Jeddah Corniche Circuit");
    expect(venueText(venueOf(s), TICKET.ar)).toBe("حلبة كورنيش جدة");
    // the circuit when staff named no place, in the calendar file too
    const blank = ticketSession({ ...BD, location: null, meet_url: null })!;
    expect(venueOf(blank)).toEqual({ kind: "circuit" });
    expect(icsPlace(blank)).toBe("Jeddah Corniche Circuit");
    expect(icsPlace(s)).toBe("Jeddah Corniche Circuit");
    expect(meetsAt(s)).toBe(false);
    expect(placeLink(s, CIRCUIT_MAP)).toBe(BD.meet_url);
    expect(placeLink(blank, CIRCUIT_MAP)).toBe(CIRCUIT_MAP);
    expect(icsFor(s, "Blood Donation - Thursday", icsPlace(s))).not.toMatch(/bike|ride/i);
    expect(ticketRoute(s, new Map())).toBeNull();
    expect(countdownMoments(s, s.date).map((x) => x[1])).toEqual(["start"]);
    expect(ticketStages([entry({ status: "active" })], s.bikes, null, "en").stages.map((x) => x.key)).toEqual(["booked", "in", "done"]);
  });
  it("draws the plate on top, the donor's number, the short rules and what confirmed donors get", () => {
    const html = card([entry()]);
    expect(html).toContain("tk-card ev-blood");
    expect(html.indexOf("/site/blood-partners.webp")).toBeGreaterThan(-1);
    expect(html.indexOf("bld-plate")).toBeLessThan(html.indexOf("tk-head"));
    expect(html).toContain('alt="Health Services at the Ministry of Defense');
    for (const w of ["Donor number", "Donor · ", "#12", "Test Donor", ...bw.rules, bw.rewardNote]) expect(html, w).toContain(w);
    expect(html).not.toContain("Queue number");
    expect(html).not.toContain("tk-logo");
  });
  it("never says a price, a total or a pay line, whatever the row holds, and has no wallet at all", () => {
    for (const row of [entry(), entry({ price: 50 }), entry({ price: 50, paid: true }), entry({ paid: true }), entry({ addons: [{ id: "x", qty: 1, p: 20 }] })]) {
      const html = card([row]);
      for (const no of ["tk-total", "tk-rider-pay", "tk-pay", "tk-amt", "tk-addons", "tk-wallet", ">Total<", ">Free<", "On the house", "Pay at the booth", "You pay at the booth", "⃁", "SAR", "Helmets"]) expect(html, no).not.toContain(no);
    }
  });
  it("is only ever cancelled here: no Edit, no Reschedule, Cancel stays, and the way there", () => {
    const html = card([entry()]);
    for (const no of [">Edit<", "Reschedule", "Change details", "Meeting point"]) expect(html, no).not.toContain(no);
    expect(html).toContain(">Cancel<");
    expect(html).toContain("Add to calendar");
    expect(html).toContain("Get directions");
    expect(html).toContain(`href="${BD.meet_url}"`);
  });
  it("says neither ride nor bike outside the free ride's own words", () => {
    const text = card([entry()]).replace(bw.rewardNote, "").replace(/<[^>]*>/g, " ");
    expect(text).not.toMatch(CYCLING);
    expect(text).toContain("Donor");
  });
  it("reads by its id on a session that did not load: still no price, and no bike words", () => {
    const html = card([entry({ price: 50 })], { noSession: true });
    expect(html).toContain("tk-card ev-blood");
    expect(html).toContain("bld-plate");
    for (const no of ["tk-total", "tk-rider-pay", ">Free<", "Riders", "Helmets", "Reschedule", ">Edit<"]) expect(html, no).not.toContain(no);
  });
  it("shows the personal code for the free ride, or that it has been used, or nothing", () => {
    const html = card([entry({ status: "active" })], { rewards: reward() });
    for (const w of ["Your free ride", ">BD-ABC123<", "Thank you for donating. Enter this code when you book. Valid until 5 Dec 2099."]) expect(html, w).toContain(w);
    const used = card([entry({ status: "active" })], { rewards: reward({ used: true }) });
    expect(used).toContain("Your free ride has been used. Thank you for donating.");
    expect(used).not.toContain("BD-ABC123");
    for (const none of [null, new Map<string, BloodReward>(), new Map([["another", { code: "BD-X", expiresAt: null, used: false }]])]) expect(card([entry()], { rewards: none })).not.toContain("tk-bld-rw");
  });
  it("reads customer_blood_rewards' answer: a missing function or a refusal is simply no code", () => {
    expect([...bloodRewards([{ entry_id: "a", code: " BD-1 ", expires_at: "2099-12-05", used: false }]).entries()]).toEqual([["a", { code: "BD-1", expiresAt: "2099-12-05", used: false }]]);
    expect(bloodRewards([{ entry_id: "a", code: "BD-1", expires_at: "2099-12-05T00:00:00", used: true }]).get("a")).toEqual({ code: "BD-1", expiresAt: "2099-12-05", used: true });
    for (const v of [null, undefined, {}, { code: "PGRST202" }, "x", [null], [{ entry_id: "a" }], [{ code: "BD-1" }], [{ entry_id: "a", code: "" }]]) expect(bloodRewards(v).size, JSON.stringify(v)).toBe(0);
    expect(rewardGood({ code: "x", expiresAt: "2099-12-05", used: false }, "2099-12-05")).toBe(true);
    expect(rewardGood({ code: "x", expiresAt: "2099-12-05", used: false }, "2099-12-06")).toBe(false);
    expect(rewardGood({ code: "x", expiresAt: "2099-12-05", used: true }, "2099-11-06")).toBe(false);
    expect(rewardGood(null, "2099-11-06")).toBe(false);
  });
  it("past: no rules and no actions, the note and the code", () => {
    const html = card([entry({ status: "done" })], { past: true, rewards: reward(), today: "2099-11-20" });
    expect(html).toContain("BD-ABC123");
    expect(html).toContain("tk-past");
    for (const no of ["bld-sum", ">Cancel<", "Add to calendar", "<canvas"]) expect(html, no).not.toContain(no);
  });
  it("speaks Arabic and the translated languages, the booking app's own words where it has that language", () => {
    const ar = card([entry()], { locale: "ar" });
    for (const w of ["/site/blood-partners-rtl.webp", "رقم المتبرع", "المتبرع", "العمر 18 سنة فأكثر", "حلبة كورنيش جدة"]) expect(ar, w).toContain(w);
    const es = card([entry()], { locale: "es" });
    for (const w of ["Número de donante", "Donante", "18 años o más"]) expect(es, w).toContain(w);
    const d = de as Record<string, string>;
    const html = card([entry()], { locale: "de" });
    for (const w of ["Donor number", "Age 18 or over"]) expect(html, w).toContain(d[w]);
    expect(html).toContain("/site/blood-partners.webp");
  });

  describe("the page asks for the free ride only when it has to", () => {
    const account = async (rows: unknown[], rewards: () => Response) => {
      jar.account = `c1~${TOKEN}`;
      const f = db([BD], (url) => (url.includes("/rpc/customer_profile") ? json([{ name: "Test Donor", email: "donor@example.test", phone: "+966500000000" }])
        : url.includes("/rpc/my_bookings") ? json(rows) : url.includes("/rpc/customer_blood_rewards") ? rewards() : null));
      vi.stubGlobal("fetch", f);
      const page = await AccountPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) });
      return { asked: f.mock.calls.some((c) => String(c[0]).includes("/rpc/customer_blood_rewards")), cards: findAll(page, TicketCard) };
    };
    const row = (o: Record<string, unknown> = {}) => ({ id: "bd1abcdef", session_id: BD.id, session_date: BD.session_date, session_day: "Thursday", status: "waiting", queue_num: 12, price: 0, paid: false, name: "Test Donor", type_preference: "None", ...o });
    const good = () => json([{ entry_id: "bd1abcdef", code: "BD-ABC123", expires_at: "2099-12-05", used: false }]);

    it("never for an account with no booking on the event", async () => {
      const { asked, cards } = await account([], good);
      expect(asked).toBe(false);
      expect(cards).toHaveLength(0);
    });
    it("hands a ticket on the event its words and its code", async () => {
      const { asked, cards } = await account([row()], good);
      expect(asked).toBe(true);
      expect(cards).toHaveLength(1);
      const html = renderToStaticMarkup(cards[0]);
      for (const w of ["Donor number", "BD-ABC123", `href="${BD.meet_url}"`]) expect(html, w).toContain(w);
      expect((cards[0].props as { name: string }).name).toBe("Blood Donation"); // as its calendar file calls it
    });
    it("draws the ticket without a code, and no error, on a database without the function", async () => {
      const { asked, cards } = await account([row()], absent);
      expect(asked).toBe(true);
      const html = renderToStaticMarkup(cards[0]);
      expect(html).toContain("Donor number");
      expect(html).not.toContain("tk-bld-rw");
    });
    it("keeps a finished donor's ticket while the free ride is good: it is good for a month, and this page lists no past bookings", async () => {
      const done = row({ status: "done", session_id: "2001-11-05-bd", session_date: "2001-11-05" });
      const keep = await account([done], () => json([{ entry_id: "bd1abcdef", code: "BD-ABC123", expires_at: "2099-12-05", used: false }]));
      expect(keep.cards).toHaveLength(1);
      expect((keep.cards[0].props as { past?: boolean }).past).toBe(true);
      expect(renderToStaticMarkup(keep.cards[0])).toContain("BD-ABC123");
      for (const gone of [() => json([{ entry_id: "bd1abcdef", code: "BD-ABC123", expires_at: "2001-12-05", used: false }]), () => json([{ entry_id: "bd1abcdef", code: "BD-ABC123", expires_at: "2099-12-05", used: true }]), absent]) {
        expect((await account([done], gone)).cards).toHaveLength(0);
      }
      expect(bloodDone([done, row({ id: "x", status: "done", session_id: "2001-11-08", session_date: "2001-11-08" })], "2099-01-01").map((g) => g.sessionId)).toEqual(["2001-11-05-bd"]);
    });
  });
});

// ── The agreement ────────────────────────────────────────────────────────────────────────────────────────────
describe("its agreement, never the activity waiver", () => {
  const db2 = (rows: unknown[], accept: Response = json(1)) => db([BD], (url) => (url.includes("/rpc/my_bookings") ? json(rows) : url.includes("/rpc/customer_accept_waiver") ? accept : null));
  const row = (o: Record<string, unknown> = {}) => ({ id: "q9", session_id: BD.id, session_date: BD.session_date, status: "waiting", customer_id: "c1", queue_num: 7, name: "Test Donor", waiver_version: null, ...o });
  const get = (q: string) => waiverGet(new Request(`https://micromobility.sa/api/account/pending-waiver?${q}`, { headers: HEADERS }));
  const post = (body: unknown) => waiverPost(new Request("https://micromobility.sa/api/account/pending-waiver", { method: "POST", headers: HEADERS, body: JSON.stringify(body) }));

  it("is its own kind, at its own version", () => {
    const s = ticketSession(BD)!;
    expect(waiverKind(s)).toBe("blood");
    expect(waiverVersion(s)).toBe("blood-2026-11-v1");
    expect(WAIVER_VERSIONS.blood).toBe("blood-2026-11-v1");
    // every other kind keeps its own
    expect(waiverKind({ kind: "arena", bikes: false })).toBe("activity");
    expect(waiverKind({ kind: "swim", bikes: false })).toBe("swim");
    expect(waiverKind({ kind: "jcc", bikes: true })).toBe("ride");
  });
  it("says the booking app's words exactly (bldWaiverTitle, bldWaiverBody, bldWaiverAgree)", () => {
    expect(waiverCopy("blood", EN)).toEqual({
      title: "Donor agreement",
      body: "You cannot register for this event until you have read and agreed to this. Giving blood is voluntary, and I can withdraw at any time without giving a reason. The donation is a medical procedure carried out by the event’s medical team, not by MicroMobility. Only the medical team decides whether I can donate, so registering does not guarantee that I will. I will answer their health questions truthfully and follow their instructions and the venue’s, including resting after I donate and avoiding hard exercise for 5 hours. MicroMobility’s part is only to register me and to give confirmed donors their free ride. I am responsible for my personal belongings. To the fullest extent permitted by law, MicroMobility and its staff are not responsible for the medical procedure or its effects, or for any injury, illness, loss, theft or damage at the event.",
      agree: "I have read this and I agree",
    });
    const ar = waiverCopy("blood", AR);
    expect(ar.title).toBe("إقرار المتبرع");
    expect(ar.agree).toBe("قرأت هذا الإقرار وأوافق عليه");
    expect(ar.body.startsWith("لا يمكنك التسجيل في هذه الفعالية إلا بعد قراءة هذا الإقرار والموافقة عليه.")).toBe(true);
    expect(ar.body.endsWith("أو عن أي إصابة أو مرض أو فقدان أو سرقة أو تلف في الفعالية.")).toBe(true);
    // it releases MicroMobility and its staff only: the hosts' medical team does the donation
    for (const no of ["partners", "Every activity", "fracture", "on behalf of"]) expect(JSON.stringify(waiverCopy("blood", EN)), no).not.toContain(no);
    expect(waiverCopy("activity", EN).title).toBe("Activity waiver");
  });
  it("the pop-up's route brings its version, its words, its kicker and line, and calls the person a donor", async () => {
    vi.stubGlobal("fetch", db2([row()]));
    expect(await (await get("locale=en")).json()).toEqual({ signedIn: true, pending: {
      sessionId: BD.id, version: "blood-2026-11-v1", kind: "blood", copy: waiverCopy("blood", EN), name: "Blood Donation", when: "Thursday · 5 Nov 2099", time: "5 PM – 11 PM", venue: "Jeddah Corniche Circuit",
      ridersLabel: "Donor", riders: [{ name: "Test Donor", num: 7 }],
      kicker: "Agreement needed", sub: "You’re registered for this event. Read this agreement and agree to it to continue.",
    } });
    expect((await (await get("locale=ar")).json()).pending).toMatchObject({ kind: "blood", name: "التبرع بالدم", kicker: "إقرار مطلوب", sub: "أنت مسجّل في هذه الفعالية. اقرأ هذا الإقرار ووافق عليه للمتابعة.", ridersLabel: "المتبرع" });
  });
  it("records that version, and refuses any other", async () => {
    const f = db2([]);
    vi.stubGlobal("fetch", f);
    expect((await post({ sessionId: BD.id, version: "activity-2026-10-v3" })).status).toBe(409);
    expect(f.mock.calls.some((c) => String(c[0]).includes("/rpc/customer_accept_waiver"))).toBe(false);
    expect(await (await post({ sessionId: BD.id, version: "blood-2026-11-v1" })).json()).toEqual({ ok: true });
    const call = f.mock.calls.find((c) => String(c[0]).includes("/rpc/customer_accept_waiver")) as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toEqual({ p_id: "c1", p_token: TOKEN, p_session_id: BD.id, p_version: "blood-2026-11-v1" });
  });
  it("the pop-up says what the route brings, none of the waiver's own lines", () => {
    const w: PendingWaiver = { sessionId: BD.id, version: "blood-2026-11-v1", kind: "blood", copy: waiverCopy("blood", EN), name: "Blood Donation", when: "Thursday · 5 Nov 2099", time: "5 PM – 11 PM", venue: "Jeddah Corniche Circuit", ridersLabel: "Donor", riders: [{ name: "Test Donor", num: 7 }], kicker: "Agreement needed", sub: bw.gate.sub };
    const html = renderToStaticMarkup(createElement(Tx, { locale: "en", dict: null }, createElement(WaiverGate, { ...w, onDone: () => {} })));
    for (const s of ["Agreement needed", "Donor agreement", bw.gate.sub, "I have read this and I agree", "Donor", "ev-blood"]) expect(html, s).toContain(s.replace(/&/g, "&amp;"));
    for (const no of ["Waiver needed", "Our team booked you", "Riders", "Participants"]) expect(html, no).not.toContain(no);
    // another kind's pop-up keeps its own
    const other = renderToStaticMarkup(createElement(Tx, { locale: "en", dict: null }, createElement(WaiverGate, { ...w, kind: "activity", kicker: undefined, sub: undefined, onDone: () => {} })));
    expect(other).toContain("Waiver needed");
    expect(other).toContain("Our team booked you on this session.");
    expect(other).not.toContain("ev-blood");
  });
});

// ── Sharing the donor's details ──────────────────────────────────────────────────────────────────────────────
describe("sharing the donor's details with the hosts", () => {
  const ITEMS = ["Full name", "Mobile number", "Email address", "Blood type", "Birth date", "Nationality"];
  const WORDS = {
    kicker: "Before you register", title: "Sharing your details",
    sub: "To register, agree that we share these details with the event’s hosts:",
    note: "King Fahd Armed Forces Hospital in Jeddah, Health Services at the Ministry of Defense and the Ministry of Sport.",
    agree: "I agree to share my details with them.",
  };
  const row = (o: Record<string, unknown> = {}) => ({ id: "q9", session_id: BD.id, session_date: BD.session_date, status: "waiting", customer_id: "c1", queue_num: 7, name: "Test Donor", data_share_at: null, ...o });
  const db2 = (rows: unknown[], accept: Response = json(1)) => db([BD], (url) => (url.includes("/rpc/my_bookings") ? json(rows) : url.includes("/rpc/customer_accept_share") ? accept : null));
  const get = (q: string) => shareGet(new Request(`https://micromobility.sa/api/account/pending-share?${q}`, { headers: HEADERS }));
  const post = (body: unknown) => sharePost(new Request("https://micromobility.sa/api/account/pending-share", { method: "POST", headers: HEADERS, body: JSON.stringify(body) }));

  it("asks a donor who has not agreed, from today on", () => {
    const S = new Map([[BD.id, ticketSession(BD)!]]);
    expect(sharesDetails(S.get(BD.id))).toBe(true);
    expect(pendingShares([row()], S, "2099-11-01", "c1")).toEqual([{ sessionId: BD.id, date: "2099-11-05", km: null }]);
    expect(pendingShares([row({ data_share_at: "2099-11-01T09:00:00Z" })], S, "2099-11-01", "c1")).toEqual([]);
  });
  it("the route names the items and the hosts: the pop-up's code does not", async () => {
    vi.stubGlobal("fetch", db2([row()]));
    expect(await (await get("locale=en")).json()).toEqual({ signedIn: true, pending: {
      sessionId: BD.id, name: "Blood Donation", when: "Thursday · 5 Nov 2099", time: "5 PM – 11 PM", venue: "Jeddah Corniche Circuit", distance: null, kind: "blood", items: ITEMS, words: WORDS,
    } });
    const ar = (await (await get("locale=ar")).json()).pending;
    expect(ar.items).toEqual(["الاسم الكامل", "رقم الجوال", "البريد الإلكتروني", "فصيلة الدم", "تاريخ الميلاد", "الجنسية"]);
    expect(ar.words.note).toBe("مستشفى الملك فهد للقوات المسلحة بجدة، والخدمات الصحية بوزارة الدفاع، ووزارة الرياضة.");
  });
  it("records the agreement through customer_accept_share", async () => {
    const f = db2([]);
    vi.stubGlobal("fetch", f);
    expect(await (await post({ sessionId: BD.id })).json()).toEqual({ ok: true });
    const call = f.mock.calls.find((c) => String(c[0]).includes("/rpc/customer_accept_share")) as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toEqual({ p_id: "c1", p_token: TOKEN, p_session_id: BD.id });
  });
  const w: PendingShare = { sessionId: BD.id, name: "Blood Donation", when: "Thursday · 5 Nov 2099", time: "5 PM – 11 PM", venue: "Jeddah Corniche Circuit", distance: null, kind: "blood", items: ITEMS, words: WORDS };
  const draw = (p: PendingShare = w) => renderToStaticMarkup(createElement(Tx, { locale: "en", dict: null }, createElement(ShareGate, { ...p, onDone: () => {} })));
  it("the pop-up lists them in order, and never says a race, Kamin Sports or Sela", () => {
    const html = draw();
    const order = [WORDS.kicker, WORDS.title, "Blood Donation", WORDS.sub, ...ITEMS, WORDS.note, WORDS.agree, "Agree and continue", "Sign out"];
    const at = order.map((s) => html.indexOf(s));
    for (const [i, s] of order.entries()) expect(at[i], s).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html.match(/<li>/g)).toHaveLength(6);
    expect(html).toContain("ev-blood");
    for (const no of ["race", "Kamin", "Sela", "Arena", "Distance chosen", "Emergency contact", "Nothing else about you"]) expect(html, no).not.toContain(no);
  });
  it("another kind's pop-up is as it was", () => {
    const html = draw({ ...w, kind: undefined, items: undefined, words: undefined });
    expect(html).toContain("Before the race");
    expect(html).toContain("Sela and Jeddah Yacht Club");
    expect(html).not.toContain("ev-blood");
  });
});

// ── The words in every language ──────────────────────────────────────────────────────────────────────────────
describe("its words in every language", () => {
  it("never say ride, rider or bike outside the free ride's own wording", () => {
    for (const l of LOCALE_CODES) {
      const tx = serverL(l), b = bloodWords(tx), a = waiverCopy("blood", tx);
      for (const s of [b.name, b.plateAlt, ...b.rules, b.infoTitle, b.infoPdf, b.numLabel, b.donor, b.gate.kicker, b.gate.sub, b.share.kicker, b.share.title, b.share.sub, b.share.note, b.share.agree, ...b.share.items, a.title, a.agree]) expect(s, `${l}: ${s}`).not.toMatch(CYCLING);
    }
  });
  it("are the booking app's own where it speaks the language", () => {
    const es = serverL("es"), ur = serverL("ur"), tl = serverL("tl");
    expect(es("Blood Donation")).toBe("Donación de sangre");
    expect(es("Give blood. Ride free.")).toBe("Dona sangre. Monta gratis.");
    expect(ur("Donor agreement")).toBe("عطیہ دہندہ کا معاہدہ");
    expect(tl("Blood type")).toBe("Uri ng dugo");
  });
  it("are written by hand in the six it does not, with the free ride's date kept", () => {
    for (const l of ["de", "id", "ja", "ms", "ru", "zh"]) {
      const tx = serverL(l);
      for (const en of ["Blood Donation", "Donor number", "I have read this and I agree", "Before you register"]) expect(tx(en), `${l}: ${en}`).not.toBe(en);
      expect(tx("Thank you for donating. Enter this code when you book. Valid until {0}."), l).toContain("{0}");
    }
  });
});
