import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as community from "../../app/community/registration/route";
import * as petromin from "../../app/petromin/route";
import communityPage from "../../forms/community-page";
import petrominPage from "../../forms/petromin-page";

// The website serves the two registration forms exactly as their builds leave them
// (forms/community, forms/petromin), with the headers their own Workers sent.
const forms = resolve(__dirname, "../../../../../forms");
// The database host the site is built for (headers.ts reads it the same way).
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qpffkzmsfyilicwcsszz.supabase.co";

describe("the registration forms", () => {
  it("are the pages the form builds wrote (run the form's build after changing it)", () => {
    expect(communityPage).toBe(readFileSync(resolve(forms, "community/src/page.html"), "utf8"));
    expect(petrominPage).toBe(readFileSync(resolve(forms, "petromin/src/page.html"), "utf8"));
  });

  it("answer GET with the page and HEAD with its headers only", async () => {
    for (const [route, page] of [[community, communityPage], [petromin, petrominPage]] as const) {
      const res = route.GET();
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(page);
      const head = route.HEAD();
      expect(head.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(await head.text()).toBe("");
    }
  });

  it("keep their Workers' headers: not indexed, and only Supabase, fonts and the analytics beacon allowed", () => {
    const c = community.GET().headers, p = petromin.GET().headers;
    for (const h of [c, p]) {
      expect(h.get("x-robots-tag")).toBe("noindex");
      expect(h.get("cache-control")).toBe("public, max-age=300");
      expect(h.get("content-security-policy")).toContain(`connect-src 'self' ${SUPABASE} https://cloudflareinsights.com`);
      expect(h.get("content-security-policy")).toContain("frame-ancestors 'none'");
    }
    expect(c.get("content-security-policy")).toContain("form-action 'none'");
    expect(c.get("content-security-policy")).not.toContain("cdn.jsdelivr.net");
    expect(p.get("content-security-policy")).toContain("script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com");
    expect(c.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=(), payment=()");
  });

  it("have the community form's link-preview image where its page points", () => {
    expect(communityPage).toContain("https://micromobility.sa/community/registration/og-image.png");
    expect(existsSync(resolve(__dirname, "../../../public/community/registration/og-image.png"))).toBe(true);
  });
});
