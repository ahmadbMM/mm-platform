import { describe, expect, it } from "vitest";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
// The site has no @types/react-dom; this test needs one function of it (as ride-record.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { badgeSubject, firstNameOf, fitFont, ltrNum, paintShare, plainText, shareDay, shareFile, shareTint, SHARE_INK, SHARE_SITE, titleSubject, wrapTwo, type ShareAssets, type ShareSubject } from "../share-picture";
import { shareDays } from "../share-days";
import { badgeList, recordRows, type BadgeData, type RecordSession } from "../ride-record";
import { memberArea, memberTitle, type MemberArea } from "../members";
import { LOCALES } from "@/i18n/locales";
import { SHARE_WORDS, shareWords } from "@/components/account/BadgeShare.words";
import ShareImage, { ShareButton } from "@/components/account/ShareImage";
import BadgeGrid from "@/components/account/BadgeGrid";
import RideRecord from "@/components/account/RideRecord";
import { T as RECORD } from "@/components/account/RideRecord.text";
import MembersArea from "@/components/club/MembersArea";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// Share a badge or a title as a picture, as the booking app's badge-share.js does (new features build F12, 2026-11-13):
// the words in every language, the day a ride badge was reached, what the picture says and where, and the two places
// that offer Share (an earned badge's pop-up on My Account > Badges, the title on /club).

// A 2D context that keeps what was asked of it: every call with the font, paint, direction and alpha set at the time,
// a text as wide as half its size a letter.
type Call = { op: string; args: unknown[]; font: string; fill: unknown; dir: string; alpha: number };
function fakeCtx() {
  const st: Record<string, unknown> = { font: "", fillStyle: "", strokeStyle: "", direction: "", textAlign: "", textBaseline: "", globalAlpha: 1, lineWidth: 1, lineJoin: "" };
  const calls: Call[] = [];
  const px = () => Number(/(\d+)px/.exec(String(st.font))?.[1] ?? 10);
  const ctx = new Proxy(st, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === "measureText") return (s: string) => ({ width: s.length * px() * 0.5 });
      if (k === "createRadialGradient") return () => ({ addColorStop() {} });
      return (...args: unknown[]) => { calls.push({ op: k, args, font: String(st.font), fill: st.fillStyle, dir: String(st.direction), alpha: Number(st.globalAlpha) }); };
    },
    set(t, k: string, v) { t[k] = v; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, texts: () => calls.filter((c) => c.op === "fillText") };
}
const IMG = {} as CanvasImageSource, MEDAL = {} as CanvasImageSource;
const assets = (o: Partial<ShareAssets> = {}): ShareAssets => ({ fam: "Inter, sans-serif", mark: IMG, medal: MEDAL, tint: shareTint("gold"), ...o });
const badge: ShareSubject = { label: "Badge earned", name: "Momentum", level: `Level ${ltrNum(3)} of ${ltrNum(8)}`, date: "14 Nov 2026", medal: { icon: "wind", color: "orange" }, chip: null, file: "micromobility-momentum" };
const title: ShareSubject = { label: "Title", name: "Captain", level: "", date: "2 Nov 2026", medal: null, chip: { color: "gold" }, file: "micromobility-title" };

describe("the share pop-up's words", () => {
  it("are there in every language the site speaks, and the booking app's own in the ten it shares", () => {
    for (const { code } of LOCALES) for (const [k, v] of Object.entries(SHARE_WORDS[code])) expect(v.trim(), `${code}.${k}`).not.toBe("");
    expect(Object.keys(SHARE_WORDS).sort()).toEqual(LOCALES.map((l) => l.code).sort());
    expect(shareWords("en")).toMatchObject({ share: "Share", badge: "Badge earned", title: "Title", name: "Include my first name", save: "Save image" });
    expect(shareWords("ar")).toMatchObject({ share: "مشاركة", close: "إغلاق", badge: "وسام مكتسب", title: "لقب" });
    expect(shareWords("fr").name).toBe("Ajouter mon prénom");
    expect(shareWords("bn").badge).toBe("ব্যাজ অর্জিত");
    expect(shareWords("de").share).toBe("Teilen");
    expect(shareWords("xx")).toBe(SHARE_WORDS.en);
  });
  it("hold no emoji", () => {
    const all = JSON.stringify(SHARE_WORDS);
    expect(/\p{Extended_Pictographic}/u.test(all)).toBe(false);
  });
});

