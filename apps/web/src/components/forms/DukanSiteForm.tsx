"use client";

import SiteForm, { type FormRun } from "./SiteForm";
import { markup } from "@/forms/site/dukan.markup";
import run from "@/forms/site/dukan.run.js";
import "@/forms/site/dukan.css";

// Dukan's employees' bike registration (forms/dukan), on its page of the website.
export default function DukanSiteForm({ lang }: { lang: string }) {
  return <SiteForm name="dukan" markup={markup} run={run as FormRun} lang={lang} />;
}
