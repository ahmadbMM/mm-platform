import { serverLocalize } from "@/i18n/dicts";
import { pickBi, paragraphs, type StoreProduct } from "@/lib/store-core";
import { StIcon } from "../icons";
import { T } from "../w3b.text";

// The product's questions (F41): each a collapsed row with a drawn chevron that opens its answer (collapsed sections
// beat tabs). Native <details>, so it works before the page's script has run and with the keyboard.
export default function ProductFaq({ p, locale }: { p: StoreProduct; locale: string }) {
  if (!p.faq.length) return null;
  const w = serverLocalize(T, locale);
  return (
    <section className="st-pd-sec" aria-labelledby="st-pd-faq-h">
      <h2 id="st-pd-faq-h">{w.faqH}</h2>
      <div className="st-pd-faq">
        {p.faq.map((f, i) => (
          <details key={i}>
            <summary><span dir="auto">{pickBi(locale, f.q)}</span><StIcon name="chevronDown" size={20} className="st-pd-chev" /></summary>
            <div className="st-pd-faq-a">{paragraphs(pickBi(locale, f.a)).map((x, j) => <p key={j} dir="auto">{x}</p>)}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
