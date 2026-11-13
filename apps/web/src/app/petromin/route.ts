// micromobility.sa/petromin?classic=1: the registration for the Petromin nights (Petromin's, Petrolube's and Dukan's
// employees and Petromin's invited guests, one page since 2026-11-13), served as the page forms/petromin builds (the
// website's own page for it is app/[locale]/petromin). Outside the proxy on purpose, so Coming Soon never covers it.
import page from "../../forms/petromin-page";
import { formResponse } from "../../forms/headers";

export const dynamic = "force-dynamic";

export function GET() {
  return formResponse("petromin", page);
}

export function HEAD() {
  return formResponse("petromin", null);
}
