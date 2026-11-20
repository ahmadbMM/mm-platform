import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { T as M } from "@/components/market/Market.text";
import { T } from "@/components/market/w2.text";
import { w2Get, w2Post, w2PostForm } from "@/components/market/w2/api";
import { w2IssueText, w2RefusalText, W2_BIRTH_HREF } from "@/components/market/w2/say";
import { POST as savePost } from "../../app/api/market/listing/save/route";
import { POST as publishPost } from "../../app/api/market/listing/publish/route";
import { POST as statePost } from "../../app/api/market/listing/state/route";
import { GET as mineGet } from "../../app/api/market/listing/mine/route";
import { POST as photoPost } from "../../app/api/market/photo/route";
import {
  MK_DECLARATIONS, MK_FACT_KEYS, MK_FOR_WHOM, MK_PHOTO_BYTES, MK_SMALL_BYTES, MK_STATUSES, mkHasExif, mkImageKind, type MkCategory, type MkListingMine,
} from "../market/core";
import {
  W2_GROUPS, W2_KEPT_MS, W2_SHOTS, W2_STATE_OF, W2_STEPS, w2Acts, w2BodyFields, w2BodyPublish, w2BodyState, w2Changes, w2Editable, w2Empty, w2Fields,
  w2FormOf, w2FormRead, w2GroupOf, w2GroupsIn, w2HasChanges, w2IsBike, w2Issues, w2KeptOld, w2KeptRead, w2KeptValue, w2Move, w2Place, w2SaveWhat, w2Sendable,
  w2SerialText, w2Slots, w2StartStep, w2StepFrom, w2Steps, w2Stored, w2Whole, w2YearMax, type W2Ctx, type W2Form,
} from "../market/w2";
import { w2PairRefusal, w2Photo } from "../market/w2-photo";

// Selling on the Marketplace (W2): the form's plain rules, what each refusal says, the photo's bytes, and the selling
// routes. Nothing is read or written anywhere: every database and storage call is a stub.

const cat = (over: Partial<MkCategory> = {}): MkCategory => ({
  slug: "cycling-bike-road", parent: "cycling", name_en: "Road bikes", name_ar: "دراجات الطريق", sort: 10, tier: "open", needs_serial: true, min_photos: 3,
  facts: ["brand", "model", "year", "frame_size", "wheel_size"], ...over,
});
const HELMET = cat({ slug: "cycling-helmets", name_en: "Helmets", tier: "new_only", needs_serial: false, min_photos: 1, facts: ["brand", "model", "size"] });
const EBIKE = cat({ slug: "cycling-bike-electric", name_en: "E-bikes", tier: "declare" });
const SHOES = cat({ slug: "running-shoes", parent: "running", name_en: "Shoes", needs_serial: false, min_photos: 1, facts: ["brand", "model", "size", "for_whom"] });
const hex = (n: number) => `l7/${String(n).padStart(32, "0")}.jpg`;
const NOW = Date.UTC(2026, 10, 20, 12);

const mine = (over: Partial<MkListingMine> = {}): MkListingMine => ({
  id: 7, status: "draft", seller_kind: "private", category: "cycling-bike-road", sport: "cycling", title: "Canyon Endurace", description: "Carbon frame, serviced last month.",
  condition: "good", faults: null, price: 2500, negotiable: true, city: "jeddah", facts: { brand: "Canyon", year: 2022, frame_size: "54" }, serial: "WSBC-600123",
  declarations: {}, photos: [hex(1), hex(2), hex(3)], name_mode: null, display_name: null, hold_reason: null, hidden_reason: null, published_at: null, expires_at: null,
  sold_at: null, sold_price: null, commission_pct: null, commission_due: null, commission_received: false, checked_at: null, renewable: false, threads: 0, unread: 0,
  created_at: "2026-11-20T09:00:00+00:00", updated_at: "2026-11-20T09:05:00+00:00", ...over,
});
const full = (over: Partial<W2Form> = {}): W2Form => ({ ...w2FormOf(mine()), ...over });
const ctx = (over: Partial<W2Ctx> = {}): W2Ctx => ({
  draft: true, priceMax: 500_000, shop: false, shortName: "Sara A.", nameMode: "short", consent: true, termsNeeded: false, termsTick: false, now: NOW, ...over,
});
const keys = (issues: { step: string; key: string }[]) => issues.map((i) => `${i.step}:${i.key}`);

