"use client";

import SiteForm, { type FormRun } from "./SiteForm";
import { markup } from "@/forms/site/community.markup";
import run from "@/forms/site/community.run.js";
import "@/forms/site/community.css";

// The Community Membership Application (forms/community), on its page of the website.
export default function CommunitySiteForm({ lang }: { lang: string }) {
  return <SiteForm name="community" markup={markup} run={run as FormRun} lang={lang} />;
}
