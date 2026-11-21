"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { fill } from "@/i18n/tx";
import { NATIONALITIES } from "@/content/nationalities";
import { onBackdrop } from "@/lib/backdrop";
import { natOptions } from "@/lib/nationality";
import {
  askYears, checkAsk, checkJoin, checkOffer, mtAlert, mtErrKey, MT_CHECKS, MT_HELPS, MT_OFFER_LINKS,
  type MtAsk, type MtFeed, type MtFieldErr, type MtHelp, type MtLink, type MtMatch, type MtMentor, type MtOffer, type MtProfile,
} from "@/lib/mentorship";
import { HubHead, PEOPLE } from "./HubCards";
import type { CommunityWords } from "./Community.words";

// The Mentorship programme in a member's area on /club (lib/mentorship.ts; the booking app's member-hub.js Mentorship
// block, da0602c2, 2026-11-13, and the anonymous mentees of a87dee98, 2026-11-18). Its card sits after the Saturday report,
// as the app's sits after its staff card: "Help a member starting university", how many students are looking, what waits
// for the member (an offer to answer, a "Still in touch?" due), Register as a mentor (until they are one), See the
// students, Register as a mentee (until they have a request). See the students opens the programme in the card's place,
// with Close, as the app opens its own page: the member's matches (first name, WhatsApp, the check, Step back), their
// request with the offers staff proposed (Accept, Not now), them as a mentor (Change, Leave the programme), their offers
// (Withdraw), and the students' profiles - number, university and field only - each with I can help. The three forms
// (register as a mentee, register as a mentor, an offer) and every "are you sure" open as centred pop-ups (native dialogs:
// Escape and a tap outside close them). Each write goes to /api/account/mentor, which answers with the programme as the
// database now holds it; a refusal is said in its own words where it happened, never as a bar.
type Words = CommunityWords & { cancel: string }; // the page hands over mentorWords (Community.words.ts): the keys used here
type Dlg = { k: "ask" } | { k: "join"; after: number } | { k: "offer"; num: number };
type Confirm = { title: string; label: string; run: () => void };
const HELP_K: Record<MtHelp, keyof CommunityWords> = { questions: "hpQuestions", subjects: "hpSubjects", cv: "hpCv", internship: "hpInternship", job: "hpJob", unilife: "hpUnilife", city: "hpCity", talk: "hpTalk" };
const LINK_K: Record<MtLink, keyof CommunityWords> = { uni: "lkUni", field: "lkField", city: "lkCity", industry: "lkIndustry", experience: "lkExperience" };
const CHECK_K = { yes: "mtYes", not_yet: "mtNotYet", help: "mtNeedHelp" } as const;
const RULES = ["mtR1", "mtR2", "mtR3", "mtR4", "mtR5"] as const;

