// micromobility.sa/petromin-invite?classic=1: the booking of the people Petromin invites to its bike nights, served as the
// page forms/petromin-invite builds (the website's own page for it is app/[locale]/petromin-invite). Outside the proxy on
// purpose, so Coming Soon never covers it.
import page from "../../forms/petromin-invite-page";
import { formResponse } from "../../forms/headers";

export const dynamic = "force-dynamic";

export function GET() {
  return formResponse("petromin-invite", page);
}

export function HEAD() {
  return formResponse("petromin-invite", null);
}
