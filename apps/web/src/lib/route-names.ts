import { routesSchema } from "@/content/pages/routes";
import { resolvePage, type Locale } from "./content";
import type { SiteContent } from "./site";
import type { RouteItem } from "./tickets";

// The routes on the Routes page by their slug (content/pages/routes.ts): a ride that carries a
// route (sessions.route_slug, lib/rides.ts) is named after the route in the visitor's language.
export function routeNames(content: SiteContent | null, locale: Locale): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of resolvePage(routesSchema, content, locale).routes.items) if (r.slug && r.name && !out.has(r.slug)) out.set(r.slug, r.name);
  return out;
}

/** The route's name for a session, or null when it names none, or one the page no longer lists. */
export const routeNameOf = (names: Map<string, string>, slug: string | null | undefined): string | null => (slug ? names.get(slug) ?? null : null);

/** The routes with what a ticket says of them (ticketRoute): name, distance, level, surface and the
 *  map link, by slug, in the visitor's language. */
export function routeItems(content: SiteContent | null, locale: Locale): Map<string, RouteItem> {
  const out = new Map<string, RouteItem>();
  for (const r of resolvePage(routesSchema, content, locale).routes.items) {
    if (!r.slug || !r.name || out.has(r.slug)) continue;
    // resolvePage hands a link field back as its address (a string), never as {href}
    out.set(r.slug, { name: r.name, km: Number(r.km) || 0, level: String(r.level ?? ""), surface: String(r.surface ?? ""), href: typeof r.href === "string" ? r.href : "" });
  }
  return out;
}
