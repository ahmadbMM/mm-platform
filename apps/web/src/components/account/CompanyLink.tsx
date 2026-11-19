"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { companyCode, companyKept, companyParked } from "@/lib/company-link";
import { COMPANY_CODE } from "./quiet";

// A company challenge's join link (micromobility.sa/account/company?company=CODE; the booking app's /?company=CODE,
// 8e7d29c7 and d37438da): the code comes off the address and is kept on this device (lib/company-link.ts) until the rider
// is signed in, through the sign-in or the booking app's sign-up and its way back. Signed in, with a code kept, the
// account opens its Company challenge page, which joins with it at once (AccCompany). A Log out drops it (quiet.ts).
export default function CompanyLink({ signedIn, onPage }: { signedIn: boolean; onPage: boolean }) {
  const router = useRouter();
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has("company")) {
        const c = companyCode(u.searchParams.get("company"));
        if (c) localStorage.setItem(COMPANY_CODE, companyKept(c));
        u.searchParams.delete("company");
        window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
      }
      if (signedIn && !onPage && companyParked(localStorage.getItem(COMPANY_CODE))) router.replace("/account/company");
    } catch { /* storage off: the code box is there to type it */ }
  }, [signedIn, onPage, router]);
  return null;
}

/** The code kept from a link, taken off the device (joined with at once, whatever the answer); "" for none. */
export function takeParkedCode(): string {
  try {
    const c = companyParked(localStorage.getItem(COMPANY_CODE));
    localStorage.removeItem(COMPANY_CODE);
    return c;
  } catch { return ""; }
}
