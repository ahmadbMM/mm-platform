import { describe, expect, it } from "vitest";
import { learnTeaser } from "@/components/learn/LearnTeaser";
import { experiencesSchema } from "@/content/pages/experiences";
import { resolvePage } from "../content";
import type { SiteContent } from "../site";

// Not taking learn-to-ride sign-ups (owner, 2026-10-04): staff switch Experiences > Learn to ride >
// "Taking sign-ups" off; the sign-up page and the question on Home and Experiences stay, and say
// sign-ups are closed (the closed texts) in place of the form and of the question's button. The
// switch is on until staff turn it off; "Offer lessons" off still hides it all.
const learn = (content: SiteContent | null, locale: "en" | "ar" | "de" = "en") => resolvePage(experiencesSchema, content, locale).learn;

describe("Taking sign-ups", () => {
  it("is on, with the closed texts ready, until staff turn it off", () => {
    const l = learn(null);
    expect(l.taking).toBe(true);
    expect(l.closedTitle).toBe("Sign-ups are closed for now");
    expect(l.closedText).toMatch(/not taking any new sign-ups/);
    expect(learn(null, "ar").closedTitle).toBe("التسجيل مغلق حالياً");
    expect(learn(null, "de").closedTitle).toBe("Anmeldungen sind derzeit geschlossen");
  });

  it("reads the stored switch", () => {
    expect(learn({ "experiences.learn.taking": false }).taking).toBe(false);
    expect(learn({ "experiences.learn.taking": true }).taking).toBe(true);
  });

  it("keeps the question, with the closed text and no button, while off", () => {
    const t = learnTeaser(learn({ "experiences.learn.taking": false, "experiences.learn.closedText": { en: "Back in November.", ar: "نعود في نوفمبر." } }));
    expect(t).toMatchObject({ title: "Never learned to ride? We'll teach you.", text: "Back in November.", button: "", closed: true });
  });

  it("asks the question with its button while on", () => {
    const t = learnTeaser(learn(null));
    expect(t).toMatchObject({ text: expect.stringMatching(/^Kids and adults welcome/), button: "Sign up for a lesson", closed: false });
  });

  it("is gone while lessons are not offered, whatever the sign-ups switch", () => {
    expect(learnTeaser(learn({ "experiences.learn.on": false }))).toBeNull();
    expect(learnTeaser(learn({ "experiences.learn.on": false, "experiences.learn.taking": false }))).toBeNull();
  });
});