async function call(body: Record<string, unknown> | null): Promise<{ ok: true; feed: MtFeed } | { ok: false; error: string }> {
  try {
    const r = await fetch("/api/account/mentor", body ? { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      : { cache: "no-store", credentials: "same-origin" });
    const a = (await r.json().catch(() => null)) as { ok?: boolean; feed?: MtFeed; error?: string } | null;
    if (a?.ok === true && a.feed) return { ok: true, feed: a.feed };
    return { ok: false, error: a?.error || "generic" };
  } catch { return { ok: false, error: "generic" }; }
}

function Chips({ list, k, w }: { list: string[]; k: Record<string, keyof CommunityWords>; w: Words }) {
  const a = list.filter((x) => k[x]);
  return a.length ? <ul className="club-mt-chips">{a.map((x) => <li key={x}>{w[k[x]]}</li>)}</ul> : null;
}

/** A centred pop-up (a native dialog), open while it is drawn. */
function Dialog({ title, onClose, children, foot }: { title: string; onClose: () => void; children: ReactNode; foot: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  return (
    <dialog ref={ref} className="club-mt-dlg" aria-labelledby={`${id}-t`} onClose={onClose} onClick={(e) => { if (onBackdrop(e)) e.currentTarget.close(); }}>
      <div className="club-mt-dlg-in">
        <h2 id={`${id}-t`} className="club-mt-dlg-t">{title}</h2>
        <div className="club-mt-dlg-body">{children}</div>
        <div className="club-mt-dlg-acts">{foot}</div>
      </div>
    </dialog>
  );
}

export default function Mentorship({ feed: first, locale, w }: { feed: MtFeed; locale: string; w: Words }) {
  const [d, setD] = useState(first);
  const [open, setOpen] = useState(false);
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const top = useRef<HTMLElement>(null);
  const see = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    if (open) top.current?.querySelector<HTMLElement>("h3")?.focus({ preventScroll: false });
    else see.current?.focus({ preventScroll: true });
  }, [open]);

  async function act(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setMsg("");
    const a = await call(body);
    setBusy(false);
    if (a.ok) { setD(a.feed); return; }
    if (a.error === "signin") { window.location.reload(); return; }
    setMsg(w[mtErrKey(a.error)]);
    const b = await call(null);
    if (b.ok) setD(b.feed);
  }
  const ask = (title: keyof CommunityWords, label: keyof CommunityWords, run: () => void) => setConfirm({ title: w[title], label: w[label], run });
  const leave = (id: string | null, kind: "ask" | "offer" | "match") => {
    const [q, l] = kind === "ask" ? (["mtCloseAskQ", "mtCloseAsk"] as const) : kind === "offer" ? (["mtWithdrawQ", "mtWithdraw"] as const) : (["mtStepBackQ", "mtStepBack"] as const);
    ask(q, l, () => void act({ act: "leave", offer: kind === "ask" ? null : id }));
  };
  const offerOpen = (num: number) => setDlg(d.mentor ? { k: "offer", num } : { k: "join", after: num });

  const alert = mtAlert(d);
  const card = (
    <section className="club-hub club-hub-mt" aria-labelledby="club-hub-mt-h">
      <HubHead id="club-hub-mt-h" mark={PEOPLE}>{w.mtTitle}</HubHead>
      <strong className="club-hub-name">{w.mtHelpName}</strong>
      {d.profiles.length > 0 && <p className="club-hub-meta">{fill(w.mtOpenN, String(d.profiles.length))}</p>}
      {alert && <p className="club-mt-alert" role="status"><bdi>{alert.k === "offered" ? w.mtOffered : fill(w.mtCheckQ, alert.name)}</bdi></p>}
      {!d.mentor && <button type="button" className="club-hub-btn club-hub-primary" onClick={() => setDlg({ k: "join", after: 0 })}>{w.mtRegMentor}</button>}
      <button ref={see} type="button" className={`club-hub-btn${d.mentor ? " club-hub-primary" : ""}`} onClick={() => { moved.current = true; setOpen(true); void call(null).then((a) => { if (a.ok) setD(a.feed); }); }}>{w.mtSee}</button>
      {!d.ask && <button type="button" className="club-hub-btn" onClick={() => setDlg({ k: "ask" })}>{w.mtAsk}</button>}
    </section>
  );

  const offers = d.offers.filter((o) => o.status !== "matched");
  const matches = [...(d.ask?.matches ?? []).map((x) => ({ x, side: "student" as const, o: null })), ...d.offers.filter((o) => o.status === "matched").map((o) => ({ x: o, side: "mentor" as const, o }))];
  const page = (
    <section ref={top} className="club-hub club-hub-mt club-mt-page" aria-labelledby="club-mt-h">
      <div className="club-mt-head">
        <h3 id="club-mt-h" tabIndex={-1}>{w.mtTitle}</h3>
        <button type="button" className="club-hub-btn club-mt-close" onClick={() => { moved.current = true; setOpen(false); setMsg(""); }}>{w.close}</button>
      </div>
      {msg && !dlg && <p className="club-hub-err" role="alert">{msg}</p>}
      {matches.length > 0 && <><h4 className="club-mt-h2">{w.mtMatches}</h4>{matches.map((m) => <MatchCard key={m.x.id} x={m.x} side={m.side} o={m.o} w={w} busy={busy} onCheck={(v) => void act({ act: "check", offer: m.x.id, answer: v })} onLeave={() => leave(m.x.id, "match")} />)}</>}
      {d.ask && <><h4 className="club-mt-h2">{w.mtYourAsk}</h4><AskCard a={d.ask} w={w} locale={locale} busy={busy}
        onAnswer={(id, yes) => (yes ? void act({ act: "answer", offer: id, yes: true }) : ask("mtNotNowQ", "mtNotNow", () => void act({ act: "answer", offer: id, yes: false })))}
        onEdit={() => setDlg({ k: "ask" })} onClose={() => leave(null, "ask")} /></>}
      <h4 className="club-mt-h2">{w.mtYouMentor}</h4>
      <MentorCard m={d.mentor} w={w} onJoin={() => setDlg({ k: "join", after: 0 })} onQuit={() => ask("mtLeaveProgQ", "mtLeaveProg", () => void act({ act: "quit" }))} />
      {offers.length > 0 && <><h4 className="club-mt-h2">{w.mtYourOffers}</h4><ul className="club-mt-list">{offers.map((o) => <OfferRow key={o.id} o={o} w={w} onWithdraw={() => leave(o.id, "offer")} />)}</ul></>}
      <h4 className="club-mt-h2">{w.mtStudents}</h4>
      {d.profiles.length ? d.profiles.map((p) => <ProfileCard key={p.num} p={p} w={w} onHelp={() => offerOpen(p.num)} />) : <p className="club-hub-meta">{w.mtNone}</p>}
      {!d.ask && <button type="button" className="club-hub-btn" onClick={() => setDlg({ k: "ask" })}>{w.mtAsk}</button>}
    </section>
  );

  return (
    <>
      {open ? page : card}
      {dlg?.k === "ask" && <AskForm key="ask" a={d.ask && d.ask.status === "pending" ? d.ask : null} locale={locale} w={w} onClose={() => setDlg(null)} onDone={(f) => { setD(f); setDlg(null); }} />}
      {dlg?.k === "join" && <JoinForm key="join" m={d.mentor} w={w} onClose={() => setDlg(null)} onDone={(f) => {
        setD(f);
        const p = dlg.after ? f.profiles.find((x) => x.num === dlg.after && !x.offered) : null;
        setDlg(p && f.mentor ? { k: "offer", num: p.num } : null);
      }} />}
      {dlg?.k === "offer" && (() => {
        const p = d.profiles.find((x) => x.num === dlg.num);
        return p ? <OfferForm key={`of${p.num}`} p={p} helps={d.mentor?.helps ?? []} w={w} onClose={() => setDlg(null)} onDone={(f) => { setD(f); setDlg(null); }} /> : null;
      })()}
      {confirm && (
        <Dialog title={confirm.title} onClose={() => setConfirm(null)} foot={<>
          <button type="button" className="club-hub-btn" onClick={(e) => e.currentTarget.closest("dialog")?.close()}>{w.cancel}</button>
          <button type="button" className="club-hub-btn club-hub-red" onClick={(e) => { const run = confirm.run; e.currentTarget.closest("dialog")?.close(); run(); }}>{confirm.label}</button>
        </>}>{null}</Dialog>
      )}
    </>
  );
}

