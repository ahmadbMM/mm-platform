"use client";

import "./signup.css";
import { useEffect, useRef } from "react";
import { useTxLocale } from "@/i18n/TxProvider";
import { FORGOT_WA_SHOWN, forgotWaHref } from "@/lib/signup";
import { signupWords } from "./Signup.words";

// Forgot password, as the booking app has it (its forgot mode; the owner, 2026-10-07: no self-service reset - an email
// and a mobile number were all it took to take an account over): the rider messages us on WhatsApp from the number on
// their account, staff send a temporary password from the account editor, and the rider chooses their own at the next
// sign-in (ChangePassword.tsx). Its title, the one line, the WhatsApp button with the message filled in, the number
// written out, and Back to sign in: in place of the sign-in form (SignIn.tsx, `onBack`) or as its own page
// (/forgot-password, `backHref`).
export default function ForgotPanel({ heading = "h2", onBack, backHref = "/account" }: { heading?: "h1" | "h2"; onBack?: () => void; backHref?: string }) {
  const w = signupWords(useTxLocale());
  const top = useRef<HTMLHeadingElement>(null);
  const inPlace = !!onBack;
  // Opened in place of the form: the keyboard follows to its title.
  useEffect(() => { if (inPlace) top.current?.focus(); }, [inPlace]);
  const H = heading;
  const back = (
    <>
      <svg className="su-back-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      <span>{w.back}</span>
    </>
  );
  return (
    <div className="su-fg">
      <H ref={top} tabIndex={-1} className={heading === "h2" ? "su-fg-title" : undefined}>{w.forgotTitle}</H>
      <p className="su-fg-sub">{w.forgotSub}</p>
      <a className="ac-go su-fg-wa" href={forgotWaHref(w.forgotWaText)} target="_blank" rel="noopener noreferrer">{w.forgotWaBtn}</a>
      <p className="su-fg-num" dir="ltr">{FORGOT_WA_SHOWN}</p>
      {onBack
        ? <button type="button" className="su-back" onClick={onBack}>{back}</button>
        : <a className="su-back" href={backHref}>{back}</a>}
    </div>
  );
}
