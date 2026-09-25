import type { MetadataRoute } from "next";
import { isComingSoon, loadSiteContent, siteCanOpen } from "@/lib/site";
import { SITE_URL } from "@/lib/seo";

// Search engines stay out while the site is Coming Soon (the launch package ships the same
// Disallow: / until launch day). Once it is open they read everything but the private parts -
// the API, the staff preview and a visitor's own account - and are pointed at the sitemap.
// Read on every request: built once, it kept the Coming Soon "Disallow: /" after launch until the
// next deploy.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const closed = siteCanOpen() ? isComingSoon(await loadSiteContent()) : true;
  return closed
    ? { rules: { userAgent: "*", disallow: "/" } }
    : {
        rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/preview", "/account"] },
        sitemap: `${SITE_URL}/sitemap.xml`,
      };
}
