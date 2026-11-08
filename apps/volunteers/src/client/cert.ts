// The certificate template, as this page may write it into a window.
//
// Cloudflare adds its Web Analytics beacon to HTML it serves on a proxied hostname - a script tag
// before the body closes; the booking site's copy of this very file came back with one in
// production on 2026-11-08. The certificate has no script of its own and its window should run
// none: a third-party one would load beside a volunteer's name and report every print. So every
// script comes out, whoever put it there. The booking site does the same (_vcNoScripts).
export const stripScripts = (html: string): string => html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "");
