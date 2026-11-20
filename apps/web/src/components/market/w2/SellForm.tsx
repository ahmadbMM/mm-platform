"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import {
  MK_DECLARATIONS, MK_DESC_MAX, MK_FAULTS_MAX, MK_FOR_WHOM, MK_MINE, MK_RULES, MK_SERIAL_MAX, MK_TITLE_MAX, MK_WHEEL_SIZES, SA_CITIES,
  conditionKeys, isMkNameMode, listingHref, mkCatName, mkCategoryOf, mkCityName, mkPhotoSrc, mkPick, mkSports, mkTypesOf, sellHref,
  type MkCategory, type MkFactKey, type MkListingMine, type MkMe, type MkNameMode,
} from "@/lib/market/core";
import {
  W2_CONDITIONS, W2_FACT_MAX, isW2Step, w2Changes, w2Fields, w2FormOf, w2FormRead, w2HasChanges, w2Issues, w2Place, w2Sendable, w2StartStep,
  w2SerialText, w2StepFrom, w2Steps, w2Stored, w2Whole, type W2Ctx, type W2Fields, type W2Form, type W2Issue, type W2Step,
} from "@/lib/market/w2";
import MkAmt from "../MkAmt";
import MkIcon from "../MkIcon";
import MkSignIn from "../MkSignIn";
import { T as M } from "../Market.text";
import { T } from "../w2.text";
import PhotoGrid from "./PhotoGrid";
import ShareButton from "./ShareButton";
import { w2Get, w2Post, type W2Refused } from "./api";
import { W2_BIRTH_HREF, w2IssueText, w2RefusalText } from "./say";

// The selling form: one listing, filled in short steps and published from one review screen.
//   1 Photos and category   the photos first (PhotoGrid), then the sport and the product type
//   2 Details               the facts the category asks for, the condition (its definition inside each option), known faults
//   3 Title and description
//   4 Price and city        the price with its Negotiable tick, the city
//   5 Final details         the frame or serial number and the declarations where the category asks for them, how the
//                           seller is named (first name and last initial, or no name) and the consent tick
//   6 Review                everything on one screen, each part with its own Edit, then Publish
// A draft is the account's from its first photo: it is saved as the seller goes (on every step, and a moment after
// they stop typing), so it can be carried on from any device, and the page's address becomes the draft's own. A
// listing already on sale is edited in the same steps and saved in one go from the review, because the database holds
// a listing on sale to every publish rule on each save.
// Nothing typed is ever lost: a refusal is said at its field and the form stays as it is; a save that got no answer
// leaves the form as it is and says "Not saved"; and a draft's form is kept in this browser beside the page (for
// twelve hours at most), so a reload (a phone that dropped the page to open its camera) opens it as it was.
type Err = { field: string; text: string; birth?: boolean };
type Done = { listing: MkListingMine; kind: "live" | "held" | "saved" };
type Saved = { ok: true; listing: MkListingMine | null } | W2Refused;

// For what a draft's save may send: only the values the database would refuse outright matter, never the account.
const HARD_ONLY: W2Ctx = { draft: false, priceMax: Number.MAX_SAFE_INTEGER, shop: true, shortName: null, nameMode: "", consent: true, termsNeeded: false, termsTick: true };
// The controls each step shows, so a refusal about one of them is said beside it.
const STEP_FIELDS: Record<W2Step, readonly string[]> = {
  item: ["photos", "category"], details: ["facts", "condition", "faults"], words: ["title", "description"], price: ["price", "city"],
  final: ["serial", "declarations", "name_mode", "consent", "terms"], review: [],
};

/* ------------------------------------------------------------------ the form kept in this browser */

