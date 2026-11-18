"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import {
  TM_ABOUTS, TM_BODY_MAX, TM_BODY_MIN, tmError, tmMine, tmStatusWord, type TmAbout, type TmMine, type TmMineItem, type TmNameMode,
} from "@/lib/testimonials";
import { T } from "./Testimonials.text";
import Stars from "./Stars";
import TmSignIn from "./TmSignIn";
import { ConsentTick, NameChoice, StarPick, Words, firstChoice, readPhoto } from "./TestimonialFields";

// /testimonials/write for a signed-in rider (the page draws this only when the account cookie is there): the account's
// names, "since" line, the switch and their own testimonials come from /api/testimonials/mine; the form sends through
// /api/testimonials/send with source 'web', and Delete through /api/testimonials/delete (a second tap confirms). Every
// refusal the database can give is said in words (Testimonials.text.ts errors); a check the page can make itself (what
// it is about, the stars, 20 characters, the tick) is said before anything is sent. A session the database no longer
// takes shows the sign-in in its place.
type Load = { state: "loading" } | { state: "ready"; mine: TmMine } | { state: "signin" } | { state: "absent" } | { state: "fail" };

async function readMine(): Promise<Load> {
  try {
    const r = await fetch("/api/testimonials/mine", { cache: "no-store", credentials: "same-origin" });
    const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    const mine = tmMine(b);
    if (mine) return { state: "ready", mine };
    const e = tmError(b?.error);
    return e === "signin" ? { state: "signin" } : e === "absent" ? { state: "absent" } : { state: "fail" };
  } catch {
    return { state: "fail" };
  }
}

export default function TestimonialWrite({ locale, create }: { locale: string; create: string }) {
  const t = useLocalize(T);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const retry = useCallback(async () => setLoad(await readMine()), []);
  // after a send or a delete: the list read again, kept as it was when the read fails
  const refresh = useCallback(async () => {
    const l = await readMine();
    if (l.state === "ready" || l.state === "signin") setLoad(l);
  }, []);
  useEffect(() => {
    let live = true;
    void readMine().then((l) => { if (live) setLoad(l); });
    return () => { live = false; };
  }, []);

  if (load.state === "loading") return <p className="tm-note" role="status" aria-busy="true" />;
  if (load.state === "signin") return <TmSignIn locale={locale} create={create} />;
  if (load.state === "absent") return <p className="tm-note">{t.errors.absent}</p>;
  if (load.state === "fail") {
    return (
      <div className="tm-box">
        <p className="ac-err" role="alert">{t.loadFail}</p>
        <button type="button" className="tm-btn tm-btn-line" onClick={() => { setLoad({ state: "loading" }); void retry(); }}>{t.retry}</button>
      </div>
    );
  }
  return <Ready key="ready" locale={locale} mine={load.mine} onChanged={refresh} onSignedOut={() => setLoad({ state: "signin" })} />;
}

