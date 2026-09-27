import { describe, expect, it } from "vitest";
import { bg, sized, srcSet } from "../img";
import variants from "../image-variants.json";

// The size of photo a page asks for (lib/img.ts), against the copies that exist (image-variants.json).
type Entry = { width: number; variants: number[] };
const SITE = variants as Record<string, Entry>;
const webp = (url: string, w: number) => url.replace(/\.(jpe?g|png|webp)$/i, `.w${w}.webp`);
const find = (test: (url: string, e: Entry) => boolean) => Object.entries(SITE).find(([u, e]) => test(u, e))!;
// Found in the manifest rather than named, so replacing a photo does not break the test.
const jpeg = find((u, e) => /\.jpe?g$/.test(u) && e.variants.includes(640) && e.variants.includes(1280) && e.variants.includes(e.width)); // a wide JPEG: two smaller copies and the whole of it
const narrow = find((u, e) => /\.jpe?g$/.test(u) && e.width > 640 && e.width < 1280); // a JPEG narrower than 1280: the whole of it stands in for the 1280 copy
const own = find((u, e) => /\.webp$/.test(u) && !e.variants.includes(e.width)); // a WebP photo: smaller copies only

describe("the site's own photos", () => {
  it("use the smallest WebP copy at least as wide as drawn", () => {
    const [u] = jpeg;
    expect(sized(u, 300)).toBe(webp(u, 640));
    expect(sized(u, 640)).toBe(webp(u, 640));
    expect(bg(u)).toBe(webp(u, 1280));
  });
  it("never fall back to the JPEG: wider than every copy, the whole photo as WebP", () => {
    const [u, e] = jpeg;
    expect(sized(u, 5000)).toBe(webp(u, e.width));
    const [n, ne] = narrow;
    expect(bg(n)).toBe(webp(n, ne.width));
  });
  it("send a photo that is a WebP already as it is when no copy is wide enough", () => {
    const [u] = own;
    expect(sized(u, 5000)).toBe(u);
  });
  it("offer every copy to the browser, and the photo itself only when no copy is the whole of it", () => {
    const [u, e] = jpeg;
    expect(srcSet(u)).toBe(e.variants.map((v) => `${webp(u, v)} ${v}w`).join(", "));
    const [w, we] = own;
    expect(srcSet(w)).toBe(`${we.variants.map((v) => `${webp(w, v)} ${v}w`).join(", ")}, ${w} ${we.width}w`);
  });
  it("have a WebP for every photo Home draws, the narrow gallery ones included", () => {
    for (const n of [1, 3, 5, 11]) expect(sized(`/site/home/gallery-${n}.jpg`, 640), `gallery-${n}`).toMatch(/\.w\d+\.webp$/);
    for (const f of ["entry-biz", "split-biz", "split-rides"]) expect(bg(`/site/home/${f}.jpg`), f).toMatch(/\.w\d+\.webp$/);
  });
  it("leave the share picture alone: the apps that fetch it want a JPEG", () => {
    expect(SITE["/site/og.jpg"]).toBeUndefined();
    expect(sized("/site/og.jpg", 640)).toBe("/site/og.jpg");
  });
});

describe("staff uploads and everything else", () => {
  it("ask the media route for a width; it falls back to the photo itself", () => {
    expect(sized("/media/home/abc.jpg", 500)).toBe("/media/home/abc.jpg?w=640");
    expect(bg("/media/home/abc.jpg")).toBe("/media/home/abc.jpg?w=1280");
    expect(srcSet("/media/home/abc.jpg")).toBe("/media/home/abc.jpg?w=640 640w, /media/home/abc.jpg?w=1280 1280w");
  });
  it("leave small files, other sites and empty values alone", () => {
    expect(sized("/site/logo-dark.png", 640)).toBe("/site/logo-dark.png");
    expect(sized("https://example.com/a.jpg", 640)).toBe("https://example.com/a.jpg");
    expect(sized("", 640)).toBe("");
    expect(srcSet("https://example.com/a.jpg")).toBeUndefined();
  });
});
