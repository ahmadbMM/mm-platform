"use client";

import { inviteText } from "@/lib/hub-feed";

// "Invite a friend to a Saturday social ride" at the foot of a member's area on /club (the booking app's _invShare and its
// Community tab's invitation card, 04e8a0d9 and dfcbfb05, the owner 2026-11-02): one full-width button that hands the app's
// own invitation, with the member's code in the community form's address (lib/hub-feed.ts inviteText), to the phone's
// share sheet, or to WhatsApp where there is none. The site sends nothing: the member sends the message and can change
// it first. The code is read with the page (member_invite_code), so the tap opens the sheet at once.
export default function InviteFriend({ code, locale, label, msg }: { code: string; locale: string; label: string; msg: string }) {
  async function share() {
    const text = inviteText(msg, code, locale);
    if (navigator.share) {
      try { await navigator.share({ text }); return; }
      catch (e) { if ((e as { name?: string })?.name === "AbortError") return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }
  return (
    <section className="club-hub club-hub-inv">
      <button type="button" className="club-hub-btn" onClick={() => void share()}>
        {label}
      </button>
    </section>
  );
}
