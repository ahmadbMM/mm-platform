"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MK_PHOTOS_MAX, mkPhotoSrc, type MkCategory } from "@/lib/market/core";
import { w2Move, w2Slots, type W2Shot } from "@/lib/market/w2";
import MkIcon from "../MkIcon";
import type { W2Words } from "../w2.text";
import type { W2Refused } from "./api";
import W2Icon, { W2Grip } from "./W2Icon";
import { w2Shrink, w2Upload, type W2Copies } from "./photo-client";

// The photos of a listing, as its seller adds and orders them. Photos come from the camera or the library; each is
// drawn again in the browser into the two copies the Marketplace stores (photo-client.ts) and sent one at a time, its
// tile showing the picture from the phone at once. The first photo is the cover. A photo moves by dragging its grip
// (mouse, pen or finger; the grip alone holds the touch, so the page still scrolls under a thumb) or with the two
// buttons under it, and the arrow keys on the grip do the same. The shots a whole bike is still missing are drawn
// under its photos as labelled outlines, in the order a buyer wants to see them (the photos fill them by place: the
// first photo is the drive side); they are places to fill, not a rule about which photo goes where.
// A photo that could not be sent stays as a tile with "Try again": the picture is kept, so nothing is chosen twice.
//   photos     the listing's photo names, in order (the parent's state)
//   ensureId   the listing's number, making the draft first when there is none yet; a refusal when it could not be made
//   onChange   the new order or list
//   onRefused  something stood in the way (the parent says it in words): a route's refusal, "unreadable", "full"
//   onPending  how many photos are on their way, so the parent can wait for them
type Pending = { key: string; url: string; state: "work" | "fail"; file: Blob; copies: W2Copies | null };
export type PhotoGridProps = {
  photos: string[];
  cat: MkCategory | null;
  m: W2Words;
  retry: string;
  invalid: boolean;
  ensureId: () => Promise<number | W2Refused>;
  onChange: (photos: string[], why: "add" | "move" | "remove") => void;
  onRefused: (r: W2Refused) => void;
  onPending: (n: number) => void;
};

let seq = 0;

