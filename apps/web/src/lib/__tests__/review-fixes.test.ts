import { describe, expect, it, vi } from "vitest";
import { fieldValue } from "../content";
import { toPosts } from "../journal";
import { isStaffToken } from "../preview";
import { normalizePhone } from "../rpc-client";
import { toSession } from "../rides";
import type { ItemField } from "@/content/types";

// The fixes from the 2026-09-25 review of the website.

describe("normalizePhone, as the booking app reads a mobile", () => {
  it("drops direction marks from RTL contacts, reads Persian digits, and the trunk 0 after +966", () => {
    expect(normalizePhone("‪0551234567‬")).toBe("+966551234567");
    expect(normalizePhone("۰۵۵۱۲۳۴۵۶۷")).toBe("+966551234567");
    expect(normalizePhone("+966 055 123 4567")).toBe("+966551234567");
    expect(normalizePhone("00966 0551234567")).toBe("+966551234567");
    expect(normalizePhone("+966551234567")).toBe("+966551234567");
  });
});

describe("fields staff may clear, and fields with one value in every language", () => {
  const link: ItemField = { id: "x", type: "link", optional: true, label: { en: "", ar: "" }, def: "https://x.com/micromobilitysa" };
  const cr: ItemField = { id: "cr", type: "text", max: 40, optional: true, mono: true, label: { en: "", ar: "" }, def: { en: "1009107240", ar: "1009107240" } };
  const phone: ItemField = { id: "phone", type: "text", max: 24, mono: true, label: { en: "", ar: "" }, def: { en: "+966500000000", ar: "+966500000000" } };
  it("an optional link saved empty is left out; one never saved keeps its default", () => {
    expect(fieldValue(link, { href: "" }, "en")).toBe("");
    expect(fieldValue(link, undefined, "en")).toBe("https://x.com/micromobilitysa");
  });
  it("a single value typed in one box shows on both pages; cleared, an optional one hides", () => {
    expect(fieldValue(phone, { en: "+966511111111", ar: "" }, "ar")).toBe("+966511111111");
    expect(fieldValue(phone, { en: "", ar: "+966522222222" }, "en")).toBe("+966522222222");
    expect(fieldValue(cr, { en: "", ar: "" }, "ar")).toBe("");
    expect(fieldValue(cr, undefined, "ar")).toBe("1009107240");
  });
});

describe("Journal addresses", () => {
  const item = (title: string, x: Record<string, unknown> = {}) => ({ title, body: "Text", date: "2026-09-01", show: true, ...x });
  it("an article keeps its address in both languages and when another is published", () => {
    const en = [item("Ride recap"), item("Ride recap")];
    const ar = [item(""), item("ملخص")]; // #1 untranslated
    expect(toPosts(ar, en).map((p) => p.slug)).toEqual(["ride-recap-2"]);
    expect(toPosts(en, en).map((p) => p.slug).sort()).toEqual(["ride-recap", "ride-recap-2"]);
    const hidden = [item("News", { show: false }), item("News")];
    expect(toPosts(hidden, hidden).map((p) => p.slug)).toEqual(["news-2"]);
  });
  it("a numbered address never collides with a real one", () => {
    const en = [item("News"), item("News"), item("News 2")];
    expect(new Set(toPosts(en, en).map((p) => p.slug)).size).toBe(3);
  });
  it("reads a date typed in Arabic digits", () => {
    expect(toPosts([item("A", { date: "٢٠٢٦-١٠-٠١" })], [item("A")])[0].date).toBe("2026-10-01");
  });
});

describe("the staff preview check", () => {
  it("does not cache a timeout or a server error as \"not staff\"", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    const down = vi.fn(async () => new Response("oops", { status: 503 }));
    expect(await isStaffToken("aaa.bbb.review1", down as unknown as typeof fetch, 0)).toBe(false);
    const up = vi.fn(async () => new Response("true", { status: 200, headers: { "content-type": "application/json" } }));
    expect(await isStaffToken("aaa.bbb.review1", up as unknown as typeof fetch, 1000)).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("a booked session is named whatever its state", () => {
  it("keeps a Petromin night or a closed one when asked to", () => {
    const row = { id: "2026-09-30-pw", session_date: "2026-09-30", status: "closed", event_kind: "community", ride_kind: "petromin", title: null, bike_slots: null, open_to_all: false, paid_ride: true };
    expect(toSession(row)).toBeNull();
    expect(toSession(row, true)).toMatchObject({ id: "2026-09-30-pw", kind: "petromin" });
  });
});
