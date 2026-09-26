"use client";

import { useState } from "react";
import { fill } from "@/lib/fill";
import { sized, srcSet } from "@/lib/img";

// A model's photos: the large one, the thumbnails under it, and - when the model comes in
// colours - a swatch per colour that shows that colour's photos. A colour with no photos of its
// own shows the photos that belong to no colour, so picking a colour never empties the page.
// Everything is a button, so it all works from the keyboard. The words come from the page, in its
// language.
export type GalleryPhoto = { url: string; alt: string; colorId: string | null };
export type GalleryColor = { id: string; name: string; hex: string | null };
type Labels = { all: string; colour: string; photo: string };

export default function BikeGallery({ photos, colors, labels }: { photos: GalleryPhoto[]; colors: GalleryColor[]; labels: Labels }) {
  const [color, setColor] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const own = color ? photos.filter((p) => p.colorId === color) : photos;
  const shown = own.length ? own : color ? photos.filter((p) => !p.colorId) : photos;
  const list = shown.length ? shown : photos;
  const main = list[Math.min(at, list.length - 1)];
  const pickColor = (id: string | null) => { setColor(id); setAt(0); };
  if (!main) return null;
  return (
    <div className="ct-gallery">
      <figure className="ct-gallery-main">
        <img key={main.url} src={sized(main.url, 1280)} srcSet={srcSet(main.url)} sizes="(max-width: 900px) 100vw, 55vw" alt={main.alt} />
      </figure>
      {list.length > 1 && (
        <div className="ct-thumbs">
          {list.map((p, i) => (
            <button key={p.url + i} type="button" aria-current={i === Math.min(at, list.length - 1) ? "true" : undefined}
              aria-label={fill(labels.photo, { n: i + 1, m: list.length })} onClick={() => setAt(i)}>
              <img src={sized(p.url, 640)} srcSet={srcSet(p.url)} sizes="84px" alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {colors.length > 0 && (
        <div className="ct-swatches" role="group" aria-label={labels.colour}>
          <button type="button" aria-pressed={color === null} onClick={() => pickColor(null)}>{labels.all}</button>
          {colors.map((c) => (
            <button key={c.id} type="button" aria-pressed={color === c.id} onClick={() => pickColor(c.id)}>
              <span className="ct-sw" aria-hidden="true" style={c.hex ? { background: c.hex } : undefined} />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