// Only a listing that exists is kept (by its number, which opens for its own account alone), and for twelve hours at
// most: nothing is typed before the first photo makes the draft, and a phone several people use holds no one's form
// for longer than that. What is kept is the seller's own listing as they were writing it, and nothing else.
const KEPT_FOR_MS = 12 * 3600 * 1000;
const KEPT = "mk-w2-form:";
const keptKey = (id: number) => `${KEPT}${id}`;
type Kept = { form: W2Form; step: W2Step | null; nameMode: MkNameMode | "" };
/** Forms kept longer ago than that are let go, whoever's they were. */
function sweep(now: number) {
  try {
    const old: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(KEPT)) continue;
      let saved = 0;
      try { const v = JSON.parse(window.localStorage.getItem(k) ?? "null") as { saved?: unknown } | null; if (v && typeof v.saved === "number") saved = v.saved; } catch { /* not ours to read: it goes */ }
      if (!(now - saved < KEPT_FOR_MS)) old.push(k);
    }
    for (const k of old) window.localStorage.removeItem(k);
  } catch { /* no storage */ }
}
function kept(l: MkListingMine | null, now: number): Kept {
  const server = w2FormOf(l);
  sweep(now);
  if (!l) return { form: server, step: null, nameMode: "" };
  try {
    const raw = window.localStorage.getItem(keptKey(l.id));
    const b = raw ? (JSON.parse(raw) as { at?: unknown; saved?: unknown; dirty?: unknown; step?: unknown; nameMode?: unknown; form?: unknown }) : null;
    if (!b) return { form: server, step: null, nameMode: "" };
    const same = b.at === l.updated_at;
    const recent = typeof b.saved === "number" && now - b.saved < KEPT_FOR_MS;
    let form = server;
    if (b.dirty === true && (same || recent)) {
      form = w2FormRead(b.form, server);
      // the listing changed since (a save whose answer never arrived, or another device): its photos are the database's
      if (!same) form = { ...form, photos: server.photos };
    }
    return { form, step: isW2Step(b.step) && (same || recent) ? b.step : null, nameMode: isMkNameMode(b.nameMode) ? b.nameMode : "" };
  } catch {
    return { form: server, step: null, nameMode: "" };
  }
}
function keep(id: number, value: unknown) {
  try { window.localStorage.setItem(keptKey(id), JSON.stringify(value)); } catch { /* no storage: the form still works */ }
}
function forget(id: number) {
  try { window.localStorage.removeItem(keptKey(id)); } catch { /* nothing kept */ }
}

/* ------------------------------------------------------------------ small parts */

function Said({ err, f, add }: { err: Err | null; f: string; add: string }) {
  if (!err || err.field !== f) return null;
  return (
    <div className="mk-w2-said" role="alert">
      <p className="mk-err">{err.text}</p>
      {err.birth && <Link className="mk-link" href={W2_BIRTH_HREF}>{add}<MkIcon name="next" size={16} flip /></Link>}
    </div>
  );
}

function Field({ id, label, f, err, add, children }: { id: string; label: string; f: string; err: Err | null; add: string; children: ReactNode }) {
  return (
    <div className="mk-field" data-f={f}>
      <label htmlFor={id}>{label}</label>
      {children}
      <Said err={err} f={f} add={add} />
    </div>
  );
}