describe("the form and the listing it saves", () => {
  it("opens a listing as the seller left it, and an empty form for a new one", () => {
    const f = w2FormOf(mine());
    expect(f).toMatchObject({ category: "cycling-bike-road", title: "Canyon Endurace", price: "2500", negotiable: true, city: "jeddah", condition: "good", serial: "WSBC-600123" });
    expect(f.facts).toMatchObject({ brand: "Canyon", year: "2022", frame_size: "54", model: "" });
    expect(f.photos).toEqual([hex(1), hex(2), hex(3)]);
    expect(w2FormOf(null)).toEqual(w2Empty());
    expect(w2FormOf(mine({ title: null, price: null, condition: null, city: null, category: null }))).toMatchObject({ title: "", price: "", condition: "", city: "", category: "" });
  });
  it("reads a number as people type it, with Arabic digits and thousands commas", () => {
    expect(w2Whole("2500")).toBe(2500);
    expect(w2Whole(" 2,500 ")).toBe(2500);
    expect(w2Whole("٢٥٠٠")).toBe(2500);
    expect(w2Whole("۲۵۰۰")).toBe(2500);
    expect(w2Whole("2500.00")).toBe(2500);
    for (const bad of ["", "abc", "25.5", "-3", "2 500 riyals", "1e3"]) expect(w2Whole(bad), bad).toBeNull();
    expect(w2SerialText(" wsbc 600-123 ")).toBe("WSBC600-123");
    expect(w2YearMax(NOW)).toBe(2027);
  });
  it("sends the facts the category asks for and no others, a serial and the declarations only where they belong", () => {
    const f = full({ facts: { ...w2Empty().facts, brand: "  Canyon  ", model: "Endurace", year: "2022", frame_size: "54", wheel_size: "700c", size: "L", for_whom: "men" } });
    const road = w2Fields(f, cat(), NOW);
    expect(road.facts).toEqual({ brand: "Canyon", model: "Endurace", year: 2022, frame_size: "54", wheel_size: "700c" });
    expect(road.serial).toBe("WSBC-600123");
    expect(road.declarations).toEqual({});
    const shoes = w2Fields(f, SHOES, NOW);
    expect(shoes.facts).toEqual({ brand: "Canyon", model: "Endurace", size: "L", for_whom: "men" });
    expect(shoes.serial).toBeNull();
    const ebike = w2Fields(full({ declarations: { complete: true, unmodified: false, speed_25: true, charger: false } }), EBIKE, NOW);
    expect(ebike.declarations).toEqual({ complete: true, speed_25: true });
    expect(w2Fields(f, null, NOW)).toMatchObject({ category: null, facts: {}, serial: null });
  });
  it("keeps a value that cannot be read out of what is sent", () => {
    const f = w2Fields(full({ price: "lots", title: "   ", city: "atlantis", facts: { ...w2Empty().facts, year: "1850", wheel_size: "31" } }), cat(), NOW);
    expect(f).toMatchObject({ price: null, title: null, city: null, facts: {} });
    expect(w2Fields(full({ price: "600000" }), cat(), NOW).price).toBeNull();
  });
  it("sends only what changed since the database last answered", () => {
    const l = mine();
    const base = w2Stored(l);
    expect(w2Changes(base, w2Fields(w2FormOf(l), cat(), NOW))).toEqual({});
    const changes = w2Changes(base, w2Fields(full({ title: "Canyon Endurace CF", price: "2400", photos: [hex(2), hex(1), hex(3)] }), cat(), NOW));
    expect(changes).toEqual({ title: "Canyon Endurace CF", price: 2400, photos: [hex(2), hex(1), hex(3)] });
    expect(w2HasChanges(changes)).toBe(true);
    expect(w2Changes(base, w2Fields(full({ faults: "" , description: "Carbon frame,\n serviced   last month." }), cat(), NOW))).toEqual({});
    expect(w2Changes(w2Stored(null), w2Fields(w2Empty(), null, NOW))).toEqual({});
    expect(w2Changes(base, w2Fields(full({ category: "cycling-helmets" }), HELMET, NOW))).toEqual({ category: "cycling-helmets", facts: { brand: "Canyon" }, serial: null });
  });
  it("holds back from a draft's save only the values the database would refuse", () => {
    const f = full({ title: "Call me on 0551234567", description: "see www.example.com", price: "2400", facts: { ...w2Empty().facts, year: "20x2" } });
    const issues = w2Issues(f, cat(), ctx());
    const send = w2Sendable(w2Changes(w2Stored(mine()), w2Fields(f, cat(), NOW)), issues);
    expect(Object.keys(send).sort()).toEqual(["price"]);
    // a title that is only too short for publishing is still a draft's title
    const short = full({ title: "Ab" });
    expect(w2Sendable(w2Changes(w2Stored(mine()), w2Fields(short, cat(), NOW)), w2Issues(short, cat(), ctx()))).toEqual({ title: "Ab" });
  });
  it("makes a draft only when asked to, saves a draft as it goes and a listing on sale in one go", () => {
    const road = cat();
    const typed = { ...w2Empty(), category: "cycling-bike-road" };
    // no draft yet: putting the page away with only a category chosen sends nothing; the first photo makes the draft
    expect(w2SaveWhat(null, w2Stored(null), typed, road, {}, NOW)).toBeNull();
    expect(w2SaveWhat(null, w2Stored(null), typed, road, { create: true }, NOW)).toEqual({ category: "cycling-bike-road" });
    expect(w2SaveWhat(null, w2Stored(null), w2Empty(), null, { create: true }, NOW)).toEqual({});
    // a draft: only what changed, without what the database would refuse outright
    const l = mine();
    const linked = full({ title: "see www.example.com", price: "2400" });
    expect(w2SaveWhat(l, w2Stored(l), full(), road, {}, NOW)).toBeNull();
    expect(w2SaveWhat(l, w2Stored(l), full(), road, { create: true }, NOW)).toBeNull();
    expect(w2SaveWhat(l, w2Stored(l), linked, road, {}, NOW)).toEqual({ price: 2400 });
    expect(w2SaveWhat(l, w2Stored(l), linked, road, { all: true }, NOW)).toEqual({ title: "see www.example.com", price: 2400 });
    // a listing on sale: nothing until Save changes, then everything that changed
    const live = mine({ status: "live" });
    expect(w2SaveWhat(live, w2Stored(live), full({ price: "2400" }), road, {}, NOW)).toBeNull();
    expect(w2SaveWhat(live, w2Stored(live), full({ price: "2400" }), road, { all: true }, NOW)).toEqual({ price: 2400 });
    expect(w2SaveWhat(live, w2Stored(live), full(), road, { all: true }, NOW)).toBeNull();
  });
  it("keeps beside the page only what the database has not taken, and opens a listing with it", () => {
    const l = mine();
    const clean = w2KeptValue(l, w2FormOf(l), false, "words", "short", NOW);
    expect(clean).toEqual({ at: l.updated_at, saved: NOW, dirty: false, step: "words", nameMode: "short" });
    expect(JSON.stringify(clean)).not.toContain("WSBC"); // a saved form is not kept twice, its serial number least of all
    const dirty: unknown = JSON.parse(JSON.stringify(w2KeptValue(l, full({ title: "Typed and not saved", photos: [hex(3), hex(1)] }), true, "words", "none", NOW)));
    // the same state of the listing: the form as it was typed, on its step
    expect(w2KeptRead(dirty, l, NOW + 60_000)).toMatchObject({ step: "words", nameMode: "none", form: { title: "Typed and not saved", photos: [hex(3), hex(1)] } });
    // the listing changed since: the typed words stay, the photos are the database's
    const moved = mine({ updated_at: "2026-11-20T10:00:00+00:00", photos: [hex(1)] });
    expect(w2KeptRead(dirty, moved, NOW + 60_000).form).toMatchObject({ title: "Typed and not saved", photos: [hex(1)] });
    // a saved form: the listing as the database has it, on the step it was left at
    expect(w2KeptRead(clean, l, NOW + 60_000)).toEqual({ form: w2FormOf(l), step: "words", nameMode: "short" });
    // past its twelve hours, not ours to read, or nothing kept: the listing as it is
    expect(w2KeptOld(dirty, NOW + W2_KEPT_MS - 1)).toBe(false);
    expect(w2KeptOld(dirty, NOW + W2_KEPT_MS)).toBe(true);
    for (const junk of [null, "x", [], { saved: "yesterday" }]) expect(w2KeptOld(junk, NOW), JSON.stringify(junk)).toBe(true);
    expect(w2KeptRead(dirty, moved, NOW + W2_KEPT_MS)).toEqual({ form: w2FormOf(moved), step: null, nameMode: "none" });
    expect(w2KeptRead(null, l, NOW)).toEqual({ form: w2FormOf(l), step: null, nameMode: "" });
    expect(w2KeptRead({ dirty: true, at: l.updated_at, saved: NOW, step: "nowhere", nameMode: "full", form: "x" }, l, NOW)).toEqual({ form: w2FormOf(l), step: null, nameMode: "" });
    expect(w2KeptRead(dirty, null, NOW)).toEqual({ form: w2Empty(), step: null, nameMode: "" });
  });
  it("reads the form this browser kept back key by key, and never more than a form could hold", () => {
    const server = w2FormOf(mine());
    expect(w2FormRead(null, server)).toBe(server);
    const read = w2FormRead({ title: "Typed and not saved", price: "2400", photos: [hex(3), "evil/../x.jpg", hex(3), "s2/" + "0".repeat(32) + ".jpg"], negotiable: "yes", facts: { brand: 5, model: "CF 8" }, condition: "bogus", extra: 1 }, server);
    expect(read).toMatchObject({ title: "Typed and not saved", price: "2400", negotiable: true, condition: "good", photos: [hex(3)] });
    expect(read.facts).toMatchObject({ brand: "Canyon", model: "CF 8" });
    expect(w2FormRead({ title: "x".repeat(5000) }, server).title.length).toBe(160);
  });
});

describe("what the form still needs", () => {
  it("nothing, for a complete draft", () => {
    expect(w2Issues(full(), cat(), ctx())).toEqual([]);
  });
  it("photos first: the category's own minimum, then the category", () => {
    expect(keys(w2Issues(w2Empty(), null, ctx({ nameMode: "", consent: false })))).toEqual([
      "item:photos", "item:category", "details:condition", "words:title", "words:description", "price:price", "price:city", "final:name_mode", "final:consent",
    ]);
    const two = w2Issues(full({ photos: [hex(1), hex(2)] }), cat(), ctx());
    expect(two).toEqual([{ step: "item", field: "photos", key: "photos", n: 3, hard: false }]);
    expect(w2Issues(full({ photos: [hex(1)], category: "cycling-helmets", condition: "new" }), HELMET, ctx())).toEqual([]);
    expect(keys(w2Issues(full({ photos: Array.from({ length: 11 }, (_, i) => hex(i)) }), cat(), ctx()))).toEqual(["item:photos_max"]);
    // a sport alone is not a category to list under
    expect(keys(w2Issues(full(), cat({ slug: "cycling", parent: null, needs_serial: false, min_photos: 1, facts: [] }), ctx()))).toEqual(["item:category"]);
  });
  it("the title and the description by their cleaned length, and no link or phone number in any text", () => {
    expect(keys(w2Issues(full({ title: "Ab", description: "Too short" }), cat(), ctx()))).toEqual(["words:title", "words:description"]);
    expect(keys(w2Issues(full({ title: "x".repeat(81) }), cat(), ctx()))).toEqual(["words:title"]);
    const text = w2Issues(full({ title: "Bike at www.example.com", description: "Call ٠٥٥١٢٣٤٥٦٧ after five", faults: "ask on 966551234567", facts: { ...w2Empty().facts, brand: "site.com brand" } }), cat(), ctx());
    expect(text.map((i) => `${i.field}:${i.key}:${i.hard}`)).toEqual(["fact_brand:link:true", "faults:phone:true", "title:link:true", "description:phone:true"]);
  });
  it("a new-only category takes New alone, a new account's price has a ceiling, and the year is one", () => {
    expect(keys(w2Issues(full({ category: "cycling-helmets", condition: "good" }), HELMET, ctx()))).toEqual(["details:new_only"]);
    expect(w2Issues(full({ price: "3500" }), cat(), ctx({ priceMax: 3000 }))).toEqual([{ step: "price", field: "price", key: "price_max", n: 3000, hard: false }]);
    expect(w2Issues(full({ price: "3000" }), cat(), ctx({ priceMax: 3000 }))).toEqual([]);
    expect(keys(w2Issues(full({ price: "0" }), cat(), ctx()))).toEqual(["price:price"]);
    expect(keys(w2Issues(full({ price: "abc" }), cat(), ctx()))).toEqual(["price:price"]);
    expect(keys(w2Issues(full({ facts: { ...w2Empty().facts, year: "2028" } }), cat(), ctx()))).toEqual(["details:year"]);
    expect(w2Issues(full({ facts: { ...w2Empty().facts, year: "2027" } }), cat(), ctx())).toEqual([]);
  });
  it("a serial number where the category needs one, and all four declarations for an e-bike or e-scooter", () => {
    expect(keys(w2Issues(full({ serial: "" }), cat(), ctx()))).toEqual(["final:serial"]);
    expect(w2Issues(full({ serial: "ab" }), cat(), ctx())).toEqual([{ step: "final", field: "serial", key: "serial", hard: true }]);
    expect(w2Issues(full({ serial: "" , category: "running-shoes" }), SHOES, ctx())).toEqual([]);
    const three = { complete: true, unmodified: true, speed_25: true, charger: false };
    expect(keys(w2Issues(full({ declarations: three }), EBIKE, ctx()))).toEqual(["final:declare"]);
    expect(w2Issues(full({ declarations: { ...three, charger: true } }), EBIKE, ctx())).toEqual([]);
  });
  it("a name chosen and the ticks made before a draft is published, and none of them for a listing already on sale", () => {
    expect(keys(w2Issues(full(), cat(), ctx({ nameMode: "" })))).toEqual(["final:name_mode"]);
    expect(keys(w2Issues(full(), cat(), ctx({ nameMode: "short", shortName: null })))).toEqual(["final:name_mode"]);
    expect(w2Issues(full(), cat(), ctx({ nameMode: "none", shortName: null }))).toEqual([]);
    expect(keys(w2Issues(full(), cat(), ctx({ consent: false, termsNeeded: true })))).toEqual(["final:consent", "final:terms"]);
    expect(w2Issues(full(), cat(), ctx({ termsNeeded: true, termsTick: true }))).toEqual([]);
    // an approved shop lists under its own name: no name is chosen
    expect(w2Issues(full(), cat(), ctx({ shop: true, nameMode: "" }))).toEqual([]);
    expect(w2Issues(full(), cat(), ctx({ draft: false, nameMode: "", consent: false, termsNeeded: true }))).toEqual([]);
  });
});