describe("the day a ride badge was reached", () => {
  const row = (sid: string, o: Record<string, unknown> = {}) => ({ id: `${sid}-${String(o.queue_num ?? 1)}`, session_id: sid, session_date: sid.slice(0, 10), status: "done", paid: true, queue_num: 1, type_preference: "Road", ...o });
  const sat = ["2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26", "2026-10-03"];
  const rows = recordRows([
    row("2026-08-30"), // a circuit evening, first of all
    ...sat.map((d) => row(d)),
    row("2026-09-12", { queue_num: 2 }), // the rider's party: the night counts once
    row("2026-09-01-sw"), // a pool session: no ride
    row("2026-10-10", { status: "noshow" }), // not ridden
    row("2026-10-11", { paid: false }), // owed: not ridden
  ]);
  const ses = new Map<string, RecordSession>([
    ["2026-08-30", { kind: "jcc", freeRide: false }], ...sat.map((d) => [d, { kind: "saturday", freeRide: true }] as [string, RecordSession]),
    ["2026-09-01-sw", { kind: "swim", freeRide: false }], ["2026-10-10", { kind: "saturday", freeRide: true }], ["2026-10-11", { kind: "jcc", freeRide: false }],
  ]);
  it("is the night that made the count, for the bike rides and the Saturday rides", () => {
    expect(shareDays(rows, ses)).toEqual({ first_lap: "2026-08-30", regular: "2026-09-26", rolling_start: "2026-09-05", slipstream: "2026-10-03" });
  });
  it("names none for a count a night without a day would decide, and none for anything else", () => {
    const one = recordRows([row("2026-09-05")]), odd = [...one, { ...one[0], id: "x1-1", sessionId: "x1", date: "" }];
    const s = new Map<string, RecordSession>([["2026-09-05", { kind: "saturday", freeRide: true }], ["x1", { kind: "jcc", freeRide: false }]]);
    expect(shareDays(odd, s)).toEqual({ rolling_start: "2026-09-05" });
    expect(shareDays([], new Map())).toEqual({});
  });
});

