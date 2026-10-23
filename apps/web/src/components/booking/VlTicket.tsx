"use client";

import "./vl-ticket.css";
import { useEffect, useRef, useState } from "react";
import { ibanGroups, VL_BANK, vlTicketView, type VlTicketAnswer } from "@/lib/vl-ticket";

// Victory Lap: "Do you already have a ticket, or would you like to buy one?" on the ticket (the owner,
// 2026-10-23; the booking app's _vtTkHtml and renderVtGate, lib/vl-ticket.ts). The ticket's line asks it
// with both answers; once answered it says "You have a ticket for the race." (with Change), that the
// receipt is still to send (Upload receipt, Change), or that the receipt came and the ticket is paid.
// "I'd like to buy one", Upload receipt and Change open the booking app's pop-up, centred: the question,
// or the organiser's bank details (each copyable, the session's price), their bank letter (PDF) and the
// transfer receipt - a picture made small here (the long side 1600 px at most, a JPEG under ~2.5 MB) -
// with Send receipt, I'll send it later and Back. Answers go through /api/account/vl-ticket
// (customer_vl_ticket); a database without the question yet puts it aside (the line and the pop-up go).
// Its words come ready in the page's language from the ticket (tickets.text.ts).
export type VlTicketText = {
  title: string; q: string; have: string; buy: string; buyTitle: string; buySub: string;
  amount: string; benef: string; bank: string; iban: string; acct: string; copy: string; copied: string;
  letter: string; rcptLabel: string; rcptPick: string; rcptChange: string; rcptBad: string; send: string;
  later: string; back: string; haveNote: string; paidNote: string; needRcpt: string; upload: string;
  change: string; saving: string; close: string; failed: string;
};
type Props = {
  entryId: string;
  /** The answer so far, and whether the receipt came in. */
  answer: VlTicketAnswer | null; receipt: boolean;
  /** Marked paid (staff, or a receipt): with no answer the line asks nothing. */
  paid: boolean;
  /** The race's name and day, for the pop-up's head. */
  name: string; when: string;
  /** The amount to transfer, as the ticket writes amounts (the riyal sign and the number). */
  amount: string;
  /** The account's name and bank in the page's language (lib/vl-ticket.ts vlBankWords). */
  bankName: string; bankBank: string;
  t: VlTicketText;
};
type Step = "ask" | "buy";

const Ic = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const TICK = "m5 12.5 4.5 4.5L19 7.5";
const DOC = "M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4ZM14 3v4h4M12 11v6M9.5 14.5 12 17l2.5-2.5";
const PLUS = "M12 5v14M5 12h14";
const CAL = "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z";
const X = "M6 6l12 12M18 6 6 18";

/** A picture made small enough to send (_vtPick): the long side 1600 px at most, a JPEG under ~2.5 MB. */
function shrink(file: File): Promise<string> {
  return new Promise((ok, no) => {
    const rd = new FileReader();
    rd.onerror = () => no(new Error("read"));
    rd.onload = () => {
      const im = new Image();
      im.onerror = () => no(new Error("image"));
      im.onload = () => {
        const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight, 1));
        const w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        const cx = cv.getContext("2d");
        if (!cx) return no(new Error("canvas"));
        cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
        let q = 0.82, u = cv.toDataURL("image/jpeg", q);
        while (u.length > 2_500_000 && q > 0.4) { q -= 0.12; u = cv.toDataURL("image/jpeg", q); }
        ok(u);
      };
      im.src = String(rd.result);
    };
    rd.readAsDataURL(file);
  });
}

