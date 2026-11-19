import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell, { navFrom } from "@/components/site/PageShell";
import "@/components/account/account.css";
import "@/components/account/account-menu.css";
import "@/components/booking/booking.css";
import RideRecord from "@/components/account/RideRecord";
import RideMore from "@/components/account/RideMore";
import HelperPath, { helperLine } from "@/components/account/HelperPath";
import { Anniversary, TriedKinds } from "@/components/account/Landmarks";
import AccountParts from "@/components/account/AccountParts";
import WalletCard from "@/components/account/WalletCard";
import ReferralCard from "@/components/account/ReferralCard";
import VolunteerCard, { volunteerCardShows, type VolunteerMe } from "@/components/account/VolunteerCard";
import { hoursText } from "@/components/account/Volunteer.words";
import { walletWords } from "@/components/account/Wallet.words";
import { Sar } from "@/components/booking/Sar";
import { walletOf } from "@/lib/wallet";
import { referralOf, referralRodeOf } from "@/lib/referral";
import { bloodTypeWords } from "@/components/account/BloodType.words";
import SportCard from "@/components/account/SportCard";
import CalendarFeed from "@/components/account/CalendarFeed";
import { calendarWords } from "@/components/account/Calendar.words";
import { calfHost, calfLang, calfPeekOn } from "@/lib/calendar-feed";
import { T as RECORD } from "@/components/account/RideRecord.text";
import { T as TICKET } from "@/components/booking/tickets.text";
import { T as WS_TRACK } from "@/components/workshop/WorkshopTrack.text";
import "../handoff.css";
import { accountSchema } from "@/content/pages/account";
import { BLOOD_NAME, bloodName, bloodWords } from "@/content/blood-words";
import { FARM_NAME, farmBadge, farmName } from "@/content/farm-words";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { readAccount, readBookings, rpcServer } from "@/lib/account";
import { btOf } from "@/lib/blood-type";
import { spName, spOf, spOptionsOf } from "@/lib/sport";
import { emAbsent, emState } from "@/lib/emergency";
import { asLocale, resolvePage } from "@/lib/content";
import { bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { kindNames, type RideKind } from "@/lib/rides";
import { badgeList, ledRides, recordRows, rideMore, rideStats } from "@/lib/ride-record";
import { loadBadgeData, loadBikeTypes, loadOpenKinds, loadRecordSessions } from "@/lib/ride-record-data";
import { myRecords } from "@/lib/my-records";
import MyRecords from "@/components/account/MyRecords";
import { anniversaryOf, annivLine, triedKinds } from "@/lib/landmarks";
import { helperPathOf } from "@/lib/helper-path";
import { shareDays } from "@/lib/share-days";
import { firstNameOf } from "@/lib/share-picture";
import { riyadhClock } from "@/lib/workshop-days";
import { purchasesOf } from "@/lib/account-profile";
import { pastJobs, upcomingJobs, workshopJobsOf } from "@/lib/workshop-mine";
import { ACC_DEFAULT_PAGE, accHref, accountRoute, detailValues, initialsOf, lcLabel, pageTitle, shortDay, type AccPage, type RowValue } from "@/lib/account-menu";
import { fmtDayDate } from "@/lib/tickets";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { phrase } from "@/i18n/tx";
import { LOCALES, intlOf, localeInfo } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { ArrowIcon } from "@/components/site/Icons";
import { accWords } from "@/components/account/AccountMenu.words";
import AccMenu, { type MenuGroup, type MenuRow, type MenuTile } from "@/components/account/AccMenu";
import AccIcon from "@/components/account/AccIcon";
import CityLabel from "@/components/account/CityLabel";
import { AccFocus, AccGuard } from "@/components/account/AccForm";
import { AccAbout, AccContact, AccPersonal, AccResidence, AccRiding, type WaState } from "@/components/account/AccDetails";
import { AccAmbassador, AccCompany, AccDelete, AccEmergency, AccPassword, type AmbMine, type CompanyRow, type EmRow } from "@/components/account/AccPages";
import { AccPurchases, AccWorkshop } from "@/components/account/AccLists";
import { handoffNotice, signedOutView, unreadView } from "@/components/account/gate";

// micromobility.sa/account - sign in with the Micromobility account riders book with; signed in, the booking app's own
// Account (the user, 2026-11-19: "i want the account page to be very similar on main for it on booking app"): the profile
// card above the Account | Stats | Badges switch, then on Account the Wallet and Invite friends tiles and the menu, whose
// rows open small pages at their own addresses (/account/personal, /account/contact ...; lib/account-menu.ts), each with
// its own Save. A wide screen shows the menu and the open page side by side (Personal details when none is picked); a
// phone the menu, or one page with Back. The bookings are their own page, /bookings (a ticket in the header). Stats at
// /account/stats and Badges at /account/badges are the record, as before (2026-11-09). After the booking app hands a rider
// back (api/account/handoff), the page says whom they are signed in as, or asks which account this browser keeps.
const S = (v: unknown) => (typeof v === "string" ? v : "");
const TYPE_NAME: Record<string, { en: string; ar: string }> = {
  Road: phrase("Road", "طريق"), Hybrid: phrase("Hybrid", "هجين"), Mountain: phrase("Mountain", "جبلي"), "Road Carbon": phrase("Road Carbon", "طريق كربون"),
  Kids: phrase("Kids", "أطفال"), Gravel: phrase("Gravel", "حصى"), Any: phrase("Any bike", "أي دراجة"), Own: phrase("Own bike", "دراجتي الخاصة"),
};
const TECH_WA = "966579543997";
const TECH_SHOWN = "+(966) 57 954 3997";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; part?: string[] }> }): Promise<Metadata> {
  const { locale, part } = await params;
  const route = accountRoute(part);
  const w = accWords(locale);
  const view = route?.view ?? "account", page = route?.page ?? null;
  const name = page ? pageTitle(page, w, { calendar: calendarWords(locale).row }) : view === "account" ? w.account : view === "stats" ? w.stats : w.badges;
  return pageMeta({ path: page ? accHref(page) : accHref(view), locale, title: `${name}${name === w.account ? "" : ` · ${w.account}`} · Micromobility`, noindex: true });
}

