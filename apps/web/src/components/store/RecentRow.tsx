"use client";

import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { sized } from "@/lib/img";
import { productHref } from "@/lib/store-core";
import { bySlugs, type RecentItem } from "@/lib/store-listing";
import BidiText from "./BidiText";
import { NoPhoto } from "./bits";
import { useRecent } from "./useLists";
import { T as W } from "./w2.text";

// Recently viewed (F08): one row of four small photos at the page's end, of the products this browser last opened (the
// product page notes them: RecordView). Kept in this browser alone; nothing is drawn until it has one.
export default function RecentRow({ items, locale }: { items: RecentItem[]; locale: string }) {
  const w = useLocalize(W);
  const list = bySlugs(items, useRecent(), 4);
  if (!list.length) return null;
  return (
    <section className="st-recent" aria-labelledby="st-recent-h">
      <h2 id="st-recent-h" className="st-h2">{w.recent}</h2>
      <ul>
        {list.map((p) => (
          <li key={p.slug}>
            <Link href={productHref(p)}>
              <span className="st-recent-img">{p.image ? <img src={sized(p.image, 640)} alt="" loading="lazy" decoding="async" /> : <NoPhoto />}</span>
              <span className="st-recent-name"><BidiText text={p.name} locale={locale} /></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