describe("the steps", () => {
  it("are six for a draft; a listing on sale has the last checks only where its category asks for them", () => {
    expect(w2Steps(true, null)).toEqual([...W2_STEPS]);
    expect(w2Steps(false, cat())).toEqual([...W2_STEPS]);
    expect(w2Steps(false, EBIKE)).toContain("final");
    expect(w2Steps(false, SHOES)).toEqual(["item", "details", "words", "price", "review"]);
  });
  it("go forward and back among the steps there are", () => {
    const steps = w2Steps(false, SHOES);
    expect(w2StepFrom(steps, "price", 1)).toBe("review");
    expect(w2StepFrom(steps, "review", 1)).toBeNull();
    expect(w2StepFrom(steps, "item", -1)).toBeNull();
    expect(w2StepFrom(steps, "review", -1)).toBe("price");
  });
  it("open a draft where it stopped and a published listing on its review", () => {
    const steps = w2Steps(true, cat());
    expect(w2StartStep(true, steps, w2Issues(full({ title: "" }), cat(), ctx({ consent: false })))).toBe("words");
    expect(w2StartStep(true, steps, w2Issues(full(), cat(), ctx({ consent: false })))).toBe("final");
    expect(w2StartStep(true, steps, [])).toBe("review");
    expect(w2StartStep(false, steps, w2Issues(w2Empty(), null, ctx()))).toBe("review");
  });
  it("can be edited only in the states the database edits in", () => {
    expect(MK_STATUSES.filter(w2Editable)).toEqual(["draft", "live", "reserved", "expired"]);
  });
});

describe("what a refusal says", () => {
  // every refusal code that can reach the selling screens, as a route answers it
  const reach: [string, string][] = [
    ["signin", ""], ["busy", ""], ["birth", ""], ["adult", ""], ["suspended", ""], ["terms", ""], ["consent", ""],
    ["input", "category"], ["input", "title"], ["input", "description"], ["input", "condition"], ["input", "faults"], ["input", "price"], ["input", "city"],
    ["input", "facts"], ["input", "serial"], ["input", "declarations"], ["input", "photos"], ["input", "name_mode"], ["input", "action"], ["input", "for"], ["input", "ext"],
    ["link", "title"], ["link", "description"], ["link", "faults"], ["link", "facts"], ["phone", "title"], ["phone", "description"], ["phone", "faults"], ["phone", "facts"],
    ["photos", ""], ["serial", ""], ["declare", ""], ["new_only", ""], ["price", ""], ["limit", "live"], ["limit", "drafts"], ["limit", "photos"],
    ["state", ""], ["gone", ""], ["invalid", ""], ["too_big", ""], ["absent", ""], ["origin", ""], ["generic", ""], ["unreadable", ""], ["full", ""],
  ];
  it("has plain words for every code, in English and Arabic", () => {
    for (const [error, detail] of reach) {
      for (const [t, m] of [[M.en, T.en], [M.ar, T.ar]] as const) {
        const text = w2RefusalText(t, m, error, detail);
        expect(text.trim().length, `${error} ${detail}`).toBeGreaterThan(5);
        expect(text, `${error} ${detail}`).not.toMatch(/MKT_|undefined|\{\d\}/);
      }
    }
  });
  it("names what is wrong rather than saying only that something is", () => {
    const say = (error: string, detail = "") => w2RefusalText(M.en, T.en, error, detail);
    expect(say("limit", "live")).toBe(M.en.errors.limit_live);
    expect(say("limit", "drafts")).toBe(M.en.errors.limit_drafts);
    expect(say("limit", "photos")).toBe(M.en.errors.limit_photos);
    expect(say("adult")).toBe(M.en.errors.adult);
    expect(say("birth")).toBe(M.en.errors.birth);
    expect(say("suspended")).toBe(M.en.errors.suspended);
    expect(say("link", "title")).toBe(M.en.errors.link);
    expect(say("phone", "description")).toBe(M.en.errors.phone);
    expect(say("photos")).toBe(M.en.errors.photos);
    expect(say("serial")).toBe(M.en.errors.serial);
    expect(say("declare")).toBe(M.en.errors.declare);
    expect(say("new_only")).toBe(M.en.errors.new_only);
    expect(say("price")).toBe(M.en.errors.price);
    expect(say("input", "title")).toBe(T.en.need.title);
    expect(say("input", "declarations")).toBe(M.en.errors.declare);
    expect(say("input", "no-such-key")).toBe(M.en.errors.input);
    expect(say("no-such-error")).toBe(M.en.errors.generic);
    // the missing birth date leads to where it is added
    expect(W2_BIRTH_HREF).toBe("/account/personal");
  });
  it("says each thing the form noticed, with its number where it has one", () => {
    for (const [t, m] of [[M.en, T.en], [M.ar, T.ar]] as const) {
      const all = [
        ...w2Issues(w2Empty(), null, ctx({ nameMode: "", consent: false, termsNeeded: true })),
        ...w2Issues(full({ photos: [hex(1)], title: "see example.com", description: "0551234567 call", price: "9000", serial: "x", facts: { ...w2Empty().facts, year: "12" }, condition: "fair", declarations: w2Empty().declarations }), cat({ tier: "declare" }), ctx({ priceMax: 3000 })),
        ...w2Issues(full({ category: "cycling-helmets", condition: "fair", photos: Array.from({ length: 11 }, (_, i) => hex(i)) }), HELMET, ctx()),
      ];
      expect(new Set(all.map((i) => i.key)).size).toBeGreaterThanOrEqual(16);
      for (const i of all) expect(w2IssueText(t, m, i).trim().length, i.key).toBeGreaterThan(5);
    }
    expect(w2IssueText(M.en, T.en, { key: "photos", n: 3 })).toBe("Add at least 3 photos.");
    expect(w2IssueText(M.en, T.en, { key: "photos", n: 1 })).toBe("Add at least one photo.");
    expect(w2IssueText(M.en, T.en, { key: "price_max", n: 3000 })).toContain("3,000");
    expect(w2IssueText(M.ar, T.ar, { key: "price_max", n: 3000 })).toContain("3,000");
  });
  it("is put at the control it is about", () => {
    expect(w2Place("input", "title")).toEqual({ step: "words", field: "title" });
    expect(w2Place("link", "description")).toEqual({ step: "words", field: "description" });
    expect(w2Place("phone", "faults")).toEqual({ step: "details", field: "faults" });
    expect(w2Place("link", "facts")).toEqual({ step: "details", field: "facts" });
    expect(w2Place("photos", "")).toEqual({ step: "item", field: "photos" });
    expect(w2Place("serial", "")).toEqual({ step: "final", field: "serial" });
    expect(w2Place("declare", "")).toEqual({ step: "final", field: "declarations" });
    expect(w2Place("new_only", "")).toEqual({ step: "details", field: "condition" });
    expect(w2Place("price", "")).toEqual({ step: "price", field: "price" });
    expect(w2Place("consent", "")).toEqual({ step: "final", field: "consent" });
    expect(w2Place("terms", "")).toEqual({ step: "final", field: "terms" });
    for (const e of ["limit", "birth", "adult", "suspended", "busy", "generic", "gone", "state"]) expect(w2Place(e, "live"), e).toBeNull();
  });
});

