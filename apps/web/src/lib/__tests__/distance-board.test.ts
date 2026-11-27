import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as ride-record.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import Medal from "@/components/account/Medal";
import type { ReactElement } from "react";
import { T as RECORD } from "@/components/account/RideRecord.text";
import { BOARD_WORDS } from "@/components/leaderboard/Leaderboard.words";
import { serverLocalize } from "@/i18n/dicts";
import { LOCALE_CODES } from "@/i18n/locales";
import { GET as boardRoute } from "../../app/api/leaderboard/route";
import { GET as mineRoute, POST as mineSend } from "../../app/api/account/distances/route";
import { askChoices } from "../badge-request";
import {
  boardName, boardSubject, claimBody, kmMi, claimProblem, claimRefusal, kmNum, ownCard, readBoard, readKm, readMine, refusalWord,
  BOARD_LINK, BOARD_MEDAL, type MyDistances,
} from "../distance-board";
import { BADGE_SYS, HELD_ONLY, badgeList, type BadgeData } from "../ride-record";
import { plainText } from "../share-picture";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// The distance leaderboards (the booking app's distance-board.js, rentals migration 20261127180000): what the database
// answers, read safely; the claim's checks and the words it says them in; the share picture; the Longest Ride medals
// and badges; and the two routes, which send the account cookie's session to the database and never hand it back.
const SITE = "https://micromobility.sa";
const TOK = "tk1a2b3c4d5e6f7g8h9i";
const COOKIE = `NEXT_LOCALE=en; mm_acct=c1~${TOK}`;
const PDF = "data:application/pdf;base64," + Buffer.from("%PDF-1.4\n%%EOF").toString("base64");
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const db = (body: unknown, status = 200) => vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => answer(body, status));
const sentTo = (f: ReturnType<typeof db>, n = 0) => {
  const [url, init] = f.mock.calls[n] as [string, RequestInit];
  return { fn: url.split("/rpc/")[1], args: JSON.parse(String(init.body)) as Record<string, unknown> };
};
const post = (body: unknown, o: { cookie?: string; origin?: string } = {}) =>
  new Request(SITE + "/api/account/distances", { method: "POST", headers: { origin: o.origin ?? SITE, "content-type": "application/json", ...(o.cookie === "" ? {} : { cookie: o.cookie ?? COOKIE }) }, body: JSON.stringify(body) });
const get = (path: string, cookie = "") => new Request(SITE + path, { headers: cookie ? { cookie } : {} });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const mine = (o: Partial<MyDistances> = {}): MyDistances => ({ best: 82.5, at: "2026-11-01", lifetime: 640, year: 410.4, member: true, medal: null, claims: [], ...o });

