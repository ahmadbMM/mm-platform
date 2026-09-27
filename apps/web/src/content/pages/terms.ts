import { bi, type PageSchema } from "@/content/types";

// micromobility.sa/terms - the Terms & Conditions. Written 2026-09-25 FOR THE OWNER TO CONFIRM,
// from what the company already says elsewhere and nothing more: the booking app's waiver and its
// booth and first-come messages, the Help page's delivery, returns and warranty answers, the Club
// and Ambassador pages. The page is off until staff switch it on (Website > Pages), after the
// owner has read it in Preview; staff change every clause in Website > Terms.
//
// Legal text, in English and Arabic only (enArOnly), like the Privacy Notice: every other language
// shows the English with a note. A clause's text is plain: a blank line starts a paragraph and a
// line starting "- " is a list item (lib/journal.ts parseBody).
const para = <I extends string>(id: I, max: number, en: string, ar: string, dEn: string, dAr: string) =>
  ({ id, type: "longtext" as const, max, enArOnly: true, label: bi(en, ar), def: bi(dEn, dAr) });
const clause = (title: [string, string], body: [string, string]) => ({ title: bi(...title), body: bi(...body) });

export const termsSchema = {
  page: "terms",
  label: bi("Terms & Conditions", "الشروط والأحكام"),
  sections: [
    {
      id: "intro",
      label: bi("Top of the page", "أعلى الصفحة"),
      fields: [
        { id: "updated", type: "text", max: 10, mono: true, label: bi("Last updated (YYYY-MM-DD)", "آخر تحديث (YYYY-MM-DD)"), def: bi("2026-09-25", "2026-09-25") },
        para("text", 600, "Opening paragraph", "الفقرة الافتتاحية",
          "These terms apply when you use micromobility.sa, book a ride or a rental, request a workshop service or buy from our store. If anything here is unclear, contact us before you book or buy.",
          "تسري هذه الشروط عند استخدامك موقع micromobility.sa، أو حجزك رحلة أو استئجار دراجة، أو طلبك خدمة صيانة، أو شرائك من متجرنا. وإذا كان أي شيء هنا غير واضح، فتواصل معنا قبل الحجز أو الشراء."),
      ],
    },
    {
      id: "clauses",
      label: bi("Clauses", "البنود"),
      hint: bi("Each clause has a title and its text. In the text, a line starting \"- \" is a list item.", "لكل بند عنوان ونص. في النص، السطر الذي يبدأ بـ \"- \" عنصر في قائمة."),
      fields: [
        {
          id: "items", type: "list", maxItems: 20, label: bi("Clauses", "البنود"),
          item: [
            { id: "title", type: "text", max: 80, enArOnly: true, label: bi("Title", "العنوان"), def: bi("", "") },
            { id: "body", type: "longtext", max: 2400, enArOnly: true, label: bi("Text", "النص"), def: bi("", "") },
          ],
          def: [
            clause(["Who we are", "من نحن"], [
              "Micromobility is operated by Micromobility Company Ltd., a company registered in the Kingdom of Saudi Arabia, with its store in Jeddah. Our registration details and contact details are on the About page.",
              "تُدار مايكروموبيليتي من قِبل شركة التنقل الدقيق المحدودة، وهي شركة مسجلة في المملكة العربية السعودية، ومتجرها في جدة. تجد بيانات تسجيلنا وطرق التواصل معنا في صفحة \"من نحن\".",
            ]),
            clause(["Rides and rentals", "الرحلات والتأجير"], [
              "- Rides and rentals are booked in our booking app, for the session, date and number of riders you choose.\n- At the Corniche Circuit, payment is collected at our booth when you arrive. Please have your queue number ready.\n- Bikes are assigned on a first come, first served basis: come early to get the bike type you chose.\n- Some rides, such as our community rides, are for members, and places on them are confirmed by our team.\n- You can change or cancel a booking in My Bookings in the booking app.",
              "- تُحجز الرحلات والتأجير عبر تطبيق الحجز، للجلسة والتاريخ وعدد الراكبين الذي تختاره.\n- في حلبة الكورنيش، يتم الدفع عند الكشك عند وصولك. يرجى إحضار رقم طابورك.\n- يتم توزيع الدراجات على أساس الأول فالأول، فتعال مبكراً للحصول على نوع الدراجة الذي اخترته.\n- بعض الرحلات، مثل رحلات المجتمع، مخصصة للأعضاء، ويؤكد فريقنا الأماكن فيها.\n- يمكنك تعديل الحجز أو إلغاؤه من \"حجوزاتي\" في تطبيق الحجز.",
            ]),
            clause(["Riding safely", "الركوب الآمن"], [
              "Every rider accepts our waiver before riding. Cycling is a physical activity that carries risk. You agree to wear a helmet and to follow the team's instructions and the circuit course. You are responsible for your own safety and for any damage to the rented bike caused by misuse, and the bike is returned in the condition it was received.",
              "يوافق كل راكب على الإقرار قبل الركوب. ركوب الدراجة نشاط بدني ينطوي على مخاطر، وتتعهد بارتداء الخوذة والالتزام بتعليمات الفريق ومسار الحلبة. وتتحمل مسؤولية سلامتك الشخصية وأي ضرر يلحق بالدراجة المستأجرة نتيجة سوء الاستخدام، وتُعاد الدراجة بحالتها عند الاستلام.",
            ]),
            clause(["Workshop services", "خدمات الورشة"], [
              "Workshop requests made on this site are confirmed by our team. Service prices are shown on the Workshop page, and parts are priced separately.",
              "يؤكد فريقنا طلبات الصيانة المرسلة عبر هذا الموقع. أسعار الخدمات معروضة في صفحة الورشة، وتُسعَّر القطع بشكل منفصل.",
            ]),
            clause(["Buying from our store", "الشراء من متجرنا"], [
              "- Orders from our online store are reviewed and confirmed before they are prepared, and ship free of charge to every region of the Kingdom. You can also collect an order from our Jeddah store.\n- You can return a product within 7 days, or exchange it within 15 days, of receiving it, as long as it is unused, in its original packaging and with its invoice. Items made or adjusted especially for you can't be returned unless they are faulty.\n- Once we have received and checked a returned product, the refund goes back the way you paid.\n- Manufacturing defects are covered by our warranty, with full after-sales support. The Help page sets out what it covers.",
              "- نراجع طلبات متجرنا الإلكتروني ونؤكدها قبل تجهيزها، وتُشحن مجاناً إلى جميع مناطق المملكة. ويمكنك أيضاً استلام طلبك من متجرنا في جدة.\n- يمكنك إرجاع المنتج خلال 7 أيام، أو استبداله خلال 15 يوماً، من تاريخ استلامه، بشرط أن يكون غير مستخدم وفي تغليفه الأصلي ومعه الفاتورة. ولا يمكن إرجاع المنتجات المصنوعة أو المعدّلة خصيصاً لك ما لم يكن فيها عيب.\n- بعد استلامنا المنتج المُرجَع وفحصه، يُعاد المبلغ بطريقة الدفع نفسها التي استخدمتها.\n- يشمل ضماننا العيوب المصنعية مع دعم فني كامل بعد البيع، وتوضح صفحة المساعدة ما يشمله.",
            ]),
            clause(["Club and Ambassadors", "النادي والسفراء"], [
              "Club tiers and ride credits, and Ambassador codes and points, work as described on the Club and Ambassadors pages.",
              "تعمل مستويات النادي وأرصدة الرحلات، وأكواد السفراء ونقاطهم، وفق ما هو موضح في صفحتَي النادي والسفراء.",
            ]),
            clause(["Your personal data", "بياناتك الشخصية"], [
              "How we collect, use and protect your personal data is set out in our Privacy Notice.",
              "يوضح إشعار الخصوصية كيف نجمع بياناتك الشخصية ونستخدمها ونحميها.",
            ]),
            clause(["Changes and law", "التعديلات والقانون"], [
              "We may update these terms; the date at the top of this page shows when they last changed. These terms are governed by the laws of the Kingdom of Saudi Arabia.",
              "قد نحدّث هذه الشروط، ويوضح التاريخ في أعلى هذه الصفحة آخر تعديل لها. وتخضع هذه الشروط لأنظمة المملكة العربية السعودية.",
            ]),
            clause(["Contact", "التواصل"], [
              "Questions about these terms? Email info@micromobility.sa or call +966 56 666 8818.",
              "لديك سؤال حول هذه الشروط؟ راسلنا على info@micromobility.sa أو اتصل على ‎+966 56 666 8818.",
            ]),
          ],
        },
      ],
    },
  ],
} as const satisfies PageSchema;
