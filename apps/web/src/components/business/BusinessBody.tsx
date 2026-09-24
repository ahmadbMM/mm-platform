"use client";

import { useState } from "react";
import MessageForm from "@/components/site/MessageForm";

// The service tabs and the enquiry form share one piece of state: the form notes which service
// the visitor was reading (the tab's id, from its English name), so the staff page knows.
export type BizService = { id: string; tab: string; image: string; title: string; text: string; points: string[] };
type Props = {
  locale: string;
  services: BizService[];
  highlights: { value: string; label: string }[];
  clientsTitle: string; clients: { name: string; logo: string }[];
  partnersTitle: string; partners: { name: string; logo: string }[];
  form: { eyebrow: string; title: string; text: string; button: string; doneTitle: string; doneText: string };
};

function Logos({ items }: { items: { name: string; logo: string }[] }) {
  return (
    <div className="bz-logo-row">
      {items.map((l, i) => (l.logo ? <img key={i} src={l.logo} alt={l.name} loading="lazy" /> : <span key={i} className="mm-lat">{l.name}</span>))}
    </div>
  );
}

export default function BusinessBody(p: Props) {
  const [tab, setTab] = useState(0);
  const svc = p.services[tab] || p.services[0];
  return (
    <>
      {p.services.length > 1 && (
        <div className="bz-tabs" role="tablist">
          {p.services.map((s, i) => (
            <button key={s.id} type="button" role="tab" aria-selected={i === tab} aria-controls="bz-svc" onClick={() => setTab(i)}>{s.tab}</button>
          ))}
        </div>
      )}
      {svc && (
        <section className="bz-svc" id="bz-svc" role="tabpanel">
          <div className="bz-svc-img" style={svc.image ? { backgroundImage: `url('${svc.image}')` } : undefined} role="img" aria-label={svc.title} />
          <div>
            <h2>{svc.title}</h2>
            <p>{svc.text}</p>
            <ul className="bz-points">{svc.points.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        </section>
      )}
      <section className="bz-proof-wrap">
        {p.highlights.length > 0 && (
          <div className="bz-proof">{p.highlights.map((h, i) => <div key={i}><strong>{h.value}</strong><span>{h.label}</span></div>)}</div>
        )}
        {(p.clients.length > 0 || p.partners.length > 0) && (
          <div className="bz-logos">
            {p.clients.length > 0 && <><p>{p.clientsTitle}</p><Logos items={p.clients} /></>}
            {p.partners.length > 0 && <><p>{p.partnersTitle}</p><Logos items={p.partners} /></>}
          </div>
        )}
      </section>
      <section className="bz-form-wrap" id="enquiry">
        <div className="bz-form">
          <div>
            <p className="bz-eyebrow">{p.form.eyebrow}</p>
            <h2>{p.form.title}</h2>
            <p>{p.form.text}</p>
          </div>
          <MessageForm locale={p.locale} kind="business" topic={svc ? svc.id : ""} withCompany sendLabel={p.form.button} doneTitle={p.form.doneTitle} doneText={p.form.doneText} />
        </div>
      </section>
    </>
  );
}