export default function PhotoGrid({ photos, cat, m, retry, invalid, ensureId, onChange, onRefused, onPending }: PhotoGridProps) {
  const [pend, setPend] = useState<Pending[]>([]);
  // the phone's own copy of a photo sent in this visit, shown in place of the stored one (no second download)
  const [local, setLocal] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState<number | null>(null);
  const cam = useRef<HTMLInputElement>(null);
  const lib = useRef<HTMLInputElement>(null);
  const list = useRef(photos);
  const urls = useRef<string[]>([]);
  const dragAt = useRef<number | null>(null);
  useEffect(() => { list.current = photos; }, [photos]);
  useEffect(() => { onPending(pend.filter((p) => p.state === "work").length); }, [pend, onPending]);
  useEffect(() => () => { for (const u of urls.current) URL.revokeObjectURL(u); }, []);

  const send = useCallback(async (it: Pending) => {
    const copies = it.copies ?? (await w2Shrink(it.file));
    if (!copies) {
      setPend((p) => p.filter((x) => x.key !== it.key));
      onRefused({ ok: false, error: "unreadable", detail: "" });
      return;
    }
    const failed = (r: W2Refused) => {
      setPend((p) => p.map((x) => (x.key === it.key ? { ...x, state: "fail" as const, copies } : x)));
      onRefused(r);
    };
    const id = await ensureId();
    if (typeof id !== "number") return failed(id);
    const r = await w2Upload("listing", id, copies);
    if (!r.ok) return failed(r);
    setLocal((l) => ({ ...l, [r.name]: it.url }));
    setPend((p) => p.filter((x) => x.key !== it.key));
    const next = [...list.current, r.name];
    list.current = next;
    onChange(next, "add");
  }, [ensureId, onChange, onRefused]);

  async function add(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = "";
    const room = MK_PHOTOS_MAX - list.current.length - pend.length;
    if (files.length > room) onRefused({ ok: false, error: "full", detail: "" });
    const items: Pending[] = files.slice(0, Math.max(0, room)).map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return { key: `p${++seq}`, url, state: "work", file, copies: null };
    });
    if (!items.length) return;
    setPend((p) => [...p, ...items]);
    for (const it of items) await send(it); // one at a time: a phone on mobile data sends them in order
  }
  const again = (it: Pending) => {
    setPend((p) => p.map((x) => (x.key === it.key ? { ...x, state: "work" as const } : x)));
    void send({ ...it, state: "work" });
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.current.length || from === to) return;
    const next = w2Move(list.current, from, to);
    list.current = next;
    onChange(next, "move");
  };
  const remove = (i: number) => {
    const next = list.current.filter((_, k) => k !== i);
    list.current = next;
    onChange(next, "remove");
  };

  // Dragging: the grip is pressed, and the photo takes the place of whichever photo the pointer is over.
  function dragStart(e: React.PointerEvent, index: number) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    dragAt.current = index;
    setDrag(index);
    const onMove = (ev: PointerEvent) => {
      const at = dragAt.current;
      if (at === null) return;
      const tile = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-mk-tile]");
      const to = tile ? Number(tile.dataset.mkTile) : NaN;
      if (!Number.isInteger(to) || to === at || to < 0 || to >= list.current.length) return;
      move(at, to);
      dragAt.current = to;
      setDrag(to);
    };
    const onEnd = () => {
      dragAt.current = null;
      setDrag(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  }
  function gripKey(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const by = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : e.key === "ArrowRight" ? (rtl ? -1 : 1) : 0;
    if (!by) return;
    e.preventDefault();
    const to = index + by;
    if (to < 0 || to >= list.current.length) return;
    move(index, to);
    const grid = e.currentTarget.closest(".mk-w2-grid");
    requestAnimationFrame(() => grid?.querySelector<HTMLButtonElement>(`[data-mk-tile="${to}"] .mk-w2-grip`)?.focus());
  }

  const taken = photos.length + pend.length;
  const slots = w2Slots(taken, cat);
  const plain = slots.includes("plain");
  const full = taken >= MK_PHOTOS_MAX;
  return (
    <div className={`mk-w2-photos${invalid ? " mk-w2-bad" : ""}`} data-f="photos">
      <ul className="mk-w2-grid">
        {photos.map((name, i) => (
          <li key={name} className={`mk-w2-tile${drag === i ? " mk-w2-lift" : ""}`} data-mk-tile={i}>
            <span className="mk-w2-pic">
              <img src={local[name] ?? mkPhotoSrc(name, true) ?? ""} alt={m.photoN(i + 1)} draggable={false} />
              {i === 0 && <span className="mk-w2-cover">{m.cover}</span>}
              <button type="button" className="mk-w2-grip" aria-label={`${m.drag}: ${m.photoN(i + 1)}`} onPointerDown={(e) => dragStart(e, i)} onKeyDown={(e) => gripKey(e, i)}>
                <W2Grip />
              </button>
            </span>
            <span className="mk-w2-tile-acts">
              <button type="button" className="mk-w2-ib" aria-label={`${m.earlier}: ${m.photoN(i + 1)}`} disabled={i === 0} onClick={() => move(i, i - 1)}><MkIcon name="back" size={18} flip /></button>
              <button type="button" className="mk-w2-ib" aria-label={`${m.later}: ${m.photoN(i + 1)}`} disabled={i === photos.length - 1} onClick={() => move(i, i + 1)}><MkIcon name="next" size={18} flip /></button>
              <button type="button" className="mk-w2-ib mk-w2-ib-red" aria-label={`${m.removePhoto}: ${m.photoN(i + 1)}`} onClick={() => remove(i)}><MkIcon name="trash" size={18} /></button>
            </span>
          </li>
        ))}
        {pend.map((p) => (
          <li key={p.key} className={`mk-w2-tile mk-w2-tile-${p.state}`}>
            <span className="mk-w2-pic">
              <img src={p.url} alt="" draggable={false} />
              {p.state === "work"
                ? <span className="mk-w2-wait" role="status"><span className="mk-w2-spin" aria-hidden="true" /><span className="mm-sr">{m.uploading}</span></span>
                : <span className="mk-w2-failed">{m.notUploaded}</span>}
            </span>
            <span className="mk-w2-tile-acts">
              {p.state === "fail" && <button type="button" className="mk-w2-ib mk-w2-ib-text" onClick={() => again(p)}><MkIcon name="again" size={18} />{retry}</button>}
              {p.state === "fail" && <button type="button" className="mk-w2-ib mk-w2-ib-red" aria-label={m.removePhoto} onClick={() => setPend((x) => x.filter((y) => y.key !== p.key))}><MkIcon name="trash" size={18} /></button>}
            </span>
          </li>
        ))}
        {plain && (
          <li className="mk-w2-tile mk-w2-tile-empty">
            <button type="button" className="mk-w2-slot" onClick={() => lib.current?.click()} aria-label={m.addPhoto}><W2Icon name="plain" size={26} /></button>
          </li>
        )}
      </ul>
      {!plain && slots.length > 0 && (
        <ul className="mk-w2-shots">
          {slots.map((s) => (
            <li key={s} className="mk-w2-tile mk-w2-tile-empty">
              <button type="button" className="mk-w2-slot" onClick={() => lib.current?.click()} aria-label={`${m.addPhoto}: ${m.shots[s as W2Shot]}`}>
                <W2Icon name={s} size={28} />
                <span>{m.shots[s as W2Shot]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mk-w2-add">
        <button type="button" className="mk-btn2 mk-w2-cam" disabled={full} onClick={() => cam.current?.click()}><MkIcon name="camera" size={18} />{m.takePhoto}</button>
        <button type="button" className="mk-btn2" disabled={full} onClick={() => lib.current?.click()}><MkIcon name="photo" size={18} />{m.choosePhotos}</button>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden tabIndex={-1} aria-hidden="true" onChange={(e) => void add(e.currentTarget)} />
      <input ref={lib} type="file" accept="image/*" multiple hidden tabIndex={-1} aria-hidden="true" onChange={(e) => void add(e.currentTarget)} />
    </div>
  );
}
