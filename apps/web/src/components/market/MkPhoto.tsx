import { MK_SMALL_SIDE, isMkPhotoName, mkPhotoSrc } from "@/lib/market/core";
import { MkNoPhoto } from "./MkIcon";

// One photo of a listing or a shop's logo, from the site's own address (app/mkt for the marketplace's bucket,
// app/media for the photos staff upload for MicroMobility's own listings), in a box that keeps its place before the
// picture arrives. A photo is never flipped on right-to-left pages.
//   name      the photo as the database names it (a listing's `photos[i]`, a card's `photo`, a shop's `logo`); null or
//             a name that is neither kind draws the "no photo" mark
//   alt       what the picture shows, in the page's language ("" only when the text beside it says the same)
//   small     the 480px copy only (a card, a thumbnail, a thread's row); without it the full photo, with the small
//             copy offered to a narrow screen
//   ratio     the box's shape: "1/1" (the default), "4/3" or "auto" (the photo's own)
//   eager     the first photo of a page: loaded at once and first
//   noPhoto   the "no photo" mark's name for a screen reader (Market.text.ts `noPhoto`)
export default function MkPhoto({ name, alt, small = false, ratio = "1/1", eager = false, noPhoto = "", className = "" }: {
  name: string | null | undefined; alt: string; small?: boolean; ratio?: "1/1" | "4/3" | "auto"; eager?: boolean; noPhoto?: string; className?: string;
}) {
  const src = mkPhotoSrc(name, small);
  const cls = `mk-photo mk-photo-${ratio === "1/1" ? "sq" : ratio === "4/3" ? "43" : "auto"}${className ? ` ${className}` : ""}`;
  if (!src) return <span className={cls}><MkNoPhoto label={noPhoto || alt} /></span>;
  // the two copies of a marketplace photo, for the browser to choose between; a staff photo has its own sizes
  const own = !small && isMkPhotoName(name);
  return (
    <span className={cls}>
      <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} decoding="async" draggable={false}
        srcSet={own ? `${mkPhotoSrc(name, true)} ${MK_SMALL_SIDE}w, ${src} 1600w` : undefined} sizes={own ? "(max-width: 600px) 100vw, 800px" : undefined} />
    </span>
  );
}
