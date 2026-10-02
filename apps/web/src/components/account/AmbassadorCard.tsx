"use client";

import { useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { intlOf } from "@/i18n/locales";
import { fmtNum } from "@/lib/fill";
import type { AmbassadorMine } from "@/lib/account-extras";
import { T } from "./Account.text";

// The ambassador's own card on My Account (the booking app's _ambMinePaint, ambassador_mine): an
// account that is an ambassador - by its id, else by its mobile - sees its code with Share and
// Copy, the points it earned, the points left to spend and how many friends used it, the last five
// uses, and a Paused pill while the code is paused. Anyone else sees nothing.
export default function AmbassadorCard({ locale, a }: { locale: string; a: AmbassadorMine }) {
  const t = useLocalize(T);
  const [copied, setCopied] = useState(false);
  const N = (n: number) => fmtNum(n, locale);
  const day = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    try { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", timeZone: "Asia/Riyadh" }).format(d); } catch { return ""; }
  };
  async function copy() {
    try { await navigator.clipboard.writeText(a.code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the code is on screen to copy by hand */ }
  }
  async function share() {
    try { if (navigator.share) { await navigator.share({ text: a.code }); return; } } catch { return; } // a share the rider closed is not an error
    await copy();
  }
  return (
    <section className="ac-panel ac-amb" aria-labelledby="ac-amb-h">
      <div className="ac-amb-top">
        <h2 id="ac-amb-h" className="ac-panel-h">{t.ambTitle}</h2>
        {a.status === "paused" && <span className="ac-pill warn">{t.ambPaused}</span>}
      </div>
      <div className="ac-amb-code">
        <span className="ac-k">{t.ambCode}</span>
        <strong dir="ltr">{a.code}</strong>
        <div className="ac-row-btns">
          <button type="button" className="ac-btn" onClick={share}>{t.ambShare}</button>
          <button type="button" className="ac-btn ac-btn-line" onClick={copy} aria-live="polite">{copied ? t.copied : t.copy}</button>
        </div>
      </div>
      <dl className="ac-kpis">
        <div><dt>{t.ambPoints}</dt><dd>{N(a.earned)}</dd></div>
        <div><dt>{t.ambBalance}</dt><dd>{N(a.balance)}</dd></div>
        <div><dt>{t.ambUses}</dt><dd>{N(a.uses)}</dd></div>
      </dl>
      {a.events.length > 0 && (
        <>
          <p className="ac-k">{t.ambRecent}</p>
          <ul className="ac-list">
            {a.events.map((e, i) => (
              <li key={i} className={e.status === "void" ? "void" : undefined}>
                <span>{t.ambCtx[e.context] || e.context}<small>{day(e.at)} · {t.ambSt[e.status] || e.status}</small></span>
                <strong dir="ltr">{e.points > 0 ? "+" : ""}{N(e.points)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
