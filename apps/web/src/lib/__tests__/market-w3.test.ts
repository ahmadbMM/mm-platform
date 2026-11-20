import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// @ts-expect-error - @types/react-dom is not installed; the server renderer is plain JavaScript here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import UnreadBadge from "@/components/market/UnreadBadge";
import { T as BADGE } from "@/components/market/w3/badge.text";
import { T as W } from "@/components/market/w3.text";
import { T as S } from "@/components/market/Market.text";
import { POST as blockPost } from "../../app/api/market/block/route";
import { POST as shopPost } from "../../app/api/market/contact/shop/route";
import { POST as reportPost } from "../../app/api/market/report/route";
import { GET as threadGet } from "../../app/api/market/thread/get/route";
import { GET as threadList } from "../../app/api/market/thread/list/route";
import { POST as threadOpen } from "../../app/api/market/thread/open/route";
import { POST as threadSend } from "../../app/api/market/thread/send/route";
import { POST as waPost } from "../../app/api/market/thread/whatsapp/route";
import { GET as unreadGet } from "../../app/api/market/unread/route";
import { fmtPattern } from "../date-pattern";
import { MK_REPORT_REASONS, type MkMessage, type MkOther } from "../market/core";
import {
  INBOX_POLL_MS, MK_CONTACT_HASH, UNREAD_POLL_MS, bodyProblem, companyWaHref, contactMode, dayStarts, isShopSlug, isToday, lastId, listingMark,
  mapHref, mergeMessages, mkReply, nameModes, onSale, otherName, phoneShown, pollDelay, quickReplies, reportBackHref, reportReasons, riyadhDay,
  sendOutcome, signInHref, telHref, threadListingHref, unreadText,
} from "../market/w3";
import { inboxFmt } from "../market/w3-fmt";

// The Marketplace's contact side (W3): the plain rules of the Contact button, the first message, the inbox, a thread,
// a report, a shop's contact buttons and the unread number, and its nine routes. Nothing is read or written anywhere:
// every database call is a stub.