function MatchCard({ x, side, o, w, busy, onCheck, onLeave }: { x: MtMatch | MtOffer; side: "student" | "mentor"; o: MtOffer | null; w: Words; busy: boolean; onCheck: (v: string) => void; onLeave: () => void }) {
  const m = x as MtMatch;
  return (
    <div className="club-mt-card club-mt-match">
      <span className="club-hub-k">{side === "student" ? w.mtYourMentor : w.mtYourStudent}</span>
      <strong className="club-hub-name"><bdi>{x.name}</bdi></strong>
      {side === "mentor" && o
        ? <><p className="club-mt-line">{fill(w.mtProfile, String(o.num))} · <bdi>{o.university}</bdi></p><p className="club-hub-meta"><bdi>{o.field}</bdi></p></>
        : <>{m.summary && <p className="club-mt-goal"><bdi>{m.summary}</bdi></p>}<Chips list={m.links ?? []} k={LINK_K} w={w} /></>}
      {x.wa && <a className="club-hub-btn club-hub-primary club-mt-wa" href={`https://wa.me/${x.wa}`} target="_blank" rel="noopener">{w.mtWa}</a>}
      {x.due && (
        <div className="club-mt-check">
          <span className="club-hub-k"><bdi>{fill(w.mtCheckQ, x.name)}</bdi></span>
          <div className="club-mt-acts">{MT_CHECKS.map((v) => <button key={v} type="button" className="club-hub-btn" disabled={busy} onClick={() => onCheck(v)}>{w[CHECK_K[v]]}</button>)}</div>
        </div>
      )}
      <button type="button" className="club-hub-btn" onClick={onLeave}>{w.mtStepBack}</button>
    </div>
  );
}

