"use client";

// My Account's other small pages with something to press (the user, 2026-11-19, as the booking app's): Emergency contacts
// (the check-up's own boxes, EmergencyFields, with a Save), Password (current and new, the app's _accPwdOpen), Delete my
// account (a request, asked again in a centred pop-up, withdrawable: the app's _delSet), the ambassador card's code
// (copy and share), the company challenge (its cards and the code box: company-challenge.js), and Log out.
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DIAL_CODES } from "@/content/dial-codes";
import { EM_EMPTY, EM_RELS, emReadBoth, type EmFields, type EmRel } from "@/lib/emergency";
import { passwordProblem } from "@/lib/learn";
import { intlOf } from "@/i18n/locales";
import type { AccWords } from "./AccountMenu.words";
import EmergencyFields, { emMessage, type EmLook, type EmProblem } from "./EmergencyFields";
import { emergencyWords } from "./Emergency.words";
import { useTxLocale } from "@/i18n/TxProvider";
import PasswordBox from "./PasswordBox";
import { signOut } from "./quiet";
import AccIcon from "./AccIcon";
import { SaveRow, postAcc, useDirty, useSave } from "./AccForm";

const reload = () => { window.location.reload(); return null; };

// ── Emergency contacts ──────────────────────────────────────────────────────────────────────────────────────────────
/** A stored number as the picker's dial code and the rest (the longest code it starts with). */
export function emSplit(phone: string): { cc: string; phone: string } {
  const p = (phone || "").replace(/[^\d+]/g, "");
  if (!p.startsWith("+")) return { cc: "+966", phone: p };
  const code = [...new Set(DIAL_CODES.map((d) => d[0]))].filter((c) => p.startsWith(c)).sort((a, b) => b.length - a.length)[0];
  return code ? { cc: code, phone: p.slice(code.length) } : { cc: "+966", phone: p.replace(/^\+/, "") };
}
export type EmRow = { name: string; phone: string; rel: string };
const asFields = (r: EmRow | null): EmFields => (r && (r.name || r.phone)
  ? { name: r.name, ...emSplit(r.phone), rel: (EM_RELS as readonly string[]).includes(r.rel) ? (r.rel as EmRel) : "" }
  : EM_EMPTY);
const LOOK: EmLook = { block: "acm-em", head: "acm-k", sub: "acm-hide", field: "acm-f", input: "acm-in", select: "acm-in", ph: "ph", err: "acm-f-err", add: "acm-btn acm-btn-line acm-add", opt: "acm-opt" };

export function AccEmergency({ w, initial, offerTwo, own }: { w: AccWords; initial: { one: EmRow | null; two: EmRow | null }; offerTwo: boolean; own: string }) {
  const ew = emergencyWords(useTxLocale());
  const base = useMemo(() => ({ one: asFields(initial.one), two: asFields(initial.two) }), [initial]);
  const [f, setF] = useState(base);
  const [saved, setSaved] = useState(base);
  const [problem, setProblem] = useState<EmProblem>(null);
  const s = useSave();
  const same = (a: EmFields, b: EmFields) => a.name === b.name && a.cc === b.cc && a.phone === b.phone && a.rel === b.rel;
  useDirty(!same(f.one, saved.one) || !same(f.two, saved.two));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (s.state === "busy") return;
    const c = emReadBoth(f.one, f.two, own);
    if ("error" in c) { setProblem(c); requestAnimationFrame(() => (document.querySelector(`[data-em="${c.which}-${c.error === "em_relation" ? "rel" : c.error === "em_phone" || c.error === "em_self" || c.error === "em_same" ? "phone" : "name"}"]`) as HTMLElement | null)?.focus()); return; }
    setProblem(null);
    const ok = await s.run(async () => {
      const b = await postAcc<{ problem?: EmProblem }>("/api/account/emergency", { one: f.one, two: f.two });
      if (b.ok) return null;
      if (b.error === "signin") return reload();
      if (b.error === "refused" && b.problem) { setProblem(b.problem); return emMessage(ew, b.problem.error); }
      return b.error === "busy" ? w.errBusy : w.errConn;
    });
    if (ok) setSaved(f);
  }
  return (
    <form className="acm-card" onSubmit={submit} noValidate>
      <EmergencyFields one={f.one} two={f.two} offerTwo={offerTwo} problem={problem} look={LOOK} head={false}
        onChange={(one, two) => { setF({ one, two }); setProblem(null); s.edited(); }} />
      <SaveRow state={s.state} err={s.err} w={w} />
    </form>
  );
}

