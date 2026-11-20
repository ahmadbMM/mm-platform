import { MK_RULES, MK_SHOP_APPLY, mkAmtText, mkNum, mkWaDigits, type MkSettings } from "./core";

// The Marketplace's rules (micromobility.sa/marketplace/rules), W4: the terms of use, what may not be sold, staying
// safe, the commission, reports, complaints and disputes, how data is used, the shop agreement and how the rules
// change. Written by hand in English and Arabic only, as the site's Terms and Privacy Notice are: every other language
// reads the English, and the page says so in its own words. Nothing here is run through the translators' dictionaries
// (it is not a *.text.ts file), so a legal sentence is never a machine's guess.
//
// What the text must never do: promise protection, a guarantee, a refund or compensation from MicroMobility for
// someone else's item, set a term of someone else's sale, or say MicroMobility takes or holds money for one. The site
// shows the listing; the sale is between the two people. lib/__tests__/market-w4-rules.test.ts reads every sentence
// for that. The numbers in the text (the commission, a listing's days, the limits) are the settings staff keep, so
// the page and the database say the same.
//
// A sentence may carry a link as [words](address); only this site's own pages, a place on this page, an email and a
// WhatsApp chat are read as links (w4Inline), anything else stays plain words.

/** The date of the rules as written here. It is the value the database's 'marketplace.terms_version' starts with
 *  (lib/market/core.ts MK_TERMS_VERSION_DEFAULT), which the selling form records when a seller accepts the rules and
 *  the shop application records as the agreement. Change the words of the rules and this date together, then set
 *  'marketplace.terms_version' to it: every seller is then asked to accept the rules again. */
export const W4_RULES_VERSION = "2026-11-21";

/** The working days a complaint about the Marketplace itself is answered in. */
export const W4_COMPLAINT_DAYS = 5;

/** The page's sections, in order: each is an address on the page (/marketplace/rules#safety). */
export const W4_ANCHORS = ["how", "who", "promise", "not-allowed", "restricted", "safety", "commission", "reports", "complaints", "data", "shops", "changes"] as const;
export type W4Anchor = (typeof W4_ANCHORS)[number];
/** A section's address, for a link from another page: rulesHref("safety") is "/marketplace/rules#safety". */
export const rulesHref = (anchor?: W4Anchor): string => (anchor ? `${MK_RULES}#${anchor}` : MK_RULES);

export type W4Block =
  /** a paragraph */
  | { p: string }
  /** words staff wrote (the way to pay the commission), shown exactly as written: no link is read from them */
  | { plain: string }
  /** a heading inside a section */
  | { h: string }
  /** a list */
  | { ul: string[] }
  /** named groups of short items (what may not be sold) */
  | { groups: { title: string; items: string[] }[] };
export type W4Section = { id: W4Anchor; title: string; blocks: W4Block[] };
export type W4Rules = { intro: string; sections: W4Section[] };

export type W4RulesInput = {
  settings: Pick<MkSettings, "commissionPct" | "commissionHow" | "limits" | "listingDays">;
  /** MicroMobility's email as staff set it for the site ("" when none). */
  email: string;
  /** MicroMobility's WhatsApp link as staff set it for the site (a wa.me address), or null. */
  whatsapp: string | null;
};

/* ------------------------------------------------------------------ numbers in a sentence */

