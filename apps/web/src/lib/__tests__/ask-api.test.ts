import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as readPage } from "../../app/api/ask/[slug]/route";
import { GET as readPageNamedSend, POST as send } from "../../app/api/ask/send/route";
import { POST as unsend } from "../../app/api/ask/unsend/route";
import { POST as vote } from "../../app/api/ask/vote/route";
import { askKey } from "../ask-server";

// The Ask pages' own routes (app/api/ask): the account's session is read from the HttpOnly cookie on the server and
// goes to the database - it never comes back to the browser. There is no database here: fetch is a stand-in that
// records what the routes send it.
const SITE = "https://micromobility.sa";
const TOK = "tk1a2b3c4d5e6f7g8h9i";
const COOKIE = `NEXT_LOCALE=en; mm_acct=c1~${TOK}`;
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const db = (body: unknown, status = 200) => vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => answer(body, status));
const sentTo = (f: ReturnType<typeof db>, n = 0) => {
  const [url, init] = f.mock.calls[n] as [string, RequestInit];
  return { fn: url.split("/rpc/")[1], args: JSON.parse(String(init.body)) as Record<string, unknown>, headers: init.headers as Record<string, string> };
};
const post = (path: string, body: unknown, o: { cookie?: string; origin?: string } = {}) =>
  new Request(SITE + path, { method: "POST", headers: { origin: o.origin ?? SITE, "content-type": "application/json", ...(o.cookie === "" ? {} : { cookie: o.cookie ?? COOKIE }) }, body: typeof body === "string" ? body : JSON.stringify(body) });
const get = (path: string, cookie = "") => new Request(SITE + path, { headers: cookie ? { cookie } : {} });
const slug = (s: string) => ({ params: Promise.resolve({ slug: s }) });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("POST /api/ask/send", () => {
  it("sends the answer to ask_send with the cookie's session, and hands back the database's answer - never the token", async () => {
    const f = db({ ok: true, status: "pending", score: null, mine: [{ id: 5, value: { t: "Kites" }, body: "Kites", status: "pending" }] });
    vi.stubGlobal("fetch", f);
    const res = await send(post("/api/ask/send", { question: 11, value: { t: "Kites" }, lang: "ar" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store, private");
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ ok: true, status: "pending", mine: [{ id: 5 }] });
    expect(text).not.toContain(TOK);
    expect(sentTo(f)).toMatchObject({ fn: "ask_send", args: { p_question: 11, p_id: "c1", p_token: TOK, p_value: { t: "Kites" }, p_lang: "ar" } });
    expect(sentTo(f).headers.apikey).toBe("anon");
  });
  it("sends an answer in English when the page's language is not one the site speaks", async () => {
    const f = db({ ok: true, status: "approved" });
    vi.stubGlobal("fetch", f);
    await send(post("/api/ask/send", { question: 11, value: { o: ["a"] }, lang: "xx" }));
    await send(post("/api/ask/send", { question: 11, value: { o: ["a"] } }));
    expect(sentTo(f, 0).args.p_lang).toBe("en");
    expect(sentTo(f, 1).args.p_lang).toBe("en");
  });
  it("is only for this site's own pages, signed in: nothing reaches the database otherwise", async () => {
    const f = db({ ok: true });
    vi.stubGlobal("fetch", f);
    const other = await send(post("/api/ask/send", { question: 11, value: { t: "x" } }, { origin: "https://evil.example" }));
    expect(other.status).toBe(403);
    expect(await other.json()).toEqual({ ok: false, error: "origin" });
    const out = await send(post("/api/ask/send", { question: 11, value: { t: "x" } }, { cookie: "" }));
    expect(out.status).toBe(401);
    expect(await out.json()).toEqual({ ok: false, error: "signin" });
    const bent = await send(post("/api/ask/send", { question: 11, value: { t: "x" } }, { cookie: "mm_acct=not-a-session" }));
    expect(bent.status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });
  it("refuses a body that is not an answer before asking the database", async () => {
    const f = db({ ok: true });
    vi.stubGlobal("fetch", f);
    for (const body of [{}, { question: "11", value: { t: "x" } }, { question: 0, value: { t: "x" } }, { question: 1.5, value: { t: "x" } }, { question: 11 }, { question: 11, value: "Kites" }, { question: 11, value: ["a"] }, { question: 11, value: { t: "x".repeat(5000) } }, "not json", [1]]) {
      const res = await send(post("/api/ask/send", body));
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: "invalid" });
    }
    expect(f).not.toHaveBeenCalled();
  });
  it("passes on why the database did not take it, by the contract's code", async () => {
    for (const [error, status] of [["limit", 409], ["closed", 409], ["throttled", 409], ["signin", 401]] as const) {
      vi.stubGlobal("fetch", db({ ok: false, error }));
      const res = await send(post("/api/ask/send", { question: 11, value: { t: "x" } }));
      expect(res.status, error).toBe(status);
      expect(await res.json()).toEqual({ ok: false, error });
    }
    vi.stubGlobal("fetch", db({ ok: false }));
    expect(await (await send(post("/api/ask/send", { question: 11, value: { t: "x" } }))).json()).toEqual({ ok: false, error: "generic" });
  });
  it("says it could not be sent when the database does not answer, or does not have the function yet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const down = await send(post("/api/ask/send", { question: 11, value: { t: "x" } }));
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ ok: false, error: "generic" });
    vi.stubGlobal("fetch", db({ code: "PGRST202", message: "Could not find the function public.ask_send in the schema cache" }, 404));
    const absent = await send(post("/api/ask/send", { question: 11, value: { t: "x" } }));
    expect(absent.status).toBe(404);
    expect(await absent.json()).toEqual({ ok: false, error: "generic" });
    vi.stubGlobal("fetch", db("null"));
    expect((await send(post("/api/ask/send", { question: 11, value: { t: "x" } }))).status).toBe(502);
  });
});