// ── Password ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function AccPassword({ w }: { w: AccWords }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [done, setDone] = useState(false);
  const s = useSave();
  useDirty(!!(cur || next));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (s.state === "busy") return;
    setDone(false);
    const pp = passwordProblem(next);
    if (pp) { s.setErr(pp === "short" ? w.pwShort : w.pwCommon); return; }
    const ok = await s.run(async () => {
      const b = await postAcc("/api/account/password", { mode: "change", current: cur, next });
      if (b.ok) return null;
      if (b.error === "signin") return reload();
      return b.error === "bad" ? (cur ? w.pwBad : w.pwCurReq) : b.error === "same" ? w.pwSame : b.error === "locked" ? w.pwLocked
        : b.error === "weak" ? w.pwShort : b.error === "common" ? w.pwCommon : w.errConn;
    });
    if (ok) { setCur(""); setNext(""); setDone(true); }
  }
  return (
    <form className="acm-card" onSubmit={submit} noValidate>
      <div className="acm-f">
        <label htmlFor="acm-pw-cur">{w.pwCurrent}</label>
        <PasswordBox id="acm-pw-cur" className="acm-in" value={cur} maxLength={200} dir="ltr" onChange={(e) => { setCur(e.target.value); setDone(false); s.edited(); }} autoComplete="current-password" />
      </div>
      <div className="acm-f">
        <label htmlFor="acm-pw-new">{w.pwNew}</label>
        <PasswordBox id="acm-pw-new" className="acm-in" value={next} maxLength={200} dir="ltr" onChange={(e) => { setNext(e.target.value); setDone(false); s.edited(); }} autoComplete="new-password" />
      </div>
      {done && <p className="acm-ok" role="status">{w.pwSaved}</p>}
      <SaveRow state={s.state} err={s.err} w={w} label={w.pwSave} />
    </form>
  );
}

// ── Delete my account ───────────────────────────────────────────────────────────────────────────────────────────────
export function AccDelete({ w, locale, requestedAt }: { w: AccWords; locale: string; requestedAt: string | null }) {
  const router = useRouter();
  const [at, setAt] = useState(requestedAt);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dlg = useRef<HTMLDialogElement>(null);
  const day = (iso: string) => {
    try { return new Intl.DateTimeFormat(intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(iso)); }
    catch { return iso.slice(0, 10); }
  };
  async function send(request: boolean) {
    setBusy(true); setErr("");
    const b = await postAcc<{ requestedAt?: string | null }>("/api/account/deletion", { request });
    setBusy(false);
    dlg.current?.close();
    if (b.ok) { setAt(b.requestedAt ?? null); router.refresh(); } else if (b.error === "signin") reload(); else setErr(w.errConn);
  }
  return (
    <div className="acm-card">
      {at ? (
        <>
          <p className="acm-state" role="status">{w.delRequested.replace("{0}", day(at))}</p>
          <button type="button" className="acm-btn acm-btn-line" onClick={() => send(false)} aria-disabled={busy || undefined}>{w.delWithdraw}</button>
        </>
      ) : (
        <>
          <p className="acm-text">{w.delSub}</p>
          <button type="button" className="acm-btn acm-btn-line acm-btn-red-line" onClick={() => dlg.current?.showModal()} aria-disabled={busy || undefined}>{w.delBtn}</button>
        </>
      )}
      {err && <p className="acm-err" role="alert">{err}</p>}
      <dialog ref={dlg} className="acm-dlg" aria-labelledby="acm-del-dh" onClick={(e) => { if (e.target === e.currentTarget) dlg.current?.close(); }}>
        <h2 id="acm-del-dh">{w.delConfirmTitle}</h2>
        <p className="acm-text">{w.delConfirmBody}</p>
        <div className="acm-dlg-btns">
          <button type="button" className="acm-btn acm-btn-red" onClick={() => send(true)} aria-disabled={busy || undefined}>{w.delConfirmBtn}</button>
          <button type="button" className="acm-btn acm-btn-line" onClick={() => dlg.current?.close()}>{w.cancel}</button>
        </div>
      </dialog>
    </div>
  );
}