export default function VlTicket({ entryId, answer: initial, receipt: hadReceipt, paid, name, when, amount, bankName, bankBank, t }: Props) {
  const [answer, setAnswer] = useState<VlTicketAnswer | null>(initial);
  const [receipt, setReceipt] = useState(hadReceipt);
  const [off, setOff] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [img, setImg] = useState("");
  const [copied, setCopied] = useState("");
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const id = `vt-${entryId}`;

  // the pop-up opens as a modal (centred, the page behind it inert) and focuses its title
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (step && !d.open) { d.showModal(); d.querySelector<HTMLElement>(".vt-title")?.focus({ preventScroll: true }); }
    if (!step && d.open) d.close();
  }, [step]);

  if (off) return null;
  const view = vlTicketView({ status: "waiting", paid: paid || receipt, vlTicket: answer, vlReceiptAt: receipt ? "1" : null }, false);
  if (view === "none") return null;

  const open = (s: Step, el: HTMLElement) => { opener.current = el; setErr(""); setImg(""); setStep(s); };
  const shut = () => {
    if (busy) return;
    setStep(null); setErr(""); setImg("");
    opener.current?.focus({ preventScroll: true });
  };

  async function save(v: VlTicketAnswer, picture?: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/account/vl-ticket", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId, answer: v, img: picture ?? null }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) {
        setAnswer(v);
        if (picture) setReceipt(true);
        return true;
      }
      // a database without the question yet: it steps aside
      if (b?.error === "absent") { setStep(null); setOff(true); return false; }
      // signed out, or the booking is no longer one the question is for: the page drawn again says so
      if (b?.error === "signin" || b?.error === "refused") { window.location.reload(); return false; }
    } catch { /* offline: say so below */ } finally { setBusy(false); }
    setErr(t.failed);
    return false;
  }

  const have = async () => { if (await save("have")) { setStep(null); opener.current?.focus({ preventScroll: true }); } };
  const later = async () => { if (answer === "buy" || (await save("buy"))) { setStep(null); opener.current?.focus({ preventScroll: true }); } };
  const send = async () => { if (img && (await save("buy", img))) { setStep(null); setImg(""); opener.current?.focus({ preventScroll: true }); } };

  async function pick(el: HTMLInputElement) {
    const f = el.files?.[0];
    el.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type || "")) { setErr(t.rcptBad); return; }
    try { setImg(await shrink(f)); setErr(""); } catch { setErr(t.rcptBad); }
  }

  async function copy(key: string, v: string) {
    try { await navigator.clipboard.writeText(v); setCopied(key); setTimeout(() => setCopied((c) => (c === key ? "" : c)), 1800); } catch { /* the value stays selectable */ }
  }
  const row = (key: string, label: string, value: string, opts: { cp?: string; ltr?: boolean; amt?: boolean } = {}) => (
    <div className="vt-row" key={key}>
      <span className="vt-k">{label}</span>
      <bdi className={`vt-v${opts.amt ? " tk-amt" : ""}`} dir={opts.ltr ? "ltr" : undefined}>{value}</bdi>
      {opts.cp && (
        <button type="button" className="vt-cp" aria-label={`${t.copy} ${label}`} onClick={() => copy(key, opts.cp!)}>
          {copied === key ? <><Ic d={TICK} size={14} />{t.copied}</> : t.copy}
        </button>
      )}
    </div>
  );

  const line =
    view === "paid" ? (
      <div className="vt-tk vt-tk-done" role="status"><Ic d={TICK} /><span>{t.paidNote}</span></div>
    ) : view === "have" ? (
      <div className="vt-tk vt-tk-done" role="status">
        <Ic d={TICK} /><span>{t.haveNote}</span>
        <button type="button" className="vt-b" onClick={(e) => open("ask", e.currentTarget)}>{t.change}</button>
      </div>
    ) : view === "buy" ? (
      <div className="vt-tk">
        <p className="vt-tk-q">{t.needRcpt}</p>
        <div className="vt-tk-btns">
          <button type="button" className="vt-b solid" onClick={(e) => open("buy", e.currentTarget)}>{t.upload}</button>
          <button type="button" className="vt-b" onClick={(e) => open("ask", e.currentTarget)}>{t.change}</button>
        </div>
      </div>
    ) : (
      <div className="vt-tk" role="group" aria-labelledby={`${id}-q`}>
        <p className="vt-tk-q" id={`${id}-q`}>{t.q}</p>
        <div className="vt-tk-btns">
          <button type="button" className="vt-b" disabled={busy} onClick={(e) => { opener.current = e.currentTarget; void save("have"); }}>{t.have}</button>
          <button type="button" className="vt-b solid" disabled={busy} onClick={(e) => open("buy", e.currentTarget)}>{t.buy}</button>
        </div>
        {err && !step && <p className="vt-err" role="alert">{err}</p>}
      </div>
    );

  return (
    <>
      {line}
      <dialog ref={dlg} className="vt-dlg" aria-labelledby={`${id}-title`} aria-describedby={`${id}-sub`}
        onCancel={(e) => { e.preventDefault(); shut(); }}>
        {step && (
          <div className="vt-in">
            <button type="button" className="vt-x" aria-label={t.close} disabled={busy} onClick={shut}><Ic d={X} size={18} /></button>
            {step === "ask" ? (
              <>
                <h2 id={`${id}-title`} className="vt-title" tabIndex={-1}>{t.title}</h2>
                <div className="vt-sess">
                  <p className="vt-ev"><bdi>{name}</bdi></p>
                  <p className="vt-ln"><Ic d={CAL} size={15} /><span>{when}</span></p>
                </div>
                <p id={`${id}-sub`} className="vt-sub vt-q">{t.q}</p>
                <div className="vt-yn">
                  <button type="button" aria-pressed={answer === "have"} disabled={busy} onClick={have}>{t.have}</button>
                  <button type="button" aria-pressed={answer === "buy"} disabled={busy} onClick={() => { setErr(""); setStep("buy"); }}>{t.buy}</button>
                </div>
                {err && <p className="vt-err" role="alert">{err}</p>}
              </>
            ) : (
              <>
                <h2 id={`${id}-title`} className="vt-title" tabIndex={-1}>{t.buyTitle}</h2>
                <p id={`${id}-sub`} className="vt-sub">{t.buySub}</p>
                <div className="vt-bank">
                  {row("amount", t.amount, amount, { ltr: true, amt: true })}
                  {row("name", t.benef, bankName, { cp: bankName })}
                  {row("bank", t.bank, bankBank)}
                  {row("iban", t.iban, ibanGroups(VL_BANK.iban), { cp: VL_BANK.iban, ltr: true })}
                  {row("acct", t.acct, VL_BANK.acct, { cp: VL_BANK.acct, ltr: true })}
                </div>
                <a className="vt-pdf" href={VL_BANK.pdf} download="Sports Fitness Unit bank details.pdf" target="_blank" rel="noopener"><Ic d={DOC} /><span>{t.letter}</span></a>
                <div className="vt-rc">
                  <p className="vt-rc-l">{t.rcptLabel}</p>
                  {receipt && !img && <p className="vt-done" role="status"><Ic d={TICK} /><span>{t.paidNote}</span></p>}
                  {img && <img className="vt-prev" src={img} alt={t.rcptLabel} />}
                  <label className="vt-pick">
                    <input type="file" accept="image/*" className="vt-file" disabled={busy} onChange={(e) => pick(e.currentTarget)} />
                    <Ic d={PLUS} /><span>{img || receipt ? t.rcptChange : t.rcptPick}</span>
                  </label>
                </div>
                {err && <p className="vt-err" role="alert">{err}</p>}
                <button type="button" className="vt-send" disabled={busy || !img} onClick={send}>{busy ? t.saving : t.send}</button>
                <div className="vt-foot">
                  <button type="button" className="vt-link" disabled={busy} onClick={() => { setErr(""); setStep("ask"); }}>{t.back}</button>
                  {!receipt && <button type="button" className="vt-link" disabled={busy} onClick={later}>{t.later}</button>}
                </div>
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