function AskCard({ a, w, locale, busy, onAnswer, onEdit, onClose }: { a: MtAsk; w: Words; locale: string; busy: boolean; onAnswer: (id: string, yes: boolean) => void; onEdit: () => void; onClose: () => void }) {
  const country = useMemo(() => {
    const name = NATIONALITIES.find(([c]) => c === a.country)?.[1] ?? a.country;
    return natOptions(locale, w.palestine).find((o) => o.value === name)?.label ?? name;
  }, [a.country, locale, w.palestine]);
  const st = a.status === "pending" ? w.mtAskPending : a.status === "matched" ? w.mtStMatched : w.mtAskOpen;
  return (
    <div className="club-mt-card club-mt-ask">
      <span className="club-mt-pill">{st}</span>
      {a.num && <span className="club-hub-k">{fill(w.mtProfile, String(a.num))}</span>}
      <strong className="club-hub-name"><bdi>{a.university}</bdi></strong>
      <p className="club-mt-line"><bdi>{a.field}</bdi></p>
      <p className="club-hub-meta"><bdi>{a.city}</bdi>, {country} · {fill(w.mtClass, String(a.classYear))}</p>
      <Chips list={a.helps} k={HELP_K} w={w} />
      {a.goal && <p className="club-mt-goal"><bdi>{a.goal}</bdi></p>}
      {a.proposed.map((p) => (
        <div key={p.id} className="club-mt-sub" role="group" aria-label={w.mtOffered}>
          <strong className="club-mt-line">{w.mtOffered}</strong>
          {p.summary && <p className="club-mt-goal"><bdi>{p.summary}</bdi></p>}
          <Chips list={p.links} k={LINK_K} w={w} /><Chips list={p.helps} k={HELP_K} w={w} />
          <div className="club-mt-acts">
            <button type="button" className="club-hub-btn" disabled={busy} onClick={() => onAnswer(p.id, false)}>{w.mtNotNow}</button>
            <button type="button" className="club-hub-btn club-hub-primary" disabled={busy} onClick={() => onAnswer(p.id, true)}>{w.mtAccept}</button>
          </div>
        </div>
      ))}
      {a.status === "pending" && <button type="button" className="club-hub-btn" onClick={onEdit}>{w.mtEdit}</button>}
      <button type="button" className="club-hub-btn" onClick={onClose}>{w.mtCloseAsk}</button>
    </div>
  );
}

function MentorCard({ m, w, onJoin, onQuit }: { m: MtMentor | null; w: Words; onJoin: () => void; onQuit: () => void }) {
  if (!m) return <button type="button" className="club-hub-btn club-hub-primary" onClick={onJoin}>{w.mtRegMentor}</button>;
  const line = [m.work, m.places].filter(Boolean);
  return (
    <div className="club-mt-card club-mt-me">
      <strong className="club-hub-name"><bdi>{m.university}</bdi></strong>
      <p className="club-mt-line"><bdi>{m.field}</bdi></p>
      {line.length > 0 && <p className="club-hub-meta">{line.map((x, i) => <span key={i}>{i > 0 && " · "}<bdi>{x}</bdi></span>)}</p>}
      <Chips list={m.helps} k={HELP_K} w={w} />
      <button type="button" className="club-hub-btn" onClick={onJoin}>{w.mtEdit}</button>
      <button type="button" className="club-hub-btn" onClick={onQuit}>{w.mtLeaveProg}</button>
    </div>
  );
}

function OfferRow({ o, w, onWithdraw }: { o: MtOffer; w: Words; onWithdraw: () => void }) {
  const st = o.status === "proposed" ? w.mtStProposed : o.status === "declined" ? w.mtStDeclined : o.status === "ended" ? w.mtStEnded : w.mtStOffered;
  return (
    <li className="club-mt-row">
      <div className="club-mt-row-t"><strong>{fill(w.mtProfile, String(o.num))}</strong><span><bdi>{o.university}</bdi> · <bdi>{o.field}</bdi></span><span className="club-mt-pill">{st}</span></div>
      {(o.status === "offered" || o.status === "proposed") && <button type="button" className="club-hub-btn club-hub-sm" onClick={onWithdraw}>{w.mtWithdraw}</button>}
    </li>
  );
}

