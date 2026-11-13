"use client";

import { useCallback, useEffect, useRef } from "react";
import { POLL_MS, askLive, pollDelay, type LiveAnswer } from "@/lib/ask";
import { rpcResult } from "@/lib/rpc-client";

// The results, asked for straight from the database (ask_live, with the public key - never through the site's own
// Worker, whose requests are counted): every 10 seconds on a page and every 4 on the big screen, only while the tab
// is in view, at once when it comes back into view, and slower after each failed try in a row (lib/ask.ts pollDelay).
// Each call sends the last version it holds, so a poll with nothing new is a few bytes.
//
// On a page staff pace (`live`: they show one question at a time) both ask every 2 seconds, and the first call goes at
// once: the question on screen changes under the room's eyes, and a quiz clock needs the database's time from the
// start. A page at its own pace asks exactly as before.
//
// `at` is the key and the version to ask with (null: nothing to ask). `onAnswer` is handed every answer the database
// gave ("gone": the key no longer opens the page - the caller reads the page again for a new one), with the moments
// the call left and came back on this device's clock (the database's `now` in the answer, set between the two, tells
// how far the two clocks stand apart: lib/ask-pace.ts offsetOf). The returned function asks now (after the viewer's
// own answer); asked while a call is on its way, it asks again right after it, since that call may have left before
// the answer was stored.
export type LiveMeta = { sentAt: number; gotAt: number };
export function useAskLive(slug: string, mode: keyof typeof POLL_MS, at: { key: string; ver: number } | null, onAnswer: (a: LiveAnswer, meta: LiveMeta) => void, live = false): () => void {
  const now = useRef(at);
  const handler = useRef(onAnswer);
  const ask = useRef<() => void>(() => {});
  useEffect(() => { now.current = at; handler.current = onAnswer; });
  const on = at !== null;

  useEffect(() => {
    if (!on) return;
    let stopped = false, asking = false, again = false, fails = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const plan = (ms: number) => { clearTimeout(timer); timer = setTimeout(call, ms); };
    async function call() {
      timer = undefined;
      const held = now.current;
      if (stopped || asking || !held || document.visibilityState !== "visible") return; // out of view: asked when it is back
      asking = true;
      const sentAt = Date.now();
      const r = await rpcResult<unknown>("ask_live", { p_slug: slug, p_key: held.key, p_ver: held.ver });
      const gotAt = Date.now();
      asking = false;
      if (stopped) return;
      if ("error" in r) {
        // a database that does not have the function yet: there is nothing to ask for
        if (r.error.code === "PGRST202") { stopped = true; return; }
        fails++;
      } else {
        const a = askLive(r.data);
        fails = a.kind === "gone" ? fails + 1 : 0;
        handler.current(a, { sentAt, gotAt });
      }
      if (again) { again = false; plan(0); } else plan(pollDelay(mode, fails, live));
    }
    const back = () => { if (document.visibilityState === "visible" && !asking) { clearTimeout(timer); call(); } };
    ask.current = () => { if (asking) again = true; else { clearTimeout(timer); call(); } };
    document.addEventListener("visibilitychange", back);
    plan(live ? 0 : POLL_MS[mode]);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", back); ask.current = () => {}; };
  }, [slug, mode, on, live]);

  return useCallback(() => ask.current(), []);
}
