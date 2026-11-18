"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { StarIcon } from "@/components/site/Icons";
import { intAnswer, intChips, intDraft, intToggle, type IntAnswer, type IntKey, type Interests } from "@/lib/member-interests";
import type { MemberHubWords } from "./MemberHub.words";

// My interests in a member's area on /club (lib/member-interests.ts; the booking app's _intHtml, _intTog, _intSave,
// 2026-11-18). One card, placed as the app places it: until the member has saved once it sits right after the Build-up plan
// (the app: right after its first card), its chips ticked from their sport answer and nothing kept until Save; once saved,
// at the end of the area, their picks as chips and Change (Choose when they picked none). Change opens the chips again with
// Cancel and Save. A chip's tap flips it where it is. Save posts to /api/account/interests (member_interests_set); what the
// database kept is what shows, and a refusal is said under the buttons in words (too many changes in an hour, or that it
// could not be done), never as a bar. The women's sessions are a chip only for an account the database offers them to.
// InterestsBox holds the card's state for the whole area, so the first save moves the card to the end, as the app's tab
// does, and the focus to its Change. The words come ready in the page's language (MemberHub.words.ts).
type Words = Pick<MemberHubWords, "err" | "intTitle" | "intSave" | "intChange" | "intChoose" | "intLimit" | "intCancel"> & Record<`int_${IntKey}`, string>;
type State = {
  x: Interests; edit: IntKey[] | null; busy: boolean; err: string; w: Words; focus: "" | "change" | "chip";
  set: (f: (s: State) => Partial<State>) => void;
};
const Ctx = createContext<State | null>(null);

export function InterestsBox({ initial, words, children }: { initial: Interests | null; words: Words; children?: ReactNode }) {
  const [s, setS] = useState<Omit<State, "set" | "w">>(() => ({ x: initial ?? { saved: false, keys: [], suggested: [], offered: [] }, edit: null, busy: false, err: "", focus: "" }));
  if (!initial) return <>{children}</>;
  const set = (f: (st: State) => Partial<State>) => setS((old) => ({ ...old, ...f({ ...old, w: words, set }) }));
  return <Ctx.Provider value={{ ...s, w: words, set }}>{children}</Ctx.Provider>;
}

/** The card where it stands while the member has never saved ("first"), or once they have ("end"). */
export function InterestsCard({ at }: { at: "first" | "end" }) {
  const c = useContext(Ctx);
  const change = useRef<HTMLButtonElement>(null);
  const chips = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!c || !c.focus) return;
    const el = c.focus === "change" ? change.current : chips.current?.querySelector<HTMLButtonElement>("button");
    if (!el) return;
    el.focus({ preventScroll: true });
    c.set(() => ({ focus: "" }));
  });
  if (!c || c.x.saved !== (at === "end")) return null;
  const { x, w } = c;
  const draft = c.edit ?? (x.saved ? null : intDraft(x));
  const head = <h3 id="club-int-h"><StarIcon size={14} /> {w.intTitle}</h3>;

  async function save(keys: IntKey[]) {
    if (!c || c.busy) return;
    c.set(() => ({ busy: true, err: "" }));
    let a: IntAnswer = { ok: false, error: "generic" };
    try {
      const r = await fetch("/api/account/interests", {
        method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ keys }),
      });
      a = intAnswer(await r.json().catch(() => null));
    } catch { /* said below */ }
    if (!a.ok && a.error === "signin") { window.location.reload(); return; }
    const done = a;
    c.set((st) => (done.ok
      ? { busy: false, err: "", edit: null, x: { ...st.x, saved: true, keys: done.keys, suggested: [] }, focus: "change" }
      : { busy: false, err: done.error === "limit" ? st.w.intLimit : st.w.err }));
  }

  if (!draft) {
    return (
      <section className="club-int" aria-labelledby="club-int-h">
        {head}
        {x.keys.length > 0 && <ul className="club-int-mine">{x.keys.map((k) => <li key={k}>{w[`int_${k}`]}</li>)}</ul>}
        <button ref={change} type="button" className="club-int-btn" onClick={() => c.set((st) => ({ edit: st.x.keys.slice(), err: "", focus: "chip" }))}>
          {x.keys.length ? w.intChange : w.intChoose}
        </button>
      </section>
    );
  }
  return (
    <section className="club-int" aria-labelledby="club-int-h">
      {head}
      <div ref={chips} className="club-int-picks" role="group" aria-labelledby="club-int-h">
        {intChips(x, draft).map((k) => {
          const on = draft.includes(k);
          return (
            <button key={k} type="button" className={`club-int-chip${on ? " on" : ""}`} aria-pressed={on} data-k={k}
              onClick={() => c.set((st) => ({ edit: intToggle(st.edit ?? draft, k), err: "" }))}>
              {w[`int_${k}`]}
            </button>
          );
        })}
      </div>
      <div className="club-int-acts">
        {x.saved && <button type="button" className="club-int-btn" disabled={c.busy} onClick={() => c.set(() => ({ edit: null, err: "", focus: "change" }))}>{w.intCancel}</button>}
        <button type="button" className="club-int-btn club-int-save" disabled={c.busy} onClick={() => void save(draft)}>{w.intSave}</button>
      </div>
      {c.err && <p className="club-int-err" role="alert">{c.err}</p>}
    </section>
  );
}
