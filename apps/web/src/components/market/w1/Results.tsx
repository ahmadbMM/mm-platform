"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { mkErrorKey, type MkCard } from "@/lib/market/core";
import { w1Append, type W1Filters } from "@/lib/market/w1";
import { T, mkErrorText } from "../Market.text";
import { T as W } from "../w1.text";
import ListingCard from "./ListingCard";
import { moreListings } from "./more";

// A grid of listings and its "Show more" button: the cards the page came with, then, a page of 24 at a time, the ones
// the button asks for (./more.ts) - never on their own as the visitor scrolls. While it asks the button says so and
// cannot be pressed twice; a refusal is said under the grid with the button still there to try again; the keyboard is
// taken to the first card that arrived, so a reader carries on where the list grew. The page keys this by its search
// (lib/market/w1.ts w1Key), so a new search starts a new list.
//   items, next   the first page and its cursor (null: there is no more)
//   filters       the search, sent back with the cursor
//   shop          a shop's slug on a shop's page
export default function Results({ items, next, filters, shop = null, locale }: { items: MkCard[]; next: string | null; filters: W1Filters; shop?: string | null; locale: string }) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const [list, setList] = useState(items);
  const [cursor, setCursor] = useState(next);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const arrived = useRef<number | null>(null);

  useEffect(() => {
    const id = arrived.current;
    if (id === null) return;
    arrived.current = null;
    document.getElementById(`mk-w1-c${id}`)?.focus({ preventScroll: true });
  }, [list]);

  async function more() {
    if (!cursor || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await moreListings({ filters, shop, after: cursor });
      if (r.ok) {
        const have = new Set(list.map((c) => c.id));
        arrived.current = r.items.find((c) => !have.has(c.id))?.id ?? null;
        setList((l) => w1Append(l, r.items));
        setCursor(r.next);
      } else {
        setErr(mkErrorText(t, mkErrorKey(r.error, r.detail)));
      }
    } catch {
      setErr(t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ul className="mk-w1-grid" role="list">
        {list.map((c, i) => (
          <li key={c.id}><ListingCard c={c} t={t} w={w} locale={locale} eager={i < 4} anchor={`mk-w1-c${c.id}`} /></li>
        ))}
      </ul>
      {err && <p className="mk-err mk-w1-more-err" role="alert">{err}</p>}
      {cursor && (
        <p className="mk-w1-more">
          <button type="button" className="mk-btn2" onClick={more} disabled={busy} aria-busy={busy}>{busy ? w.loading : w.more}</button>
        </p>
      )}
    </>
  );
}
