import type { Metadata } from "next";
import { askSite, SignedInAs } from "@/components/ask/AskFrame";
import TestimonialWrite from "@/components/testimonials/TestimonialWrite";
import TmFrame from "@/components/testimonials/TmFrame";
import TmSignIn from "@/components/testimonials/TmSignIn";
import { T } from "@/components/testimonials/Testimonials.text";
import "@/components/account/account.css";
import "@/components/learn/learn.css";
import "@/components/pages/pages.css";
import "@/components/testimonials/testimonials.css";
import { serverLocalize } from "@/i18n/dicts";
import { askSession } from "@/lib/ask-server";
import { pageMeta } from "@/lib/seo";

// micromobility.sa/testimonials/write: a signed-in rider writes a testimonial (what it is about, stars, the words, an
// optional photo, how their name shows, and the tick that lets MicroMobility publish it) and sees their own, each with
// its state and Delete. Signed out, the site's sign-in (as the Ask pages have it) and the way to an account, which
// hands the rider back here. The account's data is read by the page's script through /api/testimonials/mine (the session
// stays in its HttpOnly cookie); the page itself knows only whether the cookie is there. It works whether the launch
// switch is on or off, is never in search engines, and is never kept at the edge (lib/page-cache.ts).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = serverLocalize(T, locale);
  return pageMeta({ path: "/testimonials/write", locale, noindex: true, title: `${t.writeTitle} · Micromobility` });
}

export default async function TestimonialWritePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const t = serverLocalize(T, locale);
  const session = await askSession();
  const at = await askSite(locale);
  return (
    <TmFrame locale={locale} at={at}>
      <SignedInAs locale={locale} session={session} handoff={(await searchParams).handoff} />
      <div className="pg tm-page tm-write-page">
        <p className="pg-eyebrow">{t.eyebrow}</p>
        <h1>{t.writeTitle}</h1>
        {session ? <TestimonialWrite locale={locale} create={at.create} /> : <TmSignIn locale={locale} create={at.create} />}
      </div>
    </TmFrame>
  );
}
