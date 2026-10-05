"use client";

import { signOut } from "./quiet";

// Signing out here forgets this site's cookie only; the booking app stays signed in.
export default function SignOut({ label }: { label: string }) {
  return (
    <button type="button" className="ac-out" onClick={signOut}>{label}</button>
  );
}
