// The portal's marks: the booking app's rider set, drawn in one monoline stroke (1.75 on a 24 grid, round ends;
// its _CU / _cuIc), and a few more in the same hand. Nothing a volunteer reads is an emoji or a text glyph standing
// in for an icon. currentColor inks them; "flip" mirrors the ones that point along the line of reading in Arabic and Urdu.

const P: Record<string, string> = {
  tick: '<path d="M5 12.6l4.3 4.3L19 7.4"/>',
  pin: '<path d="M12 21.2s-6.6-5.7-6.6-11.1a6.6 6.6 0 0 1 13.2 0c0 5.4-6.6 11.1-6.6 11.1z"/><circle cx="12" cy="10.1" r="2.3"/>',
  cal: '<rect x="3.6" y="5.2" width="16.8" height="15.2" rx="2.6"/><path d="M3.6 10.1h16.8M8.2 3.2v4M15.8 3.2v4"/>',
  back: '<path d="M14.6 5.4L8 12l6.6 6.6"/>',
  go: '<path d="M9.4 5.4L16 12l-6.4 6.6"/>',
  person: '<circle cx="12" cy="8.2" r="3.7"/><path d="M4.9 20.2c.8-3.8 3.6-5.9 7.1-5.9s6.3 2.1 7.1 5.9"/>',
  people: '<circle cx="9" cy="8.6" r="3.1"/><path d="M3.4 19.4c.6-3.2 2.8-5 5.6-5s5 1.8 5.6 5M15.2 5.9a3 3 0 0 1 0 5.6M17.6 14.6c1.7.6 2.8 2.2 3.1 4.8"/>',
  globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.3 2.3 3.5 5.2 3.5 8.6s-1.2 6.3-3.5 8.6c-2.3-2.3-3.5-5.2-3.5-8.6s1.2-6.3 3.5-8.6z"/>',
  flag: '<path d="M5.4 21V3.8M5.4 4.4h11.8l-2.4 4 2.4 4H5.4"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 2"/>',
  close: '<path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/>',
  doc: '<path d="M14 3.4H7.2a1.8 1.8 0 0 0-1.8 1.8v13.6a1.8 1.8 0 0 0 1.8 1.8h9.6a1.8 1.8 0 0 0 1.8-1.8V8z"/><path d="M14 3.4V8h4.6M8.8 12.6h6.4M8.8 16h4.2"/>',
  again: '<path d="M19.6 12.4a7.6 7.6 0 0 1-13.4 4.5M4.4 11.6a7.6 7.6 0 0 1 13.4-4.5"/><path d="M18.3 3.6v3.9h-3.9M5.7 20.4v-3.9h3.9"/>',
  ticket: '<path d="M3.6 7.6A1.6 1.6 0 0 1 5.2 6h13.6a1.6 1.6 0 0 1 1.6 1.6V10a2 2 0 0 0 0 4v2.4a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V14a2 2 0 0 0 0-4z"/><path d="M14.4 6.6v1.6M14.4 11.2v1.6M14.4 15.8v1.6"/>',
  // the free ride: the gift of the booking app's referral free ride (_CODE_IC rf)
  gift: '<rect x="3.6" y="8.4" width="16.8" height="4.2" rx="1"/><path d="M5.2 12.6v6.6a1.2 1.2 0 0 0 1.2 1.2h11.2a1.2 1.2 0 0 0 1.2-1.2v-6.6M12 8.4v12M12 8.4C10.9 5.6 8.4 4 7 5.1c-1.3 1-.1 3.3 5 3.3zM12 8.4c1.1-2.8 3.6-4.4 5-3.3 1.3 1 .1 3.3-5 3.3z"/>',
  // drawn for the portal, in the same hand
  home: '<path d="M4 10.6L12 4l8 6.6V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19z"/><path d="M9.6 20.4v-5.6h4.8v5.6"/>',
  bell: '<path d="M6.2 16.6V11a5.8 5.8 0 0 1 11.6 0v5.6l1.6 1.8H4.6z"/><path d="M10 20.6a2.1 2.1 0 0 0 4 0"/>',
  hand: '<path d="M8.6 12.4V6.2a1.5 1.5 0 0 1 3 0v5M11.6 11V4.6a1.5 1.5 0 0 1 3 0V11M14.6 11.2V6.4a1.5 1.5 0 0 1 3 0v7.8c0 3.9-2.5 6.6-6 6.6-2.5 0-4.1-1.2-5.3-3.2l-2.2-3.8a1.5 1.5 0 0 1 2.5-1.7l1.4 1.9"/>',
  scan: '<path d="M4 8.4V5.6A1.6 1.6 0 0 1 5.6 4h2.8M15.6 4h2.8A1.6 1.6 0 0 1 20 5.6v2.8M20 15.6v2.8a1.6 1.6 0 0 1-1.6 1.6h-2.8M8.4 20H5.6A1.6 1.6 0 0 1 4 18.4v-2.8M4 12h16"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.2"/><path d="M15.4 15.4l4.6 4.6"/>',
  more: '<circle cx="5.6" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18.4" cy="12" r="1.1"/>',
  out: '<path d="M14 4.4H6.4A1.6 1.6 0 0 0 4.8 6v12a1.6 1.6 0 0 0 1.6 1.6H14M10.4 12h9.2M16.4 8.6l3.4 3.4-3.4 3.4"/>',
  medal: '<circle cx="12" cy="14.6" r="5.2"/><path d="M8.7 10.5L6.6 3.6h3.8l1.6 4.4M15.3 10.5l2.1-6.9h-3.8L12 8"/>',
  copy: '<rect x="8.4" y="8.4" width="11.6" height="11.6" rx="2.2"/><path d="M15.6 8.4V5.8a1.8 1.8 0 0 0-1.8-1.8H5.8A1.8 1.8 0 0 0 4 5.8v8a1.8 1.8 0 0 0 1.8 1.8h2.6"/>',
  // the enhancements of 2026-11-11, in the same hand
  eye: '<path d="M2.6 12s3.4-6.4 9.4-6.4 9.4 6.4 9.4 6.4-3.4 6.4-9.4 6.4S2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M9.9 5.8a9.7 9.7 0 0 1 2.1-.2c6 0 9.4 6.4 9.4 6.4a16 16 0 0 1-2.7 3.5M6.6 7.1C4 8.8 2.6 12 2.6 12s3.4 6.4 9.4 6.4c1.5 0 2.8-.4 4-.9M9.9 9.9a2.8 2.8 0 0 0 4.2 4.2M4 4l16 16"/>',
  share: '<path d="M12 14.6V3.6M8.2 7.2L12 3.4l3.8 3.8"/><path d="M8 10.2H6.6A1.6 1.6 0 0 0 5 11.8v7a1.6 1.6 0 0 0 1.6 1.6h10.8a1.6 1.6 0 0 0 1.6-1.6v-7a1.6 1.6 0 0 0-1.6-1.6H16"/>',
  bag: '<path d="M5.2 8.4h13.6l-1 11a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4z"/><path d="M8.8 8.4V7a3.2 3.2 0 0 1 6.4 0v1.4"/>',
  cup: '<path d="M6 4.6h12l-1.4 14.2a1.6 1.6 0 0 1-1.6 1.4H9a1.6 1.6 0 0 1-1.6-1.4z"/><path d="M6.6 9.6h10.8"/>',
  shirt: '<path d="M8.6 4L4.2 6.6l1.8 3.8 2.2-1v10.8h7.6V9.4l2.2 1 1.8-3.8L15.4 4a3.4 3.4 0 0 1-6.8 0z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/>',
  phone: '<path d="M6.6 3.6h2.6l1.4 4.2-2 1.4a11 11 0 0 0 6.2 6.2l1.4-2 4.2 1.4v2.6a1.8 1.8 0 0 1-1.9 1.8C10.6 18.7 5.3 13.4 4.8 5.5a1.8 1.8 0 0 1 1.8-1.9z"/>',
  heart: '<path d="M12 19.6s-7.4-4.4-7.4-9.6a4.2 4.2 0 0 1 7.4-2.7 4.2 4.2 0 0 1 7.4 2.7c0 5.2-7.4 9.6-7.4 9.6z"/>',
  torch: '<path d="M8 3.6h8v3.2l-2 3.4v9.6a1.2 1.2 0 0 1-1.2 1.2h-1.6a1.2 1.2 0 0 1-1.2-1.2v-9.6L8 6.8z"/><path d="M12 13v2"/>',
  addHome: '<rect x="4" y="4" width="16" height="16" rx="3.4"/><path d="M12 8.4v7.2M8.4 12h7.2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  offline: '<path d="M7 18.4h10.6a3.8 3.8 0 0 0 .6-7.6 6 6 0 0 0-11.4-1.6A4.6 4.6 0 0 0 7 18.4z"/><path d="M4 4l16 16"/>',
  spark: '<path d="M12 3.6l1.9 5.2 5.3 1.9-5.3 1.9L12 17.8l-1.9-5.2-5.3-1.9 5.3-1.9z"/>',
};

export type IconName = keyof typeof P;

// The marks that point along the line of reading, mirrored in Arabic and Urdu wherever they are used.
const FLIP = new Set(["go", "back"]);

/** A mark, sized in px, inked by currentColor and hidden from screen readers (its button or line says it). */
export function icon(name: string, px = 18, flip = FLIP.has(name)): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", `ic${flip ? " ic-flip" : ""}`);
  svg.setAttribute("width", String(px));
  svg.setAttribute("height", String(px));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.75");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = P[name] ?? ""; // our own constants above, never anything the database said
  return svg;
}