const render = renderUntyped as (el: ReactElement) => string;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const SESSION = "c1~" + "a".repeat(32);
const SITE = "https://micromobility.sa";
const post = (path: string, body: unknown, o: { origin?: string | null; cookie?: string | null } = {}) =>
  new Request(`${SITE}${path}`, {
    method: "POST",
    headers: { ...(o.origin === null ? {} : { origin: o.origin ?? SITE }), ...(o.cookie === null ? {} : { cookie: o.cookie ?? `mm_acct=${SESSION}` }), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const get = (path: string, cookie: string | null = `mm_acct=${SESSION}`) => new Request(`${SITE}${path}`, { headers: cookie ? { cookie } : {} });
const msg = (id: number, at = "2026-11-20T10:00:00+00:00", mine = false, body = `m${id}`): MkMessage => ({ id, mine, body, at });

describe("a route's answer in the browser", () => {
  it("passes an ok answer through and reads everything else as a refusal", () => {
    expect(mkReply<{ n: number }>({ ok: true, n: 3 })).toEqual({ ok: true, n: 3 });
    expect(mkReply({ ok: false, error: "limit", detail: "wait" })).toEqual({ ok: false, error: "limit", detail: "wait" });
    expect(mkReply({ ok: false, error: "blocked" })).toEqual({ ok: false, error: "blocked", detail: "" });
  });
  it("reads an unknown error, a broken body and no answer as generic", () => {
    for (const raw of [null, undefined, "x", [], {}, { ok: false, error: "MKT_GONE" }, { ok: "yes" }]) {
      expect(mkReply(raw)).toEqual({ ok: false, error: "generic", detail: "" });
    }
  });
});

describe("the Contact button", () => {
  const base = { kind: "private" as const, signedIn: true, threadId: null, canMessage: true };
  it("opens the first-message pop-up for a signed-in buyer who can write", () => {
    expect(contactMode(base)).toBe("write");
    expect(contactMode({ ...base, kind: "shop" })).toBe("write");
  });
  it("sends a visitor with no account to sign in, and brings them back to the listing with the pop-up's mark", () => {
    expect(contactMode({ ...base, signedIn: false })).toBe("signin");
    const href = signInHref(`/marketplace/12${MK_CONTACT_HASH}`);
    expect(href.startsWith("/account?next=")).toBe(true);
    expect(decodeURIComponent(href.split("next=")[1])).toBe("/marketplace/12#mk-contact");
  });
  it("leads a buyer who already wrote to their conversation, even once the listing is gone", () => {
    expect(contactMode({ ...base, threadId: 7 })).toBe("thread");
    expect(contactMode({ ...base, threadId: 7, canMessage: false })).toBe("thread");
  });
  it("draws nothing when no message can be sent", () => {
    expect(contactMode({ ...base, canMessage: false })).toBe("none");
    expect(contactMode({ ...base, signedIn: false, canMessage: false })).toBe("none");
  });
  it("is a link to My listings on the reader's own listing", () => {
    expect(contactMode({ ...base, canMessage: false, mine: true })).toBe("mine");
    expect(contactMode({ ...base, kind: "shop", mine: true })).toBe("mine");
  });
  it("is MicroMobility's WhatsApp for its own listing, for anyone, and nothing when no number is set", () => {
    expect(contactMode({ kind: "company", signedIn: false, threadId: null, canMessage: false, companyWa: "966566668818" })).toBe("company");
    expect(contactMode({ kind: "company", signedIn: true, threadId: null, canMessage: false, companyWa: null })).toBe("none");
    expect(contactMode({ kind: "company", signedIn: true, threadId: null, canMessage: false, companyWa: "12" })).toBe("none");
  });
  it("names the item and gives its address in MicroMobility's WhatsApp message", () => {
    const href = companyWaHref("966566668818", W.en.waCompany("Trek Domane 54"), 31, "https://micromobility.sa/");
    expect(href).toBe(`https://wa.me/966566668818?text=${encodeURIComponent("Hello MicroMobility, I am asking about this item on the Marketplace: Trek Domane 54\nhttps://micromobility.sa/marketplace/31")}`);
    expect(companyWaHref(null, "x", 31, SITE)).toBeNull();
  });
});

describe("names", () => {
  it("offers first name and last initial only when the account has a name", () => {
    expect(nameModes("Sara A.")).toEqual(["short", "none"]);
    expect(nameModes(null)).toEqual(["none"]);
    expect(nameModes("  ")).toEqual(["none"]);
  });
  it("shows the other person by the name they chose, and nothing more", () => {
    const words = { buyer: "Buyer", seller: "Private seller" };
    const o = (x: Partial<MkOther>): MkOther => ({ kind: "buyer", name: null, shop: null, ...x });
    expect(otherName(o({ name: "Sara A." }), "en", words)).toBe("Sara A.");
    expect(otherName(o({}), "en", words)).toBe("Buyer");
    expect(otherName(o({ kind: "private" }), "en", words)).toBe("Private seller");
    expect(otherName(o({ kind: "private", name: "Omar K." }), "ar", words)).toBe("Omar K.");
    const shop = { slug: "wheel-house", name_en: "Wheel House", name_ar: "بيت العجلات", logo: null };
    expect(otherName(o({ kind: "shop", shop }), "en", words)).toBe("Wheel House");
    expect(otherName(o({ kind: "shop", shop }), "ar", words)).toBe("بيت العجلات");
    expect(otherName(o({ kind: "shop", shop: { ...shop, name_ar: null } }), "ar", words)).toBe("Wheel House");
  });
});

describe("quick replies", () => {
  it("gives a buyer questions and a seller answers", () => {
    expect(quickReplies("buyer", false)).toEqual(["q_available", "q_see", "q_price"]);
    expect(quickReplies("seller", false)).toEqual(["q_yes", "q_when", "q_sold"]);
  });
  it("offers the MicroMobility hub on a Jeddah listing only", () => {
    expect(quickReplies("buyer", true)).toContain("q_hub");
    expect(quickReplies("seller", true)).toContain("q_hub");
    expect(quickReplies("buyer", false)).not.toContain("q_hub");
    expect(W.en.q_hub).toBe("Can we meet at the MicroMobility hub?");
  });
  it("has words for every quick reply and never a link or a phone number in them", () => {
    for (const lang of [W.en, W.ar]) {
      for (const k of [...quickReplies("buyer", true), ...quickReplies("seller", true)]) {
        expect(lang[k].length).toBeGreaterThan(3);
        expect(bodyProblem(lang[k])).toBeNull();
      }
    }
  });
});

describe("a message before it is sent", () => {
  it("lets ordinary words through", () => {
    expect(bodyProblem("Is this still available?")).toBeNull();
    expect(bodyProblem("هل ما زال متوفراً؟ السعر 2500")).toBeNull();
  });
  it("finds nothing to send, as the database would after cleaning", () => {
    expect(bodyProblem("")).toBe("empty");
    expect(bodyProblem("  \n ")).toBe("empty");
  });
  it("refuses a message over 1,000 characters", () => {
    expect(bodyProblem("a".repeat(1000))).toBeNull();
    expect(bodyProblem("a".repeat(1001))).toBe("long");
  });
  it("refuses a link", () => {
    expect(bodyProblem("see https://example.com/x")).toBe("link");
    expect(bodyProblem("my page is shop.example.com")).toBe("link");
  });
  it("refuses a phone number, in Western or Arabic digits", () => {
    expect(bodyProblem("call me 0501234567")).toBe("phone");
    expect(bodyProblem("+966 50 123 4567")).toBe("phone");
    expect(bodyProblem("رقمي ٠٥٠١٢٣٤٥٦٧")).toBe("phone");
  });
});

describe("a message the route refused", () => {
  it("gives the words back to be changed when the words were the problem", () => {
    for (const e of ["link", "phone", "input", "too_big"] as const) expect(sendOutcome(e)).toBe("edit");
  });
  it("keeps it with Try again when it may go through later", () => {
    for (const e of ["generic", "busy", "limit", "origin", "invalid", "absent"] as const) expect(sendOutcome(e)).toBe("retry");
  });
  it("closes the box when nothing more can be sent here", () => {
    for (const e of ["blocked", "state", "gone", "suspended", "adult", "birth", "signin", "own"] as const) expect(sendOutcome(e)).toBe("closed");
  });
});

describe("a thread's messages", () => {
  it("merges two readings into one list, each message once, oldest first", () => {
    const have = [msg(3), msg(4)];
    const got = [msg(4, undefined, false, "edited"), msg(5), msg(1)];
    const out = mergeMessages(have, got);
    expect(out.map((m) => m.id)).toEqual([1, 3, 4, 5]);
    expect(out.find((m) => m.id === 4)?.body).toBe("edited");
    expect(have.map((m) => m.id)).toEqual([3, 4]);
  });
  it("knows the newest message's number", () => {
    expect(lastId([])).toBe(0);
    expect(lastId([msg(2), msg(9)])).toBe(9);
  });
  it("asks again gently: 15 seconds while the talk goes, 30 after two quiet minutes, a minute after ten", () => {
    expect(pollDelay(0)).toBe(15_000);
    expect(pollDelay(119_000)).toBe(15_000);
    expect(pollDelay(120_000)).toBe(30_000);
    expect(pollDelay(599_000)).toBe(30_000);
    expect(pollDelay(600_000)).toBe(60_000);
    expect(INBOX_POLL_MS).toBeGreaterThanOrEqual(30_000);
    expect(UNREAD_POLL_MS).toBeGreaterThanOrEqual(60_000);
  });
});

describe("when", () => {
  it("reads a moment's day in Riyadh, three hours ahead of UTC", () => {
    expect(riyadhDay("2026-11-20T20:59:59+00:00")).toBe("2026-11-20");
    expect(riyadhDay("2026-11-20T21:00:00+00:00")).toBe("2026-11-21");
    expect(riyadhDay("not a time")).toBe("");
  });
  it("knows today from another day", () => {
    const now = Date.parse("2026-11-20T22:30:00+00:00"); // 01:30 on the 21st in Riyadh
    expect(isToday("2026-11-20T21:05:00+00:00", now)).toBe(true);
    expect(isToday("2026-11-20T20:05:00+00:00", now)).toBe(false);
    expect(isToday("", now)).toBe(false);
  });
  it("marks the first message of each Riyadh day", () => {
    const list = [msg(1, "2026-11-19T10:00:00+00:00"), msg(2, "2026-11-19T20:00:00+00:00"), msg(3, "2026-11-19T21:30:00+00:00"), msg(4, "2026-11-20T09:00:00+00:00")];
    expect([...dayStarts(list)]).toEqual([1, 3]);
    expect(dayStarts([]).size).toBe(0);
  });
  it("writes an hour and a day in the page's language, in Riyadh's time", () => {
    const en = inboxFmt("en");
    expect(fmtPattern(en.time, "2026-11-20T14:05:00+00:00")).toMatch(/^(17:05|0?5:05\sPM)$/);
    expect(fmtPattern(en.day, "2026-11-20T22:05:00+00:00")).toMatch(/21/);
    expect(fmtPattern(inboxFmt("ar").day, "2026-11-20T10:00:00+00:00")).toMatch(/20/);
  });
});

describe("the listing a thread is about", () => {
  it("says a listing's state only when it is not simply on sale", () => {
    expect(onSale("live")).toBe(true);
    expect(onSale("reserved")).toBe(true);
    expect(onSale("sold")).toBe(false);
    expect(listingMark("live")).toBeNull();
    expect(listingMark("reserved")).toBe("status_reserved");
    expect(listingMark("sold")).toBe("status_sold");
    for (const st of ["held", "hidden", "expired", "deleted", "draft"] as const) expect(listingMark(st)).toBe("offSale");
    expect(S.en[listingMark("sold") as "status_sold"]).toBe("Sold");
  });
  it("links the card to the listing only while its page would open", () => {
    expect(threadListingHref({ id: 5, status: "live" }, "buyer")).toBe("/marketplace/5");
    expect(threadListingHref({ id: 5, status: "reserved" }, "buyer")).toBe("/marketplace/5");
    expect(threadListingHref({ id: 5, status: "hidden" }, "buyer")).toBeNull();
    expect(threadListingHref({ id: 5, status: "deleted" }, "buyer")).toBeNull();
    expect(threadListingHref({ id: 5, status: "hidden" }, "seller")).toBe("/marketplace/5");
    expect(threadListingHref({ id: 5, status: "deleted" }, "seller")).toBeNull();
  });
});

describe("reports", () => {
  it("offers a listing the reasons about the item and a conversation the reasons about the person", () => {
    expect(reportReasons("listing")).toEqual(["prohibited", "counterfeit", "stolen", "misleading", "scam", "spam", "other"]);
    expect(reportReasons("thread")).toEqual(["scam", "abuse", "spam", "other"]);
  });
  it("offers only reasons the database takes, each with words in both languages", () => {
    for (const target of ["listing", "thread"] as const) {
      for (const r of reportReasons(target)) {
        expect(MK_REPORT_REASONS).toContain(r);
        expect(W.en[`r_${r}`]).toBeTruthy();
        expect(W.ar[`r_${r}`]).toBeTruthy();
      }
    }
    for (const r of MK_REPORT_REASONS) expect([...reportReasons("listing"), ...reportReasons("thread")]).toContain(r);
  });
  it("comes back from the sign-in to what was being reported", () => {
    expect(reportBackHref("listing", 12)).toBe("/marketplace/12");
    expect(reportBackHref("thread", 4)).toBe("/marketplace/inbox/4");
  });
});

describe("numbers and links", () => {
  it("writes a Saudi number in groups and any other with its plus", () => {
    expect(phoneShown("966501234567")).toBe("+966 50 123 4567");
    expect(phoneShown("966126543210")).toBe("+966 12 654 3210");
    expect(phoneShown("447700900123")).toBe("+447700900123");
    expect(phoneShown(null)).toBe("");
  });
  it("makes a number to call only from 8 to 15 digits", () => {
    expect(telHref("966501234567")).toBe("tel:+966501234567");
    expect(telHref("123")).toBeNull();
    expect(telHref(null)).toBeNull();
  });
  it("links a map only to a Google Maps address over https", () => {
    expect(mapHref("https://maps.app.goo.gl/abc123")).toBe("https://maps.app.goo.gl/abc123");
    expect(mapHref("https://www.google.com/maps/place/x")).toBe("https://www.google.com/maps/place/x");
    expect(mapHref("http://maps.google.com/?q=1,2")).toBeNull();
    expect(mapHref("https://evil.example/maps.google.com/")).toBeNull();
    expect(mapHref("javascript:alert(1)")).toBeNull();
    expect(mapHref(null)).toBeNull();
  });
  it("knows a shop's slug", () => {
    expect(isShopSlug("wheel-house")).toBe(true);
    for (const v of ["ab", "Wheel", "a--b", "a/b", "", 5, null, "x".repeat(41)]) expect(isShopSlug(v)).toBe(false);
  });
});

describe("the unread number", () => {
  it("writes nothing for none and 99+ above 99", () => {
    expect(unreadText(0)).toBe("");
    expect(unreadText(-2)).toBe("");
    expect(unreadText(Number.NaN)).toBe("");
    expect(unreadText(3)).toBe("3");
    expect(unreadText(99)).toBe("99");
    expect(unreadText(100)).toBe("99+");
  });
  it("draws nothing on a page drawn by the server, before the number is known", () => {
    for (const where of ["header", "sheet", "account"] as const) expect(render(createElement(UnreadBadge, { where }))).toBe("");
  });
  it("has its sentence in both languages", () => {
    expect(BADGE.en.unread(3)).toBe("3 unread");
    expect(BADGE.ar.unread(3)).toContain("3");
    expect(W.en.unread(3)).toBe(BADGE.en.unread(3));
  });
});

describe("the words", () => {
  it("say the same things in English and Arabic", () => {
    expect(Object.keys(W.ar).sort()).toEqual(Object.keys(W.en).sort());
    for (const [k, v] of Object.entries(W.en)) expect(typeof (W.ar as Record<string, unknown>)[k]).toBe(typeof v);
  });
  it("name MicroMobility as it is written, and carry no pictographs", () => {
    const all = (o: Record<string, unknown>) => Object.values(o).map((v) => (typeof v === "function" ? (v as (x: string) => string)("x") : String(v))).join(" ");
    for (const text of [all(W.en), all(W.ar)]) {
      expect(text).not.toMatch(/Micromobility|micromobility/);
      expect(text).not.toMatch(/[☀-➿\u{1F000}-\u{1FAFF}]/u);
    }
  });
});

describe("the contact routes", () => {
  let calls: { fn: string; args: Record<string, unknown> }[] = [];
  let answer: (fn: string, args: Record<string, unknown>) => Response = () => json({});
  beforeEach(() => {
    calls = [];
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const fn = String(url).split("/rpc/")[1] ?? "";
      const args = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ fn, args });
      return answer(fn, args);
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const body = async (r: Response) => (await r.json()) as Record<string, unknown>;

  it("refuse another site's page and a visitor with no account before any database call", async () => {
    const other = await threadSend(post("/api/market/thread/send", { thread: 1, body: "hi" }, { origin: "https://evil.example" }));
    expect(other.status).toBe(403);
    const none = await threadSend(post("/api/market/thread/send", { thread: 1, body: "hi" }, { cookie: null }));
    expect(none.status).toBe(401);
    expect(await body(none)).toEqual({ ok: false, error: "signin" });
    expect(calls).toEqual([]);
  });
  it("open a thread with the account of the cookie, never an id the browser sent", async () => {
    answer = () => json({ thread_id: 9, created: true });
    const r = await threadOpen(post("/api/market/thread/open", { listing: 12, body: "Is this still available?", nameMode: "short", p_id: "someone-else" }));
    expect(await body(r)).toEqual({ ok: true, thread_id: 9, created: true });
    expect(calls).toEqual([{ fn: "market_thread_open", args: { p_id: "c1", p_token: "a".repeat(32), p_listing: 12, p_body: "Is this still available?", p_name_mode: "short" } }]);
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
  it("refuse a first message that is not one before any database call", async () => {
    for (const bad of [{ listing: 0, body: "x", nameMode: "none" }, { listing: 12, body: 5, nameMode: "none" }, { listing: 12, body: "x", nameMode: "full" }, { listing: "12", body: "x", nameMode: "none" }, { listing: 12, body: "x".repeat(4001), nameMode: "none" }]) {
      const r = await threadOpen(post("/api/market/thread/open", bad));
      expect(r.status).toBe(400);
      expect((await body(r)).error).toBe("invalid");
    }
    expect(calls).toEqual([]);
  });
  it("send a message and pass the database's refusals on by their id and detail only", async () => {
    answer = () => json({ message: { id: 4, mine: true, body: "hello", at: "2026-11-20T10:00:00+00:00" } });
    expect(await body(await threadSend(post("/api/market/thread/send", { thread: 3, body: "hello" })))).toEqual({ ok: true, message: { id: 4, mine: true, body: "hello", at: "2026-11-20T10:00:00+00:00" } });
    for (const [message, status, error, detail] of [["MKT_PHONE: body", 400, "phone", "body"], ["MKT_LINK: body", 400, "link", "body"], ["MKT_LIMIT: wait", 429, "limit", "wait"], ["MKT_BLOCKED", 403, "blocked", undefined], ["MKT_GONE", 404, "gone", undefined]] as const) {
      answer = () => json({ code: "P0001", message, details: "customer c2", hint: null }, 400);
      const r = await threadSend(post("/api/market/thread/send", { thread: 3, body: "hello" }));
      expect(r.status).toBe(status);
      expect(await body(r)).toEqual({ ok: false, error, ...(detail ? { detail } : {}) });
    }
    expect((await threadSend(post("/api/market/thread/send", { thread: 3 }))).status).toBe(400);
  });
  it("list the inbox and read a thread, with the earlier page asked by a message's number", async () => {
    answer = () => json({ items: [] });
    expect(await body(await threadList(get("/api/market/thread/list")))).toEqual({ ok: true, items: [] });
    answer = () => json({ thread: { id: 3 }, messages: [], more: false });
    expect((await body(await threadGet(get("/api/market/thread/get?id=3")))).ok).toBe(true);
    await threadGet(get("/api/market/thread/get?id=3&before=40"));
    expect(calls.slice(1).map((c) => c.args)).toEqual([
      { p_id: "c1", p_token: "a".repeat(32), p_thread: 3, p_before: null },
      { p_id: "c1", p_token: "a".repeat(32), p_thread: 3, p_before: 40 },
    ]);
    for (const bad of ["", "?id=abc", "?id=0", "?id=3&before=x", "?id=3&before=-1"]) expect((await threadGet(get(`/api/market/thread/get${bad}`))).status).toBe(400);
    expect((await threadGet(get("/api/market/thread/get?id=3", null))).status).toBe(401);
    expect((await threadList(get("/api/market/thread/list", null))).status).toBe(401);
  });
  it("share a WhatsApp number without ever taking one from the browser, and take it back with p_on false", async () => {
    answer = () => json({ shared: true });
    expect(await body(await waPost(post("/api/market/thread/whatsapp", { thread: 3, number: "966500000000" })))).toEqual({ ok: true, shared: true });
    expect(calls[0]).toEqual({ fn: "market_share_whatsapp", args: { p_id: "c1", p_token: "a".repeat(32), p_thread: 3 } });
    answer = () => json({ shared: false });
    expect(await body(await waPost(post("/api/market/thread/whatsapp", { thread: 3, on: false })))).toEqual({ ok: true, shared: false });
    expect(calls[1]).toEqual({ fn: "market_share_whatsapp", args: { p_id: "c1", p_token: "a".repeat(32), p_thread: 3, p_on: false } });
    expect((await waPost(post("/api/market/thread/whatsapp", { thread: 3, on: "no" }))).status).toBe(400);
    expect((await waPost(post("/api/market/thread/whatsapp", {}))).status).toBe(400);
  });
  it("say a database that cannot take a number back yet is absent, and a new account's refusal as it is", async () => {
    answer = () => json({ code: "PGRST202", message: "Could not find the function public.market_share_whatsapp(p_id, p_on, p_thread, p_token) in the schema cache" }, 404);
    const r = await waPost(post("/api/market/thread/whatsapp", { thread: 3, on: false }));
    expect(await body(r)).toEqual({ ok: false, error: "absent" });
    answer = () => json({ code: "P0001", message: "MKT_NEW" }, 400);
    expect(await body(await waPost(post("/api/market/thread/whatsapp", { thread: 3 })))).toEqual({ ok: false, error: "new" });
  });
  it("report a listing or a thread once, with an optional note", async () => {
    answer = () => json({ dup: false });
    expect(await body(await reportPost(post("/api/market/report", { target: "listing", ref: 12, reason: "scam", note: "asks for a deposit" })))).toEqual({ ok: true, dup: false });
    answer = () => json({ dup: true });
    expect(await body(await reportPost(post("/api/market/report", { target: "thread", ref: 3, reason: "abuse" })))).toEqual({ ok: true, dup: true });
    expect(calls.map((c) => c.args)).toEqual([
      { p_id: "c1", p_token: "a".repeat(32), p_target: "listing", p_ref: 12, p_reason: "scam", p_note: "asks for a deposit" },
      { p_id: "c1", p_token: "a".repeat(32), p_target: "thread", p_ref: 3, p_reason: "abuse", p_note: null },
    ]);
    for (const bad of [{ target: "seller", ref: 1, reason: "scam" }, { target: "listing", ref: 1, reason: "rude" }, { target: "listing", reason: "scam" }, { target: "listing", ref: 1, reason: "scam", note: 5 }]) {
      expect((await reportPost(post("/api/market/report", bad))).status).toBe(400);
    }
    expect(calls).toHaveLength(2);
  });
  it("block and unblock the other person of a thread", async () => {
    answer = (_fn, a) => json({ blocked: a.p_on });
    expect(await body(await blockPost(post("/api/market/block", { thread: 3, on: true })))).toEqual({ ok: true, blocked: true });
    expect(await body(await blockPost(post("/api/market/block", { thread: 3, on: false })))).toEqual({ ok: true, blocked: false });
    expect(calls[0]).toEqual({ fn: "market_block", args: { p_id: "c1", p_token: "a".repeat(32), p_thread: 3, p_on: true } });
    expect((await blockPost(post("/api/market/block", { thread: 3 }))).status).toBe(400);
  });
  it("answer the unread number for an account, and a visitor from the cookie alone", async () => {
    const out = await unreadGet(get("/api/market/unread", null));
    expect(await body(out)).toEqual({ ok: true, signedIn: false, n: 0 });
    expect(out.headers.get("cache-control")).toBe("no-store, private");
    expect(calls).toEqual([]);
    answer = () => json({ n: 4 });
    const mine = await unreadGet(get("/api/market/unread"));
    expect(await body(mine)).toEqual({ ok: true, signedIn: true, n: 4 });
    expect(mine.headers.get("cache-control")).toBe("no-store, private");
    expect(calls).toEqual([{ fn: "market_unread", args: { p_id: "c1", p_token: "a".repeat(32) } }]);
  });
  it("give a shop's numbers to a signed-in account only, as digits or nothing", async () => {
    answer = () => json({ phone: "966126543210", whatsapp: "966501234567", owner_id: "c9" });
    expect(await body(await shopPost(post("/api/market/contact/shop", { slug: "wheel-house" })))).toEqual({ ok: true, phone: "966126543210", whatsapp: "966501234567" });
    answer = () => json({ phone: null, whatsapp: "<script>" });
    expect(await body(await shopPost(post("/api/market/contact/shop", { slug: "wheel-house" })))).toEqual({ ok: true, phone: null, whatsapp: null });
    expect((await shopPost(post("/api/market/contact/shop", { slug: "wheel-house" }, { cookie: null }))).status).toBe(401);
    expect((await shopPost(post("/api/market/contact/shop", { slug: "../x" }))).status).toBe(400);
    answer = () => json({ code: "P0001", message: "MKT_LIMIT: contacts" }, 400);
    expect(await body(await shopPost(post("/api/market/contact/shop", { slug: "wheel-house" })))).toEqual({ ok: false, error: "limit", detail: "contacts" });
  });
});
