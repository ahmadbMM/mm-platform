import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { T as M } from "@/components/market/Market.text";
import { T } from "@/components/market/w4.text";
import { MK_LIMITS_DEFAULT, MK_RULES, MK_SHOP_APPLY, MK_TERMS_VERSION_DEFAULT, mkClean, mkSettings } from "../market/core";
import {
  W4_ANCHORS, W4_COMPLAINT_DAYS, W4_RULES_VERSION, rulesHref, w4ArDays, w4EnDays, w4Inline, w4LinkOk, w4Pct, w4Plain, w4Rules, w4RulesDay,
  w4RulesLang, w4RulesOwn, w4RulesText, type W4Rules, type W4RulesInput,
} from "../market/w4-rules";

// The Marketplace's rules (W4): the page's sections and their addresses, the numbers the settings put in the text,
// the links a sentence may carry, and above all what the text must never say: nothing in it promises protection, a
// guarantee, a refund or compensation from MicroMobility for someone else's item.

const render = renderUntyped as (el: ReactElement) => string;
const input = (over: Partial<W4RulesInput> = {}, content: Record<string, unknown> = {}): W4RulesInput => ({
  settings: mkSettings(content), email: "info@micromobility.sa", whatsapp: "https://wa.me/966566668818", ...over,
});
const en = (i = input()) => w4Rules("en", i);
const ar = (i = input()) => w4Rules("ar", i);
const all = (r: W4Rules) => w4RulesText(r).join("\n");
const section = (r: W4Rules, id: string) => {
  const s = r.sections.find((x) => x.id === id);
  if (!s) throw new Error(`no section ${id}`);
  return w4RulesText({ intro: "", sections: [s] }).join("\n");
};
const shape = (r: W4Rules) => r.sections.map((s) => [s.id, s.blocks.map((b) => ("ul" in b ? `ul${b.ul.length}` : "groups" in b ? `g${b.groups.map((g) => g.items.length).join(".")}` : Object.keys(b)[0]))]);

describe("the rules' version", () => {
  it("is the version the database starts with, which a seller's acceptance and a shop's agreement record", () => {
    expect(W4_RULES_VERSION).toBe(MK_TERMS_VERSION_DEFAULT);
    expect(mkSettings(null).termsVersion).toBe(W4_RULES_VERSION);
    expect(w4RulesDay(W4_RULES_VERSION)).toBe("2026-11-21");
  });
  it("is written as a date only when it is one", () => {
    for (const v of ["v2", "2026-13-01", "2026-02-30", "20261121", ""]) expect(w4RulesDay(v), v).toBeNull();
  });
});

describe("the rules' sections", () => {
  it("are the twelve the page promises, in the same order in both languages, each with an address", () => {
    expect(W4_ANCHORS).toEqual(["how", "who", "promise", "not-allowed", "restricted", "safety", "commission", "reports", "complaints", "data", "shops", "changes"]);
    expect(en().sections.map((s) => s.id)).toEqual([...W4_ANCHORS]);
    expect(ar().sections.map((s) => s.id)).toEqual([...W4_ANCHORS]);
    expect(rulesHref("safety")).toBe(`${MK_RULES}#safety`);
    expect(rulesHref()).toBe(MK_RULES);
  });
  it("say the same things in Arabic as in English: block for block, item for item", () => {
    expect(shape(ar())).toEqual(shape(en()));
    const off = input({}, { "marketplace.commission_pct": 0 });
    expect(shape(w4Rules("ar", off))).toEqual(shape(w4Rules("en", off)));
  });
  it("are English everywhere but on the Arabic page, with no extra line telling the other languages so", () => {
    expect(w4RulesLang("ar")).toBe("ar");
    for (const l of ["en", "ur", "fr", "hi"]) expect(w4RulesLang(l)).toBe("en");
    expect(w4RulesOwn("en")).toBe(true);
    expect(w4RulesOwn("ar")).toBe(true);
    expect(w4RulesOwn("ur")).toBe(false);
    expect("rulesNote" in T.en || "rulesNote" in T.ar).toBe(false);
    expect(/[؀-ۿ]/.test(all(en()))).toBe(false);
    expect(/[؀-ۿ]/.test(all(ar()))).toBe(true);
  });
  it("are plain words: no pictographs, no markup, no long dashes, and the company's name as it is written", () => {
    for (const r of [en(), ar()]) {
      for (const line of w4RulesText(r)) {
        expect(mkClean(line.replace(/[⁦⁩]/g, "")), line).toBe(line.replace(/[⁦⁩]/g, "").replace(/\s+/g, " ").trim());
        expect(/[<>]|[—–]/.test(line), line).toBe(false);
        expect(/micromobility/i.test(line.replace(/MicroMobility/g, "").replace(/info@micromobility\.sa/g, "")), line).toBe(false);
      }
    }
  });
});