export default function SellForm({ locale, cats, me, listing: first }: { locale: string; cats: MkCategory[]; me: MkMe; listing: MkListingMine | null }) {
  const t = useLocalize(M);
  const m = useLocalize(T);
  const uid = useId();
  const [now] = useState(() => Date.now());
  const [start] = useState(() => kept(first, Date.now()));

  const [acct, setAcct] = useState(me);
  const [listing, setListing] = useState<MkListingMine | null>(first);
  const [form, setForm] = useState<W2Form>(start.form);
  const [base, setBase] = useState<W2Fields>(() => w2Stored(first));
  const [sport, setSport] = useState(() => mkCategoryOf(cats, start.form.category)?.parent ?? "");
  const [nameMode, setNameMode] = useState<MkNameMode | "">(() => (me.names.short ? start.nameMode : "none"));
  const [consent, setConsent] = useState(false);
  const [termsTick, setTermsTick] = useState(false);
  const [termsAsk, setTermsAsk] = useState(!me.seller.terms_ok);
  const [err, setErr] = useState<Err | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [pending, setPending] = useState(0);
  const [signedOut, setSignedOut] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const cat = mkCategoryOf(cats, form.category);
  const draft = !listing || listing.status === "draft";
  const shop = acct.shop?.status === "approved";
  const steps = w2Steps(draft, cat);
  const ctx: W2Ctx = { draft, priceMax: acct.limits.price_max, shop, shortName: acct.names.short, nameMode, consent, termsNeeded: termsAsk, termsTick, now };
  const [step, setStep] = useState<W2Step>(() => {
    const c = mkCategoryOf(cats, start.form.category);
    const isDraft = !first || first.status === "draft";
    const list = w2Steps(isDraft, c);
    if (start.step && list.includes(start.step)) return start.step;
    if (!first) return "item";
    return w2StartStep(isDraft, list, w2Issues(start.form, c, { ...HARD_ONLY, draft: isDraft, shop: false, consent: false, priceMax: me.limits.price_max }));
  });
  const at: W2Step = steps.includes(step) ? step : "review";

  // The latest values, for what runs after a wait (a save in the queue, a photo that finished sending).
  const formRef = useRef(start.form);
  const baseRef = useRef(base);
  const listingRef = useRef(first);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const update = useCallback((patch: Partial<W2Form>) => {
    const next = { ...formRef.current, ...patch };
    formRef.current = next;
    setForm(next);
    setErr(null);
    setSaveState((s) => (s === "saving" ? s : "idle"));
  }, []);

  /* ---------------------------------------------------------------- saving */

  // One save at a time, each sending only what changed since the database last answered. `all`: everything that
  // changed, as it is (the review's Save or Publish, checked first); without it only the values the database would
  // take in a draft, so a link in the title is said at the title and never sent. `create`: make the draft even when
  // nothing has been filled in yet (the first photo needs a listing to belong to).
  const saveNow = useCallback(async (o: { all?: boolean; create?: boolean; leaving?: boolean }): Promise<Saved> => {
    const l = listingRef.current, f = formRef.current;
    if (l && l.status !== "draft" && !o.all) return { ok: true, listing: l };
    const c = mkCategoryOf(cats, f.category);
    let changes = w2Changes(baseRef.current, w2Fields(f, c));
    if (!o.all) changes = w2Sendable(changes, w2Issues(f, c, HARD_ONLY));
    if (!w2HasChanges(changes) && (l || !o.create)) return { ok: true, listing: l };
    setSaveState("saving");
    const r = await w2Post<{ listing: MkListingMine }>("/api/market/listing/save", { id: l?.id ?? null, fields: changes }, o.leaving === true);
    if (!r.ok) { setSaveState("failed"); return r; }
    const nextBase = { ...baseRef.current, ...changes } as W2Fields;
    baseRef.current = nextBase;
    setBase(nextBase);
    listingRef.current = r.listing;
    setListing(r.listing);
    if (!l) {
      // the page's address becomes the draft's, so a reload opens this draft
      try { window.history.replaceState(null, "", `${sellHref(r.listing.id)}${window.location.search}`); } catch { /* the address stays */ }
    }
    setSaveState("saved");
    return { ok: true, listing: r.listing };
  }, [cats]);
  const save = useCallback((o: { all?: boolean; create?: boolean; leaving?: boolean } = {}): Promise<Saved> => {
    const run = chain.current.then(() => saveNow(o));
    chain.current = run.catch(() => undefined);
    return run;
  }, [saveNow]);

  // a draft saves itself a moment after the seller stops, and when the page is put away
  useEffect(() => {
    if (!draft || !listing || done) return;
    const id = window.setTimeout(() => { void save(); }, 2500);
    return () => window.clearTimeout(id);
  }, [form, draft, listing, done, save]);
  useEffect(() => {
    const away = () => { if (document.visibilityState === "hidden") void save({ leaving: true }); };
    document.addEventListener("visibilitychange", away);
    return () => document.removeEventListener("visibilitychange", away);
  }, [save]);
  // the form as it stands, kept in this browser until it is published or saved
  useEffect(() => {
    if (done || !listing) return;
    const dirty = w2HasChanges(w2Changes(base, w2Fields(form, cat, now)));
    keep(listing.id, { at: listing.updated_at, saved: Date.now(), dirty, step: at, nameMode, form });
  }, [form, base, at, nameMode, listing, cat, now, done]);

  /* ---------------------------------------------------------------- moving, and saying what is wrong */

  const head = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) { moved.current = true; return; }
    head.current?.scrollIntoView({ block: "start" });
    head.current?.focus({ preventScroll: true });
  }, [at, done]);
  const lost = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!err) return;
    const el = err.field ? document.querySelector(`[data-f="${err.field}"]`) : null;
    (el ?? lost.current)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [err]);

  const go = (to: W2Step) => { setErr(null); setStep(to); };
  const fail = (i: W2Issue) => {
    if (i.step !== at && steps.includes(i.step)) setStep(i.step);
    setErr({ field: i.field, text: w2IssueText(t, m, i) });
  };
  // `beside`: the control a refusal is said at when it names none of its own (a photo that could not be sent)
  const refused = (r: W2Refused, beside = "") => {
    if (r.error === "signin") { setSignedOut(true); return; }
    if (r.error === "terms") {
      // the rules changed since the form opened: their tick is asked for, with the version now in force
      setTermsAsk(true);
      setTermsTick(false);
      void w2Get<{ signedIn?: boolean; me?: MkMe }>("/api/market/me").then((a) => { if (a.ok && a.me) setAcct(a.me); });
    }
    const place = w2Place(r.error, r.detail);
    if (place && place.step !== at && steps.includes(place.step)) setStep(place.step);
    setErr({ field: place?.field ?? beside, text: w2RefusalText(t, m, r.error, r.detail), birth: r.error === "birth" });
  };
  const refusedRef = useRef(refused);
  useEffect(() => { refusedRef.current = refused; });

  const ensureId = useCallback(async (): Promise<number | W2Refused> => {
    if (listingRef.current) return listingRef.current.id;
    const r = await save({ create: true });
    return r.ok ? (r.listing ? r.listing.id : { ok: false, error: "generic", detail: "" }) : r;
  }, [save]);
  const onPhotos = useCallback((photos: string[], why: "add" | "move" | "remove") => {
    update({ photos });
    if (why !== "move") void save(); // a new order waits for the seller to stop moving
  }, [update, save]);
  const onPhotoRefused = useCallback((r: W2Refused) => { refusedRef.current(r, "photos"); }, []);

  async function next() {
    if (busy) return;
    const mine = w2Issues(formRef.current, cat, ctx).filter((i) => i.step === at);
    if (mine.length) return fail(mine[0]);
    if (draft) {
      setBusy(true);
      const r = await save({ create: true });
      setBusy(false);
      if (!r.ok) return refused(r);
    }
    const to = w2StepFrom(steps, at, 1);
    if (to) go(to);
  }
  function back() {
    const to = w2StepFrom(steps, at, -1);
    if (!to) return;
    go(to);
    void save();
  }
  async function publish() {
    if (busy) return;
    const all = w2Issues(formRef.current, cat, ctx);
    if (all.length) return fail(all[0]);
    setBusy(true);
    const s = await save({ all: true, create: true });
    if (!s.ok || !s.listing) { setBusy(false); return refused(s.ok ? { ok: false, error: "generic", detail: "" } : s); }
    if (!draft) { setBusy(false); return finish(s.listing, s.listing.status === "held" ? "held" : "saved"); }
    const mode: MkNameMode = shop || nameMode !== "short" ? "none" : "short";
    const r = await w2Post<{ listing: MkListingMine }>("/api/market/listing/publish", { id: s.listing.id, nameMode: mode, consent, terms: termsAsk && termsTick ? acct.terms_version : null });
    setBusy(false);
    if (!r.ok) return refused(r);
    finish(r.listing, r.listing.status === "held" ? "held" : "live");
  }
  function finish(l: MkListingMine, kind: Done["kind"]) {
    forget(l.id);
    listingRef.current = l;
    setListing(l);
    setDone({ listing: l, kind });
  }

  /* ---------------------------------------------------------------- drawing */

  if (signedOut) return <MkSignIn locale={locale} />;
  if (done) {
    const l = done.listing;
    const open = l.status === "live" || l.status === "reserved";
    return (
      <section className="mk-box mk-w2-done" aria-labelledby={`${uid}-done`}>
        <span className={`mk-w2-done-mark${done.kind === "held" ? " mk-w2-done-held" : ""}`}><MkIcon name={done.kind === "held" ? "clock" : "tick"} size={26} /></span>
        <h1 id={`${uid}-done`} ref={head} tabIndex={-1}>{done.kind === "held" ? m.heldTitle : done.kind === "live" ? m.liveTitle : m.savedTitle}</h1>
        {done.kind === "held" && <p>{m.heldBody}</p>}
        <div className="mk-w2-done-acts">
          {open && <Link className="mk-btn" href={listingHref(l.id)}>{m.viewListing}</Link>}
          {open && <ShareButton id={l.id} title={l.title ?? ""} label={m.share} copied={m.linkCopied} className="mk-btn2" />}
          <Link className={open ? "mk-btn2" : "mk-btn"} href={MK_MINE}>{t.myListings}</Link>
        </div>
      </section>
    );
  }

  const sports = mkSports(cats);
  const types = sport ? mkTypesOf(cats, sport) : [];
  const idOf = (k: string) => `${uid}-${k}`;
  const bad = (f: string) => (err?.field === f ? true : undefined);
  const said = (f: string) => <Said err={err} f={f} add={m.addBirth} />;
  const stepNo = steps.indexOf(at) + 1;
  const asked = w2Whole(form.price);
  const last = at === "review";
  const prev = w2StepFrom(steps, at, -1);
  const elsewhere = err && !STEP_FIELDS[at].includes(err.field) && !(at === "details" && err.field.startsWith("fact_"));
  const fact = (k: MkFactKey) => {
    const id = idOf(`fact-${k}`), f = `fact_${k}`;
    const set = (v: string) => update({ facts: { ...formRef.current.facts, [k]: v } });
    if (k === "wheel_size" || k === "for_whom") {
      const options: readonly string[] = k === "wheel_size" ? MK_WHEEL_SIZES : MK_FOR_WHOM;
      return (
        <Field key={k} id={id} label={m.facts[k]} f={f} err={err} add={m.addBirth}>
          <select id={id} value={form.facts[k]} onChange={(e) => set(e.target.value)}>
            <option value="">{m.choose}</option>
            {options.map((o) => <option key={o} value={o}>{k === "for_whom" ? m.forWhom[o as keyof typeof m.forWhom] : o === "other" ? m.wheelOther : o}</option>)}
          </select>
        </Field>
      );
    }
    const ltr = k === "year" || k === "frame_size";
    return (
      <Field key={k} id={id} label={m.facts[k]} f={f} err={err} add={m.addBirth}>
        <input id={id} type="text" value={form.facts[k]} onChange={(e) => set(e.target.value)} dir={ltr ? "ltr" : "auto"} inputMode={k === "year" ? "numeric" : undefined}
          maxLength={k === "year" ? 4 : W2_FACT_MAX[k]} autoComplete="off" aria-invalid={bad(f)} />
      </Field>
    );
  };

  return (
    <div className="mk-w2-form">
      <div className="mk-w2-top">
        <div className="mk-w2-bar" aria-hidden="true">{steps.map((s, i) => <span key={s} className={i < stepNo ? "on" : undefined} />)}</div>
        <div className="mk-w2-where">
          <p className="mk-w2-count">{m.stepOf(stepNo, steps.length)}</p>
          {draft && listing && saveState === "failed"
            ? <button type="button" className="mk-w2-save mk-w2-save-bad" onClick={() => void save()}><MkIcon name="again" size={14} />{m.notSaved}</button>
            : <span className="mk-w2-save" role="status">{draft && listing ? (saveState === "saving" ? m.saving : saveState === "saved" ? m.saved : "") : ""}</span>}
        </div>
        <h1 ref={head} tabIndex={-1}>{!draft && last ? m.editTitle : m.steps[at]}</h1>
      </div>

      {at === "item" && (
        <>
          <PhotoGrid photos={form.photos} cat={cat} m={m} retry={t.retry} invalid={err?.field === "photos"} ensureId={ensureId} onChange={onPhotos} onRefused={onPhotoRefused} onPending={setPending} />
          {said("photos")}
          <div className="mk-w2-two" data-f="category">
            <div className="mk-field">
              <label htmlFor={idOf("sport")}>{m.sport}</label>
              <select id={idOf("sport")} value={sport} aria-invalid={bad("category")} onChange={(e) => { setSport(e.target.value); update({ category: "" }); }}>
                <option value="" disabled>{m.choose}</option>
                {sports.map((s) => <option key={s.slug} value={s.slug}>{mkCatName(s, locale)}</option>)}
              </select>
            </div>
            <div className="mk-field">
              <label htmlFor={idOf("type")}>{m.type}</label>
              <select id={idOf("type")} value={cat ? cat.slug : ""} disabled={!sport} aria-invalid={bad("category")} onChange={(e) => update({ category: e.target.value })}>
                <option value="" disabled>{m.choose}</option>
                {types.map((c) => <option key={c.slug} value={c.slug}>{mkCatName(c, locale)}</option>)}
              </select>
            </div>
          </div>
          {said("category")}
        </>
      )}

      {at === "details" && (
        <>
          {cat && cat.facts.length > 0 && <div className="mk-w2-two" data-f="facts">{cat.facts.map(fact)}</div>}
          {said("facts")}
          <fieldset className="mk-w2-fs" data-f="condition">
            <legend>{m.condition}</legend>
            <div className="mk-w2-opts">
              {W2_CONDITIONS.map((c) => {
                const k = conditionKeys(c);
                return (
                  <label key={c} className="mk-w2-opt">
                    <input type="radio" name={idOf("condition")} value={c} checked={form.condition === c} onChange={() => update({ condition: c })} />
                    <span><b>{t[k.label]}</b><span className="mk-w2-def">{t[k.def]}</span></span>
                  </label>
                );
              })}
            </div>
            {said("condition")}
            {!err && cat?.tier === "new_only" && form.condition !== "" && form.condition !== "new" && <p className="mk-err" role="alert">{t.errors.new_only}</p>}
          </fieldset>
          <Field id={idOf("faults")} label={m.faults} f="faults" err={err} add={m.addBirth}>
            <textarea id={idOf("faults")} className="mk-w2-short" value={form.faults} onChange={(e) => update({ faults: e.target.value })} maxLength={MK_FAULTS_MAX} dir="auto" rows={3} aria-invalid={bad("faults")} />
          </Field>
        </>
      )}

      {at === "words" && (
        <>
          <Field id={idOf("title")} label={m.title} f="title" err={err} add={m.addBirth}>
            <input id={idOf("title")} type="text" value={form.title} onChange={(e) => update({ title: e.target.value })} maxLength={MK_TITLE_MAX} dir="auto" autoComplete="off" enterKeyHint="next" aria-invalid={bad("title")} />
          </Field>
          <Field id={idOf("description")} label={m.description} f="description" err={err} add={m.addBirth}>
            <textarea id={idOf("description")} value={form.description} onChange={(e) => update({ description: e.target.value })} maxLength={MK_DESC_MAX} dir="auto" rows={7} aria-invalid={bad("description")} />
          </Field>
        </>
      )}

      {at === "price" && (
        <>
          <Field id={idOf("price")} label={m.price} f="price" err={err} add={m.addBirth}>
            <span className="mk-w2-money">
              <span className="mk-amt" aria-hidden="true">{"⃁"}</span>
              <input id={idOf("price")} type="text" inputMode="numeric" value={form.price} onChange={(e) => update({ price: e.target.value })} maxLength={12} dir="ltr" autoComplete="off" aria-invalid={bad("price")} />
            </span>
          </Field>
          <label className="mk-check">
            <input type="checkbox" checked={form.negotiable} onChange={(e) => update({ negotiable: e.target.checked })} />
            <span>{t.negotiable}</span>
          </label>
          <Field id={idOf("city")} label={m.city} f="city" err={err} add={m.addBirth}>
            <select id={idOf("city")} value={form.city} onChange={(e) => update({ city: e.target.value })} aria-invalid={bad("city")}>
              <option value="" disabled>{m.choose}</option>
              {SA_CITIES.map((c) => <option key={c.key} value={c.key}>{mkCityName(c.key, locale)}</option>)}
            </select>
          </Field>
        </>
      )}

      {at === "final" && (
        <>
          {cat?.needs_serial && (
            <Field id={idOf("serial")} label={m.serial} f="serial" err={err} add={m.addBirth}>
              <input id={idOf("serial")} type="text" value={form.serial} onChange={(e) => update({ serial: e.target.value })} maxLength={MK_SERIAL_MAX} dir="ltr" autoComplete="off" autoCapitalize="characters"
                autoCorrect="off" spellCheck={false} aria-invalid={bad("serial")} />
            </Field>
          )}
          {cat?.tier === "declare" && (
            <fieldset className="mk-w2-fs" data-f="declarations">
              <legend>{m.declarations}</legend>
              {MK_DECLARATIONS.map((k) => (
                <label key={k} className="mk-check">
                  <input type="checkbox" checked={form.declarations[k]} onChange={(e) => update({ declarations: { ...formRef.current.declarations, [k]: e.target.checked } })} />
                  <span>{m.declare[k]}</span>
                </label>
              ))}
              {said("declarations")}
            </fieldset>
          )}
          {draft && (shop && acct.shop
            ? <div className="mk-field"><span className="mk-label">{m.listedAs}</span><p className="mk-w2-val"><bdi dir="auto">{mkPick(locale, acct.shop.name_en, acct.shop.name_ar)}</bdi></p></div>
            : (
              <fieldset className="mk-w2-fs" data-f="name_mode">
                <legend>{m.nameQ}</legend>
                <div className="mk-w2-opts">
                  {acct.names.short && (
                    <label className="mk-w2-opt">
                      <input type="radio" name={idOf("name")} checked={nameMode === "short"} onChange={() => { setNameMode("short"); setErr(null); }} />
                      <span><b><bdi dir="auto">{acct.names.short}</bdi></b></span>
                    </label>
                  )}
                  <label className="mk-w2-opt">
                    <input type="radio" name={idOf("name")} checked={nameMode === "none"} onChange={() => { setNameMode("none"); setErr(null); }} />
                    <span><b>{m.noName}</b><span className="mk-w2-def">{t.seller_private}</span></span>
                  </label>
                </div>
                {said("name_mode")}
              </fieldset>
            ))}
          {draft && (
            <div data-f="consent">
              <label className="mk-check">
                <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr(null); }} />
                <span>{shop ? m.consentShop : m.consent}</span>
              </label>
              {said("consent")}
            </div>
          )}
          {draft && termsAsk && (
            <div data-f="terms">
              <label className="mk-check">
                <input type="checkbox" checked={termsTick} onChange={(e) => { setTermsTick(e.target.checked); setErr(null); }} />
                <span>{m.acceptRules}</span>
              </label>
              <Link className="mk-link" href={MK_RULES} target="_blank" rel="noopener">{t.rules}<MkIcon name="next" size={16} flip /></Link>
              {said("terms")}
            </div>
          )}
        </>
      )}

      {at === "review" && (
        <div className="mk-w2-sum">
          <section>
            <header><h2>{m.steps.item}</h2><button type="button" className="mk-link" onClick={() => go("item")} aria-label={`${m.edit}: ${m.steps.item}`}>{m.edit}</button></header>
            {form.photos.length > 0 && (
              <ul className="mk-w2-strip">
                {form.photos.map((p, i) => <li key={p}><img src={mkPhotoSrc(p, true) ?? ""} alt={m.photoN(i + 1)} loading="lazy" /></li>)}
              </ul>
            )}
            {cat && <p className="mk-w2-val">{[mkCategoryOf(cats, cat.parent), cat].filter((c): c is MkCategory => !!c).map((c) => mkCatName(c, locale)).join(" · ")}</p>}
          </section>
          <section>
            <header><h2>{m.steps.details}</h2><button type="button" className="mk-link" onClick={() => go("details")} aria-label={`${m.edit}: ${m.steps.details}`}>{m.edit}</button></header>
            <dl>
              {form.condition && <div><dt>{m.condition}</dt><dd>{t[conditionKeys(form.condition).label]}</dd></div>}
              {cat?.facts.map((k) => {
                const v = form.facts[k].trim();
                if (!v) return null;
                const shown = k === "for_whom" ? m.forWhom[v as keyof typeof m.forWhom] ?? v : k === "wheel_size" && v === "other" ? m.wheelOther : v;
                return <div key={k}><dt>{m.facts[k]}</dt><dd><bdi dir="auto">{shown}</bdi></dd></div>;
              })}
              {form.faults.trim() && <div><dt>{m.faults}</dt><dd><bdi dir="auto">{form.faults}</bdi></dd></div>}
            </dl>
          </section>
          <section>
            <header><h2>{m.steps.words}</h2><button type="button" className="mk-link" onClick={() => go("words")} aria-label={`${m.edit}: ${m.steps.words}`}>{m.edit}</button></header>
            {form.title.trim() && <p className="mk-w2-val mk-w2-val-title"><bdi dir="auto">{form.title}</bdi></p>}
            {form.description.trim() && <p className="mk-w2-val mk-user" dir="auto">{form.description}</p>}
          </section>
          <section>
            <header><h2>{m.steps.price}</h2><button type="button" className="mk-link" onClick={() => go("price")} aria-label={`${m.edit}: ${m.steps.price}`}>{m.edit}</button></header>
            <dl>
              {asked !== null && <div><dt>{m.price}</dt><dd><MkAmt n={asked} word={t.sar} />{form.negotiable && <span className="mk-tag mk-w2-neg">{t.negotiable}</span>}</dd></div>}
              {form.city && <div><dt>{m.city}</dt><dd>{mkCityName(form.city, locale)}</dd></div>}
            </dl>
          </section>
          {steps.includes("final") && (
            <section>
              <header><h2>{m.steps.final}</h2><button type="button" className="mk-link" onClick={() => go("final")} aria-label={`${m.edit}: ${m.steps.final}`}>{m.edit}</button></header>
              <dl>
                {cat?.needs_serial && form.serial.trim() && <div><dt>{m.serial}</dt><dd><bdi dir="ltr">{w2SerialText(form.serial)}</bdi></dd></div>}
                {draft && (
                  <div>
                    <dt>{m.nameQ}</dt>
                    <dd><bdi dir="auto">{shop && acct.shop ? mkPick(locale, acct.shop.name_en, acct.shop.name_ar) : nameMode === "short" && acct.names.short ? acct.names.short : nameMode === "none" ? t.seller_private : ""}</bdi></dd>
                  </div>
                )}
              </dl>
              {cat?.tier === "declare" && (
                <ul className="mk-w2-ticks">
                  {MK_DECLARATIONS.filter((k) => form.declarations[k]).map((k) => <li key={k}><MkIcon name="tick" size={16} />{m.declare[k]}</li>)}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {elsewhere && err && (
        <div className="mk-w2-said" role="alert" ref={lost}>
          <p className="mk-err">{err.text}</p>
          {err.birth && <Link className="mk-link" href={W2_BIRTH_HREF}>{m.addBirth}<MkIcon name="next" size={16} flip /></Link>}
        </div>
      )}

      <div className="mk-w2-nav">
        {prev && <button type="button" className="mk-btn2" onClick={back} disabled={busy}><MkIcon name="back" size={18} flip />{t.back}</button>}
        {last
          ? <button type="button" className="mk-btn" onClick={() => void publish()} disabled={busy || pending > 0} aria-busy={busy || undefined}>{draft ? m.publish : m.saveChanges}</button>
          : <button type="button" className="mk-btn" onClick={() => void next()} disabled={busy || pending > 0} aria-busy={busy || undefined}>{m.next}<MkIcon name="next" size={18} flip /></button>}
      </div>
    </div>
  );
}
