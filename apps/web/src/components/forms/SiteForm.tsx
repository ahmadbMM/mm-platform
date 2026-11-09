"use client";

import { useEffect, useRef } from "react";

// A registration form drawn inside a page of the website (forms/shared/site-form.mjs): its markup as the form's build
// wrote it, and its scripts run once, after the page is on screen, with the page's language and the database the
// website talks to itself (staging's on staging). The scripts own the form from then on: React never draws inside it
// again, so nothing it does is undone by a render.
export type FormRun = (site: { lang: string; db: { url: string; key: string } }) => void;

export default function SiteForm({ name, markup, run, lang }: { name: string; markup: string; run: FormRun; lang: string }) {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    run({ lang, db: { url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } });
  }, [lang, run]);
  return <div className={`mmf mmf-${name}`} dangerouslySetInnerHTML={{ __html: markup }} />;
}
