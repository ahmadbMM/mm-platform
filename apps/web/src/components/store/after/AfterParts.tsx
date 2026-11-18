import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { intlOf } from "@/i18n/locales";
import { serverLocalize } from "@/i18n/dicts";
import { sized } from "@/lib/img";
import {
  afterSettings, arriveOpen, bikeLines, bookedSlot, checkupDays, claimLines, CHECK_KEYS, handedOver, hijriDay, hijriRange, orderPath,
  passOpen, riyadhDay, slotCalendarOpen, slotChangeOpen, type After, type AfterOrder,
} from "@/lib/sx-B4";
import type { SiteContent } from "@/lib/site";
import { T } from "../sx-B4.text";
import { AfterIcon } from "./icons";
import Arrive from "./Arrive";
import ClaimStart from "./Claim";
import HomeScreen from "./HomeScreen";
import OrderPush from "./OrderPush";
import OrderShare from "./Share";
import SlotChange from "./SlotChange";
import WalletPass from "./Wallet";
import "../sx-B4.css";

// After the sale on an order's page (builder B4, 2026-11-18), drawn by the server and handed to OrderView in its places:
//   head  - Share (N01), the Wallet pickup pass (N02), Add to calendar for the booked slot (N03)
//   way   - the pickup handover with its Hijri date (N37), Change time (N30), "I'm here" on pickup day (N14)
//   build - "Your bike is built": the staff's photos and check sheet (N29)
//   claim - Warranty: claims and where they are, Start a claim from each line still covered (N31, photos N08)
//   acts  - Book your free check-up and its calendar entry (N12, N03), Ride it with us on Saturday (N18), notifications
//           for this order (N04), Add to Home Screen (N05)
// The parts that need the database's store_after_* functions (Change time, I'm here, the build, claims, notifications)
// show only when store_after_read answered; the others need nothing new.
export type AfterNodes = {
  head: ReactNode; way: ReactNode; build: ReactNode; claim: ReactNode; acts: ReactNode;
  /** The free check-up takes the place of the generic "Book a Service" link. */
  noService: boolean;
  /** Hijri dates beside the Gregorian ones, on Arabic pages (N37). */
  hijri: { issued: string | null; supplied: string | null; expected: string | null; slot: string | null };
};

