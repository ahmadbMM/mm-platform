import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, routing } from "./i18n/routing";
import { hiddenPageTarget, isComingSoon, loadSiteContent, siteCanOpen } from "./lib/site";
import { comingSoonTarget } from "./lib/coming-soon-route";
import { PREVIEW_COOKIE, isStaffToken } from "./lib/preview";
import { askedLang } from "./lib/lang-url";
import { STORE_URL } from "./lib/links";

const intl = createMiddleware(routing);

// The registration forms' addresses (see the matcher below).
const FORM_ADDRESSES = ["/community/registration", "/petromin"];
export function formAddress(pathname: string): string | null {
  const p = pathname.toLowerCase().replace(/\/+$/, "");
  return FORM_ADDRESSES.includes(p) ? p : null;
}

// micromobility.sa/store opens the online store (a hosted Salla shop, on its own domain), at the
// address staff set (Website > Whole site > Other addresses), in English when the visitor reads
// English and in Arabic otherwise. Before Coming Soon, so the shop is reachable while the site is
// closed. Temporary (307): the shop's address can change without browsers keeping the old one.
const STORE_PATH = /^\/(?:(en|ar)\/)?store\/?$/;
export async function storeTarget(pathname: string, req: NextRequest): Promise<string | null> {
  const m = pathname.match(STORE_PATH);
  if (!m) return null;
  const set = (await loadSiteContent())?.["site.links.store"];
  const href = set && typeof set === "object" ? String((set as { href?: unknown }).href ?? "") : "";
  const base = (/^https:\/\//i.test(href) ? href : STORE_URL).replace(/\/+$/, "");
  const lang = m[1] || askedLang(req.nextUrl.searchParams) || req.cookies.get(LANG_COOKIE.name)?.value;
  return `${base}/${lang === "en" ? "en" : "ar"}`;
}

// The staff preview page; the staff page still opens it as /en/preview or /ar/preview.
const PREVIEW_PAGE = /^(?:\/(?:en|ar))?\/preview\/?$/;
// A fleet bike's NFC tag page: /bikes/<its number> (components/bikes/FleetBike.tsx).
const FLEET_PAGE = /^\/bikes\/\d{1,6}\/?$/;

export default async function proxy(req: NextRequest) {
  // The handoff spec writes the tag URL as /?bike=42; the chips carry /b/42, and the page now
  // lives at /bikes/42 (next.config redirects the chips' address there). Anything still using
  // the query form is moved over here rather than through next.config redirects, because those
  // append the original query and would leave ?bike=42 sitting in the address bar. The code
  // belongs in the path or nowhere.
  const { pathname, searchParams } = req.nextUrl;
  // The forms answer at one lower-case address each; a link typed or printed another way
  // (/Petromin, /community/Registration/) is sent there, as their own Workers did.
  const form = formAddress(pathname);
  if (form && form !== pathname) return NextResponse.redirect(new URL(form + req.nextUrl.search, req.url), 301);
  const store = await storeTarget(pathname, req);
  if (store) return NextResponse.redirect(store, 307);
  if (pathname === "/") {
    const code = searchParams.get("bike");
    if (code && /^\d{1,6}$/.test(code)) {
      const to = new URL(`/bikes/${Number(code)}`, req.url);
      return NextResponse.redirect(to, 307);
    }
  }
  // ?lang=ar / ?lang=en shows the page in that language at the address as given, and keeps it
  // as the visitor's language from then on. next-intl reads the language from the cookie, so
  // the request is given it here; the answer (a page or a redirect) sets it for the next ones.
  const lang = askedLang(searchParams);
  if (lang) req.cookies.set(LANG_COOKIE.name, lang);
  const keepLang = (res: NextResponse) => {
    if (lang) res.cookies.set(LANG_COOKIE.name, lang, { path: "/", maxAge: LANG_COOKIE.maxAge, sameSite: "lax" });
    return res;
  };
  // A fleet bike's tag page (/bikes/42: a rider tapping a sticker) opens whatever the site's
  // state - Coming Soon on, or the Bikes page not switched on. It is never a catalogue page: a
  // category's address starts with a letter (the database insists), so digits can only be a tag.
  if (FLEET_PAGE.test(pathname)) return keepLang(intl(req));
  // While the site is Coming Soon, it is the only page: /login, /about and anything else go
  // back to it. /store forwards to the shop before this runs (above), and the old /b/42 tag
  // address is redirected to /bikes/42 before this runs (next.config redirects).
  // Until Home exists the site is closed whatever staff have set, so nothing is read here yet.
  // Once it is open, a page staff have not switched on (Website > Pages) goes to Home the same way.
  const content = siteCanOpen() ? await loadSiteContent() : null;
  const closed = siteCanOpen() ? isComingSoon(content) : true;
  const soon = closed ? comingSoonTarget(pathname) : hiddenPageTarget(pathname, content);
  // A signed-in staff member previewing the site (lib/preview.ts) passes; the preview page itself
  // must always load, since it is how preview starts.
  const previewing = soon && !PREVIEW_PAGE.test(pathname) ? await isStaffToken(req.cookies.get(PREVIEW_COOKIE)?.value) : false;
  if (soon && !previewing && !PREVIEW_PAGE.test(pathname)) return keepLang(NextResponse.redirect(new URL(soon, req.url), 307));
  // No Link header naming the page's languages: the page's own <link rel="alternate"> tags do that
  // (lib/seo.ts), and the header - 1.5 KB on every answer, the page's data included - said the same.
  return keepLang(intl(req));
}

// /b/* is the tag pages' old address: the NFC chips hold micromobility.sa/b/42, and next.config
// redirects it to /bikes/42 before anything here runs. It stays excluded so that address is never
// handled as a site page, whatever else changes. /bikes/42 itself does come here (FLEET_PAGE).
// Only /b and /api themselves and what is under them: a bare "b" also caught /business, which
// was a 404 once its address lost the /en in front.
// The two registration forms are excluded too (app/community/registration, app/petromin): they
// are public whatever Coming Soon says, and they carry their own languages. Their exact
// addresses only - /Petromin and the like still come here and are sent to the real one.
export const config = { matcher: ["/((?!api/|api$|b/|b$|_next|community/registration$|petromin$|.*\\..*).*)"] };
