import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, routing } from "./i18n/routing";
import { HOME_BUILT, hiddenPageTarget, isComingSoon, loadSiteContent } from "./lib/site";
import { comingSoonTarget } from "./lib/coming-soon-route";
import { PREVIEW_COOKIE, isStaffToken } from "./lib/preview";
import { alternateLinks, askedLang } from "./lib/lang-url";

const intl = createMiddleware(routing);

// The registration forms' addresses (see the matcher below).
const FORM_ADDRESSES = ["/community/registration", "/petromin"];
export function formAddress(pathname: string): string | null {
  const p = pathname.toLowerCase().replace(/\/+$/, "");
  return FORM_ADDRESSES.includes(p) ? p : null;
}

// The staff preview page; the staff page still opens it as /en/preview or /ar/preview.
const PREVIEW_PAGE = /^(?:\/(?:en|ar))?\/preview\/?$/;

export default async function proxy(req: NextRequest) {
  // The handoff spec writes the tag URL as /?bike=42; the chips carry /b/42 instead. Anything
  // still using the old form is moved over here rather than through next.config redirects,
  // because those append the original query and would leave ?bike=42 sitting in the address
  // bar. The code belongs in the path or nowhere.
  const { pathname, searchParams } = req.nextUrl;
  // The forms answer at one lower-case address each; a link typed or printed another way
  // (/Petromin, /community/Registration/) is sent there, as their own Workers did.
  const form = formAddress(pathname);
  if (form && form !== pathname) return NextResponse.redirect(new URL(form + req.nextUrl.search, req.url), 301);
  if (pathname === "/") {
    const code = searchParams.get("bike");
    if (code && /^\d{1,6}$/.test(code)) {
      const to = new URL(`/b/${Number(code)}`, req.url);
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
  // While the site is Coming Soon, it is the only page: /login, /about and anything else go
  // back to it. /store forwards to the shop before this runs (next.config redirects), and
  // /b/* never reaches here (matcher below).
  // Until Home exists the site is closed whatever staff have set, so nothing is read here yet.
  // Once it is open, a page staff have not switched on (Website > Pages) goes to Home the same way.
  const content = HOME_BUILT ? await loadSiteContent() : null;
  const closed = HOME_BUILT ? isComingSoon(content) : true;
  const soon = closed ? comingSoonTarget(pathname) : hiddenPageTarget(pathname, content);
  // A signed-in staff member previewing the site (lib/preview.ts) passes; the preview page itself
  // must always load, since it is how preview starts.
  const previewing = soon && !PREVIEW_PAGE.test(pathname) ? await isStaffToken(req.cookies.get(PREVIEW_COOKIE)?.value) : false;
  if (soon && !previewing && !PREVIEW_PAGE.test(pathname)) return keepLang(NextResponse.redirect(new URL(soon, req.url), 307));
  const res = keepLang(intl(req));
  if (res.status < 300 || res.status >= 400) res.headers.set("Link", alternateLinks(new URL(req.url)));
  return res;
}

// /b/* is excluded on purpose: the NFC chips hold micromobility.sa/b/42 and that URL must
// never be handled as a site page. Those pages carry their own language cookie instead.
// Only /b and /api themselves and what is under them: a bare "b" also caught /business, which
// was a 404 once its address lost the /en in front.
// The two registration forms are excluded too (app/community/registration, app/petromin): they
// are public whatever Coming Soon says, and they carry their own languages. Their exact
// addresses only - /Petromin and the like still come here and are sent to the real one.
export const config = { matcher: ["/((?!api/|api$|b/|b$|_next|community/registration$|petromin$|.*\\..*).*)"] };
