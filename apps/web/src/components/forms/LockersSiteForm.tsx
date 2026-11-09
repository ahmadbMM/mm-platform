"use client";

import SiteForm, { type FormRun } from "./SiteForm";
import { markup } from "@/forms/site/lockers.markup";
import run from "@/forms/site/lockers.run.js";
import "@/forms/site/lockers.css";

// The lockers page (forms/lockers): a locker reserved from a drawing of the cabinet, on its page of the website.
export default function LockersSiteForm({ lang }: { lang: string }) {
  return <SiteForm name="lockers" markup={markup} run={run as FormRun} lang={lang} />;
}
