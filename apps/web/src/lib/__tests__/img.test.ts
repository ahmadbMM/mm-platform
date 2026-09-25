import { describe, expect, it } from "vitest";
import { bg, sized, srcSet } from "../img";
import variants from "../image-variants.json";

// The size of photo a page asks for (lib/img.ts).
const [photo, entry] = Object.entries(variants as Record<string, { width: number; variants: number[] }>).find(([, e]) => e.variants.includes(640) && e.variants.includes(1280))!;

describe("the site's own photos", () => {
  it("use the smallest copy at least as wide as drawn", () => {
    expect(sized(photo, 300)).toBe(photo.replace(/\.(jpe?g|png|webp)$/i, ".w640.webp"));
    expect(bg(photo)).toBe(photo.replace(/\.(jpe?g|png|webp)$/i, ".w1280.webp"));
    expect(sized(photo, 5000)).toBe(photo); // wider than any copy: the photo itself
  });
  it("offer every copy and the photo to the browser", () => {
    expect(srcSet(photo)).toBe(`${photo.replace(/\.(jpe?g|png|webp)$/i, ".w640.webp")} 640w, ${photo.replace(/\.(jpe?g|png|webp)$/i, ".w1280.webp")} 1280w, ${photo} ${entry.width}w`);
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
