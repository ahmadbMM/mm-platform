import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export default function proxy(req: NextRequest) {
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
  return intl(req);
}

// /b/* is excluded on purpose: the NFC chips hold micromobility.sa/b/42 and that URL must
// never be rewritten to /en/b/42. Those pages carry their own language cookie instead.
export const config = { matcher: ["/((?!api|b|_next|.*\\..*).*)"] };