describe("what the rules say", () => {
  it("say MicroMobility shows the listings and the sale is between the two people", () => {
    const how = section(en(), "how");
    expect(how).toContain("MicroMobility shows the listings. The sale, the payment and the handover are between the buyer and the seller.");
    // "someone else's item": MicroMobility is paid for what it sells itself, and the sentence before says so
    expect(how).toContain("takes no payment for someone else’s item and holds no money");
    expect(how).not.toContain("takes no payment for an item");
    expect(how).toContain("is not a party to the sale");
    const howAr = section(ar(), "how");
    expect(howAr).toContain("تعرض MicroMobility الإعلانات. أما البيع والدفع والتسليم فبين المشتري والبائع.");
    expect(howAr).toContain("وليست طرفاً في البيع");
    expect(howAr).toContain("لا تأخذ MicroMobility ثمن غرض يبيعه غيرها، ولا تحتفظ بمال لأحد.");
  });
  it("never promise protection, a guarantee, a refund or compensation from MicroMobility for someone else's item", () => {
    const risky = /warrant|guarantee|refund|compensat|protect|insur|money back|reimburse|cover(s|ed)? (you|the buyer)/i;
    const denies = /\b(no|not|never|nothing|nobody)\b/i;
    for (const line of w4RulesText(en())) {
      // the gear category "protective gear" is not a promise
      const said = line.replace(/protective gear/gi, "");
      for (const sentence of said.split(/(?<=[.:])\s+/)) {
        if (!risky.test(sentence)) continue;
        // either it says MicroMobility does not, or it is the shop's own duty to its customers
        expect(denies.test(sentence) || /\bits own\b/.test(sentence), sentence).toBe(true);
      }
    }
    const riskyAr = /ضمان|تعويض|استرداد|استرجاع المبلغ|حماية المشتري|تأمين/;
    for (const line of w4RulesText(ar())) {
      for (const sentence of line.replace(/معدات الحماية/g, "").split(/(?<=[.:])\s+/)) {
        if (!riskyAr.test(sentence)) continue;
        expect(/(^|\s)(لا|ليست|ليس|ولا)(\s|$)/.test(sentence) || sentence.includes("يتحمل هو"), sentence).toBe(true);
      }
    }
    expect(all(en())).toContain("MicroMobility gives no warranty, no refund and no compensation for an item sold by someone else.");
    expect(all(ar())).toContain("لا تقدّم MicroMobility ضماناً ولا استرداداً ولا تعويضاً عن غرض يبيعه غيرها.");
  });
  it("list everything that may not be sold, grouped", () => {
    const text = section(en(), "not-allowed").toLowerCase();
    for (const item of ["air rifles", "guns", "ammunition", "airsoft", "bows", "crossbows", "spearguns", "knives", "blades", "martial-arts weapons", "pepper spray", "tasers",
      "drones", "medicines", "supplements", "sports nutrition", "lithium batteries", "used lithium batteries", "recalled", "counterfeit", "stolen"]) expect(text, item).toContain(item);
    const groups = en().sections.find((s) => s.id === "not-allowed")?.blocks.find((b) => "groups" in b);
    expect(groups && "groups" in groups ? groups.groups.map((g) => g.title) : []).toEqual(["Weapons", "Drones", "Medicines and nutrition", "Batteries", "Fake, recalled or stolen"]);
    const textAr = section(ar(), "not-allowed");
    for (const item of ["بنادق الهواء", "الذخيرة", "الإيرسوفت", "الأقواس", "السكاكين", "رذاذ الفلفل", "الدرون", "الأدوية", "المكملات", "الليثيوم", "المقلدة", "المسحوبة", "المسروقات"]) expect(textAr, item).toContain(item);
  });
  it("say what is sold new only, what needs a declaration, and what needs a frame number", () => {
    const text = section(en(), "restricted");
    for (const item of ["Helmets", "protective gear", "Swimwear", "Base layers", "complete device", "not been modified", "25 km/h or less", "original charger", "last three characters", "Gloves and pads only"]) expect(text, item).toContain(item);
    const textAr = section(ar(), "restricted");
    for (const item of ["الخوذات", "معدات الحماية", "ملابس السباحة", "25 كم/س", "شاحنه الأصلي", "آخر ثلاث خانات"]) expect(textAr, item).toContain(item);
  });
  it("tell people how to stay safe", () => {
    const text = section(en(), "safety");
    for (const item of ["public place", "Check the item before you pay", "Never pay through a link", "verification code", "password", "never asks you to pay for someone else’s item", "never holds money"]) expect(text, item).toContain(item);
    const textAr = section(ar(), "safety");
    for (const item of ["مكان عام", "افحص الغرض قبل أن تدفع", "لا تدفع أبداً عبر رابط", "رمز تحقق", "كلمة مرور"]) expect(textAr, item).toContain(item);
  });
  it("say who may sell, what a seller promises, and what staff do with a report", () => {
    expect(section(en(), "who")).toContain("aged 18 or over");
    expect(section(en(), "who")).toContain("once our team has approved them");
    const promise = section(en(), "promise");
    for (const item of ["yours to sell", "description is honest", "real photos", "one item"]) expect(promise, item).toContain(item);
    const reports = section(en(), "reports");
    for (const item of ["Report button", "hide a listing", "strike", "pause the account or the shop", "never told who reported"]) expect(reports, item).toContain(item);
  });
  it("keep a complaint about the Marketplace apart from a dispute about an item", () => {
    const text = section(en(), "complaints");
    expect(text).toContain(`We answer within ${W4_COMPLAINT_DAYS} working days.`);
    expect(text).toContain("info@micromobility.sa");
    expect(text).toContain("is between the buyer and the seller");
    expect(text).toContain("It does not decide who is right");
    expect(text).toContain("Commerce Ministry");
    expect(section(ar(), "complaints")).toContain(`نردّ خلال ${W4_COMPLAINT_DAYS} أيام عمل.`);
  });
  it("say how data is used: what each side sees, 12 months of messages, staff only on a report, frame numbers, the record", () => {
    const text = section(en(), "data");
    for (const item of ["first name and the first letter of your last name", "or no name", "12 months", "only when one of the two people in it reports it", "Frame and serial numbers are stored in full",
      "kept after a listing is deleted", "lawful request", "Privacy Notice"]) expect(text, item).toContain(item);
    const textAr = section(ar(), "data");
    for (const item of ["12 شهراً", "إلا إذا أبلغ عنها أحد طرفيها", "إشعار الخصوصية"]) expect(textAr, item).toContain(item);
  });
  it("promise a week's notice of a change", () => {
    expect(section(en(), "changes")).toContain("at least one week before the change takes effect");
    expect(section(ar(), "changes")).toContain("قبل أسبوع على الأقل");
  });
});

