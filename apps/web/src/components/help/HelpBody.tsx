"use client";

import { useEffect, useState } from "react";
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
  return (
    <>
      {p.tabs.length > 1 && (
        <div className="hp-tabs" role="tablist">
          {p.tabs.map((x, i) => (
            <button key={x.id} type="button" role="tab" aria-selected={i === tab} onClick={() => { setTab(i); setOpen(0); }}>{x.label}</button>
          ))}
        </div>
      )}
      {cur && (
        <div className="hp-list" role="tabpanel">
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