/** A percentage as people write it: 1, 1.5, 2.25 (never 1.00). */
export const w4Pct = (n: number): string => String(Math.round(n * 100) / 100);
/** "1 day", "60 days". */
export const w4EnDays = (n: number): string => `${mkNum(n)} ${n === 1 ? "day" : "days"}`;
/** Days in Arabic, with the noun the number takes: يوم واحد، يومان، 7 أيام، 60 يوماً، 100 يوم. */
export function w4ArDays(n: number): string {
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومان";
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${mkNum(n)} أيام`;
  if (r >= 11) return `${mkNum(n)} يوماً`;
  return `${mkNum(n)} يوم`;
}

/* ------------------------------------------------------------------ links inside a sentence */

export type W4Bit = { text: string; href?: string };
const OWN_PAGE = /^\/[A-Za-z0-9/_-]*(#[a-z0-9-]+)?$/;
const OWN_PLACE = /^#[a-z0-9-]+$/;
const EMAIL = /^mailto:[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const WA = /^https:\/\/wa\.me\/\d{8,15}$/;
/** Whether an address may be a link in the rules: a page of this site, a place on this page, an email, a WhatsApp chat. */
export const w4LinkOk = (href: string): boolean => (OWN_PAGE.test(href) && !href.startsWith("//")) || OWN_PLACE.test(href) || EMAIL.test(href) || WA.test(href);

/** A sentence as the page draws it: plain words, and the [words](address) parts as links when the address is one of
 *  the kinds allowed; with any other address the words stay and the link does not. */
export function w4Inline(text: string): W4Bit[] {
  const out: W4Bit[] = [];
  const re = /\[([^\][]+)\]\(([^()\s]+)\)/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > at) out.push({ text: text.slice(at, i) });
    out.push(w4LinkOk(m[2]) ? { text: m[1], href: m[2] } : { text: m[1] });
    at = i + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
/** The same sentence with its links taken out: what a search engine's description or a test reads. */
export const w4Plain = (text: string): string => w4Inline(text).map((b) => b.text).join("");

/** Every sentence of the rules, links taken out: for the tests, and for nothing else. */
export function w4RulesText(r: W4Rules): string[] {
  const out = [r.intro];
  for (const s of r.sections) {
    out.push(s.title);
    for (const b of s.blocks) {
      if ("p" in b) out.push(w4Plain(b.p));
      else if ("plain" in b) out.push(b.plain);
      else if ("h" in b) out.push(b.h);
      else if ("ul" in b) out.push(...b.ul.map(w4Plain));
      else for (const g of b.groups) out.push(g.title, ...g.items);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ the rules */

type Reach = { mail: string | null; wa: string | null };
function reachOf(i: W4RulesInput): Reach {
  const mail = `mailto:${i.email.trim()}`;
  const digits = mkWaDigits(i.whatsapp);
  return { mail: i.email.trim() && EMAIL.test(mail) ? i.email.trim() : null, wa: digits ? `https://wa.me/${digits}` : null };
}

