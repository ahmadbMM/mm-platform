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
import BuildupPlan from "./BuildupPlan";
import type { BupPlan } from "@/lib/buildup-plan";
import { InterestsBox, InterestsCard } from "./Interests";
import type { Interests } from "@/lib/member-interests";
import { interestWords, suggestWords } from "./MemberHub.words";
import SuggestRide from "./SuggestRide";
import SeasonCard from "./SeasonCard";
import type { RsgRow } from "@/lib/ride-suggestions";
import { memberHubWords } from "./MemberHub.words";
import { yearFrom, type HubFeed } from "@/lib/hub-feed";
import type { MtFeed } from "@/lib/mentorship";
import { fill } from "@/i18n/tx";
import { ratingFinWords } from "@/components/account/RatingFin.words";
import { CHALLENGE_KEYS, communityWords, mentorWords, pickWords, YEAR_KEYS } from "./Community.words";
import { ChatButton, ClubGoalCard, FirstFiveCard, ReportCard, SeasonGoalCard, TipCard, VolunteerCallCard } from "./HubCards";
import ChallengeCard from "./ChallengeCard";
import YearCard from "./YearCard";
import Mentorship from "./Mentorship";
import InviteFriend from "./InviteFriend";
import ClubParts from "./ClubParts";

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
// The Community features round (2026-11-18), placed as the app's tab places them: the Build-up plan (BuildupPlan.tsx) right
// after the card, as the app's comes right after its first card; My interests (Interests.tsx) after it until the member
// first saves them, then at the end of the area; Suggest a ride (SuggestRide.tsx) after the announcements, as the app's
// stands near the end of its tab, before its invitation; the Ramadan season (SeasonCard.tsx, lib/hub-season.ts): its card
// leads the area while Ramadan runs and on Eid al-Fitr's first three days, and the members' sessions take its night blue
// and gold, as the app's next session's card does.
// The Community tab's own cards (2026-11-19, the owner's rule of 2026-10-01: what the booking app shows a customer, the
// website shows too), from its one read, hub_feed (lib/hub-feed.ts), placed as the app's tab places them: with nothing
// booked ahead, the Saturday report of the member's own ride just finished leads the area (`recap`); Your year
// (December and January) after My interests; Your challenge - or, under five rides, the first five rides (`p5`) - after
// the upcoming sessions; the season challenges and the club goal after Plan my Saturdays; then the staff card (the
// Saturday report, the announcements, else the tip of the week), the Mentorship programme (mentor_feed, lib/
// mentorship.ts), Volunteers needed, Suggest a ride, and the invitation to a Saturday social ride (`invite`, the member's
// code). hub_feed's club numbers and each session's riders are never read (no head counts for customers, 2026-11-13).
// Since 2026-11-20 the area is in three parts behind a switch, as the app's tab (ClubParts.tsx): Sessions (the Ramadan card,
// the recap, the Build-up plan, My interests, the upcoming sessions, the member's rides, the staff card), Challenges (the
// year, My month, the challenge, Plan my Saturdays, the season challenges, the club goal) and Club (the title, Ask,
// Mentorship, Volunteers needed, Suggest a ride, the invitation); the card, its tier bar and the birthday stay above them.
// The Community chat is a round button at the bottom corner of the area (ChatButton), as the booking app's is since
// 2026-11-20 (it was the Club part's first card).
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
  /** The booking app's Community chat (/members?hv=chat there): the corner button that opens it; none: no button. */
  chatHref?: string;
  accountHref?: string;
  /** The open Ask pages this member may answer (lib/ask-server.ts readAskList); none: no section. */
  asks?: AskCard[];
  /** Plan my Saturdays (hub_plan) and My month (hub_month), with what each kind of session is called; none: not drawn. */
  plan?: HubPlan | null;
  month?: HubMonth | null;
  kindName?: (k: RideKind) => string;
  /** The Build-up plan (lib/buildup-plan.ts) and the event's name in the page's language; none: not drawn. */
  bup?: { plan: BupPlan; name: string } | null;
  /** My interests (member_interests_get, lib/member-interests.ts); none: no card. */
  interests?: Interests | null;
  /** Suggest a ride: the member's own suggestions (ride_suggestions_mine, lib/ride-suggestions.ts); none: no card. */
  suggestions?: RsgRow[] | null;
  /** The Ramadan season today (lib/hub-season.ts seasonKind): its card and look; "" or none: neither. */
  season?: "ramadan" | "eid" | "";
  /** The Community tab's read (hub_feed, lib/hub-feed.ts); none: none of its cards. `recap`: its Saturday report leads. */
  hub?: HubFeed | null;
  recap?: boolean;
  /** The kinds the member tried this year, named in the page's language, for Your year's slides. */
  yearKinds?: { k: string; name: string }[];
  /** The first five rides in the challenge's place (lib/first-five.ts firstFiveTab); none: the challenge. */
  p5?: { n: number; tg: number } | null;
  /** The Mentorship programme (mentor_feed); none: no card. */
  mentor?: MtFeed | null;
  /** The member's invitation code (member_invite_code); none: no invitation. */
  invite?: string | null;
};

