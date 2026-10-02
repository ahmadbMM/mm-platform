// Small monoline icons, drawn on a 24-unit grid with a 1.75 stroke in the current text colour.
// Built with DOM calls (no innerHTML), decorative unless a label is given.

const P: Record<string, string[]> = {
  calendar: ["M4 6.5h16v13H4z", "M4 10.5h16", "M8.5 4v4", "M15.5 4v4"],
  list: ["M9 7h11", "M9 12h11", "M9 17h11", "M4.5 7h.01", "M4.5 12h.01", "M4.5 17h.01"],
  store: ["M4 9.5 5.5 4.5h13L20 9.5", "M4 9.5c0 1.4 1.1 2.5 2.7 2.5s2.6-1.1 2.6-2.5c0 1.4 1.1 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1 2.5 2.6 2.5S20 10.9 20 9.5", "M5.5 12v7.5h13V12", "M10 19.5v-4h4v4"],
  signout: ["M14 4.5H6.5v15H14", "M10.5 12H20", "M16.5 8.5 20 12l-3.5 3.5"],
  globe: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", "M3.5 12h17", "M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z"],
  prev: ["M14.5 6 8.5 12l6 6"],
  next: ["M9.5 6l6 6-6 6"],
  check: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", "M8 12.3l2.7 2.7L16 9.6"],
  clock: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", "M12 7.5V12l3 2"],
  open: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", "M12 8.5v7", "M8.5 12h7"],
  taken: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", "M8.5 8.5l7 7"],
  closed: ["M6 11h12v8.5H6z", "M8.5 11V8a3.5 3.5 0 0 1 7 0v3"],
  dash: ["M8 12h8"],
  users: ["M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8", "M15.5 5.3a3 3 0 0 1 0 5.6", "M17 14.4c1.9.5 3.1 2.1 3.5 4.6"],
  close: ["M6.5 6.5l11 11", "M17.5 6.5l-11 11"],
  info: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", "M12 11v5.5", "M12 7.8h.01"],
  alert: ["M12 4 3.5 19h17z", "M12 10v4.5", "M12 17h.01"],
  eye: ["M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z", "M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"],
  eyeOff: ["M4 4l16 16", "M9.9 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.9 3.6", "M6.4 7.4C3.9 9.1 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1.1", "M10.2 10.3a2.5 2.5 0 0 0 3.5 3.5"],
  repeat: ["M4.5 11V9.5a3 3 0 0 1 3-3h11", "M15.5 3.5l3 3-3 3", "M19.5 13v1.5a3 3 0 0 1-3 3h-11", "M8.5 20.5l-3-3 3-3"],
  pin: ["M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z", "M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"],
  star: ["M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16.2 7.2 18.8l1-5.4-4-3.7 5.4-.7z"],
};

export type IconName = keyof typeof P;

const NS = "http://www.w3.org/2000/svg";

export function icon(name: IconName, cls = "icon"): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", cls);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of P[name]) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  }
  return svg;
}
