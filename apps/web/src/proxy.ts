import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { HOME_BUILT, isComingSoon, loadSiteContent } from "./lib/site";
import { comingSoonTarget } from "./lib/coming-soon-route";
import { PREVIEW_COOKIE, isStaffToken } from "./lib/preview";

const intl = createMiddleware(routing);

export default async function proxy(req: NextRequest) {
  // The handoff spec writes the tag URL as /?bike=42; the chips carry /b/42 instead. Anything
  // still using the old form is moved over here rather than through next.config redirects,
  // because those append the original query and would leave ?bike=42 sitting in the address
  // bar. The code belongs in the path or nowhere.
  const { pathname, searchParams } = req.nextUrl;
  if (pathname === "/") {
    const code = searchParams.get("bike");
    if (code && /^\d{1,6}$/.test(code)) {
      const to = new URL(`/b/${Number(code)}`, req.url);
      return NextResponse.redirect(to, 307);
    }
  }
  // While the site is Coming Soon, it is the only page: /en/login, /about and anything else
  // go back to it. /store forwards to the shop before this runs (next.config redirects), and
  // /b/* never reaches here (matcher below).
  // Until Home exists the site is closed whatever staff have set, so nothing is read here yet.
  const closed = HOME_BUILT ? isComingSoon(await loadSiteContent()) : true;
  const soon = closed ? comingSoonTarget(pathname) : null;
  // A signed-in staff member previewing the site (lib/preview.ts) passes; the preview page itself
  // must always load, since it is how preview starts.
  const previewing = soon && !/^\/(en|ar)\/preview\/?$/.test(pathname) ? await isStaffToken(req.cookies.get(PREVIEW_COOKIE)?.value) : false;
  if (soon && !previewing && !/^\/(en|ar)\/preview\/?$/.test(pathname)) return NextResponse.redirect(new URL(soon, req.url), 307);
  return intl(req);
}

// /b/* is excluded on purpose: the NFC chips hold micromobility.sa/b/42 and that URL must
// never be rewritten to /en/b/42. Those pages carry their own language cookie instead.
export const config = { matcher: ["/((?!api|b|_next|.*\\..*).*)"] };