describe("the photo step", () => {
  it("draws a bike's empty slots as its shots, in order, and one plain slot for anything", () => {
    expect(w2IsBike(cat())).toBe(true);
    expect(w2IsBike(EBIKE)).toBe(true);
    expect(w2IsBike(HELMET)).toBe(false);
    expect(w2IsBike(cat({ slug: "cycling-escooters" }))).toBe(false);
    expect(w2IsBike(null)).toBe(false);
    expect(w2Slots(0, cat())).toEqual([...W2_SHOTS]);
    expect(w2Slots(2, cat())).toEqual(["drivetrain", "cockpit", "frame", "damage"]);
    expect(w2Slots(5, cat())).toEqual(["damage"]);
    expect(w2Slots(6, cat())).toEqual(["plain"]);
    expect(w2Slots(9, cat())).toEqual(["plain"]);
    expect(w2Slots(10, cat())).toEqual([]);
    expect(w2Slots(0, HELMET)).toEqual(["plain"]);
    expect(w2Slots(0, null)).toEqual(["plain"]);
    expect(w2Slots(10, null)).toEqual([]);
  });
  it("moves a photo to another place, the first being the cover", () => {
    expect(w2Move(["a", "b", "c", "d"], 2, 0)).toEqual(["c", "a", "b", "d"]);
    expect(w2Move(["a", "b", "c", "d"], 0, 3)).toEqual(["b", "c", "d", "a"]);
    expect(w2Move(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(w2Move(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});

describe("My listings", () => {
  const live = { status: "live" as const, renewable: false, commission_received: false, expires_at: "2027-01-10T00:00:00+00:00", sold_at: null };
  it("offers each state only what the database allows from it", () => {
    expect(w2Acts({ ...live, status: "draft" }, NOW)).toEqual(["continue", "delete"]);
    expect(w2Acts(live, NOW)).toEqual(["view", "sold", "reserve", "edit", "share", "delete"]);
    expect(w2Acts({ ...live, renewable: true }, NOW)[0]).toBe("renew");
    expect(w2Acts({ ...live, status: "reserved" }, NOW)).toEqual(["view", "sold", "unreserve", "edit", "share", "delete"]);
    expect(w2Acts({ ...live, status: "expired", renewable: true }, NOW)).toEqual(["repost", "edit", "delete"]);
  });
  it("lets a sale that fell through go back on sale, until the commission is ticked or the listing has run out", () => {
    const sold = { ...live, status: "sold" as const, sold_at: "2026-11-19T10:00:00+00:00" };
    expect(w2Acts(sold, NOW)).toEqual(["view", "unsold", "delete"]);
    expect(w2Acts({ ...sold, commission_received: true }, NOW)).toEqual(["view", "delete"]);
    expect(w2Acts({ ...sold, expires_at: "2026-11-01T00:00:00+00:00" }, NOW)).toEqual(["view", "delete"]);
    expect(w2Acts({ ...sold, sold_at: "2026-10-01T00:00:00+00:00" }, NOW)).toEqual(["unsold", "delete"]);
  });
  it("offers nothing on a listing our team is checking or has removed", () => {
    expect(w2Acts({ ...live, status: "held" }, NOW)).toEqual([]);
    expect(w2Acts({ ...live, status: "hidden", renewable: true }, NOW)).toEqual([]);
    expect(w2Acts({ ...live, status: "deleted" }, NOW)).toEqual([]);
  });
  it("asks the database for the right move", () => {
    expect(W2_STATE_OF).toEqual({ reserve: "reserved", unreserve: "live", unsold: "live", sold: "sold", renew: "renew", repost: "renew", delete: "deleted" });
  });
  it("groups the states for the chips, showing only the groups there are", () => {
    expect(MK_STATUSES.map(w2GroupOf)).toEqual(["draft", "live", "live", "live", "sold", "ended", "ended", "ended"]);
    expect(w2GroupsIn([{ status: "sold" }, { status: "held" }, { status: "draft" }])).toEqual(["live", "draft", "sold"]);
    expect(w2GroupsIn([])).toEqual([]);
  });
});

describe("this builder's words", () => {
  it("name every step, shot, fact, declaration, action and group, in English and Arabic", () => {
    for (const m of [T.en, T.ar]) {
      for (const s of W2_STEPS) expect(m.steps[s].trim(), s).toBeTruthy();
      for (const s of W2_SHOTS) expect(m.shots[s].trim(), s).toBeTruthy();
      for (const k of MK_FACT_KEYS) expect(m.facts[k].trim(), k).toBeTruthy();
      for (const k of MK_DECLARATIONS) expect(m.declare[k].trim(), k).toBeTruthy();
      for (const k of MK_FOR_WHOM) expect(m.forWhom[k].trim(), k).toBeTruthy();
      for (const g of W2_GROUPS) expect(m.groups[g].trim(), g).toBeTruthy();
      for (const a of ["continue", "edit", "reserve", "unreserve", "sold", "unsold", "renew", "repost", "share", "delete"] as const) expect(m.act[a].trim(), a).toBeTruthy();
      expect(Object.keys(m.need).sort()).toEqual(Object.keys(T.en.need).sort());
      expect(m.stepOf(2, 6)).toMatch(/2.*6/);
      expect(m.commissionOf("1", "⃁ 2,500")).toContain("1%");
    }
  });
  it("carry no emoji, write MicroMobility as it is written and name no other company", () => {
    const all = JSON.stringify([T.en, T.ar, T.en.needPhotos(3), T.ar.needPhotos(3), T.en.priceMax("x"), T.ar.priceMax("x"), T.en.endsIn(3), T.ar.endsIn(3)]);
    expect(all).not.toMatch(/[\u{1F000}-\u{1FAFF}☀-➿]/u);
    expect(all).not.toMatch(/Micromobility|micromobility|مايكروموبيليتي|WhatsApp|Instagram|Google/);
  });
  it("never promise what the site does not do: no money held, no protection, no refund", () => {
    const all = JSON.stringify([T.en, T.ar]).toLowerCase();
    for (const w of ["refund", "guarantee", "protect", "escrow", "we pay", "insur", "ضمان", "استرداد", "حماية"]) expect(all, w).not.toContain(w);
  });
});

/* ------------------------------------------------------------------ photos, by their bytes */

const seg = (marker: number, body: number[] | Uint8Array) => { const b = Array.from(body); const n = b.length + 2; return [0xff, marker, n >> 8, n & 0xff, ...b]; };
const txt = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));
const sof = (w: number, h: number) => seg(0xc0, [8, h >> 8, h & 0xff, w >> 8, w & 0xff, 1, 1, 0x11, 0]);
const SCAN = [...seg(0xda, [1, 1, 0, 0, 63, 0]), 0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0x78];
/** A JPEG as a camera writes one: JFIF, Exif with a place in it, XMP, a comment, then the picture and bytes after its end. */
function jpeg(o: { w?: number; h?: number; exif?: boolean; extras?: boolean; tail?: boolean; pad?: number } = {}): Uint8Array<ArrayBuffer> {
  return new Uint8Array([
    0xff, 0xd8,
    ...seg(0xe0, [...txt("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...(o.exif ? seg(0xe1, [...txt("Exif\0\0"), ...txt("GPSLatitude 21.5433 N")]) : []),
    ...(o.extras ? [...seg(0xe1, txt("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>home address</x:xmpmeta>")), ...seg(0xed, txt("Photoshop 3.0\0IPTC")), ...seg(0xfe, txt("taken on my phone")), ...seg(0xe2, txt("ICC_PROFILE\0profile")), ...seg(0xe2, txt("MPF\0second picture"))] : []),
    ...seg(0xdb, new Uint8Array(65)),
    ...sof(o.w ?? 1600, o.h ?? 1200),
    ...SCAN,
    ...(o.pad ? Array.from({ length: o.pad }, () => 0x11) : []),
    0xff, 0xd9,
    ...(o.tail ? txt("hidden after the end") : []),
  ]);
}
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
const chunk = (id: string, body: number[]) => [...txt(id), ...le32(body.length), ...body, ...(body.length & 1 ? [0] : [])];
function webp(o: { exif?: boolean; w?: number; h?: number; anim?: boolean } = {}): Uint8Array<ArrayBuffer> {
  const w = o.w ?? 480, h = o.h ?? 360;
  const vp8x = chunk("VP8X", [o.exif ? 0x0c : 0, 0, 0, 0, (w - 1) & 0xff, ((w - 1) >> 8) & 0xff, 0, (h - 1) & 0xff, ((h - 1) >> 8) & 0xff, 0]);
  const vp8 = chunk("VP8 ", [0x10, 0x00, 0x00, 0x9d, 0x01, 0x2a, w & 0xff, w >> 8, h & 0xff, h >> 8, 1, 2, 3]);
  const body = [...vp8x, ...(o.anim ? chunk("ANIM", [0, 0, 0, 0, 0, 0]) : []), ...vp8, ...(o.exif ? [...chunk("EXIF", txt("GPS 21.5 N")), ...chunk("XMP ", txt("<x:xmpmeta/>"))] : [])];
  return new Uint8Array([...txt("RIFF"), ...le32(4 + body.length), ...txt("WEBP"), ...body]);
}
const has = (b: Uint8Array, s: string) => new TextDecoder("latin1").decode(b).includes(s);

describe("a photo's bytes", () => {
  it("reads a JPEG's kind and size from the picture itself", () => {
    const p = w2Photo(jpeg({ w: 1600, h: 1067 }));
    expect(p).toMatchObject({ kind: "jpg", w: 1600, h: 1067, exif: false, dropped: 0 });
    expect(p?.clean).toEqual(jpeg({ w: 1600, h: 1067 }));
  });
  it("takes out everything a camera wrote beside the picture, and everything after its end", () => {
    const camera = jpeg({ exif: true, extras: true, tail: true });
    expect(mkHasExif(camera)).toBe(true);
    const p = w2Photo(camera);
    expect(p).toMatchObject({ kind: "jpg", w: 1600, h: 1200, exif: true, dropped: 5 });
    const clean = p?.clean ?? new Uint8Array();
    expect(mkHasExif(clean)).toBe(false);
    for (const gone of ["GPSLatitude", "xmpmeta", "home address", "IPTC", "taken on my phone", "second picture", "hidden after the end"]) expect(has(clean, gone), gone).toBe(false);
    // the colour profile and the picture's own data stay, byte for byte
    expect(has(clean, "ICC_PROFILE")).toBe(true);
    expect(mkImageKind(clean)).toBe("jpg");
    expect(Array.from(clean.slice(-2))).toEqual([0xff, 0xd9]);
    expect(w2Photo(clean)).toMatchObject({ w: 1600, h: 1200, exif: false, dropped: 0 });
    expect(w2Photo(clean)?.clean).toEqual(clean);
  });
  it("reads a WebP and takes its Exif and XMP chunks out, with the header saying so", () => {
    const p = w2Photo(webp({ exif: true }));
    expect(p).toMatchObject({ kind: "webp", w: 480, h: 360, exif: true, dropped: 2 });
    const clean = p?.clean ?? new Uint8Array();
    expect(has(clean, "EXIF") || has(clean, "XMP ") || has(clean, "GPS")).toBe(false);
    expect(clean[20] & 0x0c).toBe(0);
    expect(clean.length - 8).toBe(clean[4] | (clean[5] << 8) | (clean[6] << 16));
    expect(w2Photo(clean)).toMatchObject({ kind: "webp", w: 480, h: 360, exif: false, dropped: 0 });
    expect(w2Photo(webp())).toMatchObject({ exif: false, dropped: 0 });
  });
  it("is not a photo when it is anything else", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(w2Photo(png)).toBeNull();
    expect(w2Photo(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    expect(w2Photo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff]))).toBeNull(); // a segment longer than the file
    expect(w2Photo(new Uint8Array([...txt("<svg xmlns='http://www.w3.org/2000/svg'/>")]))).toBeNull();
    expect(w2Photo(webp({ anim: true }))).toBeNull();
    expect(w2Photo(new Uint8Array([0xff, 0xd8, ...seg(0xe0, txt("JFIF\0")), 0xff, 0xd9]))).toBeNull(); // no picture in it
    expect(w2Photo(new Uint8Array(0))).toBeNull();
  });
  it("takes a pair only when both copies are the same kind, clean, and inside their limits", () => {
    const pair = (a: Uint8Array, b: Uint8Array) => w2PairRefusal({ bytes: a.length, photo: w2Photo(a) }, { bytes: b.length, photo: w2Photo(b) });
    expect(pair(jpeg(), jpeg({ w: 480, h: 360 }))).toBeNull();
    expect(pair(jpeg(), webp())).toBe("invalid");
    expect(pair(jpeg({ exif: true }), jpeg({ w: 480, h: 360 }))).toBe("invalid");
    expect(pair(jpeg(), jpeg({ w: 480, h: 360, exif: true }))).toBe("invalid");
    expect(pair(jpeg({ w: 4000, h: 3000 }), jpeg({ w: 480, h: 360 }))).toBe("invalid");
    expect(pair(jpeg(), jpeg({ w: 1600, h: 1200 }))).toBe("invalid");
    expect(pair(jpeg({ pad: MK_PHOTO_BYTES }), jpeg({ w: 480, h: 360 }))).toBe("too_big");
    expect(pair(jpeg(), jpeg({ w: 480, h: 360, pad: MK_SMALL_BYTES }))).toBe("too_big");
    expect(pair(jpeg(), new Uint8Array(0))).toBe("invalid");
    expect(pair(new Uint8Array([1, 2, 3]), jpeg({ w: 480, h: 360 }))).toBe("invalid");
  });
});

/* ------------------------------------------------------------------ the routes */

describe("what a route takes", () => {
  it("only a listing's own keys, each of its shape", () => {
    const ok = { category: "cycling-bike-road", title: "Road bike", description: null, condition: "good", faults: null, price: 2500, negotiable: true, city: "jeddah", facts: { brand: "Canyon", year: 2022 }, serial: "WSBC-600123", declarations: { complete: true }, photos: [hex(1), hex(2)] };
    expect(w2BodyFields(ok)).toEqual(ok);
    expect(w2BodyFields({})).toEqual({});
    expect(w2BodyFields({ title: null, price: null, city: null, category: null, condition: null, serial: null })).toEqual({ title: null, price: null, city: null, category: null, condition: null, serial: null });
    const bad: unknown[] = [
      null, [], "x", { status: "live" }, { customer_id: "c2" }, { title: 5 }, { title: "x".repeat(401) }, { price: "2500" }, { price: 0 }, { price: 500_001 }, { price: 12.5 },
      { negotiable: "yes" }, { negotiable: null }, { city: "atlantis" }, { condition: "mint" }, { category: "Cycling Bikes" }, { category: "x" },
      { facts: [] }, { facts: { colour: "red" } }, { facts: { brand: { $ne: 1 } } }, { declarations: { complete: "yes" } }, { declarations: { other: true } },
      { photos: "x" }, { photos: [hex(1), hex(1)] }, { photos: ["/media/market/a.jpg"] }, { photos: ["s2/" + "0".repeat(32) + ".jpg"] }, { photos: ["../x.jpg"] },
      { photos: Array.from({ length: 11 }, (_, i) => hex(i)) },
    ];
    for (const b of bad) expect(w2BodyFields(b), JSON.stringify(b)).toBeNull();
  });
  it("a publish with its name, tick and rules version, and a state change with a price only for a sale", () => {
    expect(w2BodyPublish({ id: 7, nameMode: "short", consent: true, terms: "2026-11-21" })).toEqual({ id: 7, nameMode: "short", consent: true, terms: "2026-11-21" });
    expect(w2BodyPublish({ id: 7, nameMode: "none", consent: false })).toEqual({ id: 7, nameMode: "none", consent: false, terms: null });
    for (const b of [{ id: "7", nameMode: "short", consent: true }, { id: 7, nameMode: "full", consent: true }, { id: 7, nameMode: "short", consent: "yes" }, { id: 7, nameMode: "short", consent: true, terms: "a b" }, { id: 0, nameMode: "short", consent: true }]) {
      expect(w2BodyPublish(b), JSON.stringify(b)).toBeNull();
    }
    expect(w2BodyState({ id: 7, action: "sold", price: 2400 })).toEqual({ id: 7, action: "sold", price: 2400 });
    expect(w2BodyState({ id: 7, action: "renew" })).toEqual({ id: 7, action: "renew", price: null });
    expect(w2BodyState({ id: 7, action: "deleted", price: null })).toEqual({ id: 7, action: "deleted", price: null });
    for (const b of [{ id: 7, action: "sold" }, { id: 7, action: "sold", price: 0 }, { id: 7, action: "sold", price: "2400" }, { id: 7, action: "reserved", price: 5 }, { id: 7, action: "hide" }, { id: -1, action: "live" }]) {
      expect(w2BodyState(b), JSON.stringify(b)).toBeNull();
    }
  });
});

describe("the selling routes", () => {
  type Call = { url: string; body: unknown; method: string; type: string; bytes: Uint8Array | null };
  let calls: Call[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const stub = (answer: (c: Call) => Response) => {
    calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const raw = init?.body;
      const headers = new Headers(init?.headers);
      const c: Call = {
        url: String(url), method: init?.method ?? "GET", type: headers.get("content-type") ?? "",
        body: typeof raw === "string" ? JSON.parse(raw) : null, bytes: raw instanceof Uint8Array ? raw : null,
      };
      calls.push(c);
      return answer(c);
    }));
  };
  const SESSION = "c1~" + "a".repeat(32);
  const WHO = { p_id: "c1", p_token: "a".repeat(32) };
  const post = (path: string, body: unknown, o: { origin?: string | null; cookie?: string | null } = {}) =>
    new Request(`https://micromobility.sa/api/market/${path}`, {
      method: "POST",
      headers: { ...(o.origin === null ? {} : { origin: o.origin ?? "https://micromobility.sa" }), ...(o.cookie === null ? {} : { cookie: o.cookie ?? `mm_acct=${SESSION}` }), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const rpc = (name: string) => calls.filter((c) => c.url.endsWith(`/rpc/${name}`));
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("save a draft with the account's own id and token, never one the page sent", async () => {
    stub(() => json({ listing: mine(), purge: 0 }));
    const res = await savePost(post("listing/save", { id: null, fields: { title: "Canyon Endurace" }, p_id: "c2", p_token: "x".repeat(32) }));
    expect(await res.json()).toMatchObject({ ok: true, listing: { id: 7 }, purge: 0 });
    expect(calls.length).toBe(1);
    expect(calls[0].body).toEqual({ ...WHO, p_listing: null, p: { title: "Canyon Endurace" } });
    stub(() => json({ listing: mine(), purge: 0 }));
    await savePost(post("listing/save", { id: 7, fields: { photos: [hex(2), hex(1)], price: null } }));
    expect(calls[0].body).toEqual({ ...WHO, p_listing: 7, p: { photos: [hex(2), hex(1)], price: null } });
  });
  it("refuse a body that is not a listing's before the database is asked, and anyone who is not this site's signed-in page", async () => {
    stub(() => json({ listing: mine(), purge: 0 }));
    for (const body of [{ id: "7", fields: {} }, { id: 7 }, { id: 7, fields: { status: "live" } }, { id: 7, fields: { price: "free" } }, { id: 0, fields: {} }]) {
      const res = await savePost(post("listing/save", body));
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: "invalid" });
    }
    expect((await savePost(post("listing/save", { id: null, fields: {} }, { cookie: null }))).status).toBe(401);
    expect((await savePost(post("listing/save", { id: null, fields: {} }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await publishPost(post("listing/publish", { id: 7, nameMode: "short", consent: true }, { origin: null }))).status).toBe(403);
    expect((await statePost(post("listing/state", { id: 7, action: "deleted" }, { cookie: null }))).status).toBe(401);
    expect(calls.length).toBe(0);
  });
  it("pass a refusal on as its id and the word after its colon, never the database's own message", async () => {
    stub(() => json({ code: "P0001", message: "MKT_LINK: description", details: "internal", hint: "secret" }, 400));
    const link = await savePost(post("listing/save", { id: 7, fields: { description: "see www.example.com" } }));
    expect(link.status).toBe(400);
    expect(await link.json()).toEqual({ ok: false, error: "link", detail: "description" });
    stub(() => json({ code: "P0001", message: "MKT_LIMIT: drafts" }, 400));
    const cap = await savePost(post("listing/save", { id: null, fields: {} }));
    expect(cap.status).toBe(429);
    expect(await cap.json()).toEqual({ ok: false, error: "limit", detail: "drafts" });
    stub(() => json({ code: "P0001", message: "MKT_BIRTH" }, 400));
    expect(await (await savePost(post("listing/save", { id: null, fields: {} }))).json()).toEqual({ ok: false, error: "birth" });
    stub(() => new Response("upstream", { status: 503 }));
    const down = await savePost(post("listing/save", { id: 7, fields: { title: "x" } }));
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ ok: false, error: "generic" });
  });
  it("remove from the storage, behind the answer, a photo the seller took off the listing", async () => {
    stub((c) => (c.url.endsWith("/rpc/market_listing_save") ? json({ listing: mine({ photos: [hex(1)] }), purge: 2 })
      : c.url.endsWith("/rpc/market_purge_take") ? json({ names: [hex(2), hex(3)] }) : json([])));
    const res = await savePost(post("listing/save", { id: 7, fields: { photos: [hex(1)] } }));
    expect(await res.json()).toMatchObject({ ok: true, purge: 2 });
    await vi.waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    expect(calls.find((c) => c.method === "DELETE")).toMatchObject({ url: "https://example.supabase.co/storage/v1/object/market", body: { prefixes: [hex(2), hex(2).replace(".jpg", ".w480.jpg"), hex(3), hex(3).replace(".jpg", ".w480.jpg")] } });
    stub(() => json({ listing: mine(), purge: 0 }));
    await savePost(post("listing/save", { id: 7, fields: { title: "Same photos" } }));
    expect(calls.length).toBe(1);
  });
  it("publish a draft with the name the seller chose, the tick and the rules version the form showed", async () => {
    stub(() => json({ listing: mine({ status: "live", name_mode: "short", display_name: "Sara A." }) }));
    const res = await publishPost(post("listing/publish", { id: 7, nameMode: "short", consent: true, terms: "2026-11-21" }));
    expect(await res.json()).toMatchObject({ ok: true, listing: { status: "live", display_name: "Sara A." } });
    expect(calls[0].url).toBe("https://example.supabase.co/rest/v1/rpc/market_listing_publish");
    expect(calls[0].body).toEqual({ ...WHO, p_listing: 7, p_name_mode: "short", p_consent: true, p_terms: "2026-11-21" });
    for (const [message, error, status, detail] of [["MKT_NEW_ONLY", "new_only", 400, undefined], ["MKT_DECLARE", "declare", 400, undefined], ["MKT_SERIAL", "serial", 400, undefined], ["MKT_PHOTOS", "photos", 400, undefined],
      ["MKT_PRICE", "price", 403, undefined], ["MKT_LIMIT: live", "limit", 429, "live"], ["MKT_ADULT", "adult", 403, undefined], ["MKT_SUSPENDED", "suspended", 403, undefined], ["MKT_TERMS", "terms", 409, undefined]] as const) {
      stub(() => json({ code: "P0001", message }, 400));
      const no = await publishPost(post("listing/publish", { id: 7, nameMode: "none", consent: true, terms: null }));
      expect(no.status, message).toBe(status);
      expect(await no.json(), message).toEqual({ ok: false, error, ...(detail ? { detail } : {}) });
    }
    stub(() => json({}));
    expect((await publishPost(post("listing/publish", { id: 7, nameMode: "anon", consent: true }))).status).toBe(400);
    expect(calls.length).toBe(0);
  });
  it("mark a listing sold with its price and hand the commission to the page as the database worked it out", async () => {
    const commission = { pct: 1, due: 24, how_en: "Pay at the hub desk.", how_ar: "ادفع عند مكتب المقر." };
    stub(() => json({ listing: mine({ status: "sold", sold_price: 2400, commission_pct: 1, commission_due: 24 }), commission, purge: 0 }));
    const res = await statePost(post("listing/state", { id: 7, action: "sold", price: 2400 }));
    expect(await res.json()).toMatchObject({ ok: true, listing: { status: "sold", sold_price: 2400 }, commission });
    expect(calls[0].body).toEqual({ ...WHO, p_listing: 7, p_action: "sold", p_price: 2400 });
    stub(() => json({ listing: mine({ status: "reserved" }), commission: null, purge: 0 }));
    expect(await (await statePost(post("listing/state", { id: 7, action: "reserved" }))).json()).toMatchObject({ ok: true, commission: null });
    expect(calls[0].body).toEqual({ ...WHO, p_listing: 7, p_action: "reserved", p_price: null });
    stub(() => json({}));
    for (const body of [{ id: 7, action: "sold" }, { id: 7, action: "sold", price: 0 }, { id: 7, action: "live", price: 10 }, { id: 7, action: "approve" }]) {
      expect((await statePost(post("listing/state", body))).status, JSON.stringify(body)).toBe(400);
    }
    expect(calls.length).toBe(0);
    stub((c) => (c.url.endsWith("/rpc/market_listing_state") ? json({ listing: mine({ status: "deleted", photos: [] }), commission: null, purge: 3 }) : c.url.endsWith("/rpc/market_purge_take") ? json({ names: [] }) : json([])));
    expect(await (await statePost(post("listing/state", { id: 7, action: "deleted" }))).json()).toMatchObject({ ok: true, purge: 3 });
    await vi.waitFor(() => expect(rpc("market_purge_take").length).toBe(1));
  });
  it("list the account's own listings to its own page only", async () => {
    stub(() => json({ items: [mine()], limits: { live: 10, live_used: 0, drafts: 10, drafts_used: 1 } }));
    const res = await mineGet(new Request("https://micromobility.sa/api/market/listing/mine", { headers: { cookie: `mm_acct=${SESSION}` } }));
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.json()).toMatchObject({ ok: true, items: [{ id: 7 }], limits: { drafts_used: 1 } });
    expect(calls[0].body).toEqual(WHO);
    const out = await mineGet(new Request("https://micromobility.sa/api/market/listing/mine"));
    expect(out.status).toBe(401);
    expect(calls.length).toBe(1);
  });

  const NAME = `l7/${"ab".repeat(16)}.jpg`;
  const upload = (parts: Record<string, string | Uint8Array<ArrayBuffer> | null>, o: { origin?: string | null; cookie?: string | null; length?: string } = {}) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(parts)) {
      if (v === null) continue;
      if (typeof v === "string") form.set(k, v); else form.set(k, new Blob([v], { type: "text/plain" }), "anything.exe");
    }
    return new Request("https://micromobility.sa/api/market/photo", {
      method: "POST", body: form,
      headers: { ...(o.origin === null ? {} : { origin: o.origin ?? "https://micromobility.sa" }), ...(o.cookie === null ? {} : { cookie: o.cookie ?? `mm_acct=${SESSION}` }), ...(o.length ? { "content-length": o.length } : {}) },
    });
  };
  const storage = (c: Call) => (c.url.endsWith("/rpc/market_photo_slot") ? json({ name: NAME, small: NAME.replace(".jpg", ".w480.jpg"), expires_at: "2026-11-20T12:10:00+00:00" }) : json({ Key: "ok" }));
  const SMALL = jpeg({ w: 480, h: 360 });

  it("store a photo's two copies at the name the database issued, by what the bytes are and not what they are called", async () => {
    stub(storage);
    const res = await photoPost(upload({ for: "listing", ref: "7", full: jpeg({ extras: true, tail: true }), small: SMALL }));
    expect(await res.json()).toEqual({ ok: true, name: NAME });
    expect(calls.map((c) => c.url)).toEqual([
      "https://example.supabase.co/rest/v1/rpc/market_photo_slot",
      `https://example.supabase.co/storage/v1/object/market/${NAME}`,
      `https://example.supabase.co/storage/v1/object/market/${NAME.replace(".jpg", ".w480.jpg")}`,
    ]);
    expect(calls[0].body).toEqual({ ...WHO, p_for: "listing", p_ref: 7, p_ext: "jpg" });
    expect(calls[1].type).toBe("image/jpeg");
    // what is stored is the picture without what described it
    const stored = calls[1].bytes ?? new Uint8Array();
    for (const gone of ["xmpmeta", "home address", "IPTC", "taken on my phone", "hidden after the end"]) expect(has(stored, gone), gone).toBe(false);
    expect(w2Photo(stored)).toMatchObject({ kind: "jpg", w: 1600, h: 1200, dropped: 0 });
    expect(calls[2].bytes).toEqual(SMALL);
  });
  it("store a shop's logo for the account's own shop, and a WebP as a WebP", async () => {
    const logo = `s3/${"cd".repeat(16)}.webp`;
    stub((c) => (c.url.endsWith("/rpc/market_photo_slot") ? json({ name: logo, small: logo.replace(".webp", ".w480.webp"), expires_at: "x" }) : json({ Key: "ok" })));
    const res = await photoPost(upload({ for: "shop", ref: "", full: webp({ w: 1200, h: 1200 }), small: webp() }));
    expect(await res.json()).toEqual({ ok: true, name: logo });
    expect(calls[0].body).toEqual({ ...WHO, p_for: "shop", p_ref: null, p_ext: "webp" });
    expect(calls[1].type).toBe("image/webp");
  });
  it("write nothing and ask the database nothing until the session and the photo are checked", async () => {
    stub(storage);
    const good = { for: "listing", ref: "7", full: jpeg(), small: SMALL };
    expect((await photoPost(upload(good, { cookie: null }))).status).toBe(401);
    expect((await photoPost(upload(good, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await photoPost(upload(good, { origin: null }))).status).toBe(403);
    const cases: [Record<string, string | Uint8Array<ArrayBuffer> | null>, number][] = [
      [{ ...good, full: jpeg({ exif: true }) }, 400],                                  // a camera's own file, not drawn again
      [{ ...good, small: jpeg({ w: 480, h: 360, exif: true }) }, 400],
      [{ ...good, full: webp({ w: 1200, h: 900, exif: true }), small: webp() }, 400],
      [{ ...good, full: new Uint8Array([...txt("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>")]) }, 400],
      [{ ...good, full: new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 1, 2, 3, 4, 5, 6, 7, 8]) }, 400],
      [{ ...good, small: webp() }, 400],                                               // the two copies of different kinds
      [{ ...good, full: jpeg({ w: 4032, h: 3024 }) }, 400],                            // not shrunk
      [{ ...good, small: jpeg() }, 400],
      [{ ...good, full: null }, 400], [{ ...good, small: null }, 400],
      [{ ...good, small: "not a file" }, 400],
      [{ ...good, for: "avatar" }, 400], [{ ...good, for: null }, 400],
      [{ ...good, ref: "7; drop" }, 400], [{ ...good, ref: "" }, 400], [{ ...good, ref: null }, 400],
      [{ ...good, for: "shop", ref: "7" }, 400],
      [{ ...good, full: jpeg({ pad: MK_PHOTO_BYTES }) }, 413],
      [{ ...good, small: jpeg({ w: 480, h: 360, pad: MK_SMALL_BYTES }) }, 413],
    ];
    for (const [parts, status] of cases) {
      const res = await photoPost(upload(parts));
      expect(res.status, JSON.stringify(Object.keys(parts))).toBe(status);
      expect((await res.json()).ok).toBe(false);
    }
    // a body past the limit is not read to its end, whatever its length header says
    expect((await photoPost(upload(good, { length: "5000000" }))).status).toBe(413);
    expect((await photoPost(upload({ ...good, full: jpeg({ pad: 1_100_000 }) }))).status).toBe(413);
    const notForm = new Request("https://micromobility.sa/api/market/photo", { method: "POST", body: JSON.stringify(good), headers: { origin: "https://micromobility.sa", cookie: `mm_acct=${SESSION}`, "content-type": "application/json" } });
    expect((await photoPost(notForm)).status).toBe(400);
    expect(calls.length).toBe(0);
  });
  it("store nothing when the database issues no name, and say so when the storage keeps nothing", async () => {
    const good = { for: "listing", ref: "7", full: jpeg(), small: SMALL };
    for (const [message, error, status, detail] of [["MKT_GONE", "gone", 404, undefined], ["MKT_STATE", "state", 409, undefined], ["MKT_SUSPENDED", "suspended", 403, undefined], ["MKT_LIMIT: photos", "limit", 429, "photos"]] as const) {
      stub(() => json({ code: "P0001", message }, 400));
      const res = await photoPost(upload(good));
      expect(res.status, message).toBe(status);
      expect(await res.json()).toEqual({ ok: false, error, ...(detail ? { detail } : {}) });
      expect(calls.length).toBe(1);
    }
    stub((c) => (c.url.endsWith("/rpc/market_photo_slot") ? storage(c) : new Response("no", { status: 403 })));
    const refused = await photoPost(upload(good));
    expect(refused.status).toBe(502);
    expect(await refused.json()).toEqual({ ok: false, error: "generic" });
    expect(calls.length).toBe(2); // the full copy was refused: the small one is not sent
    // the small copy is tried once more before the photo is given up
    let smallTries = 0;
    stub((c) => { if (c.url.includes(".w480.")) { smallTries += 1; return smallTries === 1 ? new Response("busy", { status: 503 }) : json({ Key: "ok" }); } return storage(c); });
    expect(await (await photoPost(upload(good))).json()).toEqual({ ok: true, name: NAME });
    expect(smallTries).toBe(2);
    // a name of another kind than the photo is never stored under
    stub((c) => (c.url.endsWith("/rpc/market_photo_slot") ? json({ name: NAME.replace(".jpg", ".webp"), small: "x", expires_at: "x" }) : json({ Key: "ok" })));
    expect((await photoPost(upload(good))).status).toBe(502);
    expect(calls.length).toBe(1);
    // nor a name under another listing than the one asked for, nor a listing's name for a shop's logo
    stub((c) => (c.url.endsWith("/rpc/market_photo_slot") ? json({ name: NAME.replace("l7/", "l70/"), small: "x", expires_at: "x" }) : json({ Key: "ok" })));
    expect((await photoPost(upload(good))).status).toBe(502);
    expect(calls.length).toBe(1);
    stub(storage);
    expect((await photoPost(upload({ ...good, for: "shop", ref: "" }))).status).toBe(502);
    expect(calls.length).toBe(1);
  });
});

/* ------------------------------------------------------------------ how the screens ask the routes */

describe("asking the site's own routes", () => {
  type Init = RequestInit & { keepalive?: boolean };
  let asked: { url: string; init: Init }[] = [];
  const answer = (make: () => Response | Promise<Response>) => {
    asked = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init: Init = {}) => { asked.push({ url: String(url), init }); return Promise.resolve().then(make); }));
  };
  const body = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("hands a route's answer on as it is, and a refusal as its id and word", async () => {
    answer(() => body({ ok: true, items: [{ id: 7 }] }));
    expect(await w2Get<{ items: { id: number }[] }>("/api/market/listing/mine")).toEqual({ ok: true, items: [{ id: 7 }] });
    expect(asked[0]).toMatchObject({ url: "/api/market/listing/mine", init: { cache: "no-store", credentials: "same-origin" } });
    answer(() => body({ ok: false, error: "limit", detail: "drafts" }, 429));
    expect(await w2Post("/api/market/listing/save", { id: null, fields: {} })).toEqual({ ok: false, error: "limit", detail: "drafts" });
    expect(asked[0].init).toMatchObject({ method: "POST", body: JSON.stringify({ id: null, fields: {} }), credentials: "same-origin" });
    answer(() => body({ ok: false, error: "birth" }, 409));
    expect(await w2PostForm("/api/market/photo", new FormData())).toEqual({ ok: false, error: "birth", detail: "" });
  });
  it("reads no answer, a page that is not JSON and an answer of no known shape as the one refusal with words", async () => {
    const generic = { ok: false, error: "generic", detail: "" };
    answer(() => new Response("<html>502</html>", { status: 502 }));
    expect(await w2Get("/api/market/me")).toEqual(generic);
    answer(() => body({ message: "something else" }, 500));
    expect(await w2Post("/api/market/listing/state", { id: 7, action: "renew" })).toEqual(generic);
    answer(() => { throw new TypeError("Failed to fetch"); });
    expect(await w2Post("/api/market/listing/state", { id: 7, action: "renew" })).toEqual(generic);
  });
  it("gives a request up after its time with a timer every browser has, and lets one that outlives the page run", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, init: Init = {}) => new Promise<Response>((_yes, no) => {
      signal = init.signal;
      signal?.addEventListener("abort", () => no(new DOMException("given up", "AbortError")));
    })));
    const waiting = w2Get("/api/market/listing/mine");
    await vi.advanceTimersByTimeAsync(19_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    expect(await waiting).toEqual({ ok: false, error: "generic", detail: "" });
    vi.useRealTimers();
    // the save sent as the page is put away: kept alive by the browser, never cut short by the page
    answer(() => body({ ok: true, listing: { id: 7 } }));
    expect(await w2Post("/api/market/listing/save", { id: 7, fields: { title: "x" } }, true)).toMatchObject({ ok: true });
    expect(asked[0].init.keepalive).toBe(true);
    expect(asked[0].init.signal).toBeUndefined();
    // AbortSignal.timeout is not in Safari before 16: calling it there would fail every request before it was sent
    for (const f of ["api.ts", "photo-client.ts", "SellApp.tsx", "SellForm.tsx", "PhotoGrid.tsx", "MyListings.tsx", "ShareButton.tsx"]) {
      expect(readFileSync(fileURLToPath(new URL(`../../components/market/w2/${f}`, import.meta.url)), "utf8"), f).not.toMatch(/AbortSignal\.timeout\(/);
    }
  });
});

