import type { PageSchema } from "@/content/types";
import { homeSchema } from "@/content/pages/home";
import { siteSchema } from "@/content/pages/site";
import { workshopSchema } from "@/content/pages/workshop";
import { businessSchema } from "@/content/pages/business";
import { helpSchema } from "@/content/pages/help";
import { ambassadorsSchema } from "@/content/pages/ambassadors";
import { clubSchema } from "@/content/pages/club";
import { experiencesSchema } from "@/content/pages/experiences";
import { aboutSchema } from "@/content/pages/about";
import { eventsSchema } from "@/content/pages/events";
import { gallerySchema } from "@/content/pages/gallery";
import { routesSchema } from "@/content/pages/routes";
import { journalSchema } from "@/content/pages/journal";
import { accountSchema } from "@/content/pages/account";
import { termsSchema } from "@/content/pages/terms";
import { bikesSchema } from "@/content/pages/bikes";

// Every page staff can edit, in the order the staff page lists them. Adding a page here is all
// it takes for the staff editor to offer it (it reads /api/site-schema).
export const PAGES: PageSchema[] = [siteSchema, homeSchema, experiencesSchema, workshopSchema, businessSchema, helpSchema, ambassadorsSchema, clubSchema, aboutSchema, eventsSchema, gallerySchema, routesSchema, journalSchema, accountSchema, termsSchema, bikesSchema];

/** The public pages and whether they exist yet. The staff page's page list mirrors this. */
export const BUILT_PAGES = { home: true, experiences: true, workshop: true, business: true, help: true, ambassadors: true, club: true, about: true, events: true, gallery: true, routes: true, journal: true, account: true, terms: true, bikes: true } as const;
