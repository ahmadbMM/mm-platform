import { serverLocalize } from "@/i18n/dicts";
import { intlOf } from "@/i18n/locales";
import type { Locale } from "@/lib/content";
import { fmtNum } from "@/lib/fill";
import { localHref } from "@/lib/links";
import { announcementsOf, isBirthday, type MemberArea, type MemberTitle, type MemberUpcoming } from "@/lib/members";
import type { GenderChip } from "@/lib/session-gender";
import { T } from "./MembersArea.text";
import { T as ASK_T } from "@/components/ask/Ask.text";
import { askText, askWhen, type AskCard } from "@/lib/ask";
import { ArrowIcon } from "@/components/site/Icons";
import OpensIn from "@/components/site/OpensIn";
import { ShareButton } from "@/components/account/ShareImage";
import { shareWords } from "@/components/account/BadgeShare.words";
import { firstNameOf, titleSubject } from "@/lib/share-picture";
import type { OpensWords } from "@/lib/opens-in";
import { monthName, planBoxes, type HubMonth, type HubPlan } from "@/lib/member-hub";
import type { RideKind } from "@/lib/rides";
import MyMonth from "./MyMonth";
import PlanSaturdays from "./PlanSaturdays";
import { memberHubWords } from "./MemberHub.words";

// The members' area on /club, for a signed-in community member (member_area, lib/members.ts):
// their card - name, since when, credits, tier and what is left to the next - their attendance
// and last five rides, the upcoming members' rides (each booked in the booking app on that ride,
// the ones already booked marked), a birthday greeting on the day, and the site's announcements.
// Nothing here names another member.
// Since 2026-11-13 also the Ask pages open to this member ("Have your say", ask_list, read by the page with the account's
// session), each opening micromobility.sa/ask/<slug>: the booking app's Community tab lists the same ones (member-hub.js).
// Under the title, Share sends it as a picture (the booking app's _shrTitle, new features build F12, 2026-11-13; it sits
// under the title on the app's Account > Badges, and the title shows here on the website): components/account/ShareImage.tsx.
// Since the new features build (2026-11-13), the app's My month (F13, from the 26th) after their rides and Plan my
// Saturdays (F10) after the upcoming rides (lib/member-hub.ts): each drawn only when its read answered.
type Props = {
  locale: string;
  L: Locale;
  area: Extract<MemberArea, { member: true }>;
  tierNames: [string, string, string];
  /** What to call a ride: its title, else its kind's name in the page's language. */
  nameOf: (kind: string | null, title: string) => string;
  /** The booking app opened on a members' ride. */
  bookAt: (id: string, kind: string | null) => string;
  /** Today in Riyadh, "YYYY-MM-DD". */
  today: string;
  /** The staff text for no upcoming ride (Club > Upcoming club sessions). */
  empty: string;
  /** Whether each upcoming ride may be booked yet (the booking window): null when it may, else the
   *  words for when it opens; a race (Victory Lap, Arena Heros) never waits for it. */
  opens?: (date: string, kind: string | null) => string | null;
  /** When such a ride opens (epoch ms, lib/booking-window.ts opensAt), and the countdown's words: within a day of it the
   *  ride counts down to it beside a clock, and its Book shows on time (components/site/OpensIn.tsx). */
  opensAt?: (date: string) => number | null;
  opensWords?: OpensWords;
  /** An upcoming ride's chip: men only, women only, or mixed on a pool session (the owner, 2026-10-27;
   *  lib/session-gender.ts genderChip); null for none. */
  sgOf?: (r: MemberUpcoming) => GenderChip | null;
  /** "This session is for women only." in place of Book on a ride for the other gender (the owner, 2026-10-28:
   *  every member sees it, only that gender books it; lib/session-gender.ts genderBlock); null when Book stays. */
  refusalOf?: (r: MemberUpcoming) => string | null;
  /** The member's title (customer_my_titles), with the booking app's Community page and My Account, where it is
   *  chosen; absent on a database without it. The list of members itself lives in the booking app. */
  title?: MemberTitle | null;
  communityHref?: string;
  accountHref?: string;
  /** The open Ask pages this member may answer (lib/ask-server.ts readAskList); none: no section. */
  asks?: AskCard[];
  /** Plan my Saturdays (hub_plan) and My month (hub_month), with what each kind of session is called; none: not drawn. */
  plan?: HubPlan | null;
  month?: HubMonth | null;
  kindName?: (k: RideKind) => string;
};

