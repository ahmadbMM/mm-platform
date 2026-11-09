"use client";

import SiteForm, { type FormRun } from "./SiteForm";
import { markup } from "@/forms/site/defe.markup";
import run from "@/forms/site/defe.run.js";
import "@/forms/site/defe.css";

// The Defe x MicroMobility booking for the Saturday Social Ride (forms/defe), on its page of the website.
export default function DefeSiteForm({ lang }: { lang: string }) {
  return <SiteForm name="defe" markup={markup} run={run as FormRun} lang={lang} />;
}
