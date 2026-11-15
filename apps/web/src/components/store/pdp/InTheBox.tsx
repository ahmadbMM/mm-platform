import { serverLocalize } from "@/i18n/dicts";
import { pick, type StoreProduct } from "@/lib/store-core";
import { StIcon, specIcon } from "../icons";
import { T } from "../w3b.text";

// What's in the box (F37): a short list, each thing with its drawn mark and its name, so nobody opens the box
// expecting what is not there.
export default function InTheBox({ p, locale }: { p: StoreProduct; locale: string }) {
  if (!p.box.length) return null;
  const w = serverLocalize(T, locale);
  return (
    <section className="st-pd-card" aria-labelledby="st-pd-box-h">
      <h2 id="st-pd-box-h" className="st-pd-h3">{w.boxH}</h2>
      <ul className="st-pd-box">
        {p.box.map((b, i) => (
          <li key={i}><span className="st-pd-box-ic"><StIcon name={specIcon(b.icon)} size={22} /></span><bdi>{pick(locale, b.en, b.ar)}</bdi></li>
        ))}
      </ul>
    </section>
  );
}
