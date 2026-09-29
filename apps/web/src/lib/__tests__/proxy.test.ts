import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import proxy, { config } from "../../proxy";
import { resetSiteContent } from "../site";

// The addresses carry no language (i18n/routing.ts). These run the real proxy on requests as a
// browser sends them; there is no database here, so nothing staff set is read and the site is
// Coming Soon: every page but / is sent back to it.
const SITE = "https://micromobility.sa";
const call = (path: string, headers: Record<string, string> = {}) => proxy(new NextRequest(SITE + path, { headers }));
const rewrittenTo = (res: Response) => new URL(res.headers.get("x-middleware-rewrite") || "").pathname;
const redirectedTo = (res: Response) => {
  const u = new URL(res.headers.get("location") || "");
  return u.pathname + u.search;
};
const langCookie = (res: Response) => (res.headers.get("set-cookie") || "").match(/NEXT_LOCALE=(\w+)/)?.[1] ?? null;

describe("an address without a language", () => {
  it("shows / in English when nothing says otherwise, at the address as typed", async () => {
    const res = await call("/");
    expect(res.status).toBe(200);
    expect(rewrittenTo(res)).toBe("/en");
  });
  it("follows the browser's language, then the language the visitor picked", async () => {
    expect(rewrittenTo(await call("/", { "accept-language": "ar-SA,ar;q=0.9" }))).toBe("/ar");
    expect(rewrittenTo(await call("/", { "accept-language": "ar", cookie: "NEXT_LOCALE=en" }))).toBe("/en");
    expect(rewrittenTo(await call("/", { cookie: "NEXT_LOCALE=ar" }))).toBe("/ar");
  });
  it("sends no Link header: the page's own <link rel=alternate> tags name its languages (lib/seo.ts)", async () => {
    expect((await call("/")).headers.get("link")).toBeNull();
    expect((await call("/?tag=news")).headers.get("link")).toBeNull();
  });
});

describe("?lang=", () => {
  it("shows the page in that language at the same address, and remembers it for a year", async () => {
    const res = await call("/?lang=ar", { cookie: "NEXT_LOCALE=en" });
    expect(res.status).toBe(200);
    expect(rewrittenTo(res)).toBe("/ar");
    expect(langCookie(res)).toBe("ar");
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=31536000/i);
  });
  it("keeps the language when the page sends the visitor elsewhere", async () => {
    const res = await call("/club?lang=ar");
    expect(res.status).toBe(307);
    expect(redirectedTo(res)).toBe("/");
    expect(langCookie(res)).toBe("ar");
  });
  it("ignores a language the site does not have", async () => {
    const res = await call("/?lang=xx", { "accept-language": "en", cookie: "NEXT_LOCALE=ar" });
    expect(rewrittenTo(res)).toBe("/ar");
    expect(langCookie(res)).toBeNull();
  });
});

describe("the old /en and /ar addresses", () => {
  it("go to the same page without the language, switching to it", async () => {
    for (const [from, lang] of [["/en", "en"], ["/ar", "ar"], ["/ar/", "ar"]]) {
      const res = await call(from, { cookie: `NEXT_LOCALE=${lang === "ar" ? "en" : "ar"}` });
      expect(res.status, from).toBe(307);
      expect(redirectedTo(res), from).toBe("/");
      expect(langCookie(res), from).toBe(lang);
    }
  });
  it("keep a page's language on the way back to Coming Soon", async () => {
    const res = await call("/ar/club");
    expect(res.status).toBe(307);
    expect(redirectedTo(res)).toBe("/ar");
  });
});