function english(i: W4RulesInput): W4Rules {
  const { settings: s } = i;
  const l = s.limits, pct = s.commissionPct, how = s.commissionHow.en.trim();
  const r = reachOf(i);
  const reach = r.mail && r.wa ? `write to us at [${r.mail}](mailto:${r.mail}) or on [WhatsApp](${r.wa})`
    : r.mail ? `write to us at [${r.mail}](mailto:${r.mail})`
    : r.wa ? `write to us on [WhatsApp](${r.wa})`
    : "write to us with the contact details at the foot of this page";
  const shopFirst = l.shop.first_days > 0 && l.shop.live_first !== l.shop.live;
  return {
    intro: "The Marketplace is where people and shops across Saudi Arabia sell sports gear to each other. These rules apply to everyone who lists an item, contacts a seller or opens a shop here. By using the Marketplace you agree to them.",
    sections: [
      { id: "how", title: "How the Marketplace works", blocks: [
        { p: "MicroMobility shows the listings. The sale, the payment and the handover are between the buyer and the seller." },
        { ul: [
          "MicroMobility is not the seller and is not a party to the sale. The one exception is a listing marked “Sold by MicroMobility”, which MicroMobility sells itself under the site’s [Terms & Conditions](/terms).",
          "MicroMobility takes no payment for an item and holds no money for anyone.",
          "The buyer and the seller agree the price, how to pay and where to meet. Any delivery or courier is theirs to arrange and to pay for.",
          "MicroMobility does not inspect the items and does not confirm that a listing is accurate. Check the item yourself before you pay.",
          "“Checked by our team” on a listing means our team saw that item on the date shown. It is not a warranty and it does not replace your own check.",
          "Listings appear at once. Our team does not approve them first. It acts on reports.",
          `Listing is free. A listing stays on sale for ${w4EnDays(s.listingDays)} and can be renewed.`,
          "MicroMobility gives no warranty, no refund and no compensation for an item sold by someone else.",
        ] },
      ] },
      { id: "who", title: "Who may sell", blocks: [
        { ul: [
          "Anyone aged 18 or over who has a MicroMobility account with a birth date on it.",
          `Shops, once our team has approved them. A shop lists under its trade name, and its page shows its commercial registration number. [Apply to open a shop](${MK_SHOP_APPLY}).`,
          "Private listings are for your own things. If selling is your trade, apply as a shop.",
          `Listings on sale at one time: ${mkNum(l.new.live)} for a new account, ${mkNum(l.established.live)} for an older account, ${mkNum(l.shop.live)} for a shop. A new account’s price limit is ${mkAmtText(l.new.price_max)} an item.`,
          "A buyer must be 18 or over too.",
          "We may pause an account or a shop that breaks these rules.",
        ] },
      ] },
      { id: "promise", title: "What a seller promises", blocks: [
        { p: "When you publish a listing, you promise that:" },
        { ul: [
          "The item is yours to sell, and nobody else has a claim on it.",
          "The description is honest: its true condition, every fault you know of, and its real brand, model and size.",
          "The photos are real photos of this very item as it is today, not pictures from a catalogue or from another listing.",
          "Each listing is for one item, and each item has one listing.",
          "The price is the full price, in Saudi riyals.",
          "A bicycle, e-bike or e-scooter carries its real frame or serial number.",
          "The listing and your messages hold no links, no phone numbers and no other contact details.",
          "You mark the item as sold, or delete the listing, as soon as it is gone.",
          "The sale follows the law of Saudi Arabia, including any tax you owe on it.",
        ] },
      ] },
      { id: "not-allowed", title: "What may not be sold", blocks: [
        { p: "The Marketplace is for sports gear. These may not be listed, new or used:" },
        { groups: [
          { title: "Weapons", items: ["Air rifles, guns and their parts", "Ammunition", "Airsoft guns", "Bows and crossbows", "Spearguns", "Knives and blades", "Martial-arts weapons", "Pepper spray and tasers"] },
          { title: "Drones", items: ["Drones of any kind"] },
          { title: "Medicines and nutrition", items: ["Medicines", "Supplements", "Sports nutrition"] },
          { title: "Batteries", items: ["Lithium batteries sold on their own", "Used lithium batteries"] },
          { title: "Fake, recalled or stolen", items: ["Counterfeit goods and copies", "Recalled goods", "Stolen goods"] },
        ] },
        { p: "Anything else the law of Saudi Arabia does not allow to be sold is not allowed here either. A listing that breaks this is removed, and the account may be paused." },
      ] },
      { id: "restricted", title: "New only, or with a declaration", blocks: [
        { h: "New only" },
        { p: "These can be listed only when they are new and unused, because nobody can see how a used one was treated:" },
        { ul: ["Helmets", "Other protective gear, such as pads and guards", "Swimwear", "Base layers"] },
        { h: "E-bikes and e-scooters" },
        { p: "The seller declares all four of these:" },
        { ul: ["It is a complete device, not parts.", "It has not been modified.", "Its top assisted speed is 25 km/h or less.", "Its original charger is included."] },
        { h: "Frame and serial numbers" },
        { p: "A bicycle, a frame, an e-bike or an e-scooter needs its frame or serial number. Other people see only its last three characters. When the same number is on two listings, the newer one is held until our team has looked." },
        { h: "Combat sports" },
        { p: "Gloves and pads only." },
      ] },
      { id: "safety", title: "Staying safe", blocks: [
        { ul: [
          "Meet in a public place, in daylight where you can. Take someone with you for an expensive item.",
          "Check the item before you pay. Try it, look for cracks and repairs, and compare the frame number with the listing.",
          "Pay only when the item is in front of you. Do not send a deposit to hold it.",
          "Never pay through a link someone sends you.",
          "Never share a verification code, a password or your card details. A real buyer or seller does not need them.",
          "MicroMobility never asks you to pay for someone else’s item, never holds money for a sale and never sends payment links for the Marketplace. A message that says otherwise is a scam. Report it.",
          "Keep the conversation in the inbox. Share your WhatsApp number only when you choose to.",
          "For a bicycle, ask for a short written receipt: both names, the date, the price and the frame number.",
          "If something feels wrong, walk away.",
        ] },
      ] },
      { id: "commission", title: "The honour commission", blocks: pct > 0 ? [
        { p: `Listing is free. When you mark an item as sold, we ask you for a commission of ${w4Pct(pct)}% of the price it sold for. It is a matter of honour: nothing is taken automatically and nothing is enforced. The commission is our fee for showing your listing. It is not part of your sale, and the buyer pays MicroMobility nothing. It is what keeps the Marketplace open, so please pay it.` },
        ...(how ? [{ plain: how }] : []),
      ] : [
        { p: "Listing and selling here are free. MicroMobility asks for no commission at present." },
      ] },
      { id: "reports", title: "Reporting, and what our team does", blocks: [
        { ul: [
          "Every listing and every conversation has a Report button. Use it for an item that is not allowed, a fake, an item you believe is stolen, a misleading listing, a scam, abuse or spam.",
          "The other person is never told who reported them.",
          "Our team reads each report. It can hide a listing and tell its seller why, give the account a strike, or pause the account or the shop.",
          "A listing that several accounts report, or whose words match our blocked list, is held off sale until our team has looked.",
          "You can block a person from a conversation. Neither of you can then message the other until you unblock them.",
          "We remove content that breaks the law or these rules, and content the authorities tell us to remove.",
        ] },
      ] },
      { id: "complaints", title: "Complaints and disputes", blocks: [
        { h: "A complaint about the Marketplace" },
        { p: `If your complaint is about the Marketplace itself, such as a listing we hid, an account we paused, a report you think we handled wrongly or how we use your data, ${reach}. We answer within ${W4_COMPLAINT_DAYS} working days.` },
        { h: "A dispute about an item" },
        { p: "A disagreement about an item, its condition, its price or a payment is between the buyer and the seller. MicroMobility was not part of the sale. It does not decide who is right, and it has no money from the sale to return." },
        { p: "How the two of you can settle it:" },
        { ul: [
          "Talk to each other first, in the inbox, and keep the messages.",
          "Agree in writing what will happen: a repair, part of the price back, or the item returned for the money.",
          "If the seller is a shop, its return terms are on its page, and you can complain about a shop to the Commerce Ministry.",
          "If you believe you were cheated, or that an item is stolen, report it to the police. We give the authorities the records they lawfully ask for.",
          "Report the listing or the conversation to us as well, so that our team can act on the account.",
        ] },
      ] },
      { id: "data", title: "How your data is used here", blocks: [
        { h: "What a buyer sees about a seller" },
        { ul: [
          "Whether the seller is a private seller, a shop or MicroMobility.",
          "The name you chose for that listing: your first name and the first letter of your last name, or no name at all.",
          "The listing itself, with its city.",
        ] },
        { p: "Nothing else from your account is shown: not your phone number, your email, your full name, your photo or your birth date." },
        { h: "What a seller sees about a buyer" },
        { ul: [
          "The name the buyer chose for that conversation, or no name.",
          "The buyer’s messages.",
        ] },
        { h: "WhatsApp numbers" },
        { p: "Your number is shown to the other person in a conversation only after you tap “Share my WhatsApp” there, and only to that person. Once shared, it stays visible to them in that conversation." },
        { h: "Shops" },
        { p: "A shop’s page shows what its owner sent us to be shown: its trade name, its commercial registration number and activity, its VAT number, city, address, map link, description, return terms and logo. Its phone and WhatsApp numbers are shown to signed-in accounts that ask for them." },
        { h: "What we keep" },
        { ul: [
          "Messages are kept for 12 months after the last message in a conversation, then deleted.",
          "Our team reads a conversation only when one of the two people in it reports it. Each reading is recorded.",
          "Frame and serial numbers are stored in full, so that a stolen item can be traced.",
          "Listings, and the record of what happened to each one, are kept after a listing is deleted, so that we can answer a lawful request from the authorities.",
          "Photos are drawn again in your browser before they are sent, which leaves out where and when they were taken.",
        ] },
        { p: "The rest is in our [Privacy Notice](/privacy)." },
      ] },
      { id: "shops", title: "Shops and the shop agreement", blocks: [
        { p: "A shop that applies agrees to these rules and to the following:" },
        { ul: [
          "Its commercial registration is valid, and is in the name of the shop’s owner or of the business that runs it.",
          "The shop is the seller of everything it lists. It sets its own prices, takes its own payments, issues its own invoices and answers for its own returns, warranty and tax.",
          "It sells genuine goods only.",
          "It honours the return terms on its page and the rights the law gives its customers.",
          "It keeps its details up to date. Its trade name, registration, VAT number and city are changed by our team.",
          "The honour commission applies to a shop’s sales as it does to anyone’s.",
          shopFirst
            ? `A shop can have ${mkNum(l.shop.live_first)} listings on sale in its first ${w4EnDays(l.shop.first_days)}, and ${mkNum(l.shop.live)} after that.`
            : `A shop can have ${mkNum(l.shop.live)} listings on sale.`,
          "Our team approves each shop before it can list, and may pause a shop that breaks these rules. A paused shop’s listings come off sale.",
        ] },
      ] },
      { id: "changes", title: "Changes to these rules", blocks: [
        { ul: [
          "When we change these rules, a notice is shown on the Marketplace at least one week before the change takes effect.",
          "The date at the top of this page is the date of the rules now in force.",
          "Sellers are asked to accept the new rules before they publish again.",
        ] },
      ] },
    ],
  };
}

