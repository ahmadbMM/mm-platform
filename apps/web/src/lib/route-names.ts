import { routesSchema } from "@/content/pages/routes";
import { resolvePage, type Locale } from "./content";
import type { SiteContent } from "./site";

// The routes on the Routes page by their slug (content/pages/routes.ts): a ride that carries a
// route (sessions.route_slug, lib/rides.ts) is named after the route in the visitor's language.
export function routeNames(content: SiteContent | null, locale: Locale): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of resolvePage(routesSchema, content, locale).routes.items) if (r.slug && r.name && !out.has(r.slug)) out.set(r.slug, r.name);
  return out;
}

/** The route's name for a session, or null when it names none, or one the page no longer lists. */
export const routeNameOf = (names: Map<string, string>, slug: string | null | undefined): string | null => (slug ? names.get(slug) ?? null : null);