function Ready({ locale, mine, onChanged, onSignedOut }: { locale: string; mine: TmMine; onChanged: () => Promise<void>; onSignedOut: () => void }) {
  const t = useLocalize(T);
  const [about, setAbout] = useState<TmAbout | null>(null);
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [mode, setMode] = useState<TmNameMode>(() => firstChoice(mine.names));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ key: string; field?: string } | null>(null);
  const [sent, setSent] = useState(false);
  const errRef = useRef<HTMLParagraphElement>(null);
  const edit = <V,>(set: (v: V) => void) => (v: V) => { set(v); setSent(false); if (err && !busy) setErr(null); };

  const fail = (key: string, field?: string) => {
    setErr({ key, field });
    requestAnimationFrame(() => errRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
  };

  async function pickPhoto(input: HTMLInputElement) {
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    setPhotoBusy(true);
    const p = await readPhoto(f);
    setPhotoBusy(false);
    if (p) { setPhoto(p); setErr(null); } else fail("photo", "photo");
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || photoBusy) return;
    const words = body.trim();
    if (!about) return fail("about", "about");
    if (!stars) return fail("stars", "stars");
    if (words.length < TM_BODY_MIN || words.length > TM_BODY_MAX) return fail("body", "body");
    if (!consent) return fail("consent", "consent");
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/testimonials/send", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ body: words, stars, about, nameMode: mode, consent, photo, source: "web", lang: locale }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) {
        setAbout(null); setStars(0); setBody(""); setPhoto(null); setConsent(false); setSent(true);
        await onChanged().catch(() => undefined);
        return;
      }
      const code = tmError(b?.error);
      if (code === "signin") { onSignedOut(); return; }
      fail(code, code);
    } catch {
      fail("generic");
    } finally {
      setBusy(false);
    }
  }

  const bad = (f: string) => err?.field === f;
  return (
    <>
      <form className="tm-box tm-form" onSubmit={send} noValidate>
        {sent && <p className="rr-thanks" role="status">{t.sent}</p>}
        <fieldset className="tm-fs">
          <legend className="tm-q">{t.aboutQ}</legend>
          <div className={`tm-pills tm-radios${bad("about") ? " err" : ""}`}>
            {TM_ABOUTS.map((a) => (
              <label key={a} className={about === a ? "on" : undefined}>
                <input type="radio" name="tm-about" value={a} checked={about === a} disabled={busy} onChange={() => edit(setAbout)(a)} />
                {t.about[a]}
              </label>
            ))}
          </div>
        </fieldset>
        <StarPick value={stars} onChange={edit(setStars)} w={t} disabled={busy} />
        <Words value={body} onChange={edit(setBody)} w={t} disabled={busy} invalid={bad("body") || bad("link")} />
        <div className="tm-field">
          <span className="tm-q" id="tm-photo-l">{t.photoQ} <span className="tm-opt">({t.optional})</span></span>
          {photo && (
            <div className="tm-photo-pick">
              <img src={photo} alt="" />
              <button type="button" className="tm-btn tm-btn-line" disabled={busy} onClick={() => { setPhoto(null); setErr(null); }}>{t.photoRemove}</button>
            </div>
          )}
          <label className={`tm-btn tm-btn-line tm-file${photoBusy ? " busy" : ""}`}>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*" aria-labelledby="tm-photo-l" disabled={busy || photoBusy} onChange={(e) => void pickPhoto(e.currentTarget)} />
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="12" cy="12.5" r="3.6" /><path d="M8.5 5l1.4-2h4.2l1.4 2" /></svg>
            {photo ? t.photoChange : t.photoPick}
          </label>
        </div>
        <NameChoice mine={mine} value={mode} onChange={edit(setMode)} w={t} disabled={busy} />
        <ConsentTick checked={consent} onChange={edit(setConsent)} w={t} disabled={busy} invalid={bad("consent")} />
        {err && <p ref={errRef} className="ac-err" role="alert">{t.errors[err.key] ?? t.errors.generic}</p>}
        <button type="submit" className="tm-btn" disabled={busy || photoBusy}>{busy ? t.sending : t.send}</button>
      </form>
      {mine.items.length > 0 && <Mine items={mine.items} onChanged={onChanged} onSignedOut={onSignedOut} />}
    </>
  );
}

/** The rider's own, newest first: what it is about, the stars, the words, how the name shows, the state, and Delete -
 *  the first tap asks, a second within four seconds deletes. */
function Mine({ items, onChanged, onSignedOut }: { items: TmMineItem[]; onChanged: () => Promise<void>; onSignedOut: () => void }) {
  const t = useLocalize(T);
  const [sure, setSure] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [failed, setFailed] = useState<{ id: number; key: string } | null>(null);
  const [gone, setGone] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function remove(id: number) {
    if (busy !== null) return;
    if (sure !== id) {
      setSure(id);
      setFailed(null);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSure((s) => (s === id ? null : s)), 4000);
      return;
    }
    clearTimeout(timer.current);
    setBusy(id);
    try {
      const r = await fetch("/api/testimonials/delete", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id }) });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      const code = b?.ok ? null : tmError(b?.error);
      if (code === "signin") { onSignedOut(); return; }
      // gone: already taken down (another tab, or staff) - it leaves the list all the same
      if (code === null || code === "gone") { setGone((g) => [...g, id]); void onChanged().catch(() => undefined); }
      else setFailed({ id, key: code === "busy" || code === "absent" ? code : "removeFail" });
    } catch {
      setFailed({ id, key: "removeFail" });
    } finally {
      setBusy(null);
      setSure(null);
    }
  }

  const shown = items.filter((x) => !gone.includes(x.id));
  if (!shown.length) return null;
  return (
    <section className="tm-mine" aria-labelledby="tm-mine-h">
      <h2 id="tm-mine-h">{t.mineTitle}</h2>
      <ul>
        {shown.map((x) => {
          const st = tmStatusWord(x.status);
          return (
            <li key={x.id} className="tm-mine-item">
              <div className="tm-mine-top">
                <span className={`tm-status tm-status-${st}`}>{st === "waiting" ? t.waiting : st === "published" ? t.published : t.notPublished}</span>
                <span className="tm-about">{t.about[x.about]}</span>
              </div>
              {x.stars !== null && <Stars value={x.stars} label={t.starsOf(String(x.stars))} size={16} />}
              <p className="tm-mine-body" dir="auto">{x.body}</p>
              <p className="tm-mine-name">{x.displayName ? <bdi dir="auto">{x.displayName}</bdi> : t.anonymous}</p>
              {failed?.id === x.id && <p className="ac-err" role="alert">{failed.key === "removeFail" ? t.removeFail : t.errors[failed.key]}</p>}
              <button type="button" className={`tm-del${sure === x.id ? " sure" : ""}`} disabled={busy !== null} onClick={() => void remove(x.id)}>
                {sure === x.id ? t.removeSure : t.remove}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
