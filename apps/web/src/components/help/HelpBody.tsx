"use client";

import { useEffect, useId, useState } from "react";
import MessageForm from "@/components/site/MessageForm";

// The answer tabs (only those with questions), the accordion, and the message form, which notes
// the tab the visitor was reading. #delivery, #returns, #warranty open that tab (footer links).
export type HelpTab = { id: string; label: string; items: { q: string; a: string }[] };
type Props = {
  locale: string;
  tabs: HelpTab[];
  form: { title: string; text: string; button: string; doneTitle: string; doneText: string };
};

export default function HelpBody(p: Props) {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(0);
  const uid = useId();
  // After the first paint (the server cannot see the hash), and whenever the hash changes.
  useEffect(() => {
    const fromHash = () => {
      const i = p.tabs.findIndex((x) => x.id === window.location.hash.slice(1));
      if (i >= 0) { setTab(i); setOpen(0); }
    };
    const t = setTimeout(fromHash, 0);
    window.addEventListener("hashchange", fromHash);
    return () => { clearTimeout(t); window.removeEventListener("hashchange", fromHash); };
  }, [p.tabs]);
  const cur = p.tabs[tab] || p.tabs[0];
  // The tabs as a tab list is worked: one stop for Tab, the arrow keys (mirrored right to left),
  // Home and End move between them.
  function onTabKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const n = p.tabs.length, rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const step = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : step ? (tab + step + n) % n : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(to); setOpen(0);
    e.currentTarget.querySelectorAll<HTMLElement>("[role=tab]")[to]?.focus();
  }
  return (
    <>
      {p.tabs.length > 1 && (
        <div className="hp-tabs" role="tablist" onKeyDown={onTabKey}>
          {p.tabs.map((x, i) => (
            <button key={x.id} id={`${uid}t${i}`} type="button" role="tab" aria-selected={i === tab} aria-controls={`${uid}p`} tabIndex={i === tab ? 0 : -1}
              onClick={() => { setTab(i); setOpen(0); }}>{x.label}</button>
          ))}
        </div>
      )}
      {cur && (
        <div className="hp-list" role="tabpanel" id={`${uid}p`} aria-labelledby={p.tabs.length > 1 ? `${uid}t${p.tabs.indexOf(cur)}` : undefined}>
          {cur.items.map((it, i) => (
            <div key={i} className={`hp-q${open === i ? " open" : ""}`}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                <strong>{it.q}</strong><span className="hp-chip" aria-hidden="true">{open === i ? "−" : "+"}</span>
              </button>
              {open === i && <p>{it.a}</p>}
            </div>
          ))}
        </div>
      )}
      <div className="hp-ask" id="message">
        <h2>{p.form.title}</h2>
        <p>{p.form.text}</p>
        <MessageForm locale={p.locale} kind="help" topic={cur ? cur.id : "other"} sendLabel={p.form.button} doneTitle={p.form.doneTitle} doneText={p.form.doneText} />
      </div>
    </>
  );
}
