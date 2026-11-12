"use client";

import SiteForm, { type FormRun } from "./SiteForm";
import { markup } from "@/forms/site/petromin-invite.markup";
import run from "@/forms/site/petromin-invite.run.js";
import "@/forms/site/petromin-invite.css";

// The booking of Petromin's invited guests for its bike nights (forms/petromin-invite), on its page of the website.
export default function PetrominInviteSiteForm({ lang }: { lang: string }) {
  return <SiteForm name="petromin-invite" markup={markup} run={run as FormRun} lang={lang} />;
}
