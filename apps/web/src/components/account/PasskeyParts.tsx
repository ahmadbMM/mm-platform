"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocalize, useTxLocale } from "@/i18n/TxProvider";
import { intlOf } from "@/i18n/locales";
import { assertionJson, ceremonyFailure, deviceCanMakePasskeys, passkeysSupported, registrationJson, toCreateOptions, toGetOptions } from "@/lib/sx-B7-passkey-client";
import type { PasskeyItem } from "@/lib/sx-B7-passkey";
import { postJson } from "./fields";
import { T } from "./sx-B7.text";
import "./sx-B7.css";

// Passkeys (N06, B7, 2026-11-18; behind site_content 'account.passkeys', off by default - a page draws none of these
// unless the server says the switch is on):
//   - PasskeySignIn: "Sign in with a passkey" under the password sign-in (components/account/SignIn.tsx). Face ID, a
//     fingerprint or the device's PIN unlocks a passkey the rider added before; the page then reloads signed in, as
//     after the password. Shown only where the browser can use passkeys.
//   - PasskeyCard: My Account's list (what each is, when added and last used), Add a passkey, and Remove.
//   - PasskeyOffer: once after a password sign-in (SignIn marks it), on a device that can make one, for an account
//     with none yet: a centred pop-up, Add a passkey or Not now; never asked again in this browser.

const BRANDS: Record<string, string> = {
  icloud: "iCloud Keychain", google: "Google Password Manager", "chrome-mac": "Chrome on Mac", windows: "Windows Hello",
  samsung: "Samsung Pass", "1password": "1Password", bitwarden: "Bitwarden", iphone: "iPhone", ipad: "iPad", chromebook: "Chromebook", mac: "Mac",
};

const OFFER_NEXT = "mm-pk-offer"; // sessionStorage: a password sign-in just happened in this tab
const OFFERED = "mm-pk-offered"; // localStorage: the offer was shown in this browser

/** SignIn calls this on a password sign-in, before the page reloads. */
export function offerPasskeyNext(): void {
  try { sessionStorage.setItem(OFFER_NEXT, "1"); } catch { /* no storage: no offer */ }
}

const noSub = () => () => {};
const useSupported = () => useSyncExternalStore(noSub, passkeysSupported, () => false);

/** The drawn passkey mark: a person and a key (24 grid, stroke 1.75, round caps). */
export function PasskeyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M2.75 20.25c0-3.45 2.8-6.25 6.25-6.25 1.4 0 2.7.46 3.75 1.25" />
      <circle cx="17.5" cy="12.75" r="2.75" />
      <path d="M17.5 15.5v5.75M17.5 18.75h2.25" />
    </svg>
  );
}

type Answer = { ok?: boolean; error?: string; options?: Record<string, unknown>; items?: PasskeyItem[] };

/* ------------------------------------------------------------------ signing in */

