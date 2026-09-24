"use client";

import { useEffect, useState } from "react";
import { rpc } from "@/lib/rpc-client";

// The next open community rides (club_rides), read in the visitor's browser.
type Ride = { title: string; date: string; time: string | null; kind: string | null };
type Props = { locale: string; href: string; empty: string };
const KIND: Record<string, { en: string; ar: string }> = {
  saturday: { en: "Saturday Social Ride", ar: "ركبة السبت الاجتماعية" },
  swim: { en: "Triathlon Pool Session", ar: "جلسة سباحة للترياثلون" },
  workshop: { en: "Club workshop", ar: "ورشة النادي" },
};

export default function ClubRides(p: Props) {
  const ar = p.locale === "ar";
  const [rides, setRides] = useState<Ride[] | null>(null);
  useEffect(() => {
    let live = true;
    rpc<Ride[]>("club_rides", {}).then((r) => { if (live) setRides(Array.isArray(r) ? r : []); }).catch(() => { if (live) setRides([]); });
    return () => { live = false; };
  }, []);
  if (rides === null) return <div className="club-rides-grid" aria-busy="true" />;
  if (!rides.length) return <p className="club-rides-empty">{p.empty}</p>;
  const day = (d: string) => new Intl.DateTimeFormat(ar ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  return (
    <div className="club-rides-grid">
      {rides.map((r, i) => {
        const name = r.title || (r.kind && KIND[r.kind] ? (ar ? KIND[r.kind].ar : KIND[r.kind].en) : ar ? "ركبة المجتمع" : "Community ride");
        return (
          <a key={i} className="club-ride" href={p.href}>
            <span className="club-ride-when">{day(r.date)}{r.time ? <> · <bdi dir="ltr">{r.time}</bdi></> : null}</span>
            <strong>{name}</strong>
          </a>
        );
      })}
    </div>
  );
}
