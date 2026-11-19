import { cookies } from "next/headers";
import SignIn from "@/components/account/SignIn";
import SignOut from "@/components/account/SignOut";
import HandoffLink from "@/components/account/HandoffLink";
import { decodeSession } from "@/lib/account-core";
import { HANDOFF_COOKIE, accountLabel, sessionProfile } from "@/lib/handoff";
import { fill } from "@/lib/fill";
import type { L } from "@/i18n/tx";

// What My Account (/account/...) and Bookings (/bookings) show before the account is known: the session that could not be
// checked just now, a hand-back from the booking app this browser did not ask for, and the sign-in. Plain functions that
// give the page's own elements (not components), so a page's tree holds them as before.
const S = (v: unknown) => (typeof v === "string" ? v : "");

/** The session could not be checked just now (the database slow or out of reach): said so, with the page once more and
 *  Sign out, rather than the sign-in form, which told a rider who is signed in that they were not. */
export function unreadView(tx: L, again: string) {
  return (
    <div className="ac">
      <section className="ac-card">
        <img src="/site/logo-dark.png" alt="Micromobility" className="ac-logo" />
        <h1>{tx("Something went wrong", "حدث خطأ ما")}</h1>
        <p className="ac-text" role="alert">{tx("Please try again in a moment.", "يرجى المحاولة مرة أخرى بعد قليل.")}</p>
        <a className="ac-go ac-vol-go" href={again}>{tx("Try again", "حاول مرة أخرى")}</a>
        <ul className="ac-notes"><li><SignOut label={tx("Sign out", "تسجيل الخروج")} /></li></ul>
      </section>
    </div>
  );
}

/** Signed out: a hand-back kept aside names the account it would sign in as, and signs in only when the rider says so;
 *  otherwise the sign-in, with the booking app's sign-up and password reset (it hands the rider back signed in). */
export async function signedOutView(o: { tx: L; locale: string; expired: boolean; signin: { eyebrow: unknown; title: unknown; text: unknown; create: unknown; forgot: unknown };
  handoff: (auth?: string) => string }) {
  const { tx, locale, expired, signin: c } = o;
  const parked = decodeSession((await cookies()).get(HANDOFF_COOKIE)?.value);
  const offeredP = parked ? await sessionProfile(parked) : null;
  const offered = offeredP && offeredP !== "none" ? offeredP : null;
  if (offered) {
    return (
      <div className="ac">
        <section className="ac-card" aria-labelledby="ac-ho-h">
          <img src="/site/logo-dark.png" alt="Micromobility" className="ac-logo" />
          <h1 id="ac-ho-h">{fill(tx("Sign in as {name}?", "تسجيل الدخول باسم {name}؟"), { name: offered.name || offered.email || offered.phone })}</h1>
          <p className="ac-text">{fill(tx("This link signs this site in as {who}. Continue only if this is your account.", "يسجّل هذا الرابط الدخول إلى هذا الموقع باسم {who}. تابع فقط إن كان هذا حسابك."), { who: accountLabel(offered) })}</p>
          <form method="post" action="/api/account/handoff" className="ac-ho-btns">
            <button type="submit" name="do" value="switch" className="ac-go">{tx("Continue", "متابعة")}</button>
            <button type="submit" name="do" value="stay" className="ac-out">{tx("Cancel", "إلغاء")}</button>
          </form>
        </section>
      </div>
    );
  }
  return (
    <div className="ac">
      <section className="ac-card">
        <img src="/site/logo-dark.png" alt="Micromobility" className="ac-logo" />
        <p className="ac-eyebrow">{S(c.eyebrow)}</p>
        <h1>{S(c.title)}</h1>
        <p className="ac-text">{S(c.text)}</p>
        {expired && <p className="ac-err" role="status">{tx("That sign-in link has expired. Please sign in again.", "انتهت صلاحية رابط تسجيل الدخول. يرجى تسجيل الدخول مجدداً.")}</p>}
        <SignIn locale={locale} />
        {/* Sign-up and a password reset happen in the booking app, which hands the rider back here signed in
            (?handoff=site; api/account/handoff). */}
        <ul className="ac-notes">
          <li><HandoffLink href={o.handoff("signup")}>{S(c.create)}</HandoffLink></li>
          <li><HandoffLink href={o.handoff("forgot")}>{S(c.forgot)}</HandoffLink></li>
        </ul>
      </section>
    </div>
  );
}

/** Signed in, with a session the booking app handed back while this account was signed in (lib/handoff.ts): named, with
 *  the choice of account, until the rider answers or five minutes pass; or, just handed back, whom the site signed in. */
export async function handoffNotice(o: { tx: L; acct: { id: string; name: string; email: string; phone: string }; state: unknown }) {
  const { tx, acct } = o;
  const kept = decodeSession((await cookies()).get(HANDOFF_COOKIE)?.value);
  const handedP = kept && kept.id !== acct.id ? await sessionProfile(kept) : null;
  const handed = handedP && handedP !== "none" ? handedP : null;
  if (handed) {
    return (
      <section className="ac-sec ac-ho" aria-labelledby="ac-ho-h">
        <h2 id="ac-ho-h">{tx("Switch account?", "تبديل الحساب؟")}</h2>
        <p className="ac-text">
          {fill(tx("This browser is signed in as {current}. You have just signed in to the booking app as {next}. Which account should this site use?",
            "هذا المتصفح مسجّل الدخول باسم {current}، وقد سجّلت الدخول للتو في تطبيق الحجز باسم {next}. أي الحسابين تريد أن يستخدمه هذا الموقع؟"),
          { current: accountLabel(acct), next: accountLabel(handed) })}
        </p>
        <form method="post" action="/api/account/handoff" className="ac-ho-btns">
          <button type="submit" name="do" value="switch" className="ac-go">{fill(tx("Switch to {name}", "التبديل إلى {name}"), { name: handed.name || handed.email || handed.phone })}</button>
          <button type="submit" name="do" value="stay" className="ac-out">{fill(tx("Stay signed in as {name}", "البقاء مسجّلاً باسم {name}"), { name: acct.name || acct.email || acct.phone })}</button>
        </form>
      </section>
    );
  }
  if (o.state === "done") {
    return <p className="ac-ho-done" role="status">{fill(tx("You are signed in as {who}. If this is not your account, sign out.", "أنت مسجّل الدخول باسم {who}. إن لم يكن هذا حسابك، فسجّل الخروج."), { who: accountLabel(acct) })}</p>;
  }
  return null;
}
