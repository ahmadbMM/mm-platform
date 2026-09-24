"use client";

// Signing out here forgets this site's cookie only; the booking app stays signed in.
export default function SignOut({ label }: { label: string }) {
  return (
    <button type="button" className="ac-out" onClick={() => fetch("/api/account", { method: "DELETE" }).finally(() => window.location.reload())}>{label}</button>
  );
}
