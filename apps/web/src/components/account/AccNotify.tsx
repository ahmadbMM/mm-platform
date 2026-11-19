"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { UpdKind } from "@/lib/account-notify";
import type { NotifyWords } from "./Notify.words";
import AccIcon, { type AccIconName } from "./AccIcon";
import { postAcc } from "./AccForm";

// My Account > Notifications and Updates, as the booking app has them (its Notifications page, 2026-11-13; rider-updates.js;
// lib/account-notify.ts): the way to Updates (its row with how many are unread), then Ride news - the rider's own yes or no
// to WhatsApp ride news, what it is now and the one button that changes it (customer_consents through
// /api/account/consents, the app's toggleRideNews), and the Privacy Notice. No push switches: push stays dormant.
// Updates: every message the app addressed to the rider, newest first, each with its glyph, its title (a dot while it was
// unread), its text, its day and where a tap leads; reading the list marked them read.

/** The Updates row on Notifications: its count of unread ones, when the database said it. */
export function UpdatesRow({ w, unread }: { w: NotifyWords; unread: number }) {
  return (
    <ul className="acm-list acm-notify-list">
      <li>
        <Link href="/account/updates" className="acm-row" data-row="updates">
          <span className="acm-row-ic"><AccIcon name="chat" /></span>
          <span className="acm-row-t">{w.updates}</span>
          {unread > 0 && <span className="acm-row-v acm-count"><bdi>{unread}</bdi></span>}
          <AccIcon name="go" size={16} className="acm-row-go" />
        </Link>
      </li>
    </ul>
  );
}

/** Ride news: never shown with a state that is not stored (the page draws it only once customer_consents answered). */
export function RideNews({ w, initial, errConn }: { w: NotifyWords; initial: boolean; errConn: string }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function flip() {
    if (busy) return;
    setBusy(true); setErr("");
    const b = await postAcc<{ rideNews?: boolean }>("/api/account/consents", { rideNews: !on });
    setBusy(false);
    if (b.ok && typeof b.rideNews === "boolean") { setOn(b.rideNews); router.refresh(); return; }
    if (b.error === "signin") { window.location.reload(); return; }
    setErr(errConn);
  }
  return (
    <section className="acm-card acm-rn" aria-labelledby="acm-rn-h">
      <h2 className="acm-rn-h" id="acm-rn-h">{w.rideNews}</h2>
      <p className={`acm-rn-state${on ? " is-on" : ""}`} role="status">{on ? w.rnOnState : w.rnOffState}</p>
      {err && <p className="acm-err" role="alert">{err}</p>}
      <button type="button" className={`acm-btn${on ? " acm-btn-line" : ""}`} onClick={flip} aria-disabled={busy || undefined}>{on ? w.rnOffBtn : w.rnOnBtn}</button>
      <p className="acm-rn-foot"><Link href="/privacy">{w.privacy}</Link></p>
    </section>
  );
}

/** One message as the page lists it, with where a tap leads already worked out (lib/account-notify.ts updateWhere). */
export type UpdView = { id: number; kind: UpdKind; title: string; body: string; day: string; unread: boolean;
  to: { href: string; label: string; out: boolean } | null };
const KIND_IC: Record<UpdKind, AccIconName> = { reminder: "clock", change: "again", waitlist: "ticket", challenge: "flag", recap: "people", note: "chat", info: "bell" };

export function AccUpdates({ rows, w }: { rows: UpdView[]; w: NotifyWords }) {
  if (!rows.length) {
    return <p className="acm-card acm-empty acm-upd-none" role="status"><AccIcon name="bell" size={22} /><strong>{w.empty}</strong></p>;
  }
  return (
    <ul className="acm-card acm-card-list acm-upd">
      {rows.map((m) => {
        const inner = (
          <>
            <span className="acm-upd-ic"><AccIcon name={KIND_IC[m.kind]} /></span>
            <span className="acm-upd-main">
              <strong className="acm-upd-t"><bdi>{m.title}</bdi>{m.unread && <span className="acm-upd-new"><span className="acm-sr">{w.isNew}</span></span>}</strong>
              {m.body && <span className="acm-upd-b"><bdi>{m.body}</bdi></span>}
              <span className="acm-upd-m">
                {m.day && <bdi>{m.day}</bdi>}{m.day && m.to ? " · " : ""}{m.to?.label}
                {m.to?.out && <span className="acm-sr">{w.newTab}</span>}
              </span>
            </span>
            {m.to && <AccIcon name="go" size={16} className="acm-row-go" />}
          </>
        );
        const cls = `acm-upd-row${m.unread ? " is-unread" : ""}`;
        return (
          <li key={m.id} data-upd={m.kind}>
            {!m.to ? <div className={cls}>{inner}</div>
              : m.to.out ? <a className={cls} href={m.to.href} target="_blank" rel="noopener noreferrer">{inner}</a>
              : <Link className={cls} href={m.to.href}>{inner}</Link>}
          </li>
        );
      })}
    </ul>
  );
}
