import type { MetadataRoute } from "next";
import { COMING_SOON } from "@/lib/site";

// Search engines stay out while the site is Coming Soon (the launch package ships the same
// Disallow: / until launch day).
export default function robots(): MetadataRoute.Robots {
  return COMING_SOON
    ? { rules: { userAgent: "*", disallow: "/" } }
    : { rules: { userAgent: "*", allow: "/" } };
}