export default function MembersArea({ locale, L, area: a, tierNames, nameOf, bookAt, today, empty, opens, opensAt, opensWords, sgOf, refusalOf, title, communityHref, accountHref, asks, plan, month, kindName }: Props) {
  const t = serverLocalize(T, locale);
  const ask = serverLocalize(ASK_T, locale);
  const N = (n: number) => fmtNum(n, locale);
  const arrow = <ArrowIcon size={15} />;
  const day = (d: string, o: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) => new Intl.DateTimeFormat(intlOf(locale), { ...o, timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const since = a.since ? new Intl.DateTimeFormat(intlOf(locale), { month: "long", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(a.since)) : "";
  const pct = a.tier >= 2 || !a.next ? 100 : Math.min(100, Math.round((a.credits / a.next) * 100));
  const anns = announcementsOf(a.announcements, L);
  const when = (time: string | null) => {
    const m = /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec(time || "");
    return m ? <bdi dir="ltr">{m[1]} – {m[2]}</bdi> : time ? <bdi dir="ltr">{time}</bdi> : null;
  };
  return (
    <div className="club-mine club-members">
      <h2>{t.title}</h2>
      {isBirthday(a.birthDate, today) && (
        <p className="club-bday" role="status"><strong>{t.birthday(a.firstName)}</strong><span>{t.birthdayText}</span></p>
      )}
      <div className={`club-cardviz tier-${a.tier}`}>
        <div className="club-cardviz-top">
          <span className="club-cardviz-brand"><img src={a.tier === 2 ? "/site/logo-mark-dark.png" : "/site/logo-mark.png"} alt="Micromobility" /><span>{t.label}</span></span>
          <span className="club-pill">{tierNames[a.tier]}</span>
        </div>
        <div className="club-cardviz-bottom">
          <span className="club-cardviz-label">{t.credits}</span>
          <strong className="club-cardviz-num">{N(a.credits)}</strong>
          <div className="club-cardviz-foot"><strong>{a.firstName}</strong>{since && <span>{t.since} {since}</span>}</div>
        </div>
      </div>
      <span className="club-bar"><span style={{ width: `${pct}%` }} /></span>
      <p className="club-mine-next">{a.tier >= 2 || !a.next ? t.top : t.toNext(N(Math.max(0, a.next - a.credits)), tierNames[a.tier + 1])}</p>

      {title && (
        <section className="club-comm" aria-labelledby="club-comm-h">
          <h3 id="club-comm-h">{t.community}</h3>
          {title.title
            ? <>
              <p><span>{t.yourTitle}: </span><strong className="club-title"><bdi>{(locale === "ar" && title.title.nameAr) || title.title.name}</bdi></strong></p>
              <ShareButton className="shr-line" locale={locale} first={firstNameOf(a.firstName)} sub={titleSubject(title.title, locale, shareWords(locale).title)} />
            </>
            : <p className="club-att-empty">{t.noTitle}</p>}
          <p className="club-comm-links"><a href={communityHref}>{t.seeMembers} {arrow}</a> <a href={accountHref}>{t.manageTitle} {arrow}</a></p>
        </section>
      )}

      {asks && asks.length > 0 && (
        <section className="club-ask" aria-labelledby="club-ask-h">
          <h3 id="club-ask-h">{ask.listTitle}</h3>
          <ul>
            {asks.map((p) => (
              <li key={p.slug}>
                <a href={localHref(`/ask/${p.slug}`, locale)}><strong dir="auto">{askText(locale, p.title_en, p.title_ar)}</strong> {arrow}</a>
                {p.closes_at && <span className="club-up-when"><time dateTime={p.closes_at}>{ask.until(askWhen(p.closes_at, locale))}</time></span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="club-att" aria-labelledby="club-att-h">
        <h3 id="club-att-h">{t.attendance}</h3>
        <div className="club-att-nums"><span>{t.rides(N(a.rides))}</span><span>{t.groupRides(N(a.groupRides))}</span></div>
        <p className="club-att-sub">{t.last}</p>
        {a.last.length ? (
          <ul className="club-last">
            {a.last.map((r, i) => (
              <li key={i}><span>{day(r.date, { day: "numeric", month: "short", year: "numeric" })}</span><strong>{nameOf(r.kind, r.title)}</strong>{r.rated ? <em>{t.rated}</em> : <a href={localHref("/account", locale)}>{t.rate} {arrow}</a>}</li>
            ))}
          </ul>
        ) : <p className="club-att-empty">{t.noLast}</p>}
      </section>

      {month && kindName && <MyMonth locale={locale} month={month} kindName={kindName} />}

      <section className="club-up" aria-labelledby="club-up-h">
        <h3 id="club-up-h">{t.upcoming}</h3>
        {a.upcoming.length ? (
          <ul>
            {a.upcoming.map((r) => {
              const closed = opens ? opens(r.date, r.kind) : null;
              const sg = sgOf ? sgOf(r) : null;
              const refusal = refusalOf ? refusalOf(r) : null;
              const book = <a href={bookAt(r.id, r.kind)}>{t.book} {arrow}</a>;
              return (
                <li key={r.id} className={closed ? "closed" : ""}>
                  <span className="club-up-when">{day(r.date)}{r.time ? <> · {when(r.time)}</> : null}</span>
                  <strong>{nameOf(r.kind, r.title)}{sg && <> <span className={`sg-chip sg-${sg.cls}`}>{sg.label}</span></>}</strong>
                  {r.booked ? <em>{t.booked}</em> : refusal ? <small>{refusal}</small>
                    : closed && opensWords ? <OpensIn as="small" className="club-wait" text={closed} at={opensAt ? opensAt(r.date) : null} words={opensWords}>{book}</OpensIn>
                    : closed ? <small>{closed}</small> : book}
                </li>
              );
            })}
          </ul>
        ) : <p className="club-att-empty">{empty}</p>}
      </section>

      {plan && <PlanSaturdays boxes={planBoxes(plan, locale)} title={memberHubWords(locale).plan} month={plan.month ? monthName(plan.month, locale) : ""} err={memberHubWords(locale).err} />}

      {anns.length > 0 && (
        <section className="club-ann" aria-labelledby="club-ann-h">
          <h3 id="club-ann-h">{t.announcements}</h3>
          <ul>{anns.map((x, i) => <li key={i}>{x.text}{x.cta && x.href ? <> <a href={localHref(x.href, locale)}>{x.cta} {arrow}</a></> : null}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