export function PasskeySignIn({ onSignedIn, onHeld }: { onSignedIn: () => void; onHeld: () => void }) {
  const t = useLocalize(T);
  const supported = useSupported();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!supported) return null;
  async function go() {
    if (busy) return;
    setErr(""); setBusy(true);
    const start = await postJson<Answer>("/api/account/passkey/signin-start", {});
    if (!start.ok || !start.options) { setBusy(false); setErr(t.errors[start.error || ""] || t.errors.generic); return; }
    let cred: PublicKeyCredential | null = null;
    try {
      cred = (await navigator.credentials.get({ publicKey: toGetOptions(start.options) })) as PublicKeyCredential | null;
    } catch (e) {
      setBusy(false);
      if (ceremonyFailure(e) !== "cancel") setErr(t.errors.failed); // closing the prompt is the rider's own answer
      return;
    }
    if (!cred) { setBusy(false); return; }
    const done = await postJson<Answer>("/api/account/passkey/signin", assertionJson(cred));
    if (done.ok) { onSignedIn(); return; }
    setBusy(false);
    if (done.error === "must_change") { onHeld(); return; }
    if (done.error === "unknown") {
      // a passkey this site no longer keeps: its password manager may forget it (the Signal API, where there is one)
      try {
        const signal = (PublicKeyCredential as unknown as { signalUnknownCredential?: (o: { rpId: string; credentialId: string }) => Promise<void> }).signalUnknownCredential;
        if (signal) void signal({ rpId: String(start.options.rpId), credentialId: cred.id }).catch(() => {});
      } catch { /* not there */ }
    }
    setErr(t.errors[done.error || ""] || t.errors.generic);
  }
  return (
    <div className="pk-signin">
      <p className="pk-or"><span>{t.or}</span></p>
      <button type="button" className="pk-btn" onClick={go} disabled={busy} aria-busy={busy}>
        <PasskeyIcon />{busy ? t.waiting : t.signin}
      </button>
      {err && <p className="ac-err" role="alert">{err}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ adding one */

/** Adds a passkey to the signed-in account: the items after, or the refusal's code ("cancel" when the rider closed the
 *  prompt, which is said nowhere). */
async function addPasskey(): Promise<{ items: PasskeyItem[] } | { error: string }> {
  const start = await postJson<Answer>("/api/account/passkey/add-start", {});
  if (!start.ok || !start.options) return { error: start.error || "generic" };
  let cred: PublicKeyCredential | null = null;
  try {
    cred = (await navigator.credentials.create({ publicKey: toCreateOptions(start.options) })) as PublicKeyCredential | null;
  } catch (e) {
    const f = ceremonyFailure(e);
    return { error: f === "other" ? "failed" : f };
  }
  if (!cred) return { error: "cancel" };
  const done = await postJson<Answer>("/api/account/passkey/add", registrationJson(cred));
  return done.ok && Array.isArray(done.items) ? { items: done.items } : { error: done.error || "generic" };
}

function useDay() {
  const locale = useTxLocale();
  return (iso: string) => {
    try { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(iso)); }
    catch { return iso.slice(0, 10); }
  };
}

/** My Account: the account's passkeys, Add a passkey, Remove. Drawn once the list is read (nothing while it cannot be). */
export function PasskeyCard() {
  const t = useLocalize(T);
  const day = useDay();
  const supported = useSupported();
  const [items, setItems] = useState<PasskeyItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [gone, setGone] = useState<PasskeyItem | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let live = true;
    postJson<Answer>("/api/account/passkey/list", {}).then((r) => { if (live && r.ok && Array.isArray(r.items)) setItems(r.items); });
    return () => { live = false; };
  }, []);
  if (!items) return null;
  async function add() {
    setErr(""); setOk(false); setBusy(true);
    const r = await addPasskey();
    setBusy(false);
    if ("items" in r) { setItems(r.items); setOk(true); }
    else if (r.error !== "cancel") setErr(t.addErrors[r.error] || t.addErrors.generic);
  }
  async function removeIt() {
    if (!gone) return;
    setErr(""); setOk(false); setBusy(true);
    const r = await postJson<Answer>("/api/account/passkey/remove", { id: gone.id });
    setBusy(false);
    dlg.current?.close();
    if (r.ok && Array.isArray(r.items)) setItems(r.items);
    else setErr(t.addErrors[r.error || ""] || t.addErrors.generic);
  }
  const label = (p: PasskeyItem) => BRANDS[p.label] ?? t.labels[p.label] ?? t.labels.other;
  return (
    <section className="ac-panel" aria-labelledby="pk-h">
      <h2 id="pk-h" className="ac-panel-h">{t.title}</h2>
      {items.length > 0 && (
        <ul className="pk-list">
          {items.map((p) => (
            <li key={p.id} className="pk-row">
              <span className="pk-mark"><PasskeyIcon size={18} /></span>
              <span className="pk-what">
                <bdi className="pk-name">{label(p)}</bdi>
                <span className="pk-facts">
                  {[t.addedOn(day(p.createdAt)), p.lastUsedAt ? t.usedOn(day(p.lastUsedAt)) : null, p.synced ? t.synced : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <button type="button" className="ac-btn ac-btn-line pk-rm" onClick={() => { setGone(p); dlg.current?.showModal(); }} disabled={busy}>{t.remove}</button>
            </li>
          ))}
        </ul>
      )}
      {supported && items.length < 10 && (
        <button type="button" className="ac-btn pk-add" onClick={add} disabled={busy}><PasskeyIcon size={18} />{busy ? t.adding : t.add}</button>
      )}
      {ok && <p className="ac-ok" role="status">{t.added}</p>}
      {err && <p className="ac-err" role="alert">{err}</p>}
      <dialog ref={dlg} className="ac-dlg" aria-labelledby="pk-rm-h" onClick={(e) => { if (e.target === e.currentTarget) dlg.current?.close(); }}>
        <h2 id="pk-rm-h">{t.removeTitle}</h2>
        {gone && <p className="ac-sub"><bdi>{label(gone)}</bdi> · {t.addedOn(day(gone.createdAt))}</p>}
        <div className="ac-dlg-btns">
          <button type="button" className="ac-btn ac-btn-red" onClick={removeIt} disabled={busy}>{t.remove}</button>
          <button type="button" className="ac-btn ac-btn-line" onClick={() => dlg.current?.close()}>{t.cancel}</button>
        </div>
      </dialog>
    </section>
  );
}

/* ------------------------------------------------------------------ the offer after a password sign-in */

/** Whether an offer is due: a password sign-in marked it in this tab, and it was never shown in this browser. */
function offerDue(): boolean {
  try { return sessionStorage.getItem(OFFER_NEXT) === "1" && localStorage.getItem(OFFERED) !== "1"; } catch { return false; }
}
/** The offer decided: the tab's mark goes either way, and a shown offer is never shown again in this browser. Taken only
 *  here, when the answer is known (an effect that runs twice, or a page left half-way, must not lose it). */
function offerSettled(shown: boolean): void {
  try { sessionStorage.removeItem(OFFER_NEXT); if (shown) localStorage.setItem(OFFERED, "1"); } catch { /* no storage */ }
}

export function PasskeyOffer() {
  const t = useLocalize(T);
  const dlg = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    (async () => {
      if (!offerDue()) return;
      const can = await deviceCanMakePasskeys();
      if (!live) return;
      if (!can) return offerSettled(false);
      const r = await postJson<Answer>("/api/account/passkey/list", {});
      if (!live) return;
      if (!r.ok || !Array.isArray(r.items) || r.items.length > 0) return offerSettled(false);
      // another pop-up the page must ask first (a new password, the privacy notice, a waiver, a rating): the offer waits
      // for the next page in this tab
      if (document.querySelector("dialog[open], [aria-modal='true']")) return;
      offerSettled(true);
      dlg.current?.showModal();
    })();
    return () => { live = false; };
  }, []);
  async function add() {
    setErr(""); setBusy(true);
    const r = await addPasskey();
    setBusy(false);
    if ("items" in r) { dlg.current?.close(); window.location.reload(); return; }
    if (r.error !== "cancel") setErr(t.addErrors[r.error] || t.addErrors.generic);
  }
  return (
    <dialog ref={dlg} className="ac-dlg pk-offer" aria-labelledby="pk-offer-h" onClick={(e) => { if (e.target === e.currentTarget) dlg.current?.close(); }}>
      <span className="pk-offer-mark"><PasskeyIcon size={28} /></span>
      <h2 id="pk-offer-h">{t.offerTitle}</h2>
      {err && <p className="ac-err" role="alert">{err}</p>}
      <div className="ac-dlg-btns">
        <button type="button" className="ac-btn" onClick={add} disabled={busy}>{busy ? t.adding : t.add}</button>
        <button type="button" className="ac-btn ac-btn-line" onClick={() => dlg.current?.close()}>{t.notNow}</button>
      </div>
    </dialog>
  );
}