function ProfileCard({ p, w, onHelp }: { p: MtProfile; w: Words; onHelp: () => void }) {
  return (
    <div className="club-mt-card club-mt-prof" data-num={p.num}>
      <span className="club-hub-k">{fill(w.mtProfile, String(p.num))}</span>
      <strong className="club-hub-name"><bdi>{p.university}</bdi></strong>
      <p className="club-mt-line"><bdi>{p.field}</bdi></p>
      {p.offered ? <span className="club-mt-pill">{p.offered === "matched" ? w.mtStMatched : p.offered === "proposed" ? w.mtStProposed : w.mtStOffered}</span>
        : <button type="button" className="club-hub-btn club-hub-primary" onClick={onHelp}>{w.mtCanHelp}</button>}
    </div>
  );
}

// ── The forms ─────────────────────────────────────────────────────────────────────────────────────
function useForm(onDone: (f: MtFeed) => void, w: Words) {
  const [err, setErr] = useState<MtFieldErr>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  async function send(e: MtFieldErr, body: Record<string, unknown>, close: () => void) {
    setErr(e);
    if (Object.keys(e).length) {
      setTimeout(() => box.current?.querySelector<HTMLElement>(".err input, .err select, .err textarea, .err button")?.focus(), 0);
      return;
    }
    if (busy) return;
    setBusy(true); setMsg("");
    const a = await call(body);
    setBusy(false);
    if (a.ok) { onDone(a.feed); return; }
    if (a.error === "signin") { window.location.reload(); return; }
    setMsg(w[mtErrKey(a.error)]);
    if (a.error === "gone" || a.error === "own" || a.error === "exists") { const b = await call(null); if (b.ok) onDone(b.feed); else close(); }
  }
  const clear = (k: string) => setErr((x) => { if (!x[k]) return x; const y = { ...x }; delete y[k]; return y; });
  return { err, msg, busy, box, send, clear };
}

function Field({ k, label, err, w, children, htmlFor }: { k: string; label: string; err: MtFieldErr; w: Words; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={`club-mt-field${err[k] ? " err" : ""}`} data-mt={k}>
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="club-mt-lbl">{label}</span>}
      {children}
      {err[k] && <p className="club-mt-msg" role="alert">{w[err[k]]}</p>}
    </div>
  );
}

function ChipGroup<T extends string>({ id, keys, k, on, set, w, label }: { id: string; keys: readonly T[]; k: Record<T, keyof CommunityWords>; on: T[]; set: (v: T[]) => void; w: Words; label: string }) {
  return (
    <div className="club-mt-picks" role="group" aria-label={label} id={id}>
      {keys.map((x) => (
        <button key={x} type="button" className={`club-int-chip${on.includes(x) ? " on" : ""}`} aria-pressed={on.includes(x)} data-k={x}
          onClick={() => set(on.includes(x) ? on.filter((y) => y !== x) : [...on, x])}>{w[k[x]]}</button>
      ))}
    </div>
  );
}

function Agree({ ok, set, err, w, id }: { ok: boolean; set: (v: boolean) => void; err: MtFieldErr; w: Words; id: string }) {
  return (
    <>
      <details className="club-mt-rules"><summary>{w.mtRules}</summary><ul>{RULES.map((r) => <li key={r}>{w[r]}</li>)}</ul></details>
      <div className={`club-mt-field club-mt-agree${err.ok ? " err" : ""}`} data-mt="ok">
        <label className="club-mt-tick"><input id={id} type="checkbox" checked={ok} onChange={(e) => set(e.target.checked)} /><span>{w.mtAgree}</span></label>
        {err.ok && <p className="club-mt-msg" role="alert">{w[err.ok]}</p>}
      </div>
    </>
  );
}

function Foot({ w, busy, form }: { w: Words; busy: boolean; form: string }) {
  return <>
    <button type="button" className="club-hub-btn" onClick={(e) => e.currentTarget.closest("dialog")?.close()}>{w.cancel}</button>
    <button type="submit" form={form} className="club-hub-btn club-hub-primary" disabled={busy}>{w.mtSend}</button>
  </>;
}

