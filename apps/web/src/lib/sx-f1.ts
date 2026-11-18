// The security review of 2026-11-18, fixed by F1 (the store and Experiences "do all" build): small pure pieces the
// routes use, kept here so they can be tested.

/** A store-claims name the database handed this server for the order (store_after_photo_slot, review M2):
 *  o<number>/<32 hex>.jpg in that order's own folder, nothing else. */
export function claimPhotoPathOk(p: string, no: number): boolean {
  return p.startsWith(`o${no}/`) && /^o[0-9]{1,9}\/[0-9a-f]{32}\.jpg$/.test(p);
}
