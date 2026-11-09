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
  it("still opens the Privacy Notice, which the sign-up and the forms link to", async () => {
    for (const p of ["/privacy", "/privacy/"]) {
      const res = await call(p);
      expect(res.status, p).toBe(200);
      expect(rewrittenTo(res), p).toBe("/en/privacy");
    }
    expect(rewrittenTo(await call("/privacy?lang=ar"))).toBe("/ar/privacy");
    for (const p of ["/privacy/more", "/privacy.html", "/privacyx"]) expect((await call(p)).status, p).not.toBe(200);
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
    expect((await call("/club")).headers.get("x-mm-no-page-cache")).toBeNull(); // known state: the edge may keep it
  });
  it("marks a page drawn with no state ever read, so the edge never keeps that Coming Soon", async () => {
    resetSiteContent();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    const res = await call("/");
    expect(res.headers.get("x-mm-no-page-cache")).toBe("1");
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
  it("sees the registration forms' addresses too (it decides whether the website's page or the form's own answers), never their files", () => {
    for (const p of ["/petromin", "/community/registration", "/defe", "/saturday", "/lockers", "/community", "/petrominx", "/Petromin", "/community/Registration", "/Defe", "/defense", "/Saturday", "/saturdays", "/Lockers", "/lockersx"]) expect(seen(p), p).toBe(true);
    expect(seen("/community/registration/og-image.png")).toBe(false);
    // a locker's own tag comes here too: the proxy sends it on (lockers.test.ts)
    for (const p of ["/lockers/7", "/lockers/L7"]) expect(seen(p), p).toBe(true);
  });
});

describe("the registration forms' addresses", () => {
  // No database here, so the site reads as Coming Soon: a form opens all the same.
  it("lets any form with ?classic=1 through untouched to its own page", async () => {
    for (const p of ["/lockers?classic=1", "/lockers?classic=1&lang=ar&locker=7", "/saturday?classic=1&lang=ar", "/community/registration?classic=1", "/community/registration?classic=1&lang=ar", "/petromin?classic=1"]) {
      const res = await call(p);
      expect(res.headers.get("x-middleware-next"), p).toBe("1");
      expect(res.headers.get("x-middleware-rewrite"), p).toBeNull();
      expect(res.headers.get("content-security-policy"), p).toBeNull(); // the form's own page sends its own
      expect(res.status, p).toBe(200);
    }
  });
  it("draws every form as a page of the website, whatever Coming Soon says", async () => {
    for (const [p, lang, to] of [["/community/registration", "en", "/community/registration"], ["/community/registration?lang=ar", "ar", "/community/registration"], ["/community/registration?code=x&lang=fr", "fr", "/community/registration"],
      ["/petromin", "en", "/petromin"], ["/petromin?lang=ur", "ur", "/petromin"], ["/petromin?lang=ja", "ja", "/petromin"],
      ["/saturday", "en", "/saturday"], ["/saturday?lang=zh", "zh", "/saturday"], ["/lockers", "en", "/lockers"], ["/lockers?lang=ar&locker=7", "ar", "/lockers"], ["/lockers?lang=bn", "bn", "/lockers"]]) {
      const res = await call(p);
      expect(res.status, p).toBe(200);
      expect(res.headers.get("x-middleware-rewrite") ?? "", p).toContain(`/${lang}${to}`);
      // the site's security headers, which next.config.ts leaves these addresses' own pages to send (2026-11-09: none went out)
      expect(res.headers.get("content-security-policy") ?? "", p).toContain("default-src 'self'");
      expect(res.headers.get("strict-transport-security"), p).toBe("max-age=31536000");
    }
  });
  it("send another spelling to the one real address, with its query", async () => {
    for (const [from, to] of [["/Petromin", "/petromin"], ["/PETROMIN/", "/petromin"], ["/community/Registration?lang=ar", "/community/registration?lang=ar"], ["/Saturday?lang=ar", "/saturday?lang=ar"], ["/SATURDAY/", "/saturday"], ["/Lockers?lang=ar", "/lockers?lang=ar"], ["/LOCKERS/", "/lockers"]]) {
      const res = await call(from);
      expect(res.status, from).toBe(301);
      expect(redirectedTo(res), from).toBe(to);
    }
  });
});

describe("/defe, turned off", () => {
  // The user, 2026-11-09: "turn off defe page we don't need it anymore".
  it("sends any spelling of it to the Saturday ride's page, keeping only the language", async () => {
    for (const [from, to] of [["/defe", "/saturday"], ["/defe?lang=ar", "/saturday?lang=ar"], ["/Defe/", "/saturday"], ["/DEFE?code=ABC&lang=ja", "/saturday?lang=ja"], ["/defe?classic=1", "/saturday"], ["/defe?lang=xx", "/saturday"]]) {
      const res = await call(from);
      expect(res.status, from).toBe(307);
      expect(redirectedTo(res), from).toBe(to);
    }
  });
  it("leaves addresses that only start alike to the site", async () => {
    for (const p of ["/defense", "/defe/x", "/community/defe"]) expect((await call(p)).headers.get("location") ?? "", p).not.toContain("/saturday");
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
  it("sends the site's own shopping pages to the shop while the store is closed, but never an order or Track order", async () => {
    for (const p of ["/store/", "/store/cart", "/store/checkout", "/store/da54"]) {
      const res = await call(p);
      expect(res.status, p).toBe(307);
      expect(res.headers.get("location"), p).toBe("https://stepdragon.com.sa/ar");
    }
    for (const p of ["/store/order/1001?k=abc", "/store/track", "/storefront"]) {
      expect(String((await call(p)).headers.get("location")), p).not.toContain("stepdragon");
    }
  });
});

describe("the site's own store", () => {
  const content = (rows: { key: string; value: unknown }[]) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } })));
  beforeEach(() => {
    resetSiteContent();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetSiteContent();
  });
  it("opens /store and everything under it once staff open it with payments on", async () => {
    content([{ key: "site.coming_soon", value: false }, { key: "store.open", value: true }, { key: "pay.enabled", value: true }]);
    for (const p of ["/store", "/store/cart", "/store/da54", "/store/checkout"]) {
      const res = await call(p, { cookie: "NEXT_LOCALE=en" });
      expect(res.status, p).toBe(200);
      expect(rewrittenTo(res), p).toBe(`/en${p}`);
    }
  });
  it("keeps forwarding to the shop while payments are off", async () => {
    content([{ key: "site.coming_soon", value: false }, { key: "store.open", value: true }, { key: "pay.enabled", value: false }]);
    expect((await call("/store")).headers.get("location")).toBe("https://stepdragon.com.sa/ar");
  });
});

describe("www.micromobility.sa", () => {
  it("moves every address to micromobility.sa for good, path and query kept", async () => {
    for (const path of ["/", "/club?lang=ar", "/bikes/42", "/account?handoff=done", "/en/about"]) {
      const res = await proxy(new NextRequest(`https://www.micromobility.sa${path}`));
      expect(res.status, path).toBe(301);
      expect(res.headers.get("location"), path).toBe(`https://micromobility.sa${path}`);
    }
    // anything but GET and HEAD keeps its method (a 301 would turn it into a GET)
    expect((await proxy(new NextRequest("https://www.micromobility.sa/account", { method: "POST" }))).status).toBe(308);
    // the site itself, and staging, are left alone
    expect((await call("/")).status).toBe(200);
    expect((await proxy(new NextRequest("https://staging.micromobility.sa/"))).headers.get("location")).toBeNull();
  });
});
