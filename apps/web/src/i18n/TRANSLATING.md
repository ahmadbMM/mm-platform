# Translating the website

English and Arabic are written by hand: in the code (`tx("English", "العربية")`, `phrase()`,
the `*.text.ts` files) and, for the texts staff edit, in the content defaults and the store.
Every other language translates the English through `src/i18n/tx/<code>.json`, keyed by the
English text itself.

After changing or adding a text:
1. `I18N_WRITE=1 pnpm vitest run src/i18n` rewrites `source.json`, the list of texts to translate.
2. Add the new English, with its translation, to every `tx/<code>.json`, and remove the texts
   the site no longer shows. The test lists anything missing or stale.
3. The same test checks every translation. It must keep:
   - the `{placeholders}`;
   - the markup;
   - the line count;
   - the markdown markers.

The same English text gets one translation everywhere. If one English word means two things on
the site, give them different English: the promo button says "Apply code" because "Apply"
means applying to join. The same goes for "Gravel track" (a surface) versus "Gravel" (a bike type).

The first 14 languages were translated on 2026-09-25 by a translator and then an independent
reviewer per language, under the rules below.

## Decisions a reader might question
- **The store's street in Devanagari and Bengali script.** "Thu Al-Nurayn" stays in Latin
  letters in Hindi, Nepali and Bengali, because "थू" / "থু" is the spitting sound there. Urdu
  uses the Arabic original (ذو النورین).
- **The booking app's labels.** The app does not speak Indonesian, Malay, German, Russian,
  Chinese or Japanese. Where a text names one of its labels, those languages give the
  English label, on its own or in brackets after a translation, e.g. "«Мои бронирования» (My Bookings)".
- **Unit templates.** "{h} h", "{m} min", "{n} uses" and the like use forms that are right for
  any number. Russian, for example, writes "Баллы: {n}". English alone says "1 ride" / "1 use"
  (in the code).
- **Chinese tier names.** The Scout tier is 探索者, not 探路者, which is a Chinese outdoor
  brand (Toread).


## The company and the site
Micromobility is a bicycle company in Jeddah, Saudi Arabia (since 2016). It runs:
- a bike store (the exclusive Saudi distributor of the Battle, Alvas, Camp and Strauss brands, and an authorised Garmin seller), with an online store;
- a workshop, meaning a bike service and repair centre;
- "experiences": bike rental and evening ride sessions at the Jeddah Corniche Circuit (the Formula 1 track), community group rides, a Saturday social ride, a triathlon pool session and events;
- a members' Club, with ride credits and tiers;
- an Ambassador program, with personal codes and points;
- corporate services: fleets, events, activations and maintenance contracts.

Readers are residents of Saudi Arabia and visitors who read this language: expatriates, tourists and business clients. Bookings happen in a separate web app, called "the booking app".

The site is written in English, with a hand-written Arabic version. **Translate from the English.** Use the Arabic (`ar`) only to understand what a text means when the English is ambiguous. `ctx` says where each text appears:
- `page "x" › section › field` is a text staff can edit on that page;
- `file:line — code` is a label in a component;
- `NFC bike page` is the page a rider opens by tapping a sticker on a rental bike.

## Quality bar
Write the way a native professional copywriter for a premium sports brand would. The text must be natural, fluent and idiomatic, not a word-for-word translation. The meaning must be exact: no additions, no omissions, and no guessing at facts. Prices, days, times, numbers, conditions and legal meaning must stay precisely the same. Keep the tone friendly and confident. Buttons, menu items, tabs, pills, table headings and short labels must stay short: close to the English length, since navigation labels sit in a crowded header.

