"use client";

import SiteForm, { type FormRun } from "./SiteForm";
import { markup } from "@/forms/site/farmhouse.markup";
import run from "@/forms/site/farmhouse.run.js";
import "@/forms/site/farmhouse.css";

// The Farmhouse Night's booking, with the code MicroMobility gives out (forms/farmhouse), on its page of the website.
export default function FarmhouseSiteForm({ lang }: { lang: string }) {
  return <SiteForm name="farmhouse" markup={markup} run={run as FormRun} lang={lang} />;
}
