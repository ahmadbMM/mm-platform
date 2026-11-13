"use client";

import SiteForm, { type FormRun } from "./SiteForm";
import { markup } from "@/forms/site/petromin.markup";
import run from "@/forms/site/petromin.run.js";
import "@/forms/site/petromin.css";

// The registration for the Petromin nights (forms/petromin: Petromin's, Petrolube's and Dukan's employees, and Petromin's
// invited guests), on its page of the website.
export default function PetrominSiteForm({ lang }: { lang: string }) {
  return <SiteForm name="petromin" markup={markup} run={run as FormRun} lang={lang} />;
}