function arabic(i: W4RulesInput): W4Rules {
  const { settings: s } = i;
  const l = s.limits, pct = s.commissionPct, how = s.commissionHow.ar.trim() || s.commissionHow.en.trim();
  const r = reachOf(i);
  const reach = r.mail && r.wa ? `فراسلنا على [${r.mail}](mailto:${r.mail}) أو عبر [واتساب](${r.wa})`
    : r.mail ? `فراسلنا على [${r.mail}](mailto:${r.mail})`
    : r.wa ? `فراسلنا عبر [واتساب](${r.wa})`
    : "فراسلنا عبر بيانات التواصل في أسفل هذه الصفحة";
  const shopFirst = l.shop.first_days > 0 && l.shop.live_first !== l.shop.live;
  return {
    intro: "السوق مكان يبيع فيه الأفراد والمتاجر في أنحاء المملكة العربية السعودية المستلزمات الرياضية بعضهم لبعض. تسري هذه القواعد على كل من يعرض غرضاً أو يراسل بائعاً أو يفتح متجراً هنا. وباستخدامك السوق فأنت توافق عليها.",
    sections: [
      { id: "how", title: "كيف يعمل السوق", blocks: [
        { p: "تعرض MicroMobility الإعلانات. أما البيع والدفع والتسليم فبين المشتري والبائع." },
        { ul: [
          "MicroMobility ليست البائع وليست طرفاً في البيع. والاستثناء الوحيد هو الإعلان المكتوب عليه «تبيعه MicroMobility»، فهذا تبيعه MicroMobility نفسها وفق [الشروط والأحكام](/terms) الخاصة بالموقع.",
          "لا تأخذ MicroMobility ثمن أي غرض، ولا تحتفظ بمال لأحد.",
          "يتفق المشتري والبائع على السعر وطريقة الدفع ومكان اللقاء. وأي توصيل أو شحن يرتّبانه هما ويدفعان تكلفته.",
          "لا تفحص MicroMobility الأغراض ولا تؤكد صحة ما في الإعلان. افحص الغرض بنفسك قبل أن تدفع.",
          "عبارة «فحصه فريقنا» على الإعلان تعني أن فريقنا رأى ذلك الغرض في التاريخ المذكور. ليست ضماناً، ولا تغني عن فحصك أنت.",
          "تظهر الإعلانات فور نشرها. لا يراجعها فريقنا قبل النشر، بل يتصرف عند وصول بلاغ.",
          `عرض الإعلان مجاني. يبقى الإعلان معروضاً للبيع مدة ${w4ArDays(s.listingDays)} ويمكن تجديده.`,
          "لا تقدّم MicroMobility ضماناً ولا استرداداً ولا تعويضاً عن غرض يبيعه غيرها.",
        ] },
      ] },
      { id: "who", title: "من يحق له البيع", blocks: [
        { ul: [
          "كل من أتمّ 18 عاماً وله حساب في MicroMobility مسجَّل فيه تاريخ ميلاده.",
          `المتاجر، بعد موافقة فريقنا. يعرض المتجر باسمه التجاري، وتُظهر صفحته رقم سجله التجاري. [قدّم طلب فتح متجر](${MK_SHOP_APPLY}).`,
          "إعلانات الأفراد لأغراضك الشخصية. فإن كان البيع تجارتك فقدّم طلباً كمتجر.",
          `عدد الإعلانات المعروضة للبيع في وقت واحد: ${mkNum(l.new.live)} للحساب الجديد، و${mkNum(l.established.live)} للحساب الأقدم، و${mkNum(l.shop.live)} للمتجر. وحدّ السعر في الحساب الجديد ${mkAmtText(l.new.price_max)} للغرض الواحد.`,
          "ويجب أن يكون المشتري كذلك قد أتمّ 18 عاماً.",
          "لنا أن نوقف مؤقتاً أي حساب أو متجر يخالف هذه القواعد.",
        ] },
      ] },
      { id: "promise", title: "بماذا يتعهد البائع", blocks: [
        { p: "عند نشر إعلانك فأنت تتعهد بما يلي:" },
        { ul: [
          "الغرض ملكك ولك حق بيعه، وليس لأحد غيرك حق فيه.",
          "الوصف صادق: حالته الحقيقية، وكل عيب تعرفه فيه، وماركته وموديله ومقاسه كما هي.",
          "الصور صور حقيقية لهذا الغرض نفسه كما هو اليوم، لا صور من كتالوج ولا من إعلان آخر.",
          "كل إعلان لغرض واحد، ولكل غرض إعلان واحد.",
          "السعر هو السعر الكامل، بالريال السعودي.",
          "الدراجة الهوائية أو الكهربائية أو السكوتر الكهربائي يُذكر معها رقم الهيكل أو الرقم التسلسلي الصحيح.",
          "لا روابط ولا أرقام هواتف ولا أي وسيلة تواصل أخرى في الإعلان ولا في رسائلك.",
          "تعلّم على الغرض بأنه بِيع، أو تحذف الإعلان، فور بيعه.",
          "يتم البيع وفق أنظمة المملكة العربية السعودية، ومنها أي ضريبة تستحق عليك.",
        ] },
      ] },
      { id: "not-allowed", title: "ما لا يجوز بيعه", blocks: [
        { p: "السوق للمستلزمات الرياضية. ولا يجوز عرض ما يلي، جديداً كان أو مستعملاً:" },
        { groups: [
          { title: "الأسلحة", items: ["بنادق الهواء والأسلحة النارية وقطعها", "الذخيرة", "أسلحة الإيرسوفت", "الأقواس والنشّاب", "بنادق الصيد تحت الماء", "السكاكين والشفرات", "أسلحة الفنون القتالية", "رذاذ الفلفل والصواعق الكهربائية"] },
          { title: "الطائرات بدون طيار", items: ["الطائرات بدون طيار (الدرون) بكل أنواعها"] },
          { title: "الأدوية والتغذية", items: ["الأدوية", "المكملات الغذائية", "منتجات التغذية الرياضية"] },
          { title: "البطاريات", items: ["بطاريات الليثيوم المنفردة", "بطاريات الليثيوم المستعملة"] },
          { title: "المقلَّد والمسحوب والمسروق", items: ["البضائع المقلدة والمنسوخة", "البضائع المسحوبة من الأسواق", "المسروقات"] },
        ] },
        { p: "وكل ما تمنع أنظمة المملكة العربية السعودية بيعه ممنوع هنا أيضاً. الإعلان المخالف يُزال، وقد يُوقف الحساب مؤقتاً." },
      ] },
      { id: "restricted", title: "ما يُباع جديداً فقط أو بإقرار", blocks: [
        { h: "جديد فقط" },
        { p: "هذه لا تُعرض إلا جديدة غير مستعملة، لأن أحداً لا يستطيع أن يعرف كيف استُعمل المستعمل منها:" },
        { ul: ["الخوذات", "معدات الحماية الأخرى، كالواقيات", "ملابس السباحة", "الملابس الداخلية الرياضية (الطبقة الأساسية)"] },
        { h: "الدراجات الكهربائية والسكوترات الكهربائية" },
        { p: "يقرّ البائع بهذه الأربعة كلها:" },
        { ul: ["الجهاز كامل وليس قطعاً.", "لم يُجرَ عليه أي تعديل.", "أقصى سرعة له بمساعدة المحرك 25 كم/س أو أقل.", "معه شاحنه الأصلي."] },
        { h: "رقم الهيكل والرقم التسلسلي" },
        { p: "الدراجة أو الهيكل أو الدراجة الكهربائية أو السكوتر الكهربائي يلزمه رقم الهيكل أو الرقم التسلسلي. لا يرى الآخرون منه إلا آخر ثلاث خانات. وإذا ورد الرقم نفسه في إعلانين عُلّق الأحدث منهما حتى يراجعه فريقنا." },
        { h: "الرياضات القتالية" },
        { p: "القفازات والواقيات فقط." },
      ] },
      { id: "safety", title: "حافظ على سلامتك", blocks: [
        { ul: [
          "التقِ بالطرف الآخر في مكان عام، وفي النهار إن أمكن. واصطحب أحداً معك إذا كان الغرض ثميناً.",
          "افحص الغرض قبل أن تدفع. جرّبه، وابحث عن الشقوق وآثار الإصلاح، وطابق رقم الهيكل مع الإعلان.",
          "لا تدفع إلا والغرض أمامك. ولا ترسل عربوناً لحجزه.",
          "لا تدفع أبداً عبر رابط يرسله إليك أحد.",
          "لا تشارك أبداً رمز تحقق ولا كلمة مرور ولا بيانات بطاقتك. المشتري أو البائع الحقيقي لا يحتاج إليها.",
          "MicroMobility لا تطلب منك أبداً أن تدفع ثمن غرض يبيعه غيرها، ولا تحتفظ بمال لأي بيع، ولا ترسل روابط دفع تخص السوق. وأي رسالة تقول غير ذلك احتيال. أبلغ عنها.",
          "أبقِ المحادثة في رسائل السوق. ولا تشارك رقمك على واتساب إلا إذا أردت أنت.",
          "عند شراء دراجة اطلب إيصالاً مكتوباً مختصراً: الاسمان والتاريخ والسعر ورقم الهيكل.",
          "إذا شعرت أن في الأمر ما يريب فانسحب.",
        ] },
      ] },
      { id: "commission", title: "العمولة: أمانة في ذمة البائع", blocks: pct > 0 ? [
        { p: `عرض الإعلان مجاني. وعندما تعلّم على غرضك بأنه بِيع نطلب منك عمولة قدرها ${w4Pct(pct)}% من السعر الذي بِيع به. هي أمانة في ذمتك: لا يُخصم شيء تلقائياً ولا نُلزمك بشيء. العمولة مقابل عرض إعلانك، وليست جزءاً من بيعك، والمشتري لا يدفع لـ MicroMobility شيئاً. وبها يبقى السوق مفتوحاً، فنرجو أن تدفعها.` },
        ...(how ? [{ plain: how }] : []),
      ] : [
        { p: "عرض الإعلان والبيع هنا مجانيان. لا تطلب MicroMobility أي عمولة حالياً." },
      ] },
      { id: "reports", title: "الإبلاغ وما يفعله فريقنا", blocks: [
        { ul: [
          "في كل إعلان وكل محادثة زر «إبلاغ». استعمله للغرض الممنوع، وللمقلَّد، ولما تظن أنه مسروق، وللإعلان المضلِّل، وللاحتيال، وللإساءة، وللرسائل المزعجة.",
          "لا يُخبَر الطرف الآخر أبداً بمن أبلغ عنه.",
          "يقرأ فريقنا كل بلاغ. وله أن يخفي الإعلان ويخبر صاحبه بالسبب، أو يسجّل مخالفة على الحساب، أو يوقف الحساب أو المتجر مؤقتاً.",
          "الإعلان الذي تبلّغ عنه عدة حسابات، أو الذي تطابق كلماته قائمة الكلمات المحظورة لدينا، يُعلَّق عرضه حتى يراجعه فريقنا.",
          "يمكنك حظر شخص من داخل المحادثة. وبعدها لا يستطيع أي منكما مراسلة الآخر إلى أن تلغي الحظر.",
          "نزيل كل محتوى يخالف الأنظمة أو هذه القواعد، وكل محتوى تطلب الجهات المختصة إزالته.",
        ] },
      ] },
      { id: "complaints", title: "الشكاوى والخلافات", blocks: [
        { h: "شكوى تخص السوق" },
        { p: `إذا كانت شكواك عن السوق نفسه، كإعلان أخفيناه، أو حساب أوقفناه مؤقتاً، أو بلاغ ترى أننا أخطأنا في معالجته، أو طريقة استخدامنا لبياناتك، ${reach}. نردّ خلال ${W4_COMPLAINT_DAYS} أيام عمل.` },
        { h: "خلاف على غرض" },
        { p: "الخلاف على غرض أو حالته أو سعره أو على مبلغ مدفوع هو بين المشتري والبائع. لم تكن MicroMobility طرفاً في البيع. فهي لا تحكم بينكما، وليس لديها من مال البيع شيء تردّه." },
        { p: "كيف تحلّانه بينكما:" },
        { ul: [
          "تحدّثا أولاً في رسائل السوق، واحتفظا بالرسائل.",
          "اتفقا كتابةً على ما سيتم: إصلاح، أو ردّ جزء من السعر، أو إرجاع الغرض مقابل المبلغ.",
          "إذا كان البائع متجراً فشروط الإرجاع الخاصة به في صفحته، ويمكنك تقديم شكوى على المتجر لدى وزارة التجارة.",
          "إذا رأيت أنك تعرضت للاحتيال، أو أن الغرض مسروق، فأبلغ الشرطة. ونحن نسلّم الجهات المختصة ما تطلبه نظاماً من سجلات.",
          "وأبلغنا كذلك عن الإعلان أو المحادثة، ليتصرف فريقنا في شأن الحساب.",
        ] },
      ] },
      { id: "data", title: "كيف تُستخدم بياناتك هنا", blocks: [
        { h: "ما يراه المشتري عن البائع" },
        { ul: [
          "نوع البائع: فرد، أو متجر، أو MicroMobility.",
          "الاسم الذي اخترته لذلك الإعلان: اسمك الأول والحرف الأول من اسم عائلتك، أو بلا اسم.",
          "الإعلان نفسه ومدينته.",
        ] },
        { p: "ولا يظهر شيء آخر من حسابك: لا رقم جوالك ولا بريدك ولا اسمك الكامل ولا صورتك ولا تاريخ ميلادك." },
        { h: "ما يراه البائع عن المشتري" },
        { ul: [
          "الاسم الذي اختاره المشتري لتلك المحادثة، أو بلا اسم.",
          "رسائل المشتري.",
        ] },
        { h: "أرقام واتساب" },
        { p: "لا يظهر رقمك للطرف الآخر في المحادثة إلا بعد أن تضغط «مشاركة رقمي على واتساب» فيها، ولا يظهر إلا له. وبعد مشاركته يبقى ظاهراً له في تلك المحادثة." },
        { h: "المتاجر" },
        { p: "تعرض صفحة المتجر ما أرسله صاحبه إلينا ليُعرض: الاسم التجاري، ورقم السجل التجاري ونشاطه، والرقم الضريبي، والمدينة، والعنوان، ورابط الخريطة، والنبذة، وشروط الإرجاع، والشعار. أما رقم الهاتف ورقم واتساب فيظهران للحسابات المسجِّلة دخولها عند طلبهما." },
        { h: "ما نحتفظ به" },
        { ul: [
          "تُحفظ الرسائل 12 شهراً بعد آخر رسالة في المحادثة، ثم تُحذف.",
          "لا يقرأ فريقنا محادثة إلا إذا أبلغ عنها أحد طرفيها. وكل قراءة تُسجَّل.",
          "تُحفظ أرقام الهياكل والأرقام التسلسلية كاملة، ليمكن تتبّع الغرض المسروق.",
          "تُحفظ الإعلانات وسجل ما جرى لكل منها حتى بعد حذف الإعلان، لنتمكن من الرد على أي طلب نظامي من الجهات المختصة.",
          "تُرسم الصور من جديد في متصفحك قبل إرسالها، فلا يبقى فيها مكان التصوير ولا وقته.",
        ] },
        { p: "والباقي في [إشعار الخصوصية](/privacy)." },
      ] },
      { id: "shops", title: "المتاجر واتفاقية المتجر", blocks: [
        { p: "المتجر الذي يقدّم طلباً يوافق على هذه القواعد وعلى ما يلي:" },
        { ul: [
          "سجله التجاري ساري المفعول، وباسم صاحب المتجر أو المنشأة التي تديره.",
          "المتجر هو البائع لكل ما يعرضه. يحدد أسعاره، ويستلم مدفوعاته، ويصدر فواتيره، ويتحمل هو مسؤولية الإرجاع والضمان والضريبة في مبيعاته.",
          "لا يبيع إلا بضائع أصلية.",
          "يلتزم بشروط الإرجاع المعروضة في صفحته وبما يكفله النظام لعملائه من حقوق.",
          "يحدّث بياناته أولاً بأول. أما الاسم التجاري والسجل التجاري والرقم الضريبي والمدينة فيغيّرها فريقنا.",
          "تسري العمولة على مبيعات المتجر كما تسري على مبيعات غيره.",
          shopFirst
            ? `عدد إعلانات المتجر المعروضة للبيع: ${mkNum(l.shop.live_first)} في أول ${w4ArDays(l.shop.first_days)}، ثم ${mkNum(l.shop.live)} بعد ذلك.`
            : `عدد إعلانات المتجر المعروضة للبيع: ${mkNum(l.shop.live)}.`,
          "يوافق فريقنا على كل متجر قبل أن يعرض، وله أن يوقف مؤقتاً المتجر الذي يخالف هذه القواعد. وعندها تُسحب إعلاناته من العرض.",
        ] },
      ] },
      { id: "changes", title: "تغيير هذه القواعد", blocks: [
        { ul: [
          "عند تغيير هذه القواعد يظهر إشعار في السوق قبل أسبوع على الأقل من سريان التغيير.",
          "التاريخ أعلى هذه الصفحة هو تاريخ القواعد السارية الآن.",
          "يُطلب من البائعين الموافقة على القواعد الجديدة قبل أن ينشروا من جديد.",
        ] },
      ] },
    ],
  };
}

/** The rules in one of their two languages, with the settings' numbers in them. */
export const w4Rules = (lang: "en" | "ar", i: W4RulesInput): W4Rules => (lang === "ar" ? arabic(i) : english(i));
/** The language a page reads the rules in: Arabic on the Arabic page, English everywhere else. */
export const w4RulesLang = (locale: string): "en" | "ar" => (locale === "ar" ? "ar" : "en");
/** Whether this language has the rules in its own words (the others read the English, and are told so). */
export const w4RulesOwn = (locale: string): boolean => locale === "en" || locale === "ar";

/** The rules' date ("2026-11-21") as a day the page can write, or null when the version staff set is not a date. */
export function w4RulesDay(version: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  if (!m) return null;
  const d = new Date(`${version}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === version ? version : null;
}
