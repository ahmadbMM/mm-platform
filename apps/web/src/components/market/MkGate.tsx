import type { ReactNode } from "react";
import type { Session } from "@/lib/account-core";
import MkSignIn from "./MkSignIn";
import "@/components/account/account.css";

// The sign-in gate of a Marketplace page that needs an account (selling, My listings, the inbox, My shop, a shop's
// application): the page's own content for a signed-in visitor, the site's sign-in form for anyone else. It is a file
// of its own so that the pages anyone may read (browse, a listing, a shop, the rules) do not carry the form.
//   session   the account cookie's session, from lib/market/server.ts mkSession(); null draws the sign-in form
//   title     the form's heading when "Sign in to use the Marketplace" is not the one wanted
// The cookie alone decides here; the database checks the session itself on every call, and answers "signin" for one it
// no longer accepts.
export default function MkGate({ locale, session, title, children }: { locale: string; session: Session | null; title?: string; children: ReactNode }) {
  return session ? <>{children}</> : <MkSignIn locale={locale} title={title} />;
}
