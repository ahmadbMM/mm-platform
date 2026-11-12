import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as community from "../../app/community/registration/route";
import * as petromin from "../../app/petromin/route";
import * as dukan from "../../app/dukan/route";
import * as pminvite from "../../app/petromin-invite/route";
import * as saturday from "../../app/saturday/route";
import * as lockers from "../../app/lockers/route";
import communityPage from "../../forms/community-page";
import petrominPage from "../../forms/petromin-page";
import dukanPage from "../../forms/dukan-page";
import pminvitePage from "../../forms/petromin-invite-page";
import saturdayPage from "../../forms/saturday-page";
import lockersPage from "../../forms/lockers-page";
import { WAIVER_VERSIONS, waiverCopy } from "../../content/waivers";

// The website serves the registration forms exactly as their builds leave them
// (forms/community, forms/petromin, forms/dukan, forms/petromin-invite), with the headers their own Workers sent.
const forms = resolve(__dirname, "../../../../../forms");
// The database host the site is built for (headers.ts reads it the same way).
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qpffkzmsfyilicwcsszz.supabase.co";

describe("the registration forms", () => {
  it("the Saturday page uses the website's ride waiver, word for word, at the version it stamps", () => {
    // forms/saturday takes the waiver from the booking app (sync-shared); the site's copy is content/waivers.ts.
    for (const form of ["saturday"]) {
      const shared = readFileSync(resolve(forms, form + "/shared/shared.js"), "utf8");
      const SH = new Function(shared + ";return SHARED;")() as { WAIVER_VERSION: string; SITE_T: Record<"en" | "ar", { waiverBody: string }> };
      expect(SH.WAIVER_VERSION, form).toBe(WAIVER_VERSIONS.ride);
      expect(waiverCopy("ride", (en) => en).body, form).toBe(SH.SITE_T.en.waiverBody);
      expect(waiverCopy("ride", (_en, ar) => ar ?? "").body, form).toBe(SH.SITE_T.ar.waiverBody);
    }
  });

  it("are the pages the form builds wrote (run the form's build after changing it)", () => {
    expect(communityPage).toBe(readFileSync(resolve(forms, "community/src/page.html"), "utf8"));
    expect(petrominPage).toBe(readFileSync(resolve(forms, "petromin/src/page.html"), "utf8"));
    expect(dukanPage).toBe(readFileSync(resolve(forms, "dukan/src/page.html"), "utf8"));
    expect(pminvitePage).toBe(readFileSync(resolve(forms, "petromin-invite/src/page.html"), "utf8"));
    expect(saturdayPage).toBe(readFileSync(resolve(forms, "saturday/src/page.html"), "utf8"));
    expect(lockersPage).toBe(readFileSync(resolve(forms, "lockers/src/page.html"), "utf8"));
  });

  it("answer GET with the page and HEAD with its headers only", async () => {
    for (const [route, page] of [[community, communityPage], [petromin, petrominPage], [dukan, dukanPage], [pminvite, pminvitePage], [saturday, saturdayPage], [lockers, lockersPage]] as const) {
      const res = route.GET();
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(page);
      const head = route.HEAD();
      expect(head.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(await head.text()).toBe("");
    }
  });

  it("keep their Workers' headers: not indexed, and only Supabase, fonts and the analytics beacon allowed", () => {
    const c = community.GET().headers, p = petromin.GET().headers, dk = dukan.GET().headers, pi = pminvite.GET().headers, sa = saturday.GET().headers, lk = lockers.GET().headers;
    for (const h of [c, p, dk, pi, sa, lk]) {
      expect(h.get("x-robots-tag")).toBe("noindex");
      expect(h.get("cache-control")).toBe("public, max-age=300");
      expect(h.get("content-security-policy")).toContain(`connect-src 'self' ${SUPABASE} https://cloudflareinsights.com`);
      expect(h.get("content-security-policy")).toContain("frame-ancestors 'none'");
    }
    expect(c.get("content-security-policy")).not.toContain("cdn.jsdelivr.net");
    // the Saturday page loads no script from elsewhere: its own inline script and the analytics beacon only (2026-11-08)
    expect(sa.get("content-security-policy")).toContain("script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;");
    expect(saturdayPage).not.toMatch(/<script\b[^>]*\bsrc=/);
    // and so does the lockers page (2026-11-09)
    expect(lk.get("content-security-policy")).toContain("script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;");
    expect(lockersPage).not.toMatch(/<script\b[^>]*\bsrc=/);
    // and so does Dukan's form (2026-11-12): its calls are plain POSTs, no supabase-js
    expect(dk.get("content-security-policy")).toContain("script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;");
    expect(dukanPage).not.toMatch(/<script\b[^>]*\bsrc=/);
    // and so does the Petromin guests' form (2026-11-12), the same kind
    expect(pi.get("content-security-policy")).toContain("script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;");
    expect(pminvitePage).not.toMatch(/<script\b[^>]*\bsrc=/);
    // of jsDelivr, only the one file the Petromin page loads (supabase-js, pinned with its integrity hash)
    const js = petrominPage.match(/<script\b[^>]*\bsrc="(https:\/\/cdn\.jsdelivr\.net\/[^"]+)"/)?.[1];
    expect(js).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[\d.]+\/dist\/umd\/supabase\.min\.js$/);
    expect(p.get("content-security-policy")).toContain(`script-src 'self' 'unsafe-inline' ${js} https://static.cloudflareinsights.com;`);
    for (const h of [c, p, dk, pi, sa, lk]) expect(h.get("content-security-policy")).not.toMatch(/https:\/\/cdn\.jsdelivr\.net(?:\/)?(?:[\s;]|$)/);
    // all: HTTPS only, as the site's own pages say it; no device features; no form the browser posts itself
    for (const h of [c, p, dk, pi, sa, lk]) {
      expect(h.get("strict-transport-security")).toBe("max-age=31536000");
      expect(h.get("x-frame-options")).toBe("DENY");
      expect(h.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=(), payment=()");
      expect(h.get("content-security-policy")).toContain("form-action 'none'");
    }
  });

  it("take their fonts from the website only, which has every file the pages name", () => {
    for (const [route, page] of [[community, communityPage], [petromin, petrominPage], [dukan, dukanPage], [pminvite, pminvitePage]] as const) {
      const csp = route.GET().headers.get("content-security-policy") || "";
      expect(csp).toContain("font-src 'self'");
      expect(csp).not.toMatch(/googleapis|gstatic/);
      expect(page).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
      const named = [...page.matchAll(/url\("\/fonts\/forms\/([a-z0-9-]+\.woff2)"\)/g)].map((m) => m[1]);
      // the community form is in the booking app's Rubik since 2026-11-11 (one variable face a script: 8 files); Petromin keeps Space Grotesk
      // and Dukan's in Rubik, Dukan's own face (dukan.me), with IBM Plex Sans Arabic for Urdu; the Petromin guests' form wears
      // the Petromin form's faces
      expect(named.length).toBeGreaterThanOrEqual(route === petromin || route === pminvite ? 10 : 8);
      for (const f of named) expect(existsSync(resolve(__dirname, "../../../public/fonts/forms", f)), f).toBe(true);
    }
    expect([...communityPage.matchAll(/url\("\/fonts\/forms\/([a-z0-9-]+\.woff2)"\)/g)].map((m) => m[1])).toContain("rubik-var-latin.woff2");
    expect(existsSync(resolve(__dirname, "../../../public/fonts/forms/OFL-Rubik.txt"))).toBe(true);
    expect([...dukanPage.matchAll(/url\("\/fonts\/forms\/([a-z0-9-]+\.woff2)"\)/g)].map((m) => m[1])).toEqual(expect.arrayContaining(["rubik-var-latin.woff2", "rubik-var-arabic.woff2"]));
    // The Petromin guests' form: the Petromin form's Space Grotesk and IBM Plex Sans Arabic, and the site's riyal sign for its
    // fare (public/fonts/Riyal-*.woff2, as the lockers page and the account page's tickets draw it).
    expect([...pminvitePage.matchAll(/url\("\/fonts\/forms\/([a-z0-9-]+\.woff2)"\)/g)].map((m) => m[1])).toEqual(expect.arrayContaining(["space-grotesk-latin-400.woff2", "ibm-plex-sans-arabic-arabic-400.woff2"]));
    const piRiyal = [...pminvitePage.matchAll(/url\("\/fonts\/(Riyal-\d+\.woff2)"\)/g)].map((m) => m[1]);
    expect(piRiyal).toEqual(["Riyal-400.woff2", "Riyal-700.woff2"]);
    for (const f of piRiyal) expect(existsSync(resolve(__dirname, "../../../public/fonts", f)), f).toBe(true);
    // The Saturday page: Archivo for its display lines (under its own licence beside it), Space Grotesk, IBM Plex Sans Arabic.
    expect(saturday.GET().headers.get("content-security-policy") || "").toContain("font-src 'self'");
    expect(saturdayPage).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    const satNamed = [...saturdayPage.matchAll(/url\("\/fonts\/forms\/([a-z0-9-]+\.woff2)"\)/g)].map((m) => m[1]);
    expect(satNamed).toContain("archivo-latin-wdth-wght.woff2");
    expect(existsSync(resolve(__dirname, "../../../public/fonts/forms/OFL-Archivo.txt"))).toBe(true);
    expect(satNamed.length).toBeGreaterThanOrEqual(9);
    for (const f of satNamed) expect(existsSync(resolve(__dirname, "../../../public/fonts/forms", f)), f).toBe(true);
    // The lockers page: the Saturday page's fonts, and the site's riyal sign (public/fonts/Riyal-*.woff2, as the
    // tickets on the account page draw it).
    expect(lockers.GET().headers.get("content-security-policy") || "").toContain("font-src 'self'");
    expect(lockersPage).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    const lkNamed = [...lockersPage.matchAll(/url\("\/fonts\/((?:forms\/)?[A-Za-z0-9-]+\.woff2)"\)/g)].map((m) => m[1]);
    expect(lkNamed).toContain("Riyal-400.woff2");
    expect(lkNamed.length).toBeGreaterThanOrEqual(11);
    for (const f of lkNamed) expect(existsSync(resolve(__dirname, "../../../public/fonts", f)), f).toBe(true);
  });

  it("have the community form's link-preview image where its page points", () => {
    expect(communityPage).toContain("https://micromobility.sa/community/registration/og-image.png");
    expect(existsSync(resolve(__dirname, "../../../public/community/registration/og-image.png"))).toBe(true);
  });
});
