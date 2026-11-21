"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { onBackdrop } from "@/lib/backdrop";
import { pickCheer, type Cheer, type CheerStore } from "@/lib/badge-cheer";
import { TickIcon } from "@/components/site/Icons";
import Medal from "./Medal";
import { ratingFinWords } from "./RatingFin.words";
import { BDG_ASKED } from "./quiet";

// My Account's new-badge pop-up (the booking app's _bdgCelebrate, _bdgProfCheer and, for a Community badge, _plsCheer;
// lib/badge-cheer.ts has the rules): once the account page is on screen, /api/account/badge-new says which earned badges
// may be new, and the one due opens centred, once on this device - "New badge!", the medal, its name, what it means, how
// it is earned, and for one staff gave their note and the day; Close. A Community badge has Community and Done and is
// marked seen on the server. Asked once in five minutes in this tab, and again as soon as a Save fills the profile:
// `short` is the profile short of full as the page was drawn; drawn again full after a Save, Race Ready may pop up.
// It waits while another pop-up (the rating, a waiver...) holds the page.
type Answer = { ok?: boolean; who?: string; rode?: number | null; pulse?: boolean; community?: Cheer | null; seen?: string[]; items?: Cheer[]; close?: string };
const ASK_GAP = 5 * 60_000;
const SHORT = "mm_bdg_prof_short";

const store: CheerStore = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch { return false; } },
};
const ss = {
  get(k: string) { try { return window.sessionStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { window.sessionStorage.setItem(k, v); } catch { /* storage off */ } },
  del(k: string) { try { window.sessionStorage.removeItem(k); } catch { /* storage off */ } },
};
// One ask at a time: a page drawn twice at once (or an effect run twice in development) shares it.
let asking: Promise<Answer | null> | null = null;
function ask(locale: string): Promise<Answer | null> {
  asking ??= fetch(`/api/account/badge-new?locale=${encodeURIComponent(locale)}`, { cache: "no-store", credentials: "same-origin" })
    .then((r) => (r.ok ? (r.json() as Promise<Answer>) : null)).catch(() => null)
    .finally(() => { setTimeout(() => { asking = null; }, 0); });
  return asking;
}
/** Another pop-up holds the page (the rating and the other gates make the page inert; a dialog is open). */
const held = () => document.documentElement.classList.contains("rg-lock") || !!document.querySelector(".rg-gate, dialog[open]");

export default function BadgeCelebrate({ locale, short }: { locale: string; short: boolean }) {
  const path = usePathname();
  const dlg = useRef<HTMLDialogElement>(null);
  const [show, setShow] = useState<{ c: Cheer; close: string; comm: boolean } | null>(null);
  const fw = ratingFinWords(locale);

  useEffect(() => {
    // the profile short of full in this tab: a later drawing of it full is this rider's own save (Race Ready)
    const filled = !short && ss.get(SHORT) === "1";
    if (short) ss.set(SHORT, "1");
    if (!filled && Number(ss.get(BDG_ASKED) || 0) > Date.now()) return;
    let live = true, wait: ReturnType<typeof setTimeout> | undefined;
    void ask(locale).then((a) => {
      if (!live) return;
      if (!a?.ok || !a.who) return; // no answer: the next page asks again
      ss.set(BDG_ASKED, String(Date.now() + ASK_GAP));
      if (filled) ss.del(SHORT);
      const close = a.close || "Close";
      const open = () => {
        if (!live) return;
        if (held()) { wait = setTimeout(open, 1500); return; }
        if (a.community) {
          setShow({ c: a.community, close, comm: true });
          void fetch("/api/account/badge-new", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ seen: a.seen ?? [] }) }).catch(() => null);
          return;
        }
        const c = pickCheer(a.items ?? [], { who: a.who!, store, rode: a.rode ?? null, filled, pulse: !!a.pulse });
        if (c) setShow({ c, close, comm: false });
      };
      open();
    });
    return () => { live = false; clearTimeout(wait); };
  }, [short, path, locale]);

  useEffect(() => { if (show && dlg.current && !dlg.current.open) dlg.current.showModal(); }, [show]);
  if (!show) return null;
  const { c } = show;
  const sp = ["special", "national", "pink", "vlap", "defe", "volunteer", "farm"].includes(c.color);
  const done = () => dlg.current?.close();
  return (
    <dialog ref={dlg} className={`badge-pop-box bdg-new${sp ? ` special sp-${c.color}` : ""}`} aria-labelledby="bdg-new-nm"
      onClose={() => setShow(null)} onClick={(e) => { if (onBackdrop(e)) done(); }}>
      <div className="badge-pop-in">
        <p className="badge-pop-new">{fw.badge}</p>
        <Medal icon={c.icon} color={c.color} className="badge-pop-ic" />
        <p className="badge-pop-nm" id="bdg-new-nm">{c.name}</p>
        {c.about && <p className="badge-pop-about">{c.about}</p>}
        {c.how && <p className="badge-pop-d">{c.how}</p>}
        {c.given?.note && <p className="badge-pop-note"><bdi>{c.given.note}</bdi></p>}
        {c.given && <p className="badge-pop-earned"><TickIcon size={15} /> {c.given.line}</p>}
        {show.comm ? (
          <div className="bdg-new-acts">
            <Link href="/club#challenges" className="badge-pop-ask bdg-new-go" onClick={done}>{fw.community}</Link>
            <button type="button" className="badge-pop-close" onClick={done}>{fw.done}</button>
          </div>
        ) : (
          <button type="button" className="badge-pop-close" onClick={done} autoFocus>{show.close}</button>
        )}
      </div>
    </dialog>
  );
}
