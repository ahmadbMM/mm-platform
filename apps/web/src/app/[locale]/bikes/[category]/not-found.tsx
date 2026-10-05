import { getLocale } from "next-intl/server";
import BrandField from "@/components/bikes/BrandField";
import "@/components/bikes/bike.css";
import { isBikeLang, tFor } from "@/lib/bike-i18n";
import { stagingTitle } from "@/lib/staging";
import SiteNotFound from "../../not-found";
import TagOr404, { TagCode } from "./TagOr404";

// /bikes/<number> for a sticker nobody has linked to a bike answers 404 (the page calls notFound()),
// and still shows the tag page's friendly dead end - what the sticker says and the way out, as
// components/bikes/FleetBike.tsx draws it for a missing bike. Any other address under /bikes that
// has no page (a category or model that is gone) gets the site's own 404, as before.
export default async function BikesNotFound() {
  const locale = await getLocale();
  const t = tFor(isBikeLang(locale) ? locale : "en");
  const tag = (
    <div className="bk-root">
      <title>{stagingTitle(`${t("unknownTitle")} · MicroMobility`)}</title>
      <main className="bk-unknown">
        <BrandField />
        <h1>{t("unknownTitle")}</h1>
        <p className="lat">micromobility.sa/bikes/<TagCode /></p>
        <a className="bk-cta" href="https://micromobility.sa">{t("unknownCta")}</a>
      </main>
    </div>
  );
  return <TagOr404 tag={tag} site={<SiteNotFound />} />;
}