describe("the settings in the rules", () => {
  it("write the commission staff set, in one paragraph, and staff's own way to pay it as written", () => {
    const one = en().sections.find((s) => s.id === "commission");
    expect(one?.blocks).toHaveLength(1);
    expect(section(en(), "commission")).toContain("a commission of 1% of the price it sold for");
    expect(section(en(), "commission")).toContain("nothing is taken automatically and nothing is enforced");
    const set = input({}, { "marketplace.commission_pct": 2.5, "marketplace.commission_how": { en: "Pay at the hub or by [transfer](https://evil.example).", ar: "ادفع في المقر." } });
    expect(section(w4Rules("en", set), "commission")).toContain("a commission of 2.5%");
    expect(w4Rules("en", set).sections.find((s) => s.id === "commission")?.blocks[1]).toEqual({ plain: "Pay at the hub or by [transfer](https://evil.example)." });
    expect(w4Rules("ar", set).sections.find((s) => s.id === "commission")?.blocks[1]).toEqual({ plain: "ادفع في المقر." });
    expect(section(w4Rules("ar", set), "commission")).toContain("2.5%");
  });
  it("say there is no commission when it is switched off", () => {
    const off = input({}, { "marketplace.commission_pct": 0 });
    expect(section(w4Rules("en", off), "commission")).toContain("asks for no commission at present");
    expect(section(w4Rules("en", off), "commission")).not.toContain("%");
    expect(section(w4Rules("ar", off), "commission")).toContain("لا تطلب MicroMobility أي عمولة حالياً");
  });
  it("write a listing's days and the limits as staff keep them", () => {
    expect(section(en(), "how")).toContain("stays on sale for 60 days");
    expect(section(en(), "who")).toContain("2 for a new account, 10 for an older account, 200 for a shop");
    expect(section(en(), "who")).toContain("3,000");
    expect(section(en(), "shops")).toContain("20 listings on sale in its first 14 days, and 200 after that");
    const set = input({}, { "marketplace.listing_days": 30, "marketplace.limits": { ...MK_LIMITS_DEFAULT, new: { ...MK_LIMITS_DEFAULT.new, live: 1, price_max: 1500 }, shop: { live_first: 50, first_days: 0, live: 50 } } });
    expect(section(w4Rules("en", set), "how")).toContain("for 30 days");
    expect(section(w4Rules("en", set), "who")).toContain("1 for a new account");
    expect(section(w4Rules("en", set), "who")).toContain("1,500");
    expect(section(w4Rules("en", set), "shops")).toContain("A shop can have 50 listings on sale.");
    expect(section(w4Rules("ar", set), "how")).toContain("مدة 30 يوماً");
  });
  it("count days as each language does", () => {
    expect([1, 2, 60].map(w4EnDays)).toEqual(["1 day", "2 days", "60 days"]);
    expect([1, 2, 7, 10, 11, 60, 99, 100, 102, 103, 180].map(w4ArDays)).toEqual(["يوم واحد", "يومان", "7 أيام", "10 أيام", "11 يوماً", "60 يوماً", "99 يوماً", "100 يوم", "102 يوم", "103 أيام", "180 يوماً"]);
    expect([1, 1.5, 2.25, 10].map(w4Pct)).toEqual(["1", "1.5", "2.25", "10"]);
  });
  it("reach MicroMobility by what staff set for the site, and say where to look when nothing is set", () => {
    expect(section(en(input({ whatsapp: null })), "complaints")).toContain("write to us at info@micromobility.sa.");
    expect(section(en(input({ email: "" })), "complaints")).toContain("write to us on WhatsApp.");
    expect(section(en(input({ email: "not an address", whatsapp: "https://example.com/chat" })), "complaints")).toContain("the contact details at the foot of this page");
    expect(section(ar(input({ email: "", whatsapp: null })), "complaints")).toContain("بيانات التواصل في أسفل هذه الصفحة");
  });
});