describe("the picture", () => {
  it("draws a badge: the mark, the medal, the label, the name, its level and day, and the site's address", () => {
    const { ctx, calls, texts } = fakeCtx();
    const said = paintShare(ctx, badge, "", assets(), false);
    expect(calls.filter((c) => c.op === "drawImage").map((c) => c.args)).toEqual([[IMG, 476, 140, 128, 120], [MEDAL, 280, 460, 520, 520]]);
    expect(texts().map((c) => plainText(String(c.args[0])))).toEqual(["MicroMobility", "Badge earned", "Momentum", "Level 3 of 8", "14 Nov 2026", SHARE_SITE]);
    expect(texts().every((c) => c.args[1] === 540 && c.dir === "ltr")).toBe(true);
    expect(texts()[1].fill).toBe(SHARE_INK.go);
    expect(texts().at(-1)).toMatchObject({ args: [SHARE_SITE, 540, 1790, 980], fill: SHARE_INK.foot });
    expect(said.map(plainText)).toEqual(["MicroMobility", "Badge earned", "Momentum", "Level 3 of 8", "14 Nov 2026"]);
    expect(said.join(" ")).not.toMatch(/experiences/);
  });
  it("puts the first name above the badge only when asked", () => {
    const off = fakeCtx(), on = fakeCtx();
    paintShare(off.ctx, badge, "", assets(), false);
    const said = paintShare(on.ctx, badge, "Sara", assets(), false);
    expect(off.texts().map((c) => c.args[0])).not.toContain("Sara");
    expect(on.texts()[1]).toMatchObject({ args: ["Sara", 540, expect.any(Number), 980], font: "600 60px Inter, sans-serif" });
    expect(said.slice(0, 3)).toEqual(["MicroMobility", "Sara", "Badge earned"]);
    // the block of words stays centred under the medal: with the name it starts higher
    expect(Number(on.texts()[1].args[2])).toBeLessThan(Number(off.texts()[1].args[2]));
  });
  it("stands the badge's six sides in for a medal that could not be made, and the name for the mark", () => {
    const { ctx, calls, texts } = fakeCtx();
    paintShare(ctx, badge, "", assets({ mark: null, medal: null, tint: shareTint("orange") }), false);
    expect(calls.some((c) => c.op === "drawImage")).toBe(false);
    expect(calls.find((c) => c.op === "fill")).toMatchObject({ fill: "#f98a3c", alpha: 0.16 });
    expect(calls.filter((c) => c.op === "lineTo")).toHaveLength(5);
    expect(texts()[0]).toMatchObject({ args: ["MicroMobility", 540, 260, 980], fill: SHARE_INK.go });
  });
  it("draws a title on a chip in its colour, the bar on the side the line starts from", () => {
    const ltr = fakeCtx(), rtl = fakeCtx();
    const said = paintShare(ltr.ctx, title, "", assets({ medal: null, tint: shareTint("gold") }), false);
    paintShare(rtl.ctx, { ...title, name: "قائد" }, "", assets({ medal: null }), true);
    expect(ltr.texts().map((c) => c.args[0])).toEqual(["MicroMobility", "Title", "Captain", "2 Nov 2026", SHARE_SITE]);
    expect(ltr.texts()[1].args.slice(1, 3)).toEqual([540, 580]);
    const bar = (calls: Call[]) => calls.filter((c) => c.op === "fillRect" && c.args[2] === 20)[0].args;
    expect(bar(ltr.calls)).toEqual([280, 640, 20, 210]); // the chip is its narrowest, 520 wide
    expect(bar(rtl.calls)).toEqual([780, 640, 20, 210]);
    expect(rtl.texts().every((c) => c.dir === "rtl")).toBe(true);
    expect(said).toEqual(["MicroMobility", "Title", "Captain", "2 Nov 2026"]);
    expect(ltr.calls.some((c) => c.op === "drawImage" && c.args[0] === MEDAL)).toBe(false);
  });
  it("makes a long name smaller and breaks it over two lines at most", () => {
    const { ctx } = fakeCtx();
    expect(fitFont(ctx, "Short", 700, 84, 60, "x", 940)).toBe(84);
    expect(fitFont(ctx, "A".repeat(30), 700, 84, 60, "x", 940)).toBe(60);
    expect(ctx.font).toBe("700 60px x");
    expect(wrapTwo(ctx, "Hall of Fame", 940)).toEqual(["Hall of Fame"]);
    expect(wrapTwo(ctx, "one two three four five six seven eight nine ten eleven twelve thirteen", 940)).toHaveLength(2);
  });
  it("paints the eight colours as the site's medals, a special one and green as the brand green", () => {
    expect(shareTint("blue")).toBe("#3d8bfd");
    expect(shareTint("green")).toBe(SHARE_INK.go);
    expect(shareTint("vlap")).toBe(SHARE_INK.go);
    expect(shareTint(null)).toBe(SHARE_INK.go);
  });
});

