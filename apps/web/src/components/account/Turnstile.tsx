"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile, the sign-in's "are you a person" check - only when the site key is set
// (NEXT_PUBLIC_TURNSTILE_SITE_KEY at build). Usually invisible; it asks for a tap only when
// Cloudflare is unsure. The token it hands back goes with the sign-in (lib/sign-in-guard.ts).
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

type TurnstileApi = { render(el: HTMLElement, o: Record<string, unknown>): string; reset(id?: string): void; remove(id: string): void };
declare global { interface Window { turnstile?: TurnstileApi } }

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("turnstile")); };
    document.head.appendChild(s);
  });
  return loading;
}

/** Renders the check and reports its token (empty when it expires). `resetKey` asks for a new
 *  check, after a failed sign-in used the last token. */
export default function Turnstile({ locale, onToken, resetKey }: { locale: string; onToken: (t: string) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return;
    let gone = false;
    loadScript().then(() => {
      if (gone || !box.current || !window.turnstile) return;
      id.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        language: locale === "zh" ? "zh-cn" : locale,
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    }).catch(() => onToken(""));
    return () => { gone = true; if (id.current && window.turnstile) window.turnstile.remove(id.current); id.current = null; };
  }, [locale, onToken]);
  useEffect(() => { if (resetKey && id.current && window.turnstile) window.turnstile.reset(id.current); }, [resetKey]);
  return TURNSTILE_SITE_KEY ? <div ref={box} className="ac-check" /> : null;
}