describe("a link inside a sentence", () => {
  it("is read only for this site's pages, a place on the page, an email and a WhatsApp chat", () => {
    for (const ok of ["/terms", "/privacy", MK_SHOP_APPLY, "/marketplace/rules#safety", "#shops", "mailto:info@micromobility.sa", "https://wa.me/966566668818"]) expect(w4LinkOk(ok), ok).toBe(true);
    for (const no of ["https://evil.example", "//evil.example", "javascript:alert(1)", "http://wa.me/966566668818", "https://wa.me/abc", "mailto:x", "/a b", "data:text/html,x", "/terms?x=<script>"]) expect(w4LinkOk(no), no).toBe(false);
  });
  it("keeps the words and drops the link when the address is not one of those", () => {
    expect(w4Inline("See the [Terms](/terms) and the [notice](/privacy).")).toEqual([
      { text: "See the " }, { text: "Terms", href: "/terms" }, { text: " and the " }, { text: "notice", href: "/privacy" }, { text: "." },
    ]);
    expect(w4Inline("Pay by [transfer](https://evil.example).")).toEqual([{ text: "Pay by " }, { text: "transfer" }, { text: "." }]);
    expect(w4Inline("No links here.")).toEqual([{ text: "No links here." }]);
    expect(w4Plain("Read the [Privacy Notice](/privacy).")).toBe("Read the Privacy Notice.");
  });
  it("is used in the rules only for addresses of those kinds", () => {
    for (const r of [en(), ar()]) {
      let links = 0;
      for (const s of r.sections) for (const b of s.blocks) {
        const lines = "p" in b ? [b.p] : "ul" in b ? b.ul : [];
        for (const l of lines) for (const m of l.matchAll(/\]\(([^)]+)\)/g)) { links += 1; expect(w4LinkOk(m[1]), m[1]).toBe(true); }
      }
      expect(links).toBeGreaterThanOrEqual(5);
      expect(all(r)).not.toMatch(/\]\(/);
    }
  });
});

describe("the rules as the page draws them", () => {
  it("draw each section at its address, with its links, and staff's words as plain text", async () => {
    const { default: RulesBody, RulesContents } = await import("@/components/market/w4/RulesBody");
    const set = input({}, { "marketplace.commission_how": { en: "Pay <b>cash</b> at the hub, or [here](/terms).", ar: "" } });
    const rules = w4Rules("en", set);
    const html = render(createElement(RulesBody, { rules }));
    for (const id of W4_ANCHORS) expect(html, id).toContain(`<section id="${id}"`);
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="mailto:info@micromobility.sa"');
    expect(html).toContain('href="https://wa.me/966566668818" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain(`href="${MK_SHOP_APPLY}"`);
    expect(html).toContain("Pay &lt;b&gt;cash&lt;/b&gt; at the hub, or [here](/terms).");
    expect(html).not.toContain("<b>cash</b>");
    const toc = render(createElement(RulesContents, { rules }));
    expect((toc.match(/<li>/g) ?? []).length).toBe(W4_ANCHORS.length);
    expect(toc).toContain('<a href="#not-allowed">What may not be sold</a>');
  });
  it("has the words around the rules in both languages", () => {
    for (const k of ["rulesMeta", "onThisPage"] as const) { expect(T.en[k]).toBeTruthy(); expect(T.ar[k]).toBeTruthy(); }
    expect(T.en.version("v2")).toBe("Version v2");
    expect(M.en.rules).toBe("Marketplace rules");
  });
});