## Hard rules (a checker enforces most of them)
1. Every `{placeholder}` stays, spelled exactly the same: `{0}`, `{1}`, `{n}`, `{discount}`, `{name}`, `{date}`, `{time}`, `{hours}`, `{code}`, `{season}`, `{proAt}`, `{legendAt}`, `{h}`, `{m}`. Move it wherever the grammar needs it, and never translate the name inside the braces.
2. A text with line breaks keeps the same number of lines, in the same order. Each line is one item of a list, a perk or a bullet, and translates the English line in the same position. Blank lines stay blank.
3. Long articles use markdown. A line starting with `## ` is a heading and keeps `## `. A line starting with `- ` or `• ` is a bullet and keeps the same marker.
4. These stay exactly as written: the company and brand names in the Business page's client and partner lists, including "Hijrah Ride" (a client brand, not a ride). "King Abdulaziz University" is an institution and takes its usual name in your language; the registered name "Micromobility Company Ltd."; the brand and company names Micromobility and MicroMobility, Battle, Alvas, Camp, Strauss, Garmin, Donen, EasyDo, Petromin, Sela, Tamer Group, Twina, PMT, DCC, Land Rover and Škoda; the payment brands Mastercard, Visa, mada and tabby; the social networks Facebook, Instagram, Snapchat, Telegram, TikTok, YouTube, WhatsApp and X; the product names (ALVAS …, Dura-Ace Di2 2×12, Michelin Power Cup 28C and so on); the promo code SARA10; numbers such as "12", "2016" and "2–3"; coordinates; and the two postal addresses, which are copied verbatim because they must match maps. Inside a sentence, brand and product names also stay in Latin letters, in every script.
5. The currency is SAR: keep "SAR" as it is. "Riyal" as a word may be translated.
6. Digits are always Latin (0–9), in every language, including Urdu, Hindi, Nepali and Bengali. The site shows every number that way.
7. Symbols stay: ✓ · → ← ~ %. Arrows point the way the English does, **except in Urdu**, which is right-to-left: mirror them as the Arabic does (the Arabic of "Directions →" is "الاتجاهات ←").
8. Times, days and hour ranges follow the language's own conventions (24-hour clock where that is the norm). The facts must not change: "Sun & Tue · 9-11pm" is Sunday and Tuesday, 21:00 to 23:00.
9. Use your language's own punctuation, quotation marks and dashes. The English " - " between clauses is a dash.
10. `, ` (NFC bike page, key listSep) is the separator between two items, as in "Road bike, size M". Give your language's list separator with its spacing: `、` for Chinese and Japanese, `، ` for Urdu, `, ` for most others.
11. The moving strip "BATTLE⏎ALVAS⏎CAMP⏎STRAUSS⏎EST. JEDDAH⏎RIDE EVERY SATURDAY⏎مجتمع الدراجات في جدة" keeps its brand lines, translates "EST. JEDDAH" and "RIDE EVERY SATURDAY" (in capitals where the script has case), and **keeps the last line in Arabic, unchanged**: it is a deliberate Arabic touch.
12. The full postal addresses stay verbatim (rule 4). The shorter place mentions do not: "Thu Al-Nurayn St, Al Sharafeyah." and "Thu Al-Nurayn St, Al Sharafeyah, Jeddah. Saturday to Thursday, …" read naturally in your language, with the street and district names transliterated or kept in Latin letters.

## Unit templates
"{h} h", "{h} h {m} min", "{m} min", "{n} km", "{n} m", "~{0} min" and the like receive any number. Use the short unit forms your language's apps use (for example Google Maps), so that the text is correct for 1 and for many: Hindi "{h} घं {m} मि", Russian "{h} ч {m} мин", German "{h} Std. {m} Min.". Never use a word form that is right only for some numbers.

