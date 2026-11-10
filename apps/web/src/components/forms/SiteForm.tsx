"use client";

import { useEffect, useRef } from "react";

// A registration form drawn inside a page of the website (forms/shared/site-form.mjs): its markup as the form's build
// wrote it, and its scripts run once, after the page is on screen, with the page's language and the database the
// website talks to itself (staging's on staging). The scripts own the form from then on: React never draws inside it
// again, so nothing it does is undone by a render.
export type FormRun = (site: { lang: string; db: { url: string; key: string }; booking: string }) => void;

/** The booking app that reads the same database (NEXT_PUBLIC_BOOKING_URL: staging's copy, on staging), as
 *  "https://<host>/", so a hand-over code or a change link a form leads to is made and read in one database; "" when
 *  none is set, and a form then sends riders to the live one. */
function bookingUrl(): string {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_BOOKING_URL ?? "");
    return u.protocol === "https:" ? `${u.origin}/` : "";
  } catch {
    return "";
  }
}

export default function SiteForm({ name, markup, run, lang }: { name: string; markup: string; run: FormRun; lang: string }) {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    run({ lang, db: { url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" }, booking: bookingUrl() });
  }, [lang, run]);
  return <div className={`mmf mmf-${name}`} dangerouslySetInnerHTML={{ __html: markup }} />;
}
