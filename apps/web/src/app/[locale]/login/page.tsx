"use client";
// Phase 0 skeleton of the OTP flow. Visuals get replaced by the DC otp-signin design.
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function Login() {
  const [phone, setPhone] = useState("");     // E.164, e.g. +9665xxxxxxxx
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code" | "done">("phone");
  const [err, setErr] = useState<string | null>(null);
  const sb = supabaseBrowser();

  async function sendCode() {
    setErr(null);
    const { error } = await sb.auth.signInWithOtp({ phone });
    if (error) return setErr(error.message);
    setStage("code");
  }
  async function verify() {
    setErr(null);
    const { error } = await sb.auth.verifyOtp({ phone, token: code, type: "sms" });
    if (error) return setErr(error.message);
    setStage("done");
  }

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
      <div style={{ width: 320, display: "grid", gap: 12 }}>
        {stage === "phone" && (<>
          <input dir="ltr" placeholder="+9665xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button onClick={sendCode}>Send WhatsApp code</button>
        </>)}
        {stage === "code" && (<>
          <input dir="ltr" inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
          <button onClick={verify}>Verify</button>
        </>)}
        {stage === "done" && <p>Signed in. Profile row now exists in mm.profiles.</p>}
        {err && <p style={{ color: "var(--mm-error)" }}>{err}</p>}
      </div>
    </main>
  );
}
