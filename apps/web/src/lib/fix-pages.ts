// Each detail an account can owe (customer_fix_fields: what staff asked the rider to correct, and what the server asks for
// itself, _customer_asks), by the page of My Account on this site that holds it (lib/account-menu.ts). The booking steps'
// pop-up and the check-up every page shows (FixGateLoader) send the rider there instead of to the booking app.
export const FIX_PAGES: Record<string, string> = {
  name: "/account/personal", birth_date: "/account/personal", nationality: "/account/personal", gender: "/account/personal", photo: "/account/personal",
  email: "/account/contact", phone: "/account/contact", whatsapp: "/account/contact",
  country: "/account/residence", city: "/account/residence",
  emergency: "/account/emergency", emergency_name: "/account/emergency", emergency_phone: "/account/emergency", emergency_relation: "/account/emergency",
  height: "/account/riding", type_preference: "/account/riding", sport: "/account/sport", instagram: "/account/about", password: "/account/password",
};

/** Where the check-up's Add details goes for what is owed: the first owed detail's own page here, or null when one of them
 *  has no page here - a password for an account that has none (the change page asks for the current one) or a key this site
 *  does not know - and the booking app's own check-up, which asks every one, must take it. */
export function fixPageFor(asks: readonly string[]): string | null {
  if (!asks.length || asks.some((k) => k === "password" || !FIX_PAGES[k])) return null;
  return FIX_PAGES[asks[0]];
}

/** Whether this address is the page of one of the owed details, where the rider puts it right: the check-up stays away. */
export function onFixPage(path: string, asks: readonly string[]): boolean {
  const p = path.replace(/\/+$/, "");
  return asks.some((k) => k !== "password" && FIX_PAGES[k] === p);
}
