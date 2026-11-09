"use client";

import SiteForm, { type FormRun } from "./SiteForm";
import { markup } from "@/forms/site/saturday.markup";
import run from "@/forms/site/saturday.run.js";
import "@/forms/site/saturday.css";

// The Saturday Social Ride's booking, with a ride code staff give out (forms/saturday), on its page of the website.
export default function SaturdaySiteForm({ lang }: { lang: string }) {
  return <SiteForm name="saturday" markup={markup} run={run as FormRun} lang={lang} />;
}