describe("what is shared", () => {
  it("an earned badge: its level on a ladder, its day, its file", () => {
    const sub = badgeSubject({ slug: "momentum", name: "Momentum", icon: "wind", color: "orange", levels: [1, 2, 3, 4, 5, 6, 7, 8], lvN: 3, day: "14 Nov 2026" }, "Badge earned", "Level {0} of {1}");
    expect({ ...sub, level: plainText(sub.level) }).toEqual({ label: "Badge earned", name: "Momentum", level: "Level 3 of 8", date: "14 Nov 2026", medal: { icon: "wind", color: "orange" }, chip: null, file: "micromobility-momentum" });
    expect(sub.level).not.toBe(plainText(sub.level)); // its numbers held in order for a right-to-left line
    expect(badgeSubject({ slug: "lap_1a2b", name: "Lap", icon: "lapring", color: "gold", levels: null, lvN: 0 }, "B", "L {0}/{1}")).toMatchObject({ level: "", date: "" });
    expect(shareFile("lap 1/2")).toBe("micromobility-lap-1-2");
    expect(shareFile("")).toBe("micromobility-badge");
  });
  it("a title: its own Arabic name in Arabic, the day it was earned", () => {
    expect(titleSubject({ name: "Captain", nameAr: "قائد", color: "gold", at: "2026-11-02" }, "en", "Title")).toEqual({ label: "Title", name: "Captain", level: "", date: "2 Nov 2026", medal: null, chip: { color: "gold" }, file: "micromobility-title" });
    expect(titleSubject({ name: "Captain", nameAr: "قائد", color: "gold" }, "ar", "لقب")).toMatchObject({ name: "قائد", date: "" });
    expect(shareDay("2026-11-02", "de")).toBe("2. Nov. 2026");
    expect(shareDay("2026-11-30T21:30:00Z", "en")).toBe("1 Dec 2026"); // Riyadh's calendar
    expect(shareDay("soon", "en")).toBe("");
  });
  it("the first name alone", () => {
    expect(firstNameOf("  Sara Al Harbi ")).toBe("Sara");
    expect(firstNameOf("")).toBe("");
    expect(firstNameOf(null)).toBe("");
  });
});

describe("the title's day", () => {
  it("is read when customer_my_titles sends it, and left out before it did", () => {
    const titles = [{ id: "a", name: "Captain", name_ar: "قائد", color: "gold", at: "2026-11-02" }, { id: "b", name: "Legend", color: "purple", at: "later" }];
    expect(memberTitle({ status: 200, data: { ok: true, member: true, shown: "a", titles } })?.title).toEqual({ name: "Captain", nameAr: "قائد", color: "gold", at: "2026-11-02" });
    expect(memberTitle({ status: 200, data: { ok: true, member: true, shown: "b", titles } })?.title).not.toHaveProperty("at");
  });
});

// The elements a server component returns, walked for the one of a type.
function find(n: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(n)) { for (const x of n) { const f = find(x, type); if (f) return f; } return null; }
  if (!isValidElement(n)) return null;
  if (n.type === type) return n as ReactElement<Record<string, unknown>>;
  return find((n.props as { children?: ReactNode }).children, type);
}

describe("Share on My Account > Badges", () => {
  const today = "2026-11-01";
  const empty: BadgeData = { catalog: [], weeks: null, seasons: [], mine: [] };
  const rows = recordRows(["2026-10-03", "2026-10-10"].map((d) => ({ id: d, session_id: d, session_date: d, status: "done", paid: true, queue_num: 1, type_preference: "Road" })));
  const ses = new Map<string, RecordSession>(rows.map((r) => [r.sessionId, { kind: "saturday", freeRide: true }]));
  const mine = [{ slug: "marshal", note: "Thanks", at: "2026-10-20T09:00:00Z" }];
  const props = { locale: "en", stats: null, led: 0, badges: badgeList(rows, ses, { ...empty, mine }, today, null), t: RECORD.en, typeName: (x: string) => x, dur: { h: "{h} h", hm: "{h} h {m} min", m: "{m} min" }, part: "badges" as const };
  const grid = (p: Record<string, unknown>) => find((RideRecord as (q: typeof props) => ReactNode)({ ...props, ...p } as typeof props), BadgeGrid);
  it("hands the grid the rider's first name and each earned badge's day: given, else reached", () => {
    const g = grid({ share: { first: "Sara", rode: shareDays(rows, ses) } });
    expect(g?.props.share).toEqual({ locale: "en", first: "Sara" });
    const items = g?.props.items as { slug: string; on: boolean; day?: string }[];
    expect(items.find((x) => x.slug === "marshal")?.day).toBe("20 Oct 2026"); // the day staff gave it
    expect(items.find((x) => x.slug === "first_lap")?.day).toBe("3 Oct 2026"); // the night that reached it
    expect(items.find((x) => x.slug === "tailwind")?.day).toBe(""); // reached, but a day the app does not name
    expect(items.filter((x) => !x.on).every((x) => x.day === undefined)).toBe(true); // nothing to share yet
  });
  it("offers nothing without it, and draws the grid as before", () => {
    const g = grid({});
    expect(g?.props.share).toBeNull();
    expect((g?.props.items as { day?: string }[]).every((x) => x.day === undefined)).toBe(true);
    const html = renderToStaticMarkup(createElement(RideRecord, { ...props, share: { first: "Sara", rode: {} } }));
    expect(html).toBe(renderToStaticMarkup(createElement(RideRecord, props)));
  });
});