describe("while the site is Coming Soon", () => {
  it("sends every other page to /", async () => {
    for (const p of ["/club", "/about", "/journal/x", "/login"]) {
      const res = await call(p);
      expect(res.status, p).toBe(307);
      expect(redirectedTo(res), p).toBe("/");
    }
  });
  it("still opens the staff preview, at its new and its old address", async () => {
    const res = await call("/preview");
    expect(res.status).toBe(200);
    expect(rewrittenTo(res)).toBe("/en/preview");
    const old = await call("/ar/preview");
    expect(redirectedTo(old)).toBe("/preview");
    expect(langCookie(old)).toBe("ar");
  });
  it("still sends a bike tag's /?bike= to its page", async () => {
    const res = await call("/?bike=42");
    expect(res.status).toBe(307);
    expect(redirectedTo(res)).toBe("/bikes/42");
  });
  it("still opens a fleet bike's tag page, in the language asked for", async () => {
    // A rider tapping a sticker must reach the bike whatever the site's state (the Bikes page
    // itself is a switched page and goes back to Home like the others).
    for (const p of ["/bikes/42", "/bikes/000001/", "/bikes/999999"]) {
      const res = await call(p);
      expect(res.status, p).toBe(200);
      expect(rewrittenTo(res), p).toBe(`/en${p.replace(/\/$/, "")}`);
    }
    const ar = await call("/bikes/42?lang=ar");
    expect(rewrittenTo(ar)).toBe("/ar/bikes/42");
    expect(langCookie(ar)).toBe("ar");
    for (const p of ["/bikes", "/bikes/road", "/bikes/road/42", "/bikes/1234567"]) {
      const res = await call(p);
      expect(res.status, p).toBe(307);
      expect(redirectedTo(res), p).toBe("/");
    }
  });
  it("still opens the Learn to ride sign-up, in the language asked for", async () => {
    // Usable now, the way the registration forms are (owner, 2026-09-28): the page stands alone
    // while the site is closed. The rest of Experiences stays behind Coming Soon.
    for (const p of ["/experiences/learn", "/experiences/learn/"]) {
      const res = await call(p);
      expect(res.status, p).toBe(200);
      expect(rewrittenTo(res), p).toBe("/en/experiences/learn");
    }
    const ar = await call("/experiences/learn?lang=ar");
    expect(ar.status).toBe(200);
    expect(rewrittenTo(ar)).toBe("/ar/experiences/learn");
    expect(langCookie(ar)).toBe("ar");
    expect(rewrittenTo(await call("/experiences/learn", { cookie: "NEXT_LOCALE=zh" }))).toBe("/zh/experiences/learn");
    const old = await call("/ar/experiences/learn");
    expect(old.status).toBe(307);
    expect(redirectedTo(old)).toBe("/experiences/learn");
    expect(langCookie(old)).toBe("ar");
    for (const p of ["/experiences", "/experiences/", "/experiences/learning", "/experiences/learn/more", "/experiences/x", "/learn"]) {
      const res = await call(p);
      expect(res.status, p).toBe(307);
      expect(redirectedTo(res), p).toBe("/");
    }
  });
});

describe("a staff phone tapping a bike's chip", () => {
  // The staff app writes mm_staff_tap=1 for micromobility.sa on the phones it is signed in on.
  const staff = { cookie: "NEXT_LOCALE=ar; mm_staff_tap=1" };
  it("goes to the staff app with the bike's number, never kept by a cache", async () => {
    for (const [p, to] of [["/bikes/42", "42"], ["/bikes/042/", "42"], ["/bikes/999999", "999999"], ["/?bike=042", "42"], ["/bikes/42?lang=ar", "42"]]) {
      const res = await call(p, staff);
      expect(res.status, p).toBe(307);
      expect(res.headers.get("location"), p).toBe(`https://staff.micromobility.sa/?bike=${to}`);
      expect(res.headers.get("cache-control"), p).toBe("private, no-store");
    }
  });
  it("a rider's phone, or any other value, still gets the bike's page", async () => {
    for (const cookie of ["", "mm_staff_tap=", "mm_staff_tap=0", "mm_staff_tap=true", "xmm_staff_tap=1"]) {
      const res = await call("/bikes/42", cookie ? { cookie } : {});
      expect(res.status, cookie).toBe(200);
      expect(rewrittenTo(res), cookie).toBe("/en/bikes/42");
    }
    expect(redirectedTo(await call("/?bike=42", { cookie: "mm_staff_tap=0" }))).toBe("/bikes/42");
  });
  it("only a bike's number is sent on: other pages open as they would for anyone", async () => {
    for (const p of ["/", "/bikes", "/bikes/road", "/bikes/1234567", "/?bike=abc", "/club?bike=42"]) {
      const res = await call(p, staff);
      expect(res.headers.get("location") || "", p).not.toContain("staff.micromobility.sa");
    }
  });
});

