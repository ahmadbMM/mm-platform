"use client";

import { useEffect, useState } from "react";
import { rpc } from "@/lib/rpc-client";
import { useL } from "@/i18n/TxProvider";
import { intlOf } from "@/i18n/locales";
import { phrase } from "@/i18n/tx";

// The next open community rides (club_rides), read in the visitor's browser.
type Ride = { title: string; date: string; time: string | null; kind: string | null };
type Props = { locale: string; href: string; empty: string };
const KIND: Record<string, { en: string; ar: string }> = {
  saturday: phrase("Saturday Social Ride", "ركبة السبت الاجتماعية"),
  swim: phrase("Triathlon Pool Session", "جلسة سباحة للترياثلون"),
  workshop: phrase("Club workshop", "ورشة النادي"),
};

export default function ClubRides(p: Props) {
  const tx = useL();
  const [rides, setRides] = useState<Ride[] | null>(null);
  useEffect(() => {
    let live = true;
    rpc<Ride[]>("club_rides", {}).then((r) => { if (live) setRides(Array.isArray(r) ? r : []); }).catch(() => { if (live) setRides([]); });
    return () => { live = false; };
  }, []);
  if (rides === null) return <div className="club-rides-grid" aria-busy="true" />;
  // As /experiences names and times them: a title that is only the kind's English name reads in
  // the page's language, and a ride that gathers says when to gather and when it starts.
  const nameOf = (r: Ride) => {
    const k = r.kind && KIND[r.kind] ? KIND[r.kind] : null;
    if (r.title && !(k && r.title.trim().toLowerCase() === k.en.toLowerCase())) return r.title;
    return k ? tx(k.en, k.ar) : tx("Community ride", "ركبة المجتمع");
  };
  const whenOf = (r: Ride) => {
    const m = /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec(String(r.time || "").trim());
    if (!m) return r.time ? <bdi dir="ltr">{r.time}</bdi> : null;
    return r.kind === "saturday" || r.kind === "snd96"
      ? <>{tx("Gathering", "التجمع")} <bdi dir="ltr">{m[1]}</bdi> · {tx("Start", "الانطلاق")} <bdi dir="ltr">{m[2]}</bdi></>
      : <bdi dir="ltr">{m[1]} – {m[2]}</bdi>;
  };
  if (!rides.length) return <p className="club-rides-empty">{p.empty}</p>;
  const day = (d: string) => new Intl.DateTimeFormat(intlOf(p.locale), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  return (
    <div className="club-rides-grid">
      {rides.map((r, i) => {
        const name = nameOf(r), when = whenOf(r);
        return (
          <a key={i} className="club-ride" href={p.href}>
            <span className="club-ride-when">{day(r.date)}{when ? <> · {when}</> : null}</span>
            <strong>{name}</strong>
          </a>
        );
      })}
    </div>
  );
}
