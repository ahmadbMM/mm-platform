import { handoverSlots } from "@/components/store/sx-b3-data";
import { json } from "@/lib/pay/http";
import { loadSiteContent } from "@/lib/site";
import { sxSettings } from "@/lib/sx-b3";

// GET /api/store/handover?day=YYYY-MM-DD (day optional): the handover slots of "Collect fully built" (N13, 2026-11-18;
// the contract the buy box and checkout share is in SX/results/B3.md): {ok: true, on, minutes, days: [{day, slots: [{at,
// to, open}]}]}. Off ({on: false}) while staff have store.handover off or the database has no store_handover_slots yet.
// Nothing personal: which slots are free, never how many people. Never kept anywhere.
export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get("day");
  const content = await loadSiteContent();
  const h = await handoverSlots(sxSettings(content).handover, day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null);
  return json({ ok: true, ...h });
}
