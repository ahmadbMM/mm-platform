// micromobility.sa/petromin: the Petromin and Petrolube rider registration, served as the page
// forms/petromin builds. The page reports the first path segment as the registration's
// source, so another partner is another folder here re-exporting this route (and its address
// in proxy.ts). Outside the proxy on purpose, so Coming Soon never covers it.
import page from "../../forms/petromin-page";
import { formResponse } from "../../forms/headers";

export const dynamic = "force-dynamic";

export function GET() {
  return formResponse("petromin", page);
}

export function HEAD() {
  return formResponse("petromin", null);
}