export function afterParts(a: {
  o: AfterOrder; after: After | null; content: SiteContent | null; locale: string; today: string; now: number;
  bikes: ReadonlySet<string>; monthsOf: (productId: string | null) => number; owner: boolean; workshop: boolean;
  expected: { from: string; to: string } | null;
}): AfterNodes {
  const { o, after, locale, today, now } = a;
  const t = serverLocalize(T, locale);
  const set = afterSettings(a.content);
  const intl = intlOf(locale);
  const dayFmt = (d: string, o2: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intl, { ...o2, timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const short = (d: string) => dayFmt(d, { weekday: "short", day: "numeric", month: "short" });
  const long = (d: string) => dayFmt(d, { day: "numeric", month: "long", year: "numeric" });
  const no = `MM-${o.no}`;
  const k = o.key;
  const slot = bookedSlot(o);
  const bikes = bikeLines(o, a.bikes);
  const lang = locale === "ar" ? "ar" : "en";
  const hijri = {
    issued: hijriDay(riyadhDay(o.paid_at ?? o.created_at), locale),
    supplied: hijriDay(riyadhDay(o.delivered_at), locale),
    expected: a.expected ? hijriRange(a.expected.from, a.expected.to, locale) : null,
    slot: slot ? hijriDay(slot.day, locale) : null,
  };
  const cal = (what: "slot" | "checkup") => k ? `/api/store/calendar?no=${o.no}&k=${k}&what=${what}&lang=${lang}` : null;

  // ── head ──
  const slotCal = slotCalendarOpen(o) ? cal("slot") : null;
  const head = k ? (
    <div className="sxb-head">
      <OrderShare path={orderPath(o.no, k)} no={no} />
      {passOpen(o) && <WalletPass no={o.no} k={k} lang={lang} />}
      {slotCal && <a className="bk-btn2 sxb-act" href={slotCal}><AfterIcon name="calendarPlus" size={18} />{t.addCal}</a>}
    </div>
  ) : null;

  // ── way ──
  const change = !!after && !!k && slotChangeOpen(o, now, set.change, after.changes);
  const pickupLine = o.fulfil === "pickup" && slot && ["paid", "preparing", "ready"].includes(o.status);
  const way = (pickupLine || change || (after && k && arriveOpen(o, today))) ? (
    <div className="sxb-way">
      {pickupLine && slot && (
        // the hours as one left-to-right run, so an Arabic line never shows "16:20–16:00"
        <p className="st-expected">{t.pickupOn(`${short(slot.day)} · \u2066${slot.from}–${slot.to}\u2069`)}{hijri.slot && <span className="sxb-hijri">{hijri.slot}</span>}</p>
      )}
      {change && slot && k && <div className="sxb-change"><SlotChange no={o.no} k={k} current={{ day: slot.day, time: slot.time }} /></div>}
      {after && k && arriveOpen(o, today) && <Arrive no={o.no} k={k} was={after.arrival} />}
    </div>
  ) : null;

  // ── build ──
  const b = after?.build;
  const build = b && !["cancelled", "refunded", "pending"].includes(o.status) ? (
    <section className="sxb-build" aria-labelledby="sxb-build-h">
      <h2 id="sxb-build-h"><AfterIcon name="bike" size={22} />{t.builtH}</h2>
      {b.photos.length > 0 && (
        <ul className={`sxb-build-ph n${b.photos.length}`}>
          {b.photos.map((p, i) => <li key={p}><img src={sized(p, 640)} alt={t.builtPhoto(i + 1)} loading={i ? "lazy" : "eager"} /></li>)}
        </ul>
      )}
      <ul className="sxb-checks">
        {CHECK_KEYS.filter((c) => b.checks[c]).map((c) => <li key={c}><AfterIcon name="tick" size={18} />{t.checks[c]}</li>)}
      </ul>
      {b.note && <p className="sxb-build-note">{b.note}</p>}
    </section>
  ) : null;

  // ── claims ──
  const lines = after && k ? claimLines(o, after.claims, now, a.monthsOf) : [];
  const claims = after?.claims ?? [];
  const claim = (lines.length > 0 || claims.length > 0) && k ? (
    <section className="st-info sxb-warranty" aria-labelledby="sxb-war-h">
      <h2 id="sxb-war-h" className="st-info-h"><AfterIcon name="shield" size={18} />{t.warrantyH}</h2>
      {claims.length > 0 && (
        <ul className="st-rets">
          {claims.map((c) => {
            const item = o.items.find((i) => i.id === c.item_id);
            const d = riyadhDay(c.created_at);
            return (
              <li key={c.id}>
                <span><b>{d ? t.claimOf(short(d)) : t.claimTitle}</b><small><bdi>{item?.name ?? ""}</bdi></small>{c.reply && <small className="sxb-reply">{c.reply}</small>}</span>
                <span className={`st-pill sxb-c-${c.state}`}>{t.claimState[c.state]}</span>
              </li>
            );
          })}
        </ul>
      )}
      {lines.length > 0 && (
        <ul className="sxb-claim-lines">
          {lines.map((l) => (
            <li key={l.id}>
              <span><b><bdi>{l.name}</bdi></b><small>{t.coveredUntil(long(l.until))}</small></span>
              <ClaimStart no={o.no} k={k} line={l.id} lines={lines} />
            </li>
          ))}
        </ul>
      )}
    </section>
  ) : null;

  // ── acts ──
  const due = set.checkup.on && a.workshop ? checkupDays(o, set.checkup.weeks, bikes.length > 0) : null;
  const checkup = due && today <= due.by;
  const checkCal = checkup && today <= due.remind ? cal("checkup") : null;
  const ride = bikes.length > 0 && handedOver(o);
  const push = set.push && a.owner && !!after && !!k && !["delivered", "cancelled", "refunded"].includes(o.status);
  const acts = (
    <>
      {checkup && due && (
        <Link className="bk-btn2" href={`/workshop?checkup=${encodeURIComponent(no)}`}><AfterIcon name="calendarPlus" size={18} />{t.checkupBook}</Link>
      )}
      {checkCal && <a className="bk-btn2" href={checkCal}><AfterIcon name="calendarPlus" size={18} />{t.addCal}</a>}
      {ride && <Link className="bk-btn2" href="/experiences?kind=saturday"><AfterIcon name="bike" size={18} />{t.rideSat}</Link>}
      {push && k && <OrderPush no={o.no} k={k} on={after?.push === true} />}
      <HomeScreen />
    </>
  );
  return { head, way, build, claim, acts, noService: !!checkup, hijri };
}