## Terms
Keep each term consistent everywhere it appears.
- **ride**: an organised bike ride or rental outing, never a car or taxi ride. **community ride** or **group ride**: riding together in a group.
- **session** or **evening session**: a scheduled evening slot at the circuit when bikes are rented and ridden.
- **Experiences**: the name of the section of bookable activities. Use the word your language uses for bookable leisure experiences.
- **Workshop**: the bike service and repair centre (German Werkstatt, French atelier, not a seminar). Exception: "Club workshop" is a members-only skills session, a workshop in the training sense.
- **service** (bike service): a maintenance or repair job. **tune-up**: a basic service.
- **Store**: the bike shop, both physical and online.
- **booking app**: the separate web app where rides are booked.
- **credits** (Club ride credits) and **points** (ambassador points) are two different things. Keep them apart.
- **code**: a personal promo or ambassador code.
- **waitlist**: the queue for a place when a session is full.
- **tier**: a membership level. The tier names are Scout, Captain, Elite (ambassadors) and Rider, Pro, Legend (Club). **Every language translates them** (the owner's decision, 2026-09-25): a real word of the language, never the English and never a sound-for-sound transliteration (スカウト, स्काउट, رايدر). Render each name the same way everywhere it appears, and add the language's word for "level" (Stufe, nivel, स्तर, درجہ, ランク…) where the bare name would read as a plain word ("Fahrer" alone is "driver"). Tier names are filled into templates such as "{0} credits to reach {1}". The names in use:

  | | Scout | Captain | Elite | Rider | Pro | Legend |
  |---|---|---|---|---|---|---|
  | ar | كشاف | قائد | نخبة | راكب | محترف | أسطورة |
  | de | Späher | Kapitän | Elite | Fahrer | Profi | Legende |
  | fr | Éclaireur | Capitaine | Élite | Cycliste | Pro | Légende |
  | es | Explorador | Capitán | Élite | Ciclista | Profesional | Leyenda |
  | pt | Explorador | Capitão | Elite | Ciclista | Profissional | Lenda |
  | ru | Разведчик | Капитан | Элита | Велосипедист | Профи | Легенда |
  | id | Penjelajah | Kapten | Elit | Pesepeda | Profesional | Legenda |
  | ms | Peneroka | Kapten | Elit | Penunggang | Profesional | Legenda |
  | tl | Manggagalugad | Kapitan | Piling-pili | Siklista | Propesyonal | Alamat |
  | hi | खोजी | कप्तान | श्रेष्ठ | सवार | माहिर | दिग्गज |
  | ne | अन्वेषक | कप्तान | विशिष्ट | सवार | सिपालु | दिग्गज |
  | bn | অভিযাত্রী | অধিনায়ক | অভিজাত | আরোহী | দক্ষ | কিংবদন্তি |
  | ur | کھوجی | کپتان | ممتاز | سوار | ماہر | افسانوی |
  | zh | 探索者 | 队长 | 精英 | 骑士 | 高手 | 传奇 |
  | ja | 探検家 | 隊長 | 精鋭 | 乗り手 | 達人 | 伝説 |

  Nepali Elite is विशिष्ट because श्रेष्ठ alone reads as the surname Shrestha; Bengali Scout is অভিযাত্রী (explorer), not অনুসন্ধানী (investigative). "Pro fitting" is a professional bike fitting, not the tier.
- **Shift levers**: the controls on the handlebar that change gear, covered by a two-year warranty. Only the levers, never the derailleur or the whole gear system (Russian шифтеры, not переключатели передач).
- **Bike types**: Road bike, Mountain bike, Hybrid bike (in Japanese クロスバイク), Gravel bike, Kids bike. "Road Carbon" is the rental type for a carbon road bike. "Own bike" means the rider brings their own. "Any bike" means no preference.
- **Groupset**: the cycling term for the drivetrain and brakes set. Use the term cyclists in your language use.
- **Corniche**: Jeddah's seafront. "Jeddah Corniche Circuit" (JCC) is the Formula 1 street circuit. Use the name your language's F1 coverage uses, or the booking app's term where one is given. "JCC" stays "JCC".
- **Place names**:
  - Jeddah: see your language's notes.
  - Al-Balad, the historic old town: transliterate.
  - Obhur and North Obhur (a coastal area): transliterate.
  - Asfan (the desert northeast of Jeddah): transliterate.
  - Red Sea: translate.
  - Riyadh: see your language's notes.
  - Jeddah Waterfront: translate or transliterate naturally.
  - King Abdulaziz University: its usual name in your language.
  - Saudi Triathlon Federation: its usual name in your language.
- **Events**:
  - "Saudi National Day 96 Ride" is the ride for Saudi Arabia's 96th National Day.
  - "T100 Triathlon Prep" keeps "T100".
- **Legal and official terms**:
  - VAT: your language's term for value-added tax.
  - CR: the Saudi Commercial Registration number.
  - Unified No.: the Saudi Unified National Number of a company.
  - Maroof: a Saudi e-commerce verification service; keep "Maroof".
- **Pop-up**: a temporary stand at the circuit.

## Your language
- **id (Bahasa Indonesia)**: address the reader as "Anda", in a natural marketing tone. Jeddah is "Jeddah" and Riyadh is "Riyadh". Use bike terms Indonesians use ("sepeda", "servis"). This is Indonesian, not Malay.
- **ms (Bahasa Melayu, Malaysia)**: address the reader as "anda", in standard Malaysian Malay (DBP spelling). Use "basikal" (never "sepeda"), "percuma" (never "gratis"), "kedai" and "nombor telefon". Jeddah is "Jeddah" and Riyadh is "Riyadh". This is Malay, not Indonesian.
- **de (Deutsch)**: use informal "du", in lower case, as German bike brands do, and stay consistent. Jeddah is "Dschidda" and Riyadh is "Riad". The Jeddah Corniche Circuit stays "Jeddah Corniche Circuit" (as in German F1 coverage). Road bike is Rennrad, mountain bike is Mountainbike, hybrid is Trekkingrad or Fitnessbike (pick one and keep it), and groupset is Schaltgruppe. Use "10 %" (with a space) and dashes as " – ".
- **es (Español)**: use "tú", in neutral Spanish that reads well in Spain and Latin America. Jeddah is "Yeda" and Riyadh is "Riad". Match the booking app's terms (the booking app's i18n/<code>.json), for example "Circuito de la Corniche de Yeda" and "reserva".
- **fr (Français)**: use "vous". Jeddah is "Djeddah" and Riyadh is "Riyad". Match the booking app's terms (the booking app's i18n/<code>.json), for example "Circuit de la Corniche de Djeddah". Put a non-breaking space (U+00A0) before : ; ! ? » and after «, and write "10 %".
- **pt (Português do Brasil)**: use "você". Match the booking app (the booking app's i18n/<code>.json), which keeps "Jeddah" and uses "Circuito da Corniche de Jeddah"; Riyadh is "Riad". Bike gears are "marchas".
- **tl (Tagalog/Filipino)**: write natural modern Filipino as used in Philippine apps. Keep the common English loanwords Filipinos use (booking, account, password, email, online and similar), and use "ka", "mo" and "iyong". Match the booking app (the booking app's i18n/<code>.json), which keeps "Jeddah Corniche Circuit" in English.
- **ru (Русский)**: address the reader as "вы", in lower case. Jeddah is "Джидда" and Riyadh is "Эр-Рияд". The circuit is "трасса Джидда-Корниш". Road bike is шоссейный велосипед, mountain bike is горный велосипед, hybrid is гибрид, gravel bike is гревел. Use the dash "—".
- **ur (اردو)**: address the reader as "آپ", in standard Urdu with the Urdu letters (ٹ ڈ ڑ ں ے ھ). The text is right-to-left: mirror arrows. Use "،" and "۔" and Latin digits. Match the booking app (the booking app's i18n/<code>.json): Jeddah is "جدہ" and the circuit is "جدہ کورنیش سرکٹ". Riyadh is "ریاض".
- **hi (हिन्दी)**: address the reader as "आप", in natural standard Hindi, not over-Sanskritised; everyday loanwords such as साइकिल, बुकिंग and सर्विस are fine. End sentences with "।" and use Latin digits. Match the booking app (the booking app's i18n/<code>.json): Jeddah is "जेद्दाह" and the circuit is "जेद्दाह कॉर्निश सर्किट". Riyadh is "रियाद".
- **ne (नेपाली)**: address the reader as "तपाईं", in standard Nepali. End sentences with "।" and use Latin digits. Match the booking app (the booking app's i18n/<code>.json): Jeddah is "जेद्दा" and the circuit is "जेद्दा कोर्निश सर्किट". Riyadh is "रियाद".
- **bn (বাংলা)**: address the reader as "আপনি", in standard Bangladeshi Bengali. End sentences with "।" and use Latin digits. Match the booking app (the booking app's i18n/<code>.json): Jeddah is "জেদ্দা" and the circuit is "জেদ্দা কর্নিশ সার্কিট". Riyadh is "রিয়াদ".
- **zh (简体中文)**: use polite "您", in mainland conventions. Jeddah is 吉达, Riyadh is 利雅得 and the circuit is 吉达滨海赛道. Use full-width punctuation (，。：？！、「」 or “”). Put a space between Chinese characters and Latin letters or numbers, as Apple China does. Road bike is 公路车, mountain bike is 山地车, hybrid is 城市休闲车 (or 混合动力自行车, but never 混动; choose one and keep it), gravel bike is 砾石公路车 and kids bike is 儿童自行车.
- **ja (日本語)**: use polite です/ます style. Jeddah is ジェッダ (as Japanese F1 coverage writes it; use it everywhere), Riyadh is リヤド and the circuit is ジェッダ・コーニッシュ・サーキット. Use full-width punctuation, with no spaces between Japanese and numbers. Road bike is ロードバイク, mountain bike is マウンテンバイク, hybrid is クロスバイク, gravel bike is グラベルロード or グラベルバイク and kids bike is キッズバイク. Groupset is コンポーネント.