describe("the boards as the database answers them", () => {
  it("reads distance_board's rows: shared ranks, every full name (null: Member), never with dashes, the medal and the rider's own", () => {
    const a = readBoard({ ok: true, board: "longest", gender: "female", rows: [
      { r: 1, km: 120, name: "Sara Ahmed Alzahrani", medal: 1, mine: false },
      { r: 2, km: 90.5, name: null, medal: 2, mine: true },
      { r: 2, km: 90.5, name: "Noor-Al_Huda Khalid", medal: null, mine: false },
      { r: "x", km: 10 }, { r: 0, km: 5 },
    ], me: { r: 2, km: 90.5, public: true, member: true, gender: "female" } })!; // public: the old switch, read no more
    expect(a.board).toBe("longest");
    expect(a.gender).toBe("female");
    expect(a.rows.map((x) => [x.r, x.km, x.name, x.medal, x.mine])).toEqual([[1, 120, "Sara Ahmed Alzahrani", 1, false], [2, 90.5, null, 2, true], [2, 90.5, "Noor Al Huda Khalid", null, false]]);
    expect(a.me).toEqual({ r: 2, km: 90.5, member: true, gender: "female" });
    // signed out: no `me`; an unknown board or gender reads as Longest ride, men
    expect(readBoard({ ok: true, board: "nope", gender: "x", rows: [] })).toEqual({ board: "longest", gender: "male", rows: [], me: null });
    expect(readBoard({ ok: false })).toBeNull();
    expect(readBoard(null)).toBeNull();
    expect(boardName(" - ")).toBeNull();
  });

  it("reads customer_distances: the rider's own figures and distances, nothing it cannot read", () => {
    const m = readMine({ ok: true, best: 82.5, at: "2026-11-01", lifetime: "640", year: 410.4, public: true, member: false, medal: 3, claims: [
      { id: 7, kind: "total", km: 500, d: "2026-10-31", from: "2026-01-01", status: "pending", source: "claim", reply: null, at: "2026-11-02T10:00:00Z" },
      { id: 8, kind: "ride", km: 60, d: "2026-10-04", from: null, status: "declined", source: "claim", reply: " Blurry ", at: "2026-10-05T10:00:00Z" },
      { id: 9, kind: "lap", km: 1, d: "2026-10-04", status: "pending", source: "claim" },
      { id: 10, kind: "ride", km: 210, d: null, from: null, status: "approved", source: "staff", reply: null, at: "2026-11-28T10:00:00Z" }, // staff gave no date (2026-11-28)
    ] })!;
    expect(m).toMatchObject({ best: 82.5, lifetime: 640, year: 410.4, member: false, medal: 3 });
    expect(m.claims.map((x) => [x.id, x.kind, x.from, x.reply])).toEqual([[7, "total", "2026-01-01", null], [8, "ride", null, "Blurry"], [10, "ride", null, null]]);
    expect(m.claims[2].d).toBeNull();
    expect(readMine({ ok: false, error: "token" })).toBeNull();
  });

  it("writes a distance as the app does: Latin digits, a whole number bare, else one decimal; and reads Arabic digits typed", () => {
    expect([kmNum(40), kmNum(40.04), kmNum(82.55), kmNum("x")]).toEqual(["40", "40", "82.6", "0"]);
    expect(readKm("١٢٣٫٥")).toBe(123.5);
    // in kilometres and miles (2026-11-28), each to one decimal, a whole number bare
    expect([kmMi(90, BOARD_WORDS.en), kmMi(100, BOARD_WORDS.en), kmMi(0.5, BOARD_WORDS.ms), kmMi(160.9344, BOARD_WORDS.ja)]).toEqual(["90 km · 55.9 mi", "100 km · 62.1 mi", "0.5 km · 0.3 batu", "160.9 km · 100 マイル"]);
    expect(readKm("۴۲")).toBe(42);
    expect(readKm(" 12,5 ")).toBe(12.5);
    expect(readKm("12 km")).toBeNaN();
  });

  it("puts the rider's own figure on their card: the board's when ranked, else their own, the medal only on Longest ride", () => {
    const m = mine({ medal: 2 });
    expect(ownCard("longest", { r: 3, km: 82.5, member: true, gender: "male" }, m)).toEqual({ r: 3, km: 82.5, medal: 2, member: true });
    expect(ownCard("lifetime", { r: null, km: null, member: false, gender: null }, m)).toEqual({ r: null, km: 640, medal: null, member: false });
    expect(ownCard("year", null, m).km).toBe(410.4);
    expect(ownCard("month", null, m).km).toBeNull(); // this month's figure comes only from the board
    expect(ownCard("longest", null, null)).toEqual({ r: null, km: null, medal: null, member: true });
  });
});

