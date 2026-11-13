"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { askNum, askPct } from "@/lib/ask";
import { seriesColor, type AskColors, type QuestionLook } from "@/lib/ask-look";

// What the charts share: how a mark's numbers are written (the question's `look.values`), the key that names each
// colour in words and numbers, the order staff asked for, a box's measured size, and the gentle movements - a number
// easing to its new value, a row sliding to its new place, a new answer marked as it arrives. None of them moves under
// prefers-reduced-motion.

/** A mark's numbers as its look asks: the count, its share of the whole, both, or neither. */
export function valueParts(look: QuestionLook, count: number | string | null, share: number | null, locale: string): { count: string | null; pct: string | null } {
  const c = count === null || look.values === "percent" || look.values === "none" ? null : typeof count === "number" ? askNum(count, locale) : count;
  const p = share === null || look.values === "count" || look.values === "none" ? null : askPct(share, locale);
  return { count: c, pct: p };
}
/** The same in one line of words, for a tile, a title or a list a screen reader reads: "12 · 40%". */
export function valueLine(look: QuestionLook, count: number | string | null, share: number | null, locale: string): string {
  const v = valueParts(look, count, share, locale);
  return [v.count, v.pct].filter(Boolean).join(" · ");
}
/** The numbers beside a mark, in the text's own colours: the count quieter, the share strong. */
export function Values({ look, count, share, locale }: { look: QuestionLook; count: number | string | null; share: number | null; locale: string }) {
  const v = valueParts(look, count, share, locale);
  if (!v.count && !v.pct) return null;
  return <span className="ask-val">{v.count && (v.pct ? <span className="ask-val-n">{v.count}</span> : <b>{v.count}</b>)}{v.pct && <b>{v.pct}</b>}</span>;
}

/** The i-th colour of several, as a style: the fill, and the colour of what is written inside it. */
export const seriesStyle = (colors: AskColors, i: number): React.CSSProperties => { const c = seriesColor(colors, i); return { background: c.fill, color: c.on }; };

/** `index`: which of the palette's colours the mark has (the option's place as staff wrote it, so a mark keeps its
 *  colour when the order changes); `no`: the number written on it, when that is not the same. */
export type KeyRow = { id: string; label: string; index: number; no?: number; value: ReactNode; mark?: ReactNode };
/** A chart's key: every mark named in words with its numbers, beside a swatch of its colour and, where the chart
 *  numbers its marks, the same number. `plain`: a chart of one hue, whose key is numbers alone. It is a list, so it is
 *  also what a screen reader reads of the chart. */
export function Legend({ rows, colors, numbered = false, plain = false, dots = false, className = "" }: {
  rows: KeyRow[]; colors: AskColors; numbered?: boolean; plain?: boolean; dots?: boolean; className?: string;
}) {
  // a row slides to its new place when the order changes (the largest first, as answers come in)
  const ref = useFlip<HTMLOListElement & HTMLUListElement>(rows.map((r) => r.id).join("\n"));
  const Tag = numbered ? "ol" : "ul";
  return (
    <Tag ref={ref} className={`ask-key${className ? ` ${className}` : ""}`} data-many={rows.length > 6 ? "" : undefined} style={{ "--ask-rows": rows.length, "--ask-half": Math.ceil(rows.length / 2) } as React.CSSProperties}>
      {rows.map((r) => (
        <li key={r.id} data-flip={r.id}>
          <span className={`ask-sw${dots ? " dot" : ""}${plain ? " plain" : ""}`} style={plain ? undefined : seriesStyle(colors, r.index)} aria-hidden="true">{numbered ? r.no ?? r.index + 1 : ""}</span>
          <span className="ask-key-name"><span dir="auto">{r.label}</span>{r.mark}</span>
          {r.value}
        </li>
      ))}
    </Tag>
  );
}

/** Rows in the order the look asks: as staff wrote them, or the largest first (ties keep staff's order). */
export function sortRows<T>(rows: readonly T[], sort: QuestionLook["sort"], by: (x: T) => number): T[] {
  if (sort !== "count") return [...rows];
  return rows.map((x, i) => ({ x, i })).sort((p, q) => by(q.x) - by(p.x) || p.i - q.i).map(({ x }) => x);
}

