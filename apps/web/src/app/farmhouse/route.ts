// micromobility.sa/farmhouse: the Farmhouse Night's booking page, where anyone with the code MicroMobility gives out books
// the night, account and all (the user, 2026-11-15), served as the page forms/farmhouse builds. Outside the proxy on
// purpose (proxy.ts matcher), so Coming Soon never covers it.
import page from "../../forms/farmhouse-page";
import { formResponse } from "../../forms/headers";

export const dynamic = "force-dynamic";

export function GET() {
  return formResponse("farmhouse", page);
}

export function HEAD() {
  return formResponse("farmhouse", null);
}
