"use client";

import type { MkListingMine } from "@/lib/market/core";
import MkModal from "../MkModal";
import type { MkWords } from "../Market.text";
import type { W2Words } from "../w2.text";

// "Delete this listing?": the one confirm before a listing or a draft is deleted, centred like every pop-up. It names
// the listing by the title its seller wrote, and says a refusal in its own box rather than closing on it.
export default function ConfirmDelete({ l, t, m, busy, error, onCancel, onConfirm }: {
  l: Pick<MkListingMine, "status" | "title">; t: MkWords; m: W2Words; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <MkModal title={l.status === "draft" ? m.delDraftTitle : m.delTitle} onClose={onCancel} busy={busy}>
      <p className="mk-w2-about"><bdi dir="auto">{l.title?.trim() || m.untitled}</bdi></p>
      {error && <p className="mk-err mk-w2-poperr" role="alert">{error}</p>}
      <div className="mk-pop-acts">
        <button type="button" className="mk-btn2" onClick={onCancel} disabled={busy}>{t.cancel}</button>
        <button type="button" className="mk-btn2 mk-btn-red" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>{m.act.delete}</button>
      </div>
    </MkModal>
  );
}
