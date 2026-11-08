// micromobility.sa/saturday: the Saturday Social Ride's booking page, where riders book with a ride code staff give
// out (the owner, 2026-11-08), served as the page forms/saturday builds. Outside the proxy on purpose (proxy.ts
// matcher), so Coming Soon never covers it.
import page from "../../forms/saturday-page";
import { formResponse } from "../../forms/headers";

export const dynamic = "force-dynamic";

export function GET() {
  return formResponse("saturday", page);
}

export function HEAD() {
  return formResponse("saturday", null);
}
