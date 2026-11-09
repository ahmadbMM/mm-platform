// micromobility.sa/lockers: the lockers page, where a rider (with an account, or making one there) reserves a locker
// for an evening from a drawing of the cabinet (the owner, 2026-11-09), served as the page forms/lockers builds.
// Outside the proxy on purpose (proxy.ts matcher), so Coming Soon never covers it. A locker's own tag,
// /lockers/7, does go through the proxy: a staff phone on to the staff app, a rider here with ?locker=7.
import page from "../../forms/lockers-page";
import { formResponse } from "../../forms/headers";

export const dynamic = "force-dynamic";

export function GET() {
  return formResponse("lockers", page);
}

export function HEAD() {
  return formResponse("lockers", null);
}