/* ------------------------------------------------------------------ the pages and the styles, read as text */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

describe("the selling pages", () => {
  const pages = ["app/[locale]/marketplace/sell/page.tsx", "app/[locale]/marketplace/sell/[id]/page.tsx", "app/[locale]/marketplace/mine/page.tsx"];
  it("are the account's own: behind the sign-in, read for the cookie's session, never in a search engine", () => {
    for (const p of pages) {
      const src = read(p);
      expect(src, p).toContain("<MkGate locale={locale} session={session}>");
      expect(src, p).toContain("mkSession()");
      expect(src, p).toContain("noindex: true");
      expect(src, p).toContain('import "@/components/market/w2.css"');
      expect(src, p).toContain("marketSite(locale)");
    }
    expect(read(pages[1])).toContain("notFound()");
  });
  it("keep the server's own code out of the browser's", () => {
    for (const f of ["SellApp.tsx", "SellForm.tsx", "PhotoGrid.tsx", "MyListings.tsx", "ShareButton.tsx", "ConfirmDelete.tsx", "photo-client.ts", "api.ts", "say.ts"]) {
      const src = read(`components/market/w2/${f}`);
      expect(src, f).not.toMatch(/lib\/market\/(server|route|w2-server)|from "@\/lib\/account"|supabase/i);
    }
    for (const f of ["lib/market/w2.ts", "lib/market/w2-photo.ts"]) expect(read(f), f).not.toMatch(/from "\.\/(server|route|w2-server)"|next\/headers|cloudflare/);
  });
  it("lead into the form from a plain link", () => {
    const src = read("components/market/SellLink.tsx");
    expect(src).toContain("href={MK_SELL}");
    expect(src).not.toContain("use client");
    expect(src).not.toContain("placeholder");
  });
  it("write no line under a choice or beside a chip beyond the ones the build names", () => {
    // the condition's definitions are the only lines written inside an option: "No name" stands alone
    expect(read("components/market/w2/SellForm.tsx").match(/className="mk-w2-def"/g)?.length).toBe(1);
    // a held or removed listing's chip already says which it is: one line for a held one, staff's reason for a removed one
    const mineSrc = read("components/market/w2/MyListings.tsx");
    expect(mineSrc.match(/className="mk-w2-note"/g)?.length).toBe(1);
    expect(Object.keys(T.en)).not.toEqual(expect.arrayContaining(["heldNote"]));
    expect(Object.keys(T.en)).not.toEqual(expect.arrayContaining(["hiddenNote"]));
  });
  it("open every pop-up centred, through the one pop-up the Marketplace has", () => {
    for (const f of ["MyListings.tsx", "ConfirmDelete.tsx"]) expect(read(`components/market/w2/${f}`), f).toContain("<MkModal ");
    for (const f of ["SellApp.tsx", "SellForm.tsx", "PhotoGrid.tsx", "MyListings.tsx", "ShareButton.tsx", "ConfirmDelete.tsx"]) {
      expect(read(`components/market/w2/${f}`), f).not.toMatch(/role="dialog"|<dialog|window\.(alert|confirm|prompt)\(/);
    }
  });
});

describe("this builder's styles", () => {
  const css = read("components/market/w2.css").replace(/\/\*[\s\S]*?\*\//g, "");
  it("mirror in Arabic: logical properties only", () => {
    expect(css).not.toMatch(/(?:margin|padding|border)-(?:left|right)\b|(?:^|[\s;{])(?:left|right)\s*:|text-align\s*:\s*(?:left|right)|float\s*:/m);
  });
  it("pin nothing to the screen: no bar at the bottom, no sheet", () => {
    expect(css).not.toMatch(/position\s*:\s*(?:fixed|sticky)/);
  });
  it("define only this builder's own classes, and name a token for every colour that has one", () => {
    // each selector of each rule (a comma inside :is(...) does not part two selectors)
    const own = [...css.matchAll(/(?:^|\})\s*([^{}@]+)\{/g)].flatMap((m) => m[1].split(/,(?![^()]*\))/)).map((s) => s.trim()).filter(Boolean);
    for (const sel of own) expect(sel, sel).toMatch(/mk-w2-|^(?:from|to)$/);
    expect(css).not.toMatch(/#(?!fff\b)[0-9a-fA-F]{3,8}\b/);
  });
  it("keep every tap target at 44px or more", () => {
    for (const cls of ["mk-w2-ib", "mk-w2-grip", "mk-w2-act", "mk-w2-opt", "mk-w2-slot"]) {
      const rule = new RegExp(`\\.${cls}\\s*\\{[^}]*`).exec(css)?.[0] ?? "";
      const sizes = [...rule.matchAll(/(?:min-)?height\s*:\s*(\d+)px/g)].map((m) => Number(m[1]));
      expect(Math.max(0, ...sizes), cls).toBeGreaterThanOrEqual(44);
    }
  });
});