describe("POST /api/ask/unsend and /api/ask/vote", () => {
  it("take back the account's own waiting answer", async () => {
    const f = db({ ok: true });
    vi.stubGlobal("fetch", f);
    const res = await unsend(post("/api/ask/unsend", { answer: 5 }));
    expect(await res.json()).toEqual({ ok: true });
    expect(sentTo(f)).toMatchObject({ fn: "ask_unsend", args: { p_answer: 5, p_id: "c1", p_token: TOK } });
    expect((await unsend(post("/api/ask/unsend", { answer: "5" }))).status).toBe(400);
    expect((await unsend(post("/api/ask/unsend", { answer: 5 }, { cookie: "" }))).status).toBe(401);
    expect((await unsend(post("/api/ask/unsend", { answer: 5 }, { origin: "https://evil.example" }))).status).toBe(403);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("give or take back an upvote", async () => {
    const f = db({ ok: true, votes: 6 });
    vi.stubGlobal("fetch", f);
    const res = await vote(post("/api/ask/vote", { answer: 20, on: true }));
    expect(await res.json()).toEqual({ ok: true, votes: 6 });
    await vote(post("/api/ask/vote", { answer: 20, on: false }));
    expect(sentTo(f, 0)).toMatchObject({ fn: "ask_vote", args: { p_answer: 20, p_id: "c1", p_token: TOK, p_on: true } });
    expect(sentTo(f, 1).args.p_on).toBe(false);
    for (const body of [{ answer: 20 }, { answer: 20, on: "yes" }, { on: true }]) expect((await vote(post("/api/ask/vote", body))).status).toBe(400);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("GET /api/ask/<slug>", () => {
  const PAGE = { state: "ok", signed: true, can_answer: true, rk: "rk1", page: { id: 1, slug: "farm-ideas" }, questions: [] };
  it("reads the page again for the viewer: with the cookie's session when there is one, with none otherwise", async () => {
    const f = db(PAGE);
    vi.stubGlobal("fetch", f);
    const res = await readPage(get("/api/ask/farm-ideas", COOKIE), slug("farm-ideas"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store, private");
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: true, page: PAGE });
    expect(text).not.toContain(TOK);
    expect(sentTo(f, 0)).toEqual(expect.objectContaining({ fn: "ask_page", args: { p_slug: "farm-ideas", p_id: "c1", p_token: TOK } }));
    await readPage(get("/api/ask/farm-ideas"), slug("farm-ideas"));
    expect(sentTo(f, 1).args).toEqual({ p_slug: "farm-ideas" });
  });
  it("passes a staff preview's key on, and drops anything that is not a key's shape", async () => {
    const f = db(PAGE);
    vi.stubGlobal("fetch", f);
    await readPage(get("/api/ask/farm-ideas?k=Ab3_x-9.z"), slug("farm-ideas"));
    await readPage(get("/api/ask/farm-ideas?k=a%20b%3Bdrop"), slug("farm-ideas"));
    expect(sentTo(f, 0).args).toEqual({ p_slug: "farm-ideas", p_key: "Ab3_x-9.z" });
    expect(sentTo(f, 1).args).toEqual({ p_slug: "farm-ideas" });
    expect(askKey("abcdef")).toBe("abcdef");
    expect(askKey(["abcdef", "x"])).toBe("abcdef");
    for (const key of ["9f8e7d6c5b4a39281706f5e4d3c2b1a0", "0b5c1d2e-3f4a-4b6c-8d7e-9f0a1b2c3d4e", "q2Xz+7/abQ==", "q2Xz-7_abQ"]) expect(askKey(key), key).toBe(key);
    for (const bad of ["abc", "", "a b c d e f", "x".repeat(201), undefined, 12]) expect(askKey(bad), String(bad)).toBeNull();
  });
  it("answers no such page for a database that does not have the function yet, and for a link part that cannot be one", async () => {
    const f = db({ code: "PGRST202", message: "Could not find the function public.ask_page in the schema cache" }, 404);
    vi.stubGlobal("fetch", f);
    expect(await (await readPage(get("/api/ask/farm-ideas"), slug("farm-ideas"))).json()).toEqual({ ok: true, page: { state: "none" } });
    expect(await (await readPage(get("/api/ask/Farm_Ideas"), slug("Farm_Ideas"))).json()).toEqual({ ok: true, page: { state: "none" } });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("says so when the database does not answer: the page keeps what it shows", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const res = await readPage(get("/api/ask/farm-ideas", COOKIE), slug("farm-ideas"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: "generic" });
    vi.stubGlobal("fetch", db({ message: "boom" }, 503));
    expect((await readPage(get("/api/ask/farm-ideas"), slug("farm-ideas"))).status).toBe(502);
  });
  it("still reads a page whose own link part is the name of one of the routes", async () => {
    const f = db({ state: "none" });
    vi.stubGlobal("fetch", f);
    expect(await (await readPageNamedSend(get("/api/ask/send"))).json()).toEqual({ ok: true, page: { state: "none" } });
    expect(sentTo(f).args).toEqual({ p_slug: "send" });
  });
});