function AskForm({ a, locale, w, onClose, onDone }: { a: MtAsk | null; locale: string; w: Words; onClose: () => void; onDone: (f: MtFeed) => void }) {
  const id = useId();
  const { err, msg, busy, box, send, clear } = useForm(onDone, w);
  const y = new Date().getFullYear();
  const [v, setV] = useState({ university: a?.university ?? "", field: a?.field ?? "", city: a?.city ?? "", country: a?.country ?? "", classYear: a?.classYear || y, helps: (a?.helps ?? []) as MtHelp[], goal: a?.goal ?? "", genderPref: a?.genderPref ?? "any", ok: false });
  const set = (k: keyof typeof v, x: unknown) => { setV((p) => ({ ...p, [k]: x })); clear(k === "university" ? "uni" : k === "helps" ? "want" : k); };
  const codeOf = useMemo(() => Object.fromEntries(NATIONALITIES.map(([c, n]) => [n, c])), []);
  const nats = useMemo(() => natOptions(locale, w.palestine).filter((o) => codeOf[o.value]), [locale, w.palestine, codeOf]);
  const submit = (e: FormEvent) => { e.preventDefault(); void send(checkAsk(v), { act: "ask", ...v }, onClose); };
  const inp = (k: "university" | "field" | "city", max: number, ac?: string) => <input id={`${id}-${k}`} type="text" maxLength={max} autoComplete={ac} value={v[k]} onChange={(e) => set(k, e.target.value)} />;
  return (
    <Dialog title={w.mtAsk} onClose={onClose} foot={<Foot w={w} busy={busy} form={`${id}-f`} />}>
      <form id={`${id}-f`} className="club-mt-form" noValidate onSubmit={submit}><div ref={box}>
        <Field k="uni" label={w.mtUni} err={err} w={w} htmlFor={`${id}-university`}>{inp("university", 100, "organization")}</Field>
        <Field k="field" label={w.mtField} err={err} w={w} htmlFor={`${id}-field`}>{inp("field", 100)}</Field>
        <Field k="city" label={w.mtCity} err={err} w={w} htmlFor={`${id}-city`}>{inp("city", 60, "address-level2")}</Field>
        <Field k="country" label={w.mtCountry} err={err} w={w} htmlFor={`${id}-country`}>
          <select id={`${id}-country`} value={v.country} onChange={(e) => set("country", e.target.value)}>
            <option value="" />
            {nats.map((o, i) => <option key={`${o.value}-${i}`} value={codeOf[o.value]}>{o.label}</option>)}
          </select>
        </Field>
        <Field k="year" label={w.mtYear} err={err} w={w} htmlFor={`${id}-year`}>
          <select id={`${id}-year`} value={v.classYear} onChange={(e) => set("classYear", Number(e.target.value))}>{askYears(y, a?.classYear ?? 0).map((x) => <option key={x} value={x}>{x}</option>)}</select>
        </Field>
        <Field k="want" label={w.mtWantQ} err={err} w={w}><ChipGroup id={`${id}-want`} keys={MT_HELPS} k={HELP_K} on={v.helps} set={(x) => set("helps", x)} w={w} label={w.mtWantQ} /></Field>
        <Field k="goal" label={w.mtGoal} err={err} w={w} htmlFor={`${id}-goal`}><textarea id={`${id}-goal`} maxLength={200} rows={3} value={v.goal} onChange={(e) => set("goal", e.target.value)} /></Field>
        <Field k="pref" label={w.mtPref} err={err} w={w} htmlFor={`${id}-pref`}>
          <select id={`${id}-pref`} value={v.genderPref} onChange={(e) => set("genderPref", e.target.value)}>
            <option value="any">{w.mtPrefAny}</option><option value="female">{w.mtPrefF}</option><option value="male">{w.mtPrefM}</option>
          </select>
        </Field>
        <Agree ok={v.ok} set={(x) => set("ok", x)} err={err} w={w} id={`${id}-ok`} />
        {msg && <p className="club-hub-err" role="alert">{msg}</p>}
      </div></form>
    </Dialog>
  );
}