export default function MembersArea({ locale, L, area: a, tierNames, nameOf, bookAt, today, empty, opens, opensAt, opensWords, sgOf, refusalOf, title, communityHref, chatHref, accountHref, asks, plan, month, kindName, bup, interests, suggestions, season, hub, recap, yearKinds, p5, mentor, invite }: Props) {
  const t = serverLocalize(T, locale);
  const ask = serverLocalize(ASK_T, locale);
  const N = (n: number) => fmtNum(n, locale);
  const arrow = <ArrowIcon size={15} />;
  const day = (d: string, o: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) => new Intl.DateTimeFormat(intlOf(locale), { ...o, timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const since = a.since ? new Intl.DateTimeFormat(intlOf(locale), { month: "long", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(a.since)) : "";
  const pct = a.tier >= 2 || !a.next ? 100 : Math.min(100, Math.round((a.credits / a.next) * 100));
  const anns = announcementsOf(a.announcements, L);
  const cw = communityWords(locale), rf = ratingFinWords(locale), first = firstNameOf(a.firstName);
  const report = hub?.post ? <ReportCard p={hub.post} locale={locale} w={cw} /> : null;
  const when = (time: string | null) => {
    const m = /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec(time || "");
    return m ? <bdi dir="ltr">{m[1]} – {m[2]}</bdi> : time ? <bdi dir="ltr">{time}</bdi> : null;
  };
  // The three parts (2026-11-20, as the app's tab): Sessions, Challenges and Club, behind a switch (ClubParts.tsx). The card,
  // its tier bar and the birthday greeting stay above them (/account's "Open my card" lands on the card). A part with
  // nothing in it is not passed, so it has no button.
  const sess = (
    <>
      {season && <SeasonCard locale={locale} kind={season} />}
      {recap && report}
      {bup && <BuildupPlan locale={locale} plan={bup.plan} name={bup.name} bookAt={(id) => bookAt(id, "saturday")} />}
      <InterestsCard at="first" />

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
                  {r.booked ? <em>{t.booked}</em> : r.waitlist ? <em>{t.waitlist}</em> : refusal ? <small>{refusal}</small>
                    : closed && opensWords ? <OpensIn as="small" className="club-wait" text={closed} at={opensAt ? opensAt(r.date) : null} words={opensWords}>{book}</OpensIn>
                    : closed ? <small>{closed}</small> : book}
                </li>
              );
            })}
          </ul>
        ) : <p className="club-att-empty">{empty}</p>}
      </section>

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

      {!recap && report}
      {anns.length > 0 && (
        <section className="club-ann" aria-labelledby="club-ann-h">
          <h3 id="club-ann-h">{t.announcements}</h3>
          <ul>{anns.map((x, i) => <li key={i}>{x.text}{x.cta && x.href ? <> <a href={localHref(x.href, locale)}>{x.cta} {arrow}</a></> : null}</li>)}</ul>
        </section>
      )}
      {hub && !hub.post && !anns.length && <TipCard today={hub.today || today} w={cw} />}
      <InterestsCard at="end" />
    </>
  );
  const challenge = hub && (p5
    ? <FirstFiveCard n={p5.n} tg={p5.tg} name={rf.p5} of={fill(rf.p5Of, N(p5.n), N(p5.tg))} w={cw} />
    : hub.me ? <ChallengeCard me={hub.me} locale={locale} w={pickWords(cw, CHALLENGE_KEYS)} name={first} /> : null);
  const goals = (hub?.year || (month && kindName) || challenge || plan || hub?.goals.length || hub?.club) ? (
    <>
      {hub?.year && <YearCard y={hub.year} locale={locale} w={pickWords(cw, YEAR_KEYS)} kinds={yearKinds ?? []} from={yearFrom(hub.year, locale)} />}
      {month && kindName && <MyMonth locale={locale} month={month} kindName={kindName} first={firstNameOf(a.firstName)} />}
      {challenge}
      {plan && <PlanSaturdays boxes={planBoxes(plan, locale)} title={memberHubWords(locale).plan} month={plan.month ? monthName(plan.month, locale) : ""} err={memberHubWords(locale).err} />}
      {hub?.goals.map((g) => <SeasonGoalCard key={g.id || g.name} g={g} locale={locale} w={cw} shareLabel={cw.kMile} first={first} />)}
      {hub?.club && <ClubGoalCard g={hub.club} locale={locale} w={cw} />}
    </>
  ) : null;
  const club = (title || (asks && asks.length > 0) || mentor || hub?.volunteer || suggestions || invite) ? (
    <>
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
      {mentor && <Mentorship feed={mentor} locale={locale} w={{ ...mentorWords(cw), cancel: memberHubWords(locale).intCancel }} />}
      {hub?.volunteer && <VolunteerCallCard id={hub.volunteer} w={cw} />}
      {suggestions && <SuggestRide locale={locale} rows={suggestions} words={suggestWords(locale)} />}
      {invite && <InviteFriend code={invite} locale={locale} label={cw.invBtn} msg={cw.invMsg} />}
    </>
  ) : null;
  return (
    <InterestsBox initial={interests ?? null} words={interestWords(locale)}>
    <div className={`club-mine club-members${season ? " club-ssn-on" : ""}`}>
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

      <ClubParts parts={{ sess, ...(goals ? { goals } : {}), ...(club ? { club } : {}) }} labels={{ sess: cw.secSess, goals: cw.secGoals, club: cw.secClub }} label={t.title} />
      {chatHref && <ChatButton href={chatHref} label={memberHubWords(locale).chtTitle} />}
    </div>
    </InterestsBox>
  );
}
