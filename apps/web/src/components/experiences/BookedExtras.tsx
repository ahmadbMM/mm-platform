"use client";

import { useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { kitFor, type KitItem, type SxFlow } from "@/lib/sx-b6";
import { Ic } from "./BookIcons";
import GiftRide from "./GiftRide";
import { T } from "./sx-B6.text";
import "./sx-B6.css";

// Under the tickets on the website's confirmation (EM09-B, N32, EF20; the user, 2026-11-18: "do all"). With no email and
// no text message (R5) this page is the rider's record, so it says until when the booking can be cancelled or changed,
// with Manage booking; the kit the ride calls for, from the store (lights and the radar after dark, the bike computer on
// the Saturday ride; never a helmet, which comes free with every ride); and Gift a ride on a circuit ride while staff
// offer gifts. The ticket above carries the code, Wallet, the calendar entry, Directions and Share.
export default function BookedExtras({ locale, kind, start, sx, manage, until, prices, typeNames }: {
  locale: string; kind: string; start: string | null; sx: SxFlow | undefined; manage: string;
  /** The last day it may be cancelled or changed, already written; null: not said. */
  until: string | null;
  /** The circuit's fares by bike type, for Gift a ride. */
  prices: Record<string, number>; typeNames: Record<string, string>;
}) {
  const t = useLocalize(T);
  const [gift, setGift] = useState(false);
  const k = kitFor(kind, start);
  const kit: KitItem[] = k && sx ? sx.kit[k] : [];
  const giftOn = !!sx?.settings.gifts && kind === "jcc" && Object.values(prices).some((p) => p >= 1);
  return (
    <div className="sx6-after">
      <div className="sx6-manage">
        {until && <p className="sx6-until">{until}</p>}
        <a className="bk-btn2" href={manage}>{t.manage}</a>
        {giftOn && <button type="button" className="bk-btn2" aria-haspopup="dialog" onClick={() => setGift(true)}><GiftIc />{t.giftThis}</button>}
      </div>
      {kit.length > 0 && (
        <section className="sx6-kit" aria-labelledby="sx6-kit-h">
          <h3 id="sx6-kit-h" className="sx6-kit-h">{t.forRide}</h3>
          <ul>
            {kit.map((p) => (
              <li key={p.slug}>
                <a href={`/store/${p.slug}`}>
                  {p.photo ? <img src={p.photo} alt="" width={56} height={56} loading="lazy" decoding="async" /> : <span className="sx6-kit-ph" aria-hidden="true"><Ic name="bike" size={22} /></span>}
                  <span>{p.name}</span>
                  <Ic name="go" size={16} flip />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {gift && <GiftRide locale={locale} prices={prices} typeNames={typeNames} onClose={() => setGift(false)} />}
    </div>
  );
}

const GiftIc = () => (
  <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="8.5" width="17" height="4" rx="1" /><path d="M5 12.5v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 8.5v12M12 8.5c-1.6-3.6-5.4-4-5.4-1.6 0 1.6 3 1.6 5.4 1.6zM12 8.5c1.6-3.6 5.4-4 5.4-1.6 0 1.6-3 1.6-5.4 1.6z" />
  </svg>
);