function JoinForm({ m, w, onClose, onDone }: { m: MtMentor | null; w: Words; onClose: () => void; onDone: (f: MtFeed) => void }) {
  const id = useId();
  const { err, msg, busy, box, send, clear } = useForm(onDone, w);
  const [v, setV] = useState({ university: m?.university ?? "", field: m?.field ?? "", work: m?.work ?? "", places: m?.places ?? "", helps: (m?.helps ?? []) as MtHelp[], about: m?.about ?? "", ok: false });
  const key = { university: "muni", field: "mfield", work: "mwork", places: "mplaces", helps: "mhelps", about: "mabout", ok: "ok" } as const;
  const set = (k: keyof typeof v, x: unknown) => { setV((p) => ({ ...p, [k]: x })); clear(key[k]); };
  const inp = (k: "university" | "field" | "work" | "places", max: number, ac?: string) => <input id={`${id}-${k}`} type="text" maxLength={max} autoComplete={ac} value={v[k]} onChange={(e) => set(k, e.target.value)} />;
  const submit = (e: FormEvent) => { e.preventDefault(); void send(checkJoin(v), { act: "join", ...v }, onClose); };
  return (
    <Dialog title={w.mtRegMentor} onClose={onClose} foot={<Foot w={w} busy={busy} form={`${id}-f`} />}>
      <form id={`${id}-f`} className="club-mt-form" noValidate onSubmit={submit}><div ref={box}>
        <Field k="muni" label={w.mtMUni} err={err} w={w} htmlFor={`${id}-university`}>{inp("university", 160, "organization")}</Field>
        <Field k="mfield" label={w.mtMField} err={err} w={w} htmlFor={`${id}-field`}>{inp("field", 120)}</Field>
        <Field k="mwork" label={w.mtMWork} err={err} w={w} htmlFor={`${id}-work`}>{inp("work", 120, "organization-title")}</Field>
        <Field k="mplaces" label={w.mtMPlaces} err={err} w={w} htmlFor={`${id}-places`}>{inp("places", 160)}</Field>
        <Field k="mhelps" label={w.mtHelpsQ} err={err} w={w}><ChipGroup id={`${id}-helps`} keys={MT_HELPS} k={HELP_K} on={v.helps} set={(x) => set("helps", x)} w={w} label={w.mtHelpsQ} /></Field>
        <Field k="mabout" label={w.mtMAbout} err={err} w={w} htmlFor={`${id}-about`}><textarea id={`${id}-about`} maxLength={500} rows={4} value={v.about} onChange={(e) => set("about", e.target.value)} /></Field>
        <Agree ok={v.ok} set={(x) => set("ok", x)} err={err} w={w} id={`${id}-ok`} />
        {msg && <p className="club-hub-err" role="alert">{msg}</p>}
      </div></form>
    </Dialog>
  );
}

function OfferForm({ p, helps, w, onClose, onDone }: { p: MtProfile; helps: MtHelp[]; w: Words; onClose: () => void; onDone: (f: MtFeed) => void }) {
  const id = useId();
  const { err, msg, busy, box, send, clear } = useForm(onDone, w);
  const [v, setV] = useState({ links: [] as MtLink[], helps: [...helps], note: "" });
  const set = (k: keyof typeof v, x: unknown) => { setV((q) => ({ ...q, [k]: x })); clear(k); };
  const submit = (e: FormEvent) => { e.preventDefault(); void send(checkOffer({ num: p.num, ...v }), { act: "offer", num: p.num, ...v }, onClose); };
  return (
    <Dialog title={fill(w.mtProfile, String(p.num))} onClose={onClose} foot={<Foot w={w} busy={busy} form={`${id}-f`} />}>
      <form id={`${id}-f`} className="club-mt-form" noValidate onSubmit={submit}><div ref={box}>
        <p className="club-mt-sum"><strong><bdi>{p.university}</bdi></strong><span><bdi>{p.field}</bdi></span></p>
        <Field k="links" label={w.mtLinksQ} err={err} w={w}><ChipGroup id={`${id}-links`} keys={MT_OFFER_LINKS} k={LINK_K} on={v.links} set={(x) => set("links", x)} w={w} label={w.mtLinksQ} /></Field>
        <Field k="helps" label={w.mtHelpsQ} err={err} w={w}><ChipGroup id={`${id}-helps`} keys={MT_HELPS} k={HELP_K} on={v.helps} set={(x) => set("helps", x)} w={w} label={w.mtHelpsQ} /></Field>
        <Field k="note" label={w.mtNoteQ} err={err} w={w} htmlFor={`${id}-note`}><textarea id={`${id}-note`} maxLength={500} rows={4} value={v.note} onChange={(e) => set("note", e.target.value)} /></Field>
        {msg && <p className="club-hub-err" role="alert">{msg}</p>}
      </div></form>
    </Dialog>
  );
}