describe("Add a distance", () => {
  const f = { kind: "ride" as const, km: "80", d: "2026-11-20", from: "", proof: PDF };
  it("checks the distance, then the dates, then the proof, as the booking app's form", () => {
    expect(claimProblem(f, "2026-11-27")).toBeNull();
    expect(claimProblem({ ...f, km: "0.5" }, "2026-11-27")).toBe("eKm");
    // no maximum for a ride or a total (2026-11-28), only the column's room
    expect(claimProblem({ ...f, km: "301" }, "2026-11-27")).toBeNull();
    expect(claimProblem({ ...f, kind: "total", km: "50001", from: "2026-01-01" }, "2026-11-27")).toBeNull();
    expect(claimProblem({ ...f, km: "100000" }, "2026-11-27")).toBe("eKm");
    expect(claimProblem({ ...f, d: "2026-11-28" }, "2026-11-27")).toBe("eDate");
    expect(claimProblem({ ...f, kind: "total", from: "2026-11-21" }, "2026-11-27")).toBe("eDate");
    expect(claimProblem({ ...f, kind: "total", from: "" }, "2026-11-27")).toBe("eDate");
    expect(claimProblem({ ...f, proof: null }, "2026-11-27")).toBe("eProof");
  });
  it("reads the body a page posts, and refuses one without a proof, a date or a kind", () => {
    expect(claimBody({ kind: "ride", km: "82.55", date: "2026-11-20", from: "2026-01-01", note: "  Strava  ", proof: PDF, proofName: "ride\n.pdf" }))
      .toEqual({ p_kind: "ride", p_km: 82.6, p_date: "2026-11-20", p_from: null, p_note: "Strava", p_proof: PDF, p_proof_name: "ride.pdf" });
    expect(claimBody({ kind: "total", km: 400, date: "2026-11-20", from: "2026-01-01", proof: PDF })?.p_from).toBe("2026-01-01");
    expect(claimBody({ kind: "total", km: 400, date: "2026-11-20", proof: PDF })).toBeNull();
    expect(claimBody({ kind: "ride", km: 40, date: "2026-11-20" })).toBeNull();
    expect(claimBody({ kind: "ride", km: 40, date: "2026-11-20", proof: "data:text/html;base64,PGI+" })).toBeNull();
    expect(claimBody({ kind: "lap", km: 40, date: "2026-11-20", proof: PDF })).toBeNull();
    expect(claimBody({ kind: "ride", km: 420, date: "2026-11-20", proof: PDF })?.p_km).toBe(420);
    expect(claimBody({ kind: "ride", km: 100000, date: "2026-11-20", proof: PDF })).toBeNull();
    expect(claimBody({ kind: "ride", km: 40, date: "20 Nov", proof: PDF })).toBeNull();
  });
  it("says the database's refusals in the form's words", () => {
    expect(["km", "date", "proof", "limit", "token", "x"].map((e) => claimRefusal({ ok: false, error: e }))).toEqual(["km", "date", "proof", "limit", "signin", "generic"]);
    expect(["km", "date", "proof", "invalid", "limit", "busy", undefined].map(refusalWord)).toEqual(["eKm", "eDate", "eProof", "eProof", "eLimit", "eNet", "eNet"]);
  });
});

describe("the share picture", () => {
  it("names the board, the distance and the place with the board's gender, the medal held, and the leaderboard's address", () => {
    const w = BOARD_WORDS.en;
    const s = boardSubject("longest", "female", 2, 90.5, 2, w);
    expect([s.label, plainText(s.name), plainText(s.level), s.medal, s.file, s.foot]).toEqual(["Longest ride", "90.5 km · 56.2 mi", "#2 · Women", { icon: "lr2", color: "silver" }, "micromobility-longest", BOARD_LINK]);
    const y = boardSubject("year", "male", 14, 410, 1, w);
    expect([y.label, plainText(y.level), y.medal]).toEqual(["Kilometres this year", "#14 · Men", { icon: "road", color: "green" }]); // a medal only on Longest ride
    expect(BOARD_LINK).toBe("micromobility.sa/leaderboard");
    expect(plainText(boardSubject("lifetime", "male", 1, 640, null, BOARD_WORDS.ar).name)).toBe("640 كم · 397.7 ميل");
  });
});

