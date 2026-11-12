// micromobility.sa/dukan?classic=1: Dukan's employees' registration for the partner nights, served as the page
// forms/dukan builds (the website's own page for it is app/[locale]/dukan). Outside the proxy on purpose, so Coming Soon
// never covers it.
import page from "../../forms/dukan-page";
import { formResponse } from "../../forms/headers";

export const dynamic = "force-dynamic";

export function GET() {
  return formResponse("dukan", page);
}

export function HEAD() {
  return formResponse("dukan", null);
}