export default async function AccountPage({ params, searchParams }: { params: Promise<{ locale: string; part?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale, part: seg } = await params;
  const route = accountRoute(seg);
  if (!route) notFound();
  const { view, page } = route;
  const handoffState = (await searchParams).handoff;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const w = accWords(locale);
  const [{ content, previewing, hidden }, read] = await Promise.all([pageState("account"), readAccount()]);
  const acct = read === "unread" ? null : read;
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(accountSchema, content, L);
  const app = navFrom(site).booking; // the booking app as staff set it
  const handoff = (auth?: string) => bookingLink(`${app.replace(/[?#].*$/, "")}?handoff=site${auth ? `&auth=${auth}` : ""}`, locale);
  const here = page ? accHref(page) : accHref(view);
  const again = localHref(here, locale); // this page once more, when a read failed
  const shell = (body: React.ReactNode) => <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>{body}</PageShell>;

  if (read === "unread") return shell(unreadView(tx, again));
  if (!acct) return shell(await signedOutView({ tx, locale, expired: handoffState === "expired", signin: c.signin, handoff }));

  const notice = await handoffNotice({ tx, acct, state: handoffState });
  const a = { p_id: acct.id, p_token: acct.token };
  const prof = (acct.profile ?? {}) as Record<string, unknown>;
  const now = riyadhClock(new Date());
  const today = now.slice(0, 10);
  const recordBase = serverLocalize(RECORD, locale);
  const typeName = (ty: string) => (TYPE_NAME[ty] ? tx(TYPE_NAME[ty].en, TYPE_NAME[ty].ar) : ty);
  const tryAgain = tx("Try again", "حاول مرة أخرى");
  const sar = tx("SAR", "ريال");
  const failed = (
    <p className="ac-empty" role="alert">
      {tx("Something went wrong at our end. Check your connection and try again.", "حدث خلل لدينا. تحقق من اتصالك وحاول مرة أخرى.")} <a href={again}>{tryAgain} <ArrowIcon size={15} /></a>
    </p>
  );
  // Invite friends (rentals 20261108160000): the account's code is made the first time it is asked for; no tile while the
  // database has none, referrals are switched off, or it cannot be read. Stats and Badges ask too: the Recruiter badge
  // counts the friends who rode.
  const referralP = rpcServer<unknown>("customer_referral", { ...a, p_make: true }).then((r) => (r.status === 200 ? r.data : null));

  // ── Account: the menu and the open page ──────────────────────────────────────────────────────────────────────────
  const accountMain = async () => {
    const shown: AccPage = page ?? ACC_DEFAULT_PAGE; // the page drawn beside the menu (on a phone /account shows the menu alone)
    const cal = calendarWords(locale);
    // Everything the rows say, read at once with the account's own session; each read that fails, or a database without
    // the function, leaves its row out (or says nothing on it), as the booking app hides what the server cannot answer for.
    const [aboutR, emR, spR, walletR, referralRaw, ambR, volR, purR, wsR, cochR, calOn, delR] = await Promise.all([
      rpcServer<Record<string, unknown>[]>("customer_about", a),
      rpcServer<unknown[]>("customer_emergency", a),
      rpcServer<unknown>("customer_sport", a),
      rpcServer<unknown>("customer_wallet", a),
      referralP,
      rpcServer<Record<string, unknown>>("ambassador_mine", a),
      rpcServer<VolunteerMe>("volunteer_me", a),
      rpcServer<unknown[]>("customer_purchases", a),
      rpcServer<unknown[]>("customer_workshop_jobs", a),
      rpcServer<{ ok?: boolean; rows?: unknown[]; open?: boolean }>("company_challenge_mine", a),
      rpcServer<unknown>("calendar_link", { ...a, p_op: "peek" }).then(calfPeekOn),
      rpcServer<{ requested_at?: string | null }>("customer_deletion_request", { ...a, p_request: null }),
    ]);
    const about = aboutR.status === 200 && Array.isArray(aboutR.data) ? (aboutR.data[0] ?? null) : null;
    const aboutOn = !!about; // gender, profession, company and how they heard: once customer_about answers (the app's 'workplace' in cust)
    // the emergency contacts (customer_emergency): the row and its page, unless the database has no such function
    const emRow = Array.isArray(emR.data) ? (emR.data[0] as Record<string, unknown> | undefined) ?? null : null;
    const emOn = emR.status === 200 && !!emRow;
    const em = emRow ? emState(emRow) : null;
    const emOf = (p: "" | "2"): EmRow | null => (emRow && S(emRow[`emergency${p}_name`]) ? { name: S(emRow[`emergency${p}_name`]), phone: S(emRow[`emergency${p}_phone`]), rel: S(emRow[`emergency${p}_relation`]) } : null);
    // the sport question (rentals 20261110233000): its row once answered or asked
    const sp = spR.status === 200 && Array.isArray(spR.data) ? spOf(spR.data[0]) : null;
    const wallet = walletR.status === 200 ? walletOf(walletR.data) : null;
    const referral = referralOf(referralRaw, today);
    const ambD = ambR.data;
    const amb: AmbMine | null = ambD && ambD.ok === true && ambD.ambassador === true
      ? { code: S(ambD.code), status: S(ambD.status), earned: Number(ambD.earned) || 0, balance: Number(ambD.balance) || 0, uses: Number(ambD.uses) || 0 } : null;
    const volunteer = volR.status === 200 ? volR.data : null;
    const purch = purR.status === 200 && Array.isArray(purR.data) ? purchasesOf(purR.data) : null;
    const jobs = wsR.status === 200 ? workshopJobsOf(wsR.data) : [];
    const jobsUp = upcomingJobs(jobs, today);
    const coch = cochR.data && cochR.data.ok === true ? cochR.data : null;
    const cochRows: CompanyRow[] = (Array.isArray(coch?.rows) ? coch.rows : []).map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const n = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
      return { id: Number(o.id) || 0, company: S(o.company), starts: S(o.starts_on), ends: S(o.ends_on), state: o.state === "soon" || o.state === "ended" ? o.state : "on",
        team: n(o.team), sessions: n(o.sessions), mine: n(o.mine) ?? 0, badge: o.badge === true };
    });
    const cochOn = !!coch && (cochRows.length > 0 || coch.open === true);
    const del = delR.data && typeof delR.data === "object" && "requested_at" in delR.data ? { at: delR.data.requested_at ?? null } : null;

    // ── the menu ──
    const go = (p: AccPage) => localHref(accHref(p), locale);
    const dv = detailValues(prof, about as { profession?: string | null } | null, w, locale, (city) => city);
    const v = (x: RowValue | null | undefined) => (x && x.text ? x : null);
    const spAdded = spR.status === 200 && sp?.competes ? await rpcServer<unknown>("sport_option_list", {}).then((o) => (o.status === 200 ? spOptionsOf(o.data) : [])) : [];
    const spValue: RowValue | null = !sp ? null : sp.competes === null ? { text: w.addX.replace("{0}", lcLabel(w.sport, locale)), add: true }
      : sp.competes ? { text: sp.feds.map((k) => (k === "other" && sp.other ? sp.other : spName(k, locale, spAdded))).join(" · "), add: false } : { text: w.no, add: false };
    const row = (p: AccPage, icon: MenuRow["icon"], value?: MenuRow["value"]): MenuRow => ({ id: p, label: pageTitle(p, w, { calendar: cal.row }), icon, href: go(p), value: value ?? null });
    const cityVal = !dv.residence.add && S(prof.city)
      ? { ...dv.residence, node: <CityLabel city={S(prof.city)} country={S(prof.country)} locale={locale} /> } : dv.residence;
    const groups: MenuGroup[] = [
      { id: "details", title: w.grpDetails, rows: [
        row("personal", "person", v(dv.personal)), row("contact", "phone", v(dv.contact)), row("residence", "pin", v(cityVal)),
        ...(emOn ? [row("emergency", "people", em?.has ? { text: S(emRow?.emergency_name), add: false } : { text: w.addContact, add: true })] : []),
        row("riding", "bike", v(dv.riding)),
        ...(sp ? [row("sport", "run", spValue)] : []),
        row("about", "info", v(dv.about)),
      ] },
      { id: "activity", title: w.grpActivity, rows: [
        ...(amb ? [row("ambassador", "flag", { text: amb.code, add: false, ltr: true })] : []),
        ...(volunteerCardShows(volunteer) ? [row("volunteer", "clock", Number(volunteer.hours) > 0 ? { text: hoursText(Math.round(Number(volunteer.hours) * 100) / 100, locale), add: false } : null)] : []),
        ...(purch ? [row("purchases", "doc", purch.rows.length ? { text: String(purch.total), add: false, node: <Sar n={purch.total} word={sar} /> } : null)] : []),
        // the Workshop row only while the Workshop page is on, or for a rider who has an appointment (staff switch it off)
        ...(!hidden.includes("workshop") || jobs.length ? [row("workshop", "wrench", jobsUp[0]?.date ? { text: shortDay(jobsUp[0].date, intlOf(locale)), add: false } : null)] : []),
        ...(cochOn ? [row("company", "briefcase", cochRows.length ? { text: cochRows.map((r) => r.company).join(" · "), add: false } : null)] : []),
        ...(!hidden.includes("club") ? [{ id: "club", label: w.clubCard, icon: "card" as const, href: localHref("/club#card", locale), out: true }] : []),
        ...(!hidden.includes("testimonials") ? [{ id: "testimonial", label: w.testimonial, icon: "star" as const, href: localHref("/testimonials/write", locale), out: true }] : []),
      ] },
      { id: "settings", title: w.grpSettings, rows: [
        ...(calOn ? [row("calendar", "cal")] : []),
        row("language", "globe", { text: localeInfo(locale).name, add: false }),
        row("password", "lock", { text: w.change, add: false }),
        ...(!hidden.includes("help") ? [{ id: "help", label: w.help, icon: "help" as const, href: localHref("/help", locale), out: true }] : []),
        { id: "support", label: w.support, icon: "chat", href: `https://wa.me/${TECH_WA}`, out: true, value: { text: TECH_SHOWN, add: false, ltr: true } },
      ] },
    ];
    const tiles: MenuTile[] = [
      ...(wallet ? [{ id: "wallet", label: w.wallet, icon: "wallet" as const, href: go("wallet"), value: String(wallet.balance), node: <Sar n={wallet.balance} word={sar} /> }] : []),
      ...(referral ? [{ id: "invite", label: w.invite, icon: "gift" as const, href: go("invite"), value: referral.code, ltr: true }] : []),
    ];
    const delRow: MenuRow | null = del ? { ...row("delete", "trash", del.at ? { text: w.requested, add: true } : null), red: true } : null;

    // ── the open page ──
    const empty = <p className="acm-card acm-empty">{walletWords(locale).empty}</p>;
    const pane = async (): Promise<React.ReactNode> => {
      switch (shown) {
        case "personal":
          return <AccPersonal key="personal" w={w} locale={locale} initial={{ name: acct.name, birth: S(prof.birth_date), nationality: S(prof.nationality), gender: S(prof.gender), photo: S(prof.photo) || null, aboutOn }} />;
        case "contact": {
          const waR = await rpcServer<unknown[]>("customer_whatsapp", a);
          const wr = waR.status === 200 && Array.isArray(waR.data) ? ((waR.data[0] ?? {}) as Record<string, unknown>) : null;
          const wa: WaState = wr ? { phone: S(wr.phone) || acct.phone, same: wr.whatsapp_same === true ? true : wr.whatsapp_same === false ? false : null, wa: S(wr.whatsapp) } : null;
          return <AccContact w={w} initial={{ email: acct.email, phone: acct.phone }} wa={wa} />;
        }
        case "residence":
          return <AccResidence w={w} locale={locale} initial={{ country: S(prof.country), city: S(prof.city) }} />;
        case "emergency":
          return emOn ? <AccEmergency w={w} initial={{ one: emOf(""), two: emOf("2") }} offerTwo={!!em?.two} own={acct.phone} /> : empty;
        case "riding": {
          const bt = await rpcServer<unknown>("customer_blood_type", a);
          const bw = bloodTypeWords(locale);
          const blood = bt.status === 200 && !emAbsent(bt) ? { label: bw.title, pick: bw.pick, unknown: bw.unknown, value: btOf(bt.data) ?? "" } : null;
          const ty = S(prof.type_preference);
          return <AccRiding w={w} initial={{ type: ty === "Any" ? "" : ty, height: prof.height == null ? "" : String(prof.height) }} blood={blood} />;
        }
        case "sport": {
          if (!sp) return empty;
          // a list that cannot be read just now keeps the rider's own added sports: an empty one would drop them on Save
          const o = await rpcServer<unknown>("sport_option_list", {});
          const added = o.status === 200 ? spOptionsOf(o.data) : sp.feds.filter((k) => k.startsWith("x_")).map((code) => ({ code, en: code, ar: null }));
          return <div className="acm-card acm-host"><SportCard initial={{ competes: sp.competes, feds: sp.feds, other: sp.other }} added={added} /></div>;
        }
        case "about":
          return <AccAbout w={w} aboutOn={aboutOn} initial={{ profession: S(about?.profession), workplace: S(about?.workplace), heard: S(about?.heard_from), socials: prof.socials ?? null }} />;
        case "wallet":
          return wallet ? <div className="acm-card acm-host"><WalletCard wallet={wallet} locale={locale} /></div> : empty;
        case "invite":
          return referral ? <div className="acm-card acm-host"><ReferralCard r={referral} locale={locale} /></div> : empty;
        case "ambassador":
          return amb ? <AccAmbassador w={w} a={amb} locale={locale} /> : empty;
        case "volunteer":
          return volunteerCardShows(volunteer) ? <div className="acm-card acm-host"><VolunteerCard me={volunteer} locale={locale} /></div> : empty;
        case "purchases":
          return purch ? <AccPurchases rows={purch.rows} total={purch.total} w={w} locale={locale} sarWord={sar} /> : <p className="acm-card acm-empty">{w.purchEmpty}</p>;
        case "workshop": {
          const t = serverLocalize(WS_TRACK, locale);
          return <AccWorkshop up={jobsUp} past={pastJobs(jobs, today)} w={w} locale={locale} sarWord={sar} empty={walletWords(locale).empty}
            t={{ stages: t.stages, scheduled: t.scheduled, price: t.price, cancelled: t.cancelled, reference: tx("Reference", "رقم الطلب") }}
            request={hidden.includes("workshop") ? null : { href: localHref("/workshop", locale), label: tx("Request a service", "اطلب صيانة") }} />;
        }
        case "company": {
          const when = Object.fromEntries(cochRows.map((r) => [r.id, [r.starts, r.ends].filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).map((d) => fmtDayDate(d.slice(0, 10), locale)).join(" – ")]));
          return cochOn ? <AccCompany w={w} rows={cochRows} open={coch?.open === true} when={when} /> : empty;
        }
        case "calendar":
          return calOn ? <div className="acm-card acm-host"><CalendarFeed host={calfHost(app)} lang={calfLang(locale)} words={cal} /></div> : empty;
        case "language":
          return (
            <ul className="acm-card acm-card-list acm-langs">
              {LOCALES.map((l) => (
                <li key={l.code}>
                  <Link href={accHref("language")} locale={l.code} hrefLang={l.html} className="acm-lang" aria-current={l.code === locale ? "true" : undefined}>
                    <bdi lang={l.html}>{l.name}</bdi>{l.code === locale && <AccIcon name="tick" size={18} />}
                  </Link>
                </li>
              ))}
            </ul>
          );
        case "password":
          return <AccPassword w={w} />;
        case "delete":
          return del ? <AccDelete w={w} locale={locale} requestedAt={del.at} /> : empty;
      }
    };
    const title = pageTitle(shown, w, { calendar: cal.row });
    const H = page ? "h1" : "h2";
    return (
      <div className={`acm-split${page ? " acm-has-pg" : ""}`}>
        <AccMenu label={w.account} tiles={tiles} groups={groups} current={page} logOut={w.logOut} del={delRow} />
        <section className="acm-pane" aria-labelledby="acm-pg-h">
          {page && <Link href={accHref("account")} className="acm-back"><AccIcon name="back" size={18} />{w.back}</Link>}
          <H className="acm-pg-h" id="acm-pg-h" tabIndex={-1}>{title}</H>
          <AccFocus key={`focus-${shown}`} target="acm-pg-h" />
          {await pane()}
        </section>
      </div>
    );
  };

  // ── Stats and Badges: the record, read from every night booked ───────────────────────────────────────────────────
  // (the kind of ride, whether it was free, whether staff approve it). Stats: Your rides, then more of it (RideMore) and the
  // badges earned; Badges: the closest badges and every badge. A community member's Helper path (customer_helper_path,
  // rentals 20261114082300; the booking app's F23): the card on Badges, the helper days under Rides led on Stats. Stats'
  // personal landmarks (F16): the first ride's anniversary card leads it for that week, and the kinds tried sit under By
  // event. My records (the booking app's _recHtml, 2026-11-18; lib/my-records.ts) follow Your rides on Stats.
  const recordMain = async (p: "stats" | "badges") => {
    const booked = await readBookings(acct);
    // no record from bookings that could not be read: every ride badge would read as not earned
    if (booked === null) return <section className="ac-sec" aria-label={p === "stats" ? recordBase.stats : recordBase.badges}>{failed}</section>;
    const rows = booked;
    const d = resolvePage(experiencesSchema, content, L).dates;
    const names = { ...kindNames(d), petromin: tx("Petromin", "بترومين"), blood: bloodName(tx), farm: farmName(tx) };
    const enNames = { ...kindNames(resolvePage(experiencesSchema, content, "en").dates), blood: BLOOD_NAME, farm: FARM_NAME };
    const ticketText = serverLocalize(TICKET, locale);
    const record = recordRows(rows);
    const anyBikes = p === "stats" ? record.filter((r) => r.type === "Any" && r.bikeId && (r.status === "done" || r.status === "active")).map((r) => r.bikeId as string) : [];
    const [recSessions, badges, referralRaw, helperRaw, openKinds, bikeTypes] = await Promise.all([loadRecordSessions(record.map((r) => r.sessionId), acct), loadBadgeData(acct), referralP,
      rpcServer<unknown>("customer_helper_path", a), p === "stats" ? loadOpenKinds(today, acct) : Promise.resolve(null),
      anyBikes.length ? loadBikeTypes(anyBikes) : Promise.resolve(new Map<string, string>())]);
    const helper = helperPathOf(helperRaw.data);
    badges.referralRode = referralRodeOf(referralRaw); // the Recruiter badge counts these friends
    const allBadges = badgeList(record, recSessions, badges, today, acct.profile ?? null);
    // the Blood Donation Visitor and Farmhouse Night badges are worded by their events' own words (content/blood-words.ts,
    // content/farm-words.ts), handed on only to one who holds them
    const recordText = { ...recordBase, names: { ...recordBase.names,
      ...(allBadges.some((x) => x.slug === "blood_visitor") ? { blood_visitor: bloodWords(tx).visitorBadge } : {}),
      ...(allBadges.some((x) => x.slug === "farmhouse_night" && x.on) ? { farmhouse_night: farmBadge(tx) } : {}) } };
    const dur = { h: ticketText.durH, hm: ticketText.durHM, m: ticketText.durM };
    if (p === "badges") return (allBadges.length > 0 || helper) && (
      <section className="ac-sec" aria-label={recordText.badges}>
        <RideRecord part="badges" locale={locale} stats={null} led={0} badges={allBadges} t={recordText} typeName={typeName} dur={dur} reqs={badges.requests ?? null}
          share={{ first: firstNameOf(acct.name), rode: shareDays(record, recSessions) }} />
        {helper && <HelperPath locale={locale} path={helper} />}
      </section>
    );
    const stats = rideStats(record, recSessions, today);
    const led = ledRides(record, recSessions);
    const kindName = (k: RideKind) => names[k] || enNames[k] || k;
    const more = rideMore(record, recSessions, today, { type: typeName, kind: kindName, locale: intlOf(locale) });
    const anniv = anniversaryOf(stats?.first, today);
    const recs = myRecords(record, recSessions, (id) => bikeTypes.get(id) ?? null);
    // a Farm House Night on offer is named to a community member alone (2026-11-13: "not to public")
    if (openKinds?.has("farm") && (await rpcServer<boolean>("community_member", a)).data !== true) openKinds.delete("farm");
    const tried = openKinds ? triedKinds(more.byKind.map(([k]) => k), openKinds) : [];
    return (
      <section className="ac-sec" aria-label={recordText.stats}>
        {anniv && <Anniversary locale={locale} years={anniv.years} first={anniv.first} firstLabel={recordText.first} line={annivLine(content, locale)} />}
        {!stats && !led && <p className="ac-none">{recordText.none}</p>}
        <RideRecord part="stats" locale={locale} stats={stats} led={led} badges={[]} t={recordText} typeName={typeName} dur={dur} helper={helperLine(locale, helper)} />
        {recs && <MyRecords locale={locale} recs={recs} />}
        <RideMore locale={locale} more={more} t={recordText} typeName={typeName} kindName={kindName}
          earned={{ n: allBadges.filter((x) => x.on).length, of: allBadges.length, href: localHref(accHref("badges"), locale) }}
          tried={tried.length > 0 ? <TriedKinds locale={locale} kinds={tried} name={kindName} /> : null} />
      </section>
    );
  };
  const main = view === "account" ? await accountMain() : await recordMain(view);
  const photo = S(prof.photo);

  return shell(
    <div className={`ac ac-in acm${page ? " acm-in-pg" : ""}`}>
      <AccGuard w={w} />
      {notice}
      {!page && <h1 className="acm-sr">{view === "account" ? w.account : view === "stats" ? w.stats : w.badges}</h1>}
      {/* the profile card above the switch (the booking app's _accIdHtml): it opens Personal details */}
      <Link href={accHref("personal")} className="acm-id">
        {photo ? <img src={photo} alt="" className="acm-id-ph" width={56} height={56} decoding="async" /> : <span className="acm-id-ph acm-id-in" aria-hidden="true">{initialsOf(acct.name)}</span>}
        <span className="acm-id-txt"><span className="acm-id-n"><bdi>{acct.name}</bdi></span><span className="acm-id-s"><bdi dir="ltr">{acct.email || acct.phone}</bdi></span></span>
        <AccIcon name="go" size={16} className="acm-row-go" />
      </Link>
      <AccountParts part={view} locale={locale} t={{ account: w.account, stats: w.stats, badges: w.badges }} />
      {main}
    </div>,
  );
}

