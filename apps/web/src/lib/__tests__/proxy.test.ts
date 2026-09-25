import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import proxy, { config } from "../../proxy";

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
  it("tells search engines where the page is in each language", async () => {
    const link = (await call("/")).headers.get("link") || "";
    expect(link).toContain(`<${SITE}/?lang=ar>; rel="alternate"; hreflang="ar"`);
    expect(link).toContain(`<${SITE}/>; rel="alternate"; hreflang="x-default"`);
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
    expect(redirectedTo(res)).toBe("/b/42");
  });
});

describe("which addresses the proxy sees", () => {
  // The matcher as a plain regular expression, anchored the way Next.js anchors it.
  const seen = (p: string) => new RegExp(`^${config.matcher[0]}$`).test(p);
  it("sees every site page, those starting with b or api included", () => {
    for (const p of ["/", "/business", "/business/fleet", "/bikes", "/apis", "/club", "/en/business"]) expect(seen(p), p).toBe(true);
  });
  it("leaves the bike tags, the API and files alone", () => {
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
