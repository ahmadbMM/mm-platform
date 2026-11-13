"use client";

import SignIn from "@/components/account/SignIn";
import { useLocalize } from "@/i18n/TxProvider";
import { ASK_BACK_COOKIE, ASK_BACK_MAX_AGE, ASK_BACK_PATH } from "@/lib/ask";
import { T } from "./Ask.text";

// Signing in on an Ask page: the site's own sign-in form (the page draws again signed in, the session in a cookie
// this script never sees), and under it the way to an account for a visitor who has none. An account is created in
// the booking app, which hands the rider back signed in (api/account/handoff); as they leave, this page's address is
// noted in a cookie that only that route is sent, so they land back here and not on My Account.
export default function AskSignIn({ locale, create, back }: { locale: string; create: string; back: string }) {
  const t = useLocalize(T);
  const note = () => {
    try { document.cookie = `${ASK_BACK_COOKIE}=${encodeURIComponent(back)}; Path=${ASK_BACK_PATH}; Max-Age=${ASK_BACK_MAX_AGE}; SameSite=Lax; Secure`; } catch { /* no cookies: they land on My Account */ }
  };
  return (
    <div className="ask-signin">
      <SignIn locale={locale} />
      <a className="ask-create" href={create} onClick={note}>{t.create}</a>
    </div>
  );
}
