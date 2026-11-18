import { describe, expect, it } from "vitest";
import { resolvePage } from "../content";
import { HELP_TOPICS, helpSchema } from "@/content/pages/help";

// micromobility.sa/help's "Rides & bookings" tab (2026-11-16): the second tab, its answers the booking app's Account > Help
// shows too (rider-help.js RH_QA, whose English and Arabic these are word for word; it finds its own translations by this
// English). The other tabs keep their ids, which are where staff's saved answers live (site_content help.topics.<id>).
describe("the Help page's Rides & bookings tab", () => {
  it("is the second tab, the others keeping their ids", () => {
    expect([...HELP_TOPICS]).toEqual(["faq", "rides", "delivery", "returns", "warranty"]);
    const ids = helpSchema.sections.find((s) => s.id === "topics")!.fields.map((f) => f.id);
    expect(ids).toEqual(["faqTab", "faq", "ridesTab", "rides", "deliveryTab", "delivery", "returnsTab", "returns", "warrantyTab", "warranty"]);
  });
  it("holds the booking app's six answers, in English and Arabic as written there", () => {
    const en = resolvePage(helpSchema, null, "en").topics, ar = resolvePage(helpSchema, null, "ar").topics;
    expect(en.ridesTab).toBe("Rides & bookings");
    expect(ar.ridesTab).toBe("الجولات والحجوزات");
    expect((en.rides as { q: string }[]).map((x) => x.q)).toEqual(["How do I book?", "Can I cancel my booking?", "Where do we meet?", "Do I need my own helmet?", "What if I need help during a ride?", "I left something behind."]);
    expect((ar.rides as { q: string }[])[5].q).toBe("نسيت شيئاً بعد الجولة.");
    expect((resolvePage(helpSchema, null, "fr").topics.rides as { q: string }[])[0].q).toBe("Comment réserver ?");
  });
});