describe("the share pop-up", () => {
  it("waits for its picture: the button stays silent until it is made, the name switch only with a first name", () => {
    const html = renderToStaticMarkup(createElement(ShareImage, { sub: badge, first: "Sara", locale: "en", onDone: () => {} }));
    expect(html).toContain('class="shr-dlg"');
    expect(html).toContain('aria-label="Making the image"');
    expect(html).toMatch(/<input type="checkbox" role="switch"[^>]*>/);
    expect(html).not.toMatch(/role="switch"[^>]*checked/); // off every time it opens
    expect(html).toContain("Include my first name");
    expect(html).toMatch(/<button type="button" class="shr-go" disabled="">/);
    expect(html).toContain("Save image"); // no share sheet for files here
    expect(html).toContain('class="shr-probe"'); // the medal its colours are read from
    const none = renderToStaticMarkup(createElement(ShareImage, { sub: title, first: "", locale: "ar", onDone: () => {} }));
    expect(none).not.toContain('role="switch"');
    expect(none).toContain("حفظ الصورة");
    expect(none).toContain("إغلاق");
    expect(none).not.toMatch(/class="shr-probe"[^>]*><svg/); // a title has no medal
  });
});

describe("Share under the title on /club", () => {
  const a = memberArea({ status: 200, message: "", data: { ok: true, member: true, first_name: "Sara Ali", since: null, credits: 0, tier: 0, next: 100, rides: 0, group_rides: 0, last: [], upcoming: [], birth_date: null, announcements: [] } });
  const area = a as Extract<MemberArea, { member: true }>;
  const html = (title: unknown, locale = "en") => renderToStaticMarkup(createElement(MembersArea, {
    locale, L: locale === "ar" ? "ar" : "en", area, tierNames: ["Member", "Pro", "Legend"], nameOf: () => "Saturday", bookAt: () => "#", today: "2026-11-13", empty: "None",
    title: title as never, communityHref: "/c", accountHref: "/a",
  }));
  it("shows for a member holding a title, and not for one holding none", () => {
    expect(html({ hidden: false, title: { name: "Captain", nameAr: "قائد", color: "gold", at: "2026-11-02" } })).toMatch(/<button type="button" class="shr-btn shr-line"><svg[^]*<span>Share<\/span><\/button>/);
    expect(html({ hidden: false, title: { name: "Captain", nameAr: "قائد", color: "gold" } }, "ar")).toContain("<span>مشاركة</span>");
    expect(html({ hidden: false, title: null })).not.toContain("shr-btn");
    expect(html(null)).not.toContain("shr-btn");
  });
  it("is a button that opens nothing until it is tapped", () => {
    const b = renderToStaticMarkup(createElement(ShareButton, { sub: title, first: "Sara", locale: "en" }));
    expect(b).not.toContain("<dialog");
  });
});
