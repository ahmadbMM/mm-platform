"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { sized, srcSet } from "@/lib/img";
import { quickRoom } from "@/lib/store-listing";
import { Ic, NoPhoto } from "./bits";
import { StIcon } from "./icons";
import { ADDED_MS } from "@/lib/cart";
import { cartAdd, useCart } from "./useCart";
import { savedToggle, useSaved } from "./useLists";
import { BagPlus } from "./w2-icons";
import { photoLoad } from "@/lib/sx-B1-list";

// The moving parts of a product card on the store's lists (chain w2): its photo strip (D06-C), its heart (F07) and its
// quick add (F06). The card itself (ProductCard) is plain markup around them.

/** The card's photos in a strip that swipes sideways (D06-C), with dots for where it is and small arrows to tap instead
 *  (WCAG 2.5.7; each a 44px target around its drawn circle, P12). The list's first photo loads at once and first, every
 *  other one as it nears the screen (SM12-B: lib/sx-B1-list.ts photoLoad); `sizes` follows the card's width (cardSizes). Each photo opens the product; the keyboard reaches the product by the card's name, so the photos are out
 *  of the tab order, and one without a description is hidden from screen readers (the name says it; X10). On a
 *  right-to-left page the strip runs right to left and the arrows point that way (A06-A); a photo is never mirrored. */
export function CardStrip({ photos, alts, href, eager, sizes, prev, next }: {
  photos: string[]; alts: string[]; href: string; eager?: boolean; sizes: string; prev: string; next: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const n = photos.length;
  const onScroll = () => {
    const el = box.current;
    if (!el || !el.clientWidth) return;
    // a right-to-left strip scrolls to negative offsets
    setAt(Math.max(0, Math.min(n - 1, Math.round(Math.abs(el.scrollLeft) / el.clientWidth))));
  };
  const go = (i: number) => {
    const el = box.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: (rtl ? -i : i) * el.clientWidth, behavior: calm ? "auto" : "smooth" });
  };
  if (!n) return <Link href={href} className="st-strip-i st-strip-one" tabIndex={-1} aria-hidden="true"><NoPhoto /></Link>;
  return (
    <>
      <div ref={box} className="st-strip" onScroll={n > 1 ? onScroll : undefined}>
        {photos.map((src, i) => (
          <Link key={src + i} href={href} className="st-strip-i" tabIndex={-1} aria-hidden={alts[i] ? undefined : true} draggable={false}>
            <img src={sized(src, 640)} srcSet={srcSet(src)} sizes={sizes} alt={alts[i]} {...photoLoad(!!eager, i)} decoding="async" draggable={false} />
          </Link>
        ))}
      </div>
      {n > 1 && (
        <>
          <button type="button" className="st-strip-arrow is-prev" aria-label={prev} hidden={at === 0} onClick={() => go(at - 1)}>
            <StIcon name="prev" size={16} flip />
          </button>
          <button type="button" className="st-strip-arrow is-next" aria-label={next} hidden={at >= n - 1} onClick={() => go(at + 1)}>
            <StIcon name="next" size={16} flip />
          </button>
          <span className="st-strip-dots" aria-hidden="true">
            {photos.map((src, i) => <i key={src + i} className={i === at ? "on" : undefined} />)}
          </span>
        </>
      )}
    </>
  );
}

/** The heart on a card's photo (F07): saves the product in this browser, no account needed, or takes it out of Saved. */
export function SaveHeart({ slug, label }: { slug: string; label: string }) {
  const saved = useSaved().includes(slug);
  return (
    <button type="button" className={`st-heart${saved ? " on" : ""}`} aria-pressed={saved} aria-label={label} title={label} onClick={() => savedToggle(slug)}>
      <StIcon name="heart" size={20} filled={saved} />
    </button>
  );
}

/** Add to cart from the card (F06), for gear sold in one size and one colour: the round bag turns into "Added" with a
 *  drawn tick for a moment (D14-E, no pop-up), or says the cart cannot take more of it: the cart is full, or it already
 *  holds all that is in stock (10 a line at most), as the product page's Add counts. */
export function QuickAdd({ variant, stock, label, added, cant }: { variant: string; stock: number; label: string; added: string; cant: string }) {
  const [state, setState] = useState<"" | "added" | "cant">("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cart = useCart();
  useEffect(() => () => clearTimeout(timer.current), []);
  const add = () => {
    const got = quickRoom(cart, { id: variant, stock }) > 0 ? cartAdd(variant, 1) : 0;
    setState(got !== null && got > 0 ? "added" : "cant");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(""), ADDED_MS);
  };
  return (
    <>
      <button type="button" className={`st-quick${state ? ` is-${state}` : ""}`} aria-label={state ? undefined : label} title={state ? undefined : label} onClick={add}>
        {state === "added" ? <><Ic name="tick" size={16} /><span>{added}</span></> : state === "cant" ? <span>{cant}</span> : <BagPlus size={20} />}
      </button>
      <span className="mm-sr" aria-live="polite">{state === "added" ? added : state === "cant" ? cant : ""}</span>
    </>
  );
}