// ── The ambassador card ─────────────────────────────────────────────────────────────────────────────────────────────
export type AmbMine = { code: string; status: string; earned: number; balance: number; uses: number };
export function AccAmbassador({ w, a, locale }: { w: AccWords; a: AmbMine; locale: string }) {
  const [copied, setCopied] = useState(false);
  const N = (n: number) => { try { return new Intl.NumberFormat(intlOf(locale), { numberingSystem: "latn" }).format(n); } catch { return String(n); } };
  async function copy() {
    try { await navigator.clipboard.writeText(a.code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the code is on screen */ }
  }
  async function share() {
    try { if (navigator.share) { await navigator.share({ text: a.code }); return; } } catch { return; }
    await copy();
  }
  return (
    <div className="acm-card">
      {a.status === "paused" && <p className="acm-chip acm-chip-warn">{w.ambPaused}</p>}
      <span className="acm-k">{w.ambCode}</span>
      <p className="acm-code"><bdi dir="ltr">{a.code}</bdi></p>
      <div className="acm-btns">
        <button type="button" className="acm-btn" onClick={share} aria-live="polite">{copied ? w.ambCopied : w.ambShare}</button>
      </div>
      <dl className="acm-nums">
        <div><dt>{w.ambPoints}</dt><dd>{N(a.earned)}</dd></div>
        <div><dt>{w.ambBalance}</dt><dd>{N(a.balance)}</dd></div>
        <div><dt>{w.ambUses}</dt><dd>{N(a.uses)}</dd></div>
      </dl>
    </div>
  );
}

// ── The company challenge ───────────────────────────────────────────────────────────────────────────────────────────
export type CompanyRow = { id: number; company: string; starts: string; ends: string; state: "soon" | "on" | "ended"; team: number | null; sessions: number | null; mine: number; badge: boolean };
export function AccCompany({ w, rows, open, when }: { w: AccWords; rows: CompanyRow[]; open: boolean; when: Record<number, string> }) {
  const [code, setCode] = useState("");
  const s = useSave();
  useDirty(!!code);
  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (s.state === "busy" || !code.trim()) return;
    const ok = await s.run(async () => {
      const b = await postAcc("/api/account/company", { code });
      if (b.ok) return null;
      if (b.error === "signin") return reload();
      return b.error === "code" ? w.coErrCode : b.error === "ended" ? w.coErrEnded : b.error === "busy" ? w.coErrBusy : w.coErr;
    });
    if (ok) setCode("");
  }
  return (
    <>
      {rows.map((r) => (
        <section key={r.id} className="acm-card acm-co" aria-labelledby={`acm-co-${r.id}`}>
          <div className="acm-co-head">
            <h3 id={`acm-co-${r.id}`}><bdi>{r.company}</bdi></h3>
            {r.state !== "on" && <span className="acm-chip">{r.state === "soon" ? w.coSoon : w.coEnded}</span>}
          </div>
          <p className="acm-co-dates"><bdi>{when[r.id]}</bdi></p>
          <dl className="acm-nums">
            {r.team != null && <div><dt>{w.coTeam}</dt><dd>{r.team}</dd></div>}
            {r.sessions != null && <div><dt>{w.coTogether}</dt><dd>{r.sessions}</dd></div>}
            <div><dt>{w.coMine}</dt><dd>{r.mine}</dd></div>
          </dl>
          {r.badge && <p className="acm-co-badge"><AccIcon name="star" size={18} /> {w.coBadge}</p>}
        </section>
      ))}
      {open && (
        <form className="acm-card" onSubmit={join} noValidate>
          <div className="acm-f">
            <label htmlFor="acm-co-code">{w.coCode}</label>
            <input id="acm-co-code" className="acm-in acm-in-code" value={code} maxLength={12} autoCapitalize="characters" autoComplete="off" spellCheck={false} dir="ltr"
              onChange={(e) => { setCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()); s.edited(); }} />
          </div>
          <SaveRow state={s.state} err={s.err} w={w} label={w.coJoin} />
        </form>
      )}
    </>
  );
}

// ── Log out ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export function AccLogOut({ label }: { label: string }) {
  return (
    <button type="button" className="acm-row acm-row-red" onClick={signOut}>
      <span className="acm-row-ic"><AccIcon name="out" /></span>
      <span className="acm-row-t">{label}</span>
    </button>
  );
}
