import BrandField from "../BrandField";

/**
 * The brand loading state (docs/loading-screen-handoff.md).
 *
 * Worth knowing when this is and is not seen: a tag scan is a cold navigation, and the page
 * is server-rendered, so the rider goes straight from the browser's own loading to the
 * finished bike page — no flash of this screen, which is the better outcome. This covers the
 * in-app navigations, where React does have a wait to fill.
 */
export default function Loading() {
  return (
    <div className="bk-loading" role="status" aria-live="polite" aria-label="Loading">
      <BrandField />
      <span className="bk-spinner" aria-hidden="true">
        <span className="bk-ring" />
        <span className="bk-mark" />
      </span>
    </div>
  );
}