describe("the words", () => {
  it("are in every language the site speaks, the booking app's own in the eleven it speaks, with Latin digits", () => {
    const en = BOARD_WORDS.en;
    expect(Object.keys(BOARD_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const [l, w] of Object.entries(BOARD_WORDS)) {
      expect(Object.keys(w), l).toEqual(Object.keys(en));
      for (const v of Object.values(w)) expect(v.trim(), l).not.toBe("");
      expect(w.km, l).toContain("{0}");
      expect(w.mi, l).toContain("{0}");
      for (const v of Object.values(w)) expect(v, `${l} digits`).not.toMatch(/[٠-٩۰-۹०-९০-৯]/);
    }
    expect(BOARD_WORDS.ar.onlyMembers).toBe("يُرتَّب أعضاء المجتمع فقط.");
    expect(BOARD_WORDS.ms.secBoard).toBe("Pendahulu");
    expect(BOARD_WORDS.en.eKm).toBe("Enter a distance of 1 km or more.");
    expect(BOARD_WORDS.ne.eKm).toBe("1 किमी वा बढी दूरी लेख्नुहोस्।");
    expect(BOARD_WORDS.ar.noDate).toBe("بلا تاريخ");
    expect(Object.keys(BOARD_WORDS.en)).not.toContain("nameSw"); // the name switch went (2026-11-28)
  });
});

describe("Longest Ride Gold, Silver and Bronze", () => {
  it("are drawn as the race medal with the place struck on it, on the brand green ribbon", () => {
    for (const [n, [icon, color]] of Object.entries(BOARD_MEDAL)) {
      const svg = renderToStaticMarkup(createElement(Medal, { icon, color }));
      expect(svg).toContain("bdg-race");
      expect(svg).toContain(`>#${n}</text>`);
      expect(svg).toContain('fill="#03c46a"');
    }
    expect([BADGE_SYS.lr_gold, BADGE_SYS.lr_silver, BADGE_SYS.lr_bronze]).toEqual([["lr1", "gold"], ["lr2", "silver"], ["lr3", "orange"]]);
  });
  it("show only to a holder and are never offered to request, with or without the catalogue", () => {
    const row = (slug: string, icon: string) => ({ slug, icon, color: "gold", name: slug, system: true, auto: true, held_only: true });
    const cat = [row("lr_gold", "lr1"), row("lr_silver", "lr2"), row("lr_bronze", "lr3"), { slug: "marshal", icon: "shield", color: "orange", name: "Marshal", system: true, auto: false }];
    const data = (catalog: BadgeData["catalog"], m: BadgeData["mine"] = []): BadgeData => ({ catalog, weeks: null, seasons: [], mine: m });
    for (const c of [cat, []]) {
      const none = badgeList([], new Map(), data(c), "2026-11-27", null);
      expect(none.some((x) => x.slug.startsWith("lr_")), "hidden until held").toBe(false);
      expect(askChoices(none).some((x) => x.slug.startsWith("lr_"))).toBe(false);
      const held = badgeList([], new Map(), data(c, [{ slug: "lr_silver", at: "2026-11-27T10:00:00Z" }]), "2026-11-27", null);
      expect(held.find((x) => x.slug === "lr_silver")).toMatchObject({ on: true, icon: "lr2", color: "silver" });
      expect(askChoices(held).some((x) => x.slug.startsWith("lr_"))).toBe(false);
    }
    for (const s of ["lr_gold", "lr_silver", "lr_bronze"]) expect(HELD_ONLY.has(s)).toBe(true);
  });
  it("have their words in English, Arabic and the languages translated from the English", () => {
    expect(RECORD.en.names.lr_gold).toEqual(["Longest Ride Gold", "Hold the longest measured single ride among members", expect.stringContaining("Longest ride leaderboard")]);
    expect(RECORD.ar.names.lr_bronze[0]).toBe("أطول رحلة: البرونزية");
    expect(serverLocalize(RECORD, "fr").names.lr_silver[0]).toBe("Plus longue sortie : Argent");
    expect(serverLocalize(RECORD, "ja").names.lr_gold[0]).toBe("最長ライド：ゴールド");
  });
});

describe("the routes", () => {
  it("GET /api/leaderboard reads a board for anyone, and with the cookie sends the account's session - never back", async () => {
    const f = db({ ok: true, board: "year", gender: "female", rows: [{ r: 1, km: 400, name: null, medal: null, mine: true }], me: { r: 1, km: 400, public: false, member: true, gender: "female" } });
    vi.stubGlobal("fetch", f);
    const res = await boardRoute(get("/api/leaderboard?b=year&g=female", COOKIE));
    expect(res.headers.get("cache-control")).toBe("no-store, private");
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ ok: true, board: { board: "year", rows: [{ r: 1, mine: true }], me: { r: 1 } } });
    expect(text).not.toContain(TOK);
    expect(sentTo(f)).toEqual({ fn: "distance_board", args: { p_board: "year", p_gender: "female", p_id: "c1", p_token: TOK } });
    const g = db({ ok: true, board: "longest", gender: "male", rows: [] });
    vi.stubGlobal("fetch", g);
    expect(await (await boardRoute(get("/api/leaderboard?b=drop&g=x"))).json()).toMatchObject({ ok: true, board: { me: null } });
    expect(sentTo(g).args).toEqual({ p_board: "longest", p_gender: "male", p_id: null, p_token: null });
    vi.stubGlobal("fetch", db({ message: "Could not find the function" }, 404));
    expect((await boardRoute(get("/api/leaderboard"))).status).toBe(502);
  });

  it("GET /api/account/distances reads the account's own, signed in only", async () => {
    expect((await mineRoute(get("/api/account/distances"))).status).toBe(401);
    const f = db({ ok: true, best: 40, at: "2026-11-01", lifetime: 80, year: 80, public: false, member: true, medal: null, claims: [] });
    vi.stubGlobal("fetch", f);
    expect(await (await mineRoute(get("/api/account/distances", COOKIE))).json()).toMatchObject({ ok: true, mine: { best: 40, lifetime: 80 } });
    expect(sentTo(f)).toEqual({ fn: "customer_distances", args: { p_id: "c1", p_token: TOK } });
  });

  it("POST sends a claim and a take-back, and says the database's refusals", async () => {
    let f = db({ ok: true, id: 31 });
    vi.stubGlobal("fetch", f);
    expect(await (await mineSend(post({ action: "claim", kind: "ride", km: 82.5, date: "2026-11-20", proof: PDF, proofName: "a.pdf" }))).json()).toEqual({ ok: true, id: 31 });
    expect(sentTo(f)).toMatchObject({ fn: "customer_distance_claim", args: { p_id: "c1", p_token: TOK, p_kind: "ride", p_km: 82.5, p_date: "2026-11-20", p_from: null, p_note: null, p_proof: PDF, p_proof_name: "a.pdf" } });
    vi.stubGlobal("fetch", db({ ok: false, error: "limit" }));
    const lim = await mineSend(post({ action: "claim", kind: "ride", km: 82.5, date: "2026-11-20", proof: PDF }));
    expect([lim.status, await lim.json()]).toEqual([409, { ok: false, error: "limit" }]);
    f = db({ ok: true });
    vi.stubGlobal("fetch", f);
    expect(await (await mineSend(post({ action: "withdraw", id: 31 }))).json()).toEqual({ ok: true });
    expect(sentTo(f)).toEqual({ fn: "customer_distance_withdraw", args: { p_id: "c1", p_token: TOK, p_claim: 31 } });
    vi.stubGlobal("fetch", db({ ok: false, error: "token" }));
    expect((await mineSend(post({ action: "withdraw", id: 31 }))).status).toBe(401);
    // nothing reaches the database: another site, no account, a body it cannot read
    const none = db({ ok: true });
    vi.stubGlobal("fetch", none);
    expect((await mineSend(post({ action: "withdraw", id: 31 }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await mineSend(post({ action: "withdraw", id: 31 }, { cookie: "" }))).status).toBe(401);
    expect((await mineSend(post({ action: "public", on: true }))).status).toBe(400); // the name switch went (2026-11-28)
    expect((await mineSend(post({ action: "claim", kind: "ride", km: 40, date: "2026-11-20" }))).status).toBe(400);
    expect((await mineSend(post({ action: "withdraw", id: "1; drop" }))).status).toBe(400);
    expect((await mineSend(post({ action: "nope" }))).status).toBe(400);
    expect(none).not.toHaveBeenCalled();
  });
});
