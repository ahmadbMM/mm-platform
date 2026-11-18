// The server's half of the 2026-11-18 Experiences build (builder B6): what the Experiences page hands the booking flow.
// Server only (it reads the store through lib/store.ts and its memo).
import type { SiteContent } from "./site";
import { discountLicence, loadStore, storeOpen } from "./store";
import { SITE_URL } from "./seo";
import { KIT_NAMES, kitPick, packsOf, xpSettings, type SxFlow } from "./sx-b6";
import { rpcServer } from "./account";
import { payReady } from "./pay/config";
import { paySettings } from "./pay/settings";

/** The settings staff keep under xp.* (all off until set) and, while the store is open, the store's products each kind
 *  of ride links on its confirmation (N32): by the slugs staff set in xp.kit, else by name; never a helmet. Any failure
 *  reading the store leaves the kit empty. */
export async function sxFlow(content: SiteContent | null | undefined, locale: string): Promise<SxFlow> {
  const c = (content ?? {}) as Record<string, unknown>;
  const xs = xpSettings(c, !!discountLicence(content));
  // a gift is paid online: offered only where payments are on (staging) as well as switched on
  const settings = { ...xs, gifts: xs.gifts && paySettings(content).enabled && payReady() };
  let kit: SxFlow["kit"] = { night: [], saturday: [] };
  if (storeOpen(content)) {
    try {
      const st = await loadStore();
      const ps = (st?.products ?? []).filter((p) => p.kind !== "gift_card" && !p.preview).map((p) => ({
        slug: p.slug, name: (locale === "ar" && p.name_ar) || p.name_en, photo: p.images[0] ?? null,
        // matched by its English name whatever the page's language
        en: p.name_en,
      }));
      const byEn = (want: string[], re: RegExp) => {
        const picked = kitPick(ps.map((p) => ({ slug: p.slug, name: p.en, photo: p.photo })), want, re);
        return picked.map((k) => ({ ...k, name: ps.find((p) => p.slug === k.slug)?.name ?? k.name }));
      };
      kit = { night: byEn(settings.kit.night, KIT_NAMES.night), saturday: byEn(settings.kit.saturday, KIT_NAMES.saturday) };
    } catch { /* no kit */ }
  }
  // EF21: the packs staff sell, only where payments are on; none while the database has no packs (or no function)
  const packs = paySettings(content).enabled && payReady()
    ? await rpcServer<unknown[]>("xp_packs_list", {}).then((r) => (r.status === 200 ? packsOf(r.data, locale) : []), () => [])
    : [];
  return { settings, kit, origin: SITE_URL, packs };
}
