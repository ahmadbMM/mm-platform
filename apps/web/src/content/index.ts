import type { PageSchema } from "@/content/types";
import { homeSchema } from "@/content/pages/home";
import { siteSchema } from "@/content/pages/site";
import { workshopSchema } from "@/content/pages/workshop";
import { businessSchema } from "@/content/pages/business";
import { helpSchema } from "@/content/pages/help";
import { ambassadorsSchema } from "@/content/pages/ambassadors";
import { clubSchema } from "@/content/pages/club";

// Every page staff can edit, in the order the staff page lists them. Adding a page here is all
// it takes for the staff editor to offer it (it reads /api/site-schema).
export const PAGES: PageSchema[] = [siteSchema, homeSchema, workshopSchema, businessSchema, helpSchema, ambassadorsSchema, clubSchema];

/** The public pages and whether they exist yet. The staff page's page list mirrors this. */
export const BUILT_PAGES = { home: true, workshop: true, business: true, help: true, ambassadors: true, club: true } as const;
