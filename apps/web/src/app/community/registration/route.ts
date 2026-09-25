// micromobility.sa/community/registration: the community membership application, served as the
// page forms/community builds. Its link-preview image is public/community/registration/og-image.png.
// Outside the proxy on purpose (proxy.ts matcher), so Coming Soon never covers it.
import page from "../../../forms/community-page";
import { formResponse } from "../../../forms/headers";

export const dynamic = "force-dynamic";

export function GET() {
  return formResponse("community", page);
}

export function HEAD() {
  return formResponse("community", null);
}
