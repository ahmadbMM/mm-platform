"use client";

import { useState } from "react";
import { fill } from "@/i18n/tx";
import { ShareButton } from "@/components/account/ShareImage";
import { fmtNum } from "@/lib/fill";
import { hubDay, pickShown, type HubMe } from "@/lib/hub-feed";
import { monthName } from "@/lib/member-hub";
import { ltrNum } from "@/lib/share-picture";
import { FLAG, HubHead, HubProgress } from "./HubCards";
import type { CommunityWords } from "./Community.words";

// Your challenge in a member's area on /club (lib/hub-feed.ts HubMe; the booking app's _meHtml and _hubPick, 2026-11-11):
// the month's own challenge - Your first session, Your second session, Back this month, or N sessions this month - with
// its progress and "2 of 3, until 30 Nov 2026"; a level challenge not yet picked offers "Pick your challenge" over its
// levels, the suggested one marked. A tap picks it at once (/api/account/hub-level, hub_pick_level) and the choice goes:
// the database takes one pick a month. A pick that did not go through turns back and says so under the levels. Once done:
// "Done ·", and Share sends it as a picture (components/account/ShareImage.tsx; badge-share.js's 'mile' subject: "Challenge
// completed", its name, its month, the calendar medal).
type Words = Pick<CommunityWords, "goalYou" | "chFirst" | "chSecond" | "chBack" | "chLevel" | "chPick" | "goalOf" | "goalDone" | "err" | "kMile" | "mFirst" | "mSecond" | "mBack" | "mLevel">;

export default function ChallengeCard({ me: first, locale, w, name }: { me: HubMe; locale: string; w: Words; name: string }) {
  const [me, setMe] = useState(first);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const tg = me.target, done = me.n >= tg;
  const title = me.kind === "first" ? w.chFirst : me.kind === "second" ? w.chSecond : me.kind === "back" ? w.chBack : fill(w.chLevel, fmtNum(tg, locale));
  const N = (n: number) => fmtNum(n, locale);

  async function pick(level: number) {
    if (busy) return;
    const was = me;
    setMe({ ...me, target: level }); setBusy(true); setErr(false);
    let ok = false;
    try {
      const r = await fetch("/api/account/hub-level", { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ level }) });
      const a = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (a?.error === "signin") { window.location.reload(); return; }
      ok = a?.ok === true;
    } catch { /* said below */ }
    setBusy(false);
    if (ok) setMe({ ...was, target: level, chosen: true });
    else { setMe(was); setErr(true); }
  }

  const mileName = me.kind === "first" ? w.mFirst : me.kind === "second" ? w.mSecond : me.kind === "back" ? w.mBack : fill(w.mLevel, ltrNum(tg));
  return (
    <section className="club-hub club-hub-me" aria-labelledby="club-hub-me-h">
      <HubHead id="club-hub-me-h" mark={FLAG}>{w.goalYou}</HubHead>
      <strong className="club-hub-name"><bdi>{title}</bdi></strong>
      {pickShown(me) && (
        <>
          <span className="club-hub-k" id="club-hub-pick-l">{w.chPick}</span>
          <div className="club-hub-pick" role="group" aria-labelledby="club-hub-pick-l">
            {me.levels.map((k) => (
              <button key={k} type="button" className={`club-hub-lv${k === tg ? " on" : ""}`} aria-pressed={k === tg} disabled={busy} onClick={() => void pick(k)}><bdi>{N(k)}</bdi></button>
            ))}
          </div>
          {err && <p className="club-hub-err" role="alert">{w.err}</p>}
        </>
      )}
      <HubProgress n={me.n} tg={tg} label={title} />
      <p className="club-hub-meta">{done && <><strong>{w.goalDone}</strong> · </>}{fill(w.goalOf, N(Math.min(me.n, tg)), N(tg), hubDay(me.endsOn, locale))}</p>
      {done && <ShareButton className="shr-line club-hub-share" locale={locale} first={name}
        sub={{ label: w.kMile, name: mileName, level: "", date: me.endsOn ? monthName(me.endsOn, locale, true) : "", medal: { icon: "calcheck", color: "green" }, chip: null, file: "micromobility-challenge" }} />}
    </section>
  );
}
