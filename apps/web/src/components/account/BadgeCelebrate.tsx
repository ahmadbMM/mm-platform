"use client";

import { useEffect, useRef } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import Medal from "./Medal";
import { T } from "./Account.text";

// A badge just earned pops up once (the booking app's _bdgCelebrate and _bdgProfCheer), and only while it IS new
// (BDG_FRESH_MS, the booking app's 2026-11-09 fix): the newest one staff gave in the last three days, since this device
// last showed one; else National Day 96 within three days of its ride, or Race Ready when a save on this site filled
// the profile's last field (a profile that arrives full is not news). Remembered per account in this browser only, so
// without the three days every badge a rider already held popped as "New badge!" on a new phone or browser, and again
// after Safari wiped the site's storage. With no storage it never pops rather than popping on every visit. Each
// candidate is drawn as a closed pop-up; the one due is opened, centred, on the page's first paint.
export type Cheer = { slug: string; icon: string; color: string; name: string; how: string; about: string;
  /** A badge staff gave: when (ISO); null for Race Ready and National Day 96. */
  at: string | null;
  /** A badge the site works out itself: the day it was earned (National Day 96: its ride's), when it has one. */
  day?: string | null };

const FRESH_MS = 3 * 864e5;
const fresh = (s: string | null | undefined) => { const v = Date.parse(s || ""); return Number.isFinite(v) && Date.now() - v < FRESH_MS; };

// A save on My Account made while the profile was short of full (ProfileForm), for the account that made it: Race Ready,
// if that save filled it, pops up the next time the badges are drawn (the booking app's _bdgProfNew). This tab only.
const FILLED = "mm_bdg_prof_save";
export function profileSaved(accountId: string): void {
  try { window.sessionStorage.setItem(FILLED, accountId); } catch { /* storage off: no pop */ }
}

const store = {
  get(k: string): string | null { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): boolean { try { window.localStorage.setItem(k, v); return true; } catch { return false; } },
};

export default function BadgeCelebrate({ accountId, items }: { accountId: string; items: Cheer[] }) {
  const t = useLocalize(T);
  const refs = useRef<(HTMLDialogElement | null)[]>([]);
  useEffect(() => {
    const at = (s: string | null) => (s ? Date.parse(s) || 0 : 0);
    let pick = -1;
    const given = items.map((x, i) => [x, i] as const).filter(([x]) => x.at).sort((a, b) => at(b[0].at) - at(a[0].at))[0];
    if (given && fresh(given[0].at)) {
      const k = `mm_bdg_seen_${accountId}`;
      if (at(given[0].at) > (Number(store.get(k)) || 0) && store.set(k, String(at(given[0].at)))) pick = given[1];
    }
    if (pick < 0) {
      let saved = false;
      try { saved = window.sessionStorage.getItem(FILLED) === accountId; } catch { /* storage off */ }
      for (const [x, i] of items.map((x, i) => [x, i] as const)) {
        if (x.at) continue;
        if (x.slug === "complete_profile") {
          if (!saved) continue;
          try { window.sessionStorage.removeItem(FILLED); } catch { /* storage off */ }
        } else if (!fresh(x.day)) continue;
        const k = `mm_bdg_cheer_${x.slug}_${accountId}`;
        if (store.get(k)) continue;
        if (store.set(k, "1")) pick = i;
        break;
      }
    }
    const d = pick >= 0 ? refs.current[pick] : null;
    if (d && !d.open && typeof d.showModal === "function") d.showModal();
  }, [accountId, items]);
  if (!items.length) return null;
  return (
    <>
      {items.map((x, i) => (
        <dialog key={x.slug} ref={(el) => { refs.current[i] = el; }} className={`badge-pop-box${x.color === "special" || x.color === "national" ? ` special sp-${x.color}` : ""}`}
          aria-label={x.name} onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
          <div className="badge-pop-in">
            <p className="badge-pop-new">{t.newBadge}</p>
            <Medal icon={x.icon} color={x.color} className="badge-pop-ic" />
            <p className="badge-pop-nm">{x.name}</p>
            {x.about && <p className="badge-pop-about">{x.about}</p>}
            {x.how && <p className="badge-pop-d">{x.how}</p>}
            <form method="dialog"><button type="submit" className="badge-pop-close">{t.close}</button></form>
          </div>
        </dialog>
      ))}
    </>
  );
}
