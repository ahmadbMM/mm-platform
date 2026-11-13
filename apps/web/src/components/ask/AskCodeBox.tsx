"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { askCode, askSlugOk, latinDigits } from "@/lib/ask";
import { rpcResult } from "@/lib/rpc-client";
import { T } from "./Ask.text";

// A page's 6-digit code (the big screen shows it): asked of the database straight from the browser (ask_code, which
// meters tries per network) and, when a page that is open has it, the browser goes to that page.
export default function AskCodeBox() {
  const t = useLocalize(T);
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const code = askCode(text);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code) return;
    setBusy(true);
    setErr("");
    const r = await rpcResult<unknown>("ask_code", { p_code: code });
    if ("error" in r) {
      setErr(/RATE_LIMITED|THROTTLED/i.test(r.error.message || "") ? t.codeBusy : t.tryLater);
    } else if (askSlugOk(r.data)) {
      router.push(`/ask/${r.data}`);
      return; // the button stays busy while the page opens
    } else setErr(t.codeBad);
    setBusy(false);
  }
  return (
    <form className="ask-code" onSubmit={go} noValidate>
      <label htmlFor="ask-code">{t.code}</label>
      <div className="ask-code-row">
        <input id="ask-code" className="ask-input ask-code-box mm-lat" value={text} inputMode="numeric" autoComplete="off" maxLength={9} dir="ltr" placeholder="000000"
          aria-invalid={err ? true : undefined} aria-describedby={err ? "ask-code-err" : undefined}
          onChange={(e) => { setText(latinDigits(e.target.value).replace(/[^\d\s-]/g, "")); if (err) setErr(""); }} />
        <button type="submit" className="ask-btn" disabled={busy || !code}>{t.codeGo}</button>
      </div>
      {err && <p id="ask-code-err" className="ask-err" role="alert">{err}</p>}
    </form>
  );
}
