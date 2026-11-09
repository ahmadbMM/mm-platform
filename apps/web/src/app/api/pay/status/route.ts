import { payReady } from "@/lib/pay/config";
import { paySettings } from "@/lib/pay/settings";
import { loadSiteContent } from "@/lib/site";

// GET /api/pay/status: whether this site takes payments online now (the keys are set and staff have pay.enabled
// on), for the static pages that cannot read the server's settings (micromobility.sa/lockers' "Pay by card").
export const dynamic = "force-dynamic";

export async function GET() {
  const s = paySettings(await loadSiteContent());
  return Response.json({ open: s.enabled && payReady(), topup: s.enabled && s.topup && payReady() }, { headers: { "cache-control": "no-store" } });
}