const still = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A box's size as it is drawn, kept up to date; null until it has been measured (and on the server). */
export function useBox(ref: RefObject<HTMLElement | null>, on = true): { width: number; height: number } | null {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !on) return;
    const read = () => setBox((b) => { const width = Math.floor(el.clientWidth), height = Math.floor(el.clientHeight); return b && b.width === width && b.height === height ? b : { width, height }; });
    read();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, [ref, on]);
  return box;
}

/** Numbers that ease to their new values over about half a second (a ring's arcs, a radar's corners) - at once on the
 *  first draw, and always at once for a reader who asked for less motion. */
export function useTween(target: readonly number[], ms = 520): number[] {
  const [shown, setShown] = useState<number[]>(() => [...target]);
  const at = useRef<number[]>([...target]);
  const key = target.join(",");
  useEffect(() => {
    const to = key === "" ? [] : key.split(",").map(Number);
    const from = to.map((v, i) => at.current[i] ?? v);
    if (from.length === at.current.length && from.every((v, i) => v === to[i])) return;
    let frame = 0;
    const began = performance.now();
    const step = (now: number) => {
      const p = still() ? 1 : Math.min(1, (now - began) / ms);
      const e = 1 - (1 - p) ** 3;
      const cur = to.map((v, i) => from[i] + (v - from[i]) * e);
      at.current = cur;
      setShown(cur);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [key, ms]);
  return shown.length === target.length ? shown : [...target];
}

/** A list whose rows slide to their new places when their order changes (the largest first, as answers come in):
 *  give the list this ref and each row a `data-flip` name. `order` is the rows' names in order. */
export function useFlip<T extends HTMLElement>(order: string): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const places = useRef(new Map<string, [number, number]>());
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = new Map<string, [number, number]>();
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const name = child.dataset.flip;
      if (!name) continue;
      const left = child.offsetLeft, top = child.offsetTop;
      next.set(name, [left, top]);
      const was = places.current.get(name);
      if (was && (was[0] !== left || was[1] !== top) && !still() && typeof child.animate === "function") {
        child.animate([{ transform: `translate(${was[0] - left}px, ${was[1] - top}px)` }, { transform: "translate(0, 0)" }], { duration: 460, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
    }
    places.current = next;
  }, [order]);
  return ref;
}

const NONE: ReadonlySet<string> = new Set();
/** The names that came in after the first draw, each for a few seconds: a new answer is marked as it arrives (the
 *  stylesheet draws the mark), and what was there when the page opened is not. */
export function useFresh(names: readonly string[], ms = 3600): ReadonlySet<string> {
  const seen = useRef<Set<string> | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [fresh, setFresh] = useState<ReadonlySet<string>>(NONE);
  const key = names.join("\n");
  useEffect(() => {
    const now = key === "" ? [] : key.split("\n");
    if (!seen.current) { seen.current = new Set(now); return; }
    const known = seen.current;
    const added = now.filter((name) => !known.has(name));
    if (!added.length) return;
    added.forEach((name) => known.add(name));
    const all = timers.current;
    const show = setTimeout(() => { all.delete(show); setFresh((f) => new Set([...f, ...added])); }, 0);
    const hide = setTimeout(() => { all.delete(hide); setFresh((f) => { const next = new Set(f); added.forEach((name) => next.delete(name)); return next; }); }, ms);
    all.add(show); all.add(hide);
  }, [key, ms]);
  useEffect(() => { const all = timers.current; return () => { all.forEach(clearTimeout); all.clear(); }; }, []);
  return fresh;
}

/** The size, in px, at which a text of this many characters fits a width (a character taken as 0.58 of its size wide -
 *  the faces the site uses run a little under), between two bounds. */
export const fitSize = (chars: number, width: number, least: number, most: number): number => Math.max(least, Math.min(most, width / (Math.max(1, chars) * 0.58)));
