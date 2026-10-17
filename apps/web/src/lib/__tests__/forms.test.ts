import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as community from "../../app/community/registration/route";
import * as petromin from "../../app/petromin/route";
import * as defe from "../../app/defe/route";
import communityPage from "../../forms/community-page";
import petrominPage from "../../forms/petromin-page";
import defePage from "../../forms/defe-page";
import { WAIVER_VERSIONS, waiverCopy } from "../../content/waivers";

// The website serves the two registration forms exactly as their builds leave them
// (forms/community, forms/petromin), with the headers their own Workers sent.
const forms = resolve(__dirname, "../../../../../forms");
// The database host the site is built for (headers.ts reads it the same way).
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qpffkzmsfyilicwcsszz.supabase.co";

describe("the registration forms", () => {
  it("the Defe page uses the website's ride waiver, word for word, at the version it stamps", () => {
    // forms/defe takes the waiver from the booking app (sync-shared); the site's copy is content/waivers.ts.
    const shared = readFileSync(resolve(forms, "defe/shared/shared.js"), "utf8");
    const SH = new Function(shared + ";return SHARED;")() as { WAIVER_VERSION: string; SITE_T: Record<"en" | "ar", { waiverBody: string }> };
    expect(SH.WAIVER_VERSION).toBe(WAIVER_VERSIONS.ride);
    expect(waiverCopy("ride", (en) => en).body).toBe(SH.SITE_T.en.waiverBody);
    expect(waiverCopy("ride", (_en, ar) => ar ?? "").body).toBe(SH.SITE_T.ar.waiverBody);
  });

  it("are the pages the form builds wrote (run the form's build after changing it)", () => {
    expect(communityPage).toBe(readFileSync(resolve(forms, "community/src/page.html"), "utf8"));
    expect(petrominPage).toBe(readFileSync(resolve(forms, "petromin/src/page.html"), "utf8"));
    expect(defePage).toBe(readFileSync(resolve(forms, "defe/src/page.html"), "utf8"));
  });

  it("answer GET with the page and HEAD with its headers only", async () => {
    for (const [route, page] of [[community, communityPage], [petromin, petrominPage], [defe, defePage]] as const) {
      const res = route.GET();
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(page);
      const head = route.HEAD();
      expect(head.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(await head.text()).toBe("");
    }
  });

  it("keep their Workers' headers: not indexed, and only Supabase, fonts and the analytics beacon allowed", () => {
    const c = community.GET().headers, p = petromin.GET().headers, df = defe.GET().headers;
    for (const h of [c, p, df]) {
      expect(h.get("x-robots-tag")).toBe("noindex");
      expect(h.get("cache-control")).toBe("public, max-age=300");
      expect(h.get("content-security-policy")).toContain(`connect-src 'self' ${SUPABASE} https://cloudflareinsights.com`);
      expect(h.get("content-security-policy")).toContain("frame-ancestors 'none'");
    }
    expect(c.get("content-security-policy")).not.toContain("cdn.jsdelivr.net");
    // the Defe page loads no script from elsewhere: its own inline script and the analytics beacon only
    expect(df.get("content-security-policy")).toContain("script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;");
    expect(defePage).not.toMatch(/<script\b[^>]*\bsrc=/);
    // of jsDelivr, only the one file the Petromin page loads (supabase-js, pinned with its integrity hash)
    const js = petrominPage.match(/<script\b[^>]*\bsrc="(https:\/\/cdn\.jsdelivr\.net\/[^"]+)"/)?.[1];
    expect(js).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[\d.]+\/dist\/umd\/supabase\.min\.js$/);
    expect(p.get("content-security-policy")).toContain(`script-src 'self' 'unsafe-inline' ${js} https://static.cloudflareinsights.com;`);
    for (const h of [c, p, df]) expect(h.get("content-security-policy")).not.toMatch(/https:\/\/cdn\.jsdelivr\.net(?:\/)?(?:[\s;]|$)/);
    // all: HTTPS only, as the site's own pages say it; no device features; no form the browser posts itself
    for (const h of [c, p, df]) {
      expect(h.get("strict-transport-security")).toBe("max-age=31536000");
      expect(h.get("x-frame-options")).toBe("DENY");
      expect(h.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=(), payment=()");
      expect(h.get("content-security-policy")).toContain("form-action 'none'");
    }
  });

  it("take their fonts from the website only, which has every file the pages name", () => {
    for (const [route, page] of [[community, communityPage], [petromin, petrominPage]] as const) {
      const csp = route.GET().headers.get("content-security-policy") || "";
      expect(csp).toContain("font-src 'self'");
      expect(csp).not.toMatch(/googleapis|gstatic/);
      expect(page).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
      const named = [...page.matchAll(/url\("\/fonts\/forms\/([a-z0-9-]+\.woff2)"\)/g)].map((m) => m[1]);
      expect(named.length).toBeGreaterThanOrEqual(10);
      for (const f of named) expect(existsSync(resolve(__dirname, "../../../public/fonts/forms", f)), f).toBe(true);
    }
    // The Defe page: Archivo for its display lines (under its own licence beside it), Space Grotesk, IBM Plex Sans Arabic.
    const csp = defe.GET().headers.get("content-security-policy") || "";
    expect(csp).toContain("font-src 'self'");
    expect(defePage).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    const named = [...defePage.matchAll(/url\("\/fonts\/forms\/([a-z0-9-]+\.woff2)"\)/g)].map((m) => m[1]);
    expect(named).toContain("archivo-latin-wdth-wght.woff2");
    expect(named.length).toBeGreaterThanOrEqual(9);
    for (const f of named) expect(existsSync(resolve(__dirname, "../../../public/fonts/forms", f)), f).toBe(true);
    expect(existsSync(resolve(__dirname, "../../../public/fonts/forms/OFL-Archivo.txt"))).toBe(true);
  });

  it("have the community form's link-preview image where its page points", () => {
    expect(communityPage).toContain("https://micromobility.sa/community/registration/og-image.png");
    expect(existsSync(resolve(__dirname, "../../../public/community/registration/og-image.png"))).toBe(true);
  });
});
