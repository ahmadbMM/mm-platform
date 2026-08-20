// Supabase Auth "Send SMS" hook -> WhatsApp OTP via Meta Cloud API (ADR-03).
// Configure: Dashboard > Authentication > Hooks > Send SMS (HTTPS) -> this function's URL.
// Secrets (supabase secrets set):
//   SEND_SMS_HOOK_SECRET  (from the hook config; keep the base64 part after 'v1,whsec_')
//   META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_AUTH_TEMPLATE (default 'mm_auth')
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

Deno.serve(async (req) => {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const secret = (Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "").replace("v1,whsec_", "");
  let evt: { user?: { phone?: string; user_metadata?: { lang?: string } }; sms?: { otp?: string } };
  try {
    evt = new Webhook(secret).verify(payload, headers) as typeof evt;
  } catch {
    return new Response(JSON.stringify({ error: { message: "invalid signature" } }), { status: 401 });
  }

  const phone = evt.user?.phone;
  const otp = evt.sms?.otp;
  if (!phone || !otp) {
    return new Response(JSON.stringify({ error: { message: "missing phone/otp" } }), { status: 400 });
  }
  const lang = evt.user?.user_metadata?.lang === "en" ? "en" : "ar"; // Arabic default

  const res = await fetch(
    "https://graph.facebook.com/v20.0/" + Deno.env.get("META_PHONE_NUMBER_ID") + "/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + Deno.env.get("META_ACCESS_TOKEN"),
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: Deno.env.get("META_AUTH_TEMPLATE") ?? "mm_auth",
          language: { code: lang },
          components: [
            { type: "body", parameters: [{ type: "text", text: otp }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: otp }] },
          ],
        },
      }),
    },
  );

  if (!res.ok) {
    console.error("meta send failed", res.status, await res.text());
    return new Response(JSON.stringify({ error: { message: "whatsapp delivery failed" } }), { status: 500 });
  }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
});