describe("once the site is open", () => {
  // What staff set, as the database answers it: Coming Soon off, the Club page switched on and
  // the Experiences page not (Website > Pages).
  beforeEach(() => {
    resetSiteContent();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ key: "site.coming_soon", value: false }, { key: "page.club.visible", value: true }]), { status: 200, headers: { "content-type": "application/json" } })));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetSiteContent();
  });
  it("opens the Learn to ride sign-up while the Experiences page is switched off, and sends the rest of Experiences to Home", async () => {
    const res = await call("/experiences/learn");
    expect(res.status).toBe(200);
    expect(rewrittenTo(res)).toBe("/en/experiences/learn");
    for (const p of ["/experiences", "/experiences/other"]) {
      const off = await call(p);
      expect(off.status, p).toBe(307);
      expect(redirectedTo(off), p).toBe("/");
    }
    expect(rewrittenTo(await call("/club"))).toBe("/en/club"); // the site is open: a page staff switched on opens
  });
});

describe("which addresses the proxy sees", () => {
  // The matcher as a plain regular expression, anchored the way Next.js anchors it.
  const seen = (p: string) => new RegExp(`^${config.matcher[0]}$`).test(p);
  it("sees every site page, those starting with b or api included, and the tag pages", () => {
    for (const p of ["/", "/business", "/business/fleet", "/bikes", "/bikes/42", "/bikes/road/carbon/x", "/apis", "/club", "/en/business"]) expect(seen(p), p).toBe(true);
  });
  it("leaves the tags' old address (next.config redirects it), the API and files alone", () => {
    for (const p of ["/b", "/b/42", "/api", "/api/preview", "/_next/static/x.js", "/site/logo.png", "/robots.txt"]) expect(seen(p), p).toBe(false);
  });
  it("leaves the two registration forms alone, so Coming Soon never covers them", () => {
    for (const p of ["/petromin", "/community/registration", "/community/registration/og-image.png"]) expect(seen(p), p).toBe(false);
    for (const p of ["/community", "/petrominx", "/Petromin", "/community/Registration"]) expect(seen(p), p).toBe(true);
  });
});

describe("the registration forms' addresses", () => {
  it("send another spelling to the one real address, with its query", async () => {
    for (const [from, to] of [["/Petromin", "/petromin"], ["/PETROMIN/", "/petromin"], ["/community/Registration?lang=ar", "/community/registration?lang=ar"]]) {
      const res = await call(from);
      expect(res.status, from).toBe(301);
      expect(redirectedTo(res), from).toBe(to);
    }
  });
});

describe("/store", () => {
  // No database here, so the shop's address is the site's own default (Website > Other addresses).
  it("opens the shop in Arabic, or in English when the visitor reads English", async () => {
    const to = async (path: string, headers: Record<string, string> = {}) => {
      const res = await call(path, headers);
      expect(res.status).toBe(307);
      return res.headers.get("location");
    };
    expect(await to("/store")).toBe("https://stepdragon.com.sa/ar");
    expect(await to("/store?lang=en")).toBe("https://stepdragon.com.sa/en");
    expect(await to("/store", { cookie: "NEXT_LOCALE=en" })).toBe("https://stepdragon.com.sa/en");
    expect(await to("/en/store")).toBe("https://stepdragon.com.sa/en");
    expect(await to("/ar/store", { cookie: "NEXT_LOCALE=en" })).toBe("https://stepdragon.com.sa/ar");
  });
});
