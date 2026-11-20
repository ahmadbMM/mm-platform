import { readCapped } from "@/lib/capped-body";
import { listingIdOf, mkSmallName } from "@/lib/market/core";
import { marketGuard, mkJson, mkRefuse } from "@/lib/market/route";
import { mkPhotoSlot, mkStorePut } from "@/lib/market/server";
import { W2_PHOTO_TYPE, w2PairRefusal, w2Photo } from "@/lib/market/w2-photo";

// POST /api/market/photo: one photo of a listing (or a shop's logo) is stored, in its two copies.
// Body: multipart/form-data with `for` ("listing" | "shop"), `ref` (the listing's number; empty for a shop), `full`
// (the photo, longest side 1,600px, 800,000 bytes at most) and `small` (its 480px copy, 200,000 bytes at most). Both
// copies are made in the seller's browser by drawing the picture again, which leaves a camera's own data behind.
//
// In this order, and nothing is stored before the last step:
//   1. the guard: this site's own page, the account from its HttpOnly cookie, the account's photo count for the minute;
//   2. the body read to a byte limit whatever its Content-Length says, then read as a form;
//   3. each copy checked by its own bytes, never its name or the type the browser claimed (lib/market/w2-photo.ts):
//      a whole JPEG or WebP picture, the two of the same kind, inside their byte and pixel limits. A copy that still
//      carries a camera's Exif block was not drawn again and is refused. Every other part that describes the picture
//      rather than draws it (XMP, IPTC, comments, anything after its end) is taken out of what is stored;
//   4. the database issues a one-use name for this account's own listing or shop (market_photo_slot), good for ten
//      minutes; its refusals come back as they are ("gone", "state", "suspended", "limit" + "photos");
//   5. the two copies are stored at that name and its small name with the public key: the bucket takes a file only at
//      an issued, unused name.
// Answers {ok: true, name} (the full copy's name, to put in the listing's `photos` or the shop's `logo`), or
// {ok: false, error}: "invalid" 400, "too_big" 413, "generic" 502 (the storage did not keep it).
export const dynamic = "force-dynamic";

const MAX = 1_050_000; // the two copies and the form around them

async function formOf(req: Request, bytes: Uint8Array): Promise<FormData | null> {
  const type = req.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\b/i.test(type)) return null;
  try { return await new Request("https://form.invalid/", { method: "POST", headers: { "content-type": type }, body: bytes as Uint8Array<ArrayBuffer> }).formData(); } catch { return null; }
}
const bytesOf = async (v: FormDataEntryValue | null): Promise<Uint8Array<ArrayBuffer> | null> => (v && typeof v !== "string" ? new Uint8Array(await v.arrayBuffer()) : null);

export async function POST(req: Request) {
  const g = await marketGuard(req, { raw: true, kind: "market-photo", max: MAX });
  if (!g.ok) return g.res;
  const body = await readCapped(req, MAX);
  if (!body) return mkRefuse("too_big", 413);
  const form = await formOf(req, body);
  if (!form) return mkRefuse("invalid", 400);

  const target = form.get("for"), refText = form.get("ref");
  if (target !== "listing" && target !== "shop") return mkRefuse("invalid", 400);
  const ref = target === "listing" ? listingIdOf(refText) : null;
  if (target === "listing" ? ref === null : refText !== null && refText !== "") return mkRefuse("invalid", 400);

  const [fullBytes, smallBytes] = await Promise.all([bytesOf(form.get("full")), bytesOf(form.get("small"))]);
  if (!fullBytes || !smallBytes) return mkRefuse("invalid", 400);
  const full = w2Photo(fullBytes), small = w2Photo(smallBytes);
  const no = w2PairRefusal({ bytes: fullBytes.length, photo: full }, { bytes: smallBytes.length, photo: small });
  if (no || !full || !small) return mkRefuse(no ?? "invalid", no === "too_big" ? 413 : 400);

  const slot = await mkPhotoSlot(g.session, target, ref, full.kind, req);
  if (!slot.ok) return mkRefuse(slot.error, slot.status, slot.detail);
  const name = slot.data.name, type = W2_PHOTO_TYPE[full.kind];
  if (!name.endsWith(`.${full.kind}`)) return mkRefuse("generic", 502);
  if (!(await mkStorePut(name, full.clean, type))) return mkRefuse("generic", 502);
  // the small copy once more if the storage did not answer: the photo is shown from its full copy without it, but a
  // grid of full copies is a slow page
  const smallName = mkSmallName(name);
  if (!(await mkStorePut(smallName, small.clean, type)) && !(await mkStorePut(smallName, small.clean, type))) return mkRefuse("generic", 502);
  return mkJson({ ok: true, name });
}
