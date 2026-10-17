// micromobility.sa/defe: the Defe x MicroMobility booking page for the Saturday Social Ride (the
// owner, 2026-10-17), served as the page forms/defe builds. Outside the proxy on purpose (proxy.ts
// matcher), so Coming Soon never covers it.
import page from "../../forms/defe-page";
import { formResponse } from "../../forms/headers";

export const dynamic = "force-dynamic";

export function GET() {
  return formResponse("defe", page);
}

export function HEAD() {
  return formResponse("defe", null);
}
