import type { ReactNode } from "react";
import { fill } from "@/i18n/tx";
import Medal from "@/components/account/Medal";
import { ShareButton } from "@/components/account/ShareImage";
import { fmtNum } from "@/lib/fill";
import { clubLine, hubDay, tipOf, volunteerHref, type HubClubGoal, type HubPost, type HubSeasonGoal } from "@/lib/hub-feed";
import type { ShareSubject } from "@/lib/share-picture";
import type { CommunityWords } from "./Community.words";

// The Community tab's cards on /club that need nothing from the browser (lib/hub-feed.ts; the booking app's member-hub.js
// _hubProg, _seasonHtml, _clubHtml, _staffHtml, its volunteers card and _p5Html, 2026-11-11 to 2026-11-18), drawn in a
// member's area (MembersArea.tsx) where the app's tab places them. Each number is the member's own, or the club goal's
// count toward its target as the app shows it; nothing names another member, and no head count is drawn (hub_feed's
// numbers are never read: lib/hub-feed.ts).

/** Progress as the tab draws it (_hubProg): a dot for each step up to five, a bar above that, the count always said to a
 *  screen reader. */
export function HubProgress({ n, tg, label, text }: { n: number; tg: number; label: string; text?: string }) {
  const v = Math.min(n, tg), said = text || `${v} / ${tg}`;
  const aria = { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": tg, "aria-valuenow": v, "aria-valuetext": said, "aria-label": label } as const;
  if (tg <= 5) return <div className="club-hub-dots" {...aria}>{Array.from({ length: tg }, (_, i) => <span key={i} className={i < v ? "on" : undefined} />)}</div>;
  return <div className="club-hub-bar" {...aria}><span style={{ width: `${Math.min(100, Math.round((v / tg) * 100))}%` }} /></div>;
}

/** The card's small heading with its drawn mark (the app's .hub-k with _cuIc). */
const Ic = ({ d }: { d: string }) => (
  <svg className="mm-ic" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={d} /></svg>
);
export const FLAG = "M5 21V3.5M5 4.5h12.5l-2.6 4 2.6 4H5";
export const PEOPLE = "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18.2 14.8c1.8.8 3 2.6 3.3 5.2";
export const INFO = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.6v.1";
export const STAR = "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z";
export function HubHead({ id, mark, children }: { id: string; mark?: string; children: ReactNode }) {
  return <h3 id={id}>{mark && <Ic d={mark} />} {children}</h3>;
}

/** A season challenge (the app's _seasonHtml): its badge's medal beside its name, progress, "Done ·" once done, and Share. */
export function SeasonGoalCard({ g, locale, w, shareLabel, first }: { g: HubSeasonGoal; locale: string; w: CommunityWords; shareLabel: string; first: string }) {
  const name = (locale === "ar" && g.nameAr) || g.name || g.nameAr, done = g.n >= g.target, id = `club-goal-${g.id || "s"}-h`;
  const sub: ShareSubject = { label: shareLabel, name, level: "", date: "", medal: g.badge ?? { icon: "flag", color: "gold" }, chip: null, file: "micromobility-challenge" };
  return (
    <section className="club-hub club-hub-season" aria-labelledby={id}>
      <HubHead id={id}>{w.season}</HubHead>
      <div className="club-hub-row">{g.badge && <Medal icon={g.badge.icon} color={g.badge.color} className="club-hub-medal" />}<strong className="club-hub-name"><bdi>{name}</bdi></strong></div>
      <HubProgress n={g.n} tg={g.target} label={name} />
      <p className="club-hub-meta">{done && <><strong>{w.goalDone}</strong> · </>}{fill(w.goalOf, fmtNum(Math.min(g.n, g.target), locale), fmtNum(g.target, locale), hubDay(g.endsOn, locale))}</p>
      {done && <ShareButton className="shr-line club-hub-share" locale={locale} first={first} sub={sub} />}
    </section>
  );
}

/** The club's goal (the app's _clubHtml): its name, progress, "so far" or what is left (or reached), the member's own share
 *  when they have one, and once reached early the next Saturday's own target. */
export function ClubGoalCard({ g, locale, w }: { g: HubClubGoal; locale: string; w: CommunityWords }) {
  const name = g.name || g.nameAr ? (locale === "ar" && g.nameAr) || g.name || g.nameAr : fill(w.clubSat, fmtNum(g.target, locale));
  const line = clubLine(g), N = (n: number) => fmtNum(n, locale);
  return (
    <section className={`club-hub club-hub-club${line.k === "hit" ? " hit" : ""}`} aria-labelledby="club-hub-club-h">
      <HubHead id="club-hub-club-h" mark={PEOPLE}>{w.goalAll}</HubHead>
      <strong className="club-hub-name"><bdi>{name}</bdi></strong>
      <HubProgress n={g.n} tg={g.target} label={name} />
      <p className="club-hub-meta">{line.k === "hit" ? <strong>{w.clubHit}</strong> : line.k === "soFar" ? fill(w.soFar, N(line.n), hubDay(g.endsOn, locale)) : fill(w.toGo, N(line.n), hubDay(g.endsOn, locale))}</p>
      {g.mine > 0 && <p className="club-hub-meta club-hub-mine">{fill(w.clubYou, N(g.mine))}</p>}
      {line.k === "hit" && g.next && (
        <div className="club-hub-fields">
          <span><span>{w.nextSat}</span><strong><bdi>{hubDay(g.next.date, locale)}</bdi></strong></span>
          <span><span>{w.nextTarget}</span><strong><bdi>{N(g.next.target)}</bdi></strong></span>
        </div>
      )}
    </section>
  );
}

/** The Saturday report (the app's _staffHtml, R13): the ride's day, the staff's photo (/api/account/hub-photo, which
 *  hub_post_img answers for a member alone), the member's own Saturday rides that month when they rode it, and the staff's
 *  line. No head count, no name, no ranking. */
export function ReportCard({ p, locale, w }: { p: HubPost; locale: string; w: CommunityWords }) {
  const line = (locale === "ar" && p.lineAr) || p.line || p.lineAr;
  return (
    <section className="club-hub club-hub-report" aria-labelledby="club-hub-report-h">
      <h3 id="club-hub-report-h">{w.report}{p.date && <> · <bdi>{hubDay(p.date, locale)}</bdi></>}</h3>
      {p.img && <img className="club-hub-photo" src={`/api/account/hub-photo?post=${encodeURIComponent(p.id)}`} alt="" loading="lazy" decoding="async" />}
      {p.mine != null && <div className="club-hub-minebox"><span>{w.tMine}</span><strong><bdi>{fmtNum(p.mine, locale)}</bdi></strong></div>}
      {line && <p className="club-hub-line"><bdi>{line}</bdi></p>}
    </section>
  );
}

/** The tip of the week (the app's staff card with neither a report nor news): one of twelve, by the server's week. */
export function TipCard({ today, w }: { today: string; w: CommunityWords }) {
  const k = `tip${tipOf(today)}` as keyof CommunityWords;
  return (
    <section className="club-hub club-hub-tip" aria-labelledby="club-hub-tip-h">
      <HubHead id="club-hub-tip-h" mark={INFO}>{w.tip}</HubHead>
      <p className="club-hub-line">{w[k]}</p>
    </section>
  );
}

/** Volunteers needed (the app's volunteers card): the portal opened on the open call, in a new tab. */
export function VolunteerCallCard({ id, w }: { id: string; w: CommunityWords }) {
  return (
    <section className="club-hub club-hub-vol" aria-labelledby="club-hub-vol-h">
      <HubHead id="club-hub-vol-h" mark={PEOPLE}>{w.vol}</HubHead>
      <a className="club-hub-btn" href={volunteerHref(id)} target="_blank" rel="noopener">{w.volBtn}</a>
    </section>
  );
}

/** The Community chat (the booking app's chat card, 2026-11-20): members talk in the booking app, where each message
 *  carries its writer's full name; the site keeps no copy of it, so this card only opens the chat there. */
export const CHAT = "M20.4 11.6a8.2 8.2 0 0 1-12.1 7.2L3.6 20.4l1.6-4.5a8.2 8.2 0 1 1 15.2-4.3z";
export function ChatCard({ href, title, open }: { href: string; title: string; open: string }) {
  return (
    <section className="club-hub club-hub-chat" aria-labelledby="club-hub-chat-h">
      <HubHead id="club-hub-chat-h" mark={CHAT}>{title}</HubHead>
      <a className="club-hub-btn" href={href}>{open}</a>
    </section>
  );
}

/** The first five rides in the challenge's place (the app's _p5Html, new features F1): its name, the five marks, "2 of 5". */
export function FirstFiveCard({ n, tg, name, of, w }: { n: number; tg: number; name: string; of: string; w: CommunityWords }) {
  return (
    <section className="club-hub club-hub-p5" aria-labelledby="club-hub-p5-h">
      <HubHead id="club-hub-p5-h" mark={FLAG}>{w.goalYou}</HubHead>
      <strong className="club-hub-name"><bdi>{name}</bdi></strong>
      <HubProgress n={n} tg={tg} label={name} text={of} />
      <p className="club-hub-meta"><bdi>{of}</bdi></p>
    </section>
  );
}
