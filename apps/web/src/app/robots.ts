import type { MetadataRoute } from "next";
import { HOME_BUILT, isComingSoon, loadSiteContent } from "@/lib/site";

// Search engines stay out while the site is Coming Soon (the launch package ships the same
// Disallow: / until launch day).
export default async function robots(): Promise<MetadataRoute.Robots> {
  const closed = HOME_BUILT ? isComingSoon(await loadSiteContent()) : true;
  return closed
    ? { rules: { userAgent: "*", disallow: "/" } }
    : { rules: { userAgent: "*", allow: "/" } };
}
