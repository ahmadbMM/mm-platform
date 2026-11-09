-- The online store's catalogue for STAGING (staging.micromobility.sa), from the website design's products.js
-- (launch-site, 2026-09-24): its 15 products less the two service packages (Micro Care, Pro Bike Fitting), which
-- are services and fit none of store_products' categories. Real prices, VAT included; the design's "was" prices,
-- ratings and review counts are left out (a former price needs a Ministry of Commerce discount licence, and the
-- reviews were the design's own), as is "Sold out 4 times". STOCK NUMBERS ARE PLACEHOLDERS. Bikes go by pickup
-- or Jeddah delivery only (ship_ksa false). Photos: apps/web/public/site/store/<slug>/ (the design's uploads and
-- the company's own Salla product photos); the products whose design photo was a stock picture have none yet.
-- Needs rentals migration 20261110150000_online_payments.sql. Run it in the staging project's SQL editor; it can be
-- run again (a product or variant already there is left as it is). NOT FOR PRODUCTION AS IT IS.
begin;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('max', 'bikes', 'Alvas', 'DA54 MAX', 'DA54 MAX', 'ALVAS X1 carbon frame · Shimano 105 2×12 · 8.44 kg', 'إطار كربون ALVAS X1 · شيمانو 105 ‏2×12 · 8.44 كغ',
  'Our flagship road machine: ALVAS X1 carbon with super aero tubes, endurance geometry and a full Shimano 105 R7100 groupset with hydraulic discs.',
  'دراجتنا الرائدة: كربون ALVAS X1 بأنابيب انسيابية وهندسة تحمّل ومجموعة شيمانو 105 R7100 كاملة مع فرامل هيدروليكية.',
  '[{"en": ["Frame", "ALVAS X1 Carbon, Super Aero Tubes"], "ar": ["الإطار", "كربون ALVAS X1 انسيابي"]}, {"en": ["Groupset", "Shimano 105 R7100, 2×12"], "ar": ["المجموعة", "شيمانو 105 R7100 ‏2×12"]}, {"en": ["Wheels", "HELUX DD5 Carbon, 700×60mm"], "ar": ["العجلات", "HELUX DD5 كربون 700×60مم"]}, {"en": ["Weight", "8.44 kg"], "ar": ["الوزن", "8.44 كغ"]}, {"en": ["Sizes", "XS–XXL"], "ar": ["المقاسات", "XS–XXL"]}]'::jsonb, '{/site/store/max/1.webp,/site/store/max/2.webp,/site/store/max/3.webp,/site/store/max/4.webp}'::text[], 8435, null, false, true, 10)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('MAX-XS', 'XS', 1, 1),
  ('MAX-S', 'S', 2, 2),
  ('MAX-M', 'M', 3, 3),
  ('MAX-L', 'L', 3, 4),
  ('MAX-XL', 'XL', 2, 5),
  ('MAX-XXL', 'XXL', 1, 6)
) as v(sku, size, stock, sort) where p.slug = 'max'
on conflict (sku) do nothing;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('rival', 'bikes', 'Alvas', 'DA54 RIVAL', 'DA54 RIVAL', 'ALVAS X1 carbon frame · SRAM Rival 2×12 · 8.56 kg', 'إطار كربون ALVAS X1 · سرام رايفل 2×12 · 8.56 كغ',
  'Race performance at the top of the range: ALVAS X1 carbon with a full SRAM Rival 2×12 groupset, HELUX DD5 carbon wheels and Michelin tires.',
  'أداء سباق في قمة الفئة: كربون ALVAS X1 مع مجموعة سرام رايفل 2×12 كاملة وعجلات HELUX DD5 كربون وإطارات ميشلان.',
  '[{"en": ["Frame", "ALVAS X1 Carbon, Super Aero Tubes"], "ar": ["الإطار", "كربون ALVAS X1 انسيابي"]}, {"en": ["Groupset", "SRAM Rival, 2×12"], "ar": ["المجموعة", "سرام رايفل 2×12"]}, {"en": ["Wheels", "HELUX DD5 Carbon, 700×60mm"], "ar": ["العجلات", "HELUX DD5 كربون 700×60مم"]}, {"en": ["Weight", "8.56 kg"], "ar": ["الوزن", "8.56 كغ"]}, {"en": ["Sizes", "XS–XXL"], "ar": ["المقاسات", "XS–XXL"]}]'::jsonb, '{/site/store/rival/1.webp}'::text[], 15304, null, false, true, 20)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('RIVAL-XS', 'XS', 1, 1),
  ('RIVAL-S', 'S', 1, 2),
  ('RIVAL-M', 'M', 2, 3),
  ('RIVAL-L', 'L', 2, 4),
  ('RIVAL-XL', 'XL', 1, 5),
  ('RIVAL-XXL', 'XXL', 1, 6)
) as v(sku, size, stock, sort) where p.slug = 'rival'
on conflict (sku) do nothing;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('ttbgp', 'bikes', 'Alvas', 'ALVAS TT BGP', 'ALVAS TT BGP', 'ALVAS TT carbon aero frame · Dura-Ace Di2 2×12 · Disc and tri-spoke carbon wheels', 'إطار TT كربون انسيابي · دورا آيس Di2 ‏2×12 · عجلات قرصية وثلاثية الأذرع',
  'The time-trial superbike: ALVAS TT carbon in a colour-shift BGP finish with full Shimano Dura-Ace Di2 R9250, Profile Design ATTK IC cockpit, rear disc wheel and tri-spoke carbon front.',
  'دراجة السباق ضد الساعة: كربون ALVAS TT بطلاء متحوّل الألوان مع مجموعة شيمانو دورا آيس Di2 كاملة ومقود Profile Design ATTK IC وعجلة خلفية قرصية وأمامية ثلاثية الأذرع.',
  '[{"en": ["Frame", "ALVAS TT Carbon, BGP colour-shift"], "ar": ["الإطار", "كربون ALVAS TT بطلاء متحوّل"]}, {"en": ["Groupset", "Shimano Dura-Ace Di2 R9250, 2×12"], "ar": ["المجموعة", "شيمانو دورا آيس Di2 ‏2×12"]}, {"en": ["Cockpit", "Profile Design ATTK IC aerobars"], "ar": ["المقود", "Profile Design ATTK IC"]}, {"en": ["Wheels", "Rear disc + 3-spoke carbon"], "ar": ["العجلات", "خلفية قرصية + أمامية ثلاثية كربون"]}, {"en": ["Tyres", "Michelin Power Cup 700×28C"], "ar": ["الإطارات", "ميشلان Power Cup ‏700×28C"]}, {"en": ["Sizes", "S–L"], "ar": ["المقاسات", "S–L"]}]'::jsonb, '{/site/store/ttbgp/1.webp,/site/store/ttbgp/2.webp,/site/store/ttbgp/3.webp,/site/store/ttbgp/4.webp}'::text[], 22999, null, false, true, 30)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('TTBGP-S', 'S', 1, 1),
  ('TTBGP-M', 'M', 1, 2),
  ('TTBGP-L', 'L', 1, 3)
) as v(sku, size, stock, sort) where p.slug = 'ttbgp'
on conflict (sku) do nothing;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('da54al', 'bikes', 'Alvas', 'ALVAS DA54 AL', 'ألفاس DA54 AL', 'Alloy frame, carbon aero fork · Sensha hydraulic discs · 9.5 kg', 'إطار ألمنيوم وشوكة كربون · فرامل سينشا هيدروليكية · 9.5 كغ',
  'The everyday road bike: 6061 T6 alloy frame with a carbon aero fork, Sensha Empire Pro hydraulic discs and a Garmin-ready aero cockpit.',
  'دراجة الطريق اليومية: إطار ألمنيوم 6061 T6 مع شوكة كربون انسيابية وفرامل سينشا إمباير برو هيدروليكية ومقود جاهز لأجهزة قارمن.',
  '[{"en": ["Frame", "Aluminum 6061 T6, Flat Mount Disc"], "ar": ["الإطار", "ألمنيوم 6061 T6"]}, {"en": ["Fork", "Carbon Aero, Integrated Routing"], "ar": ["الشوكة", "كربون انسيابية"]}, {"en": ["Brakes", "Sensha Empire Pro HRD"], "ar": ["الفرامل", "سينشا إمباير برو هيدروليكية"]}, {"en": ["Weight", "9.5 kg"], "ar": ["الوزن", "9.5 كغ"]}, {"en": ["Sizes", "S / M"], "ar": ["المقاسات", "S / M"]}]'::jsonb, '{/site/store/da54al/1.webp}'::text[], 4783, null, false, true, 40)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('DA54AL-S', 'S', 3, 1),
  ('DA54AL-M', 'M', 2, 2)
) as v(sku, size, stock, sort) where p.slug = 'da54al'
on conflict (sku) do nothing;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('strom', 'bikes', 'Alvas', 'ALVAS STROM M50', 'ألفاس STROM M50', 'Aluminum 6061 T6 frame · Shimano Deore 1×11 · 27.5/29" wheels', 'إطار ألمنيوم 6061 T6 · شيمانو ديور 1×11 · عجلات 27.5/29"',
  'The mountain bike for Saudi trails: 6061 T6 alloy frame, lockout suspension fork and a Shimano Deore 1×11 drivetrain.',
  'الدراجة الجبلية لمسارات السعودية: إطار ألمنيوم 6061 T6 وشوكة تعليق بقفل ومجموعة شيمانو ديور 1×11.',
  '[{"en": ["Frame", "Aluminum 6061 T6, Disc Mount"], "ar": ["الإطار", "ألمنيوم 6061 T6"]}, {"en": ["Fork", "ALVAS Suspension, Lockout"], "ar": ["الشوكة", "تعليق ALVAS بقفل"]}, {"en": ["Drivetrain", "Shimano Deore 1×11"], "ar": ["المجموعة", "شيمانو ديور 1×11"]}, {"en": ["Weight", "14 kg"], "ar": ["الوزن", "14 كغ"]}, {"en": ["Sizes", "27.5/29 - S / M / L"], "ar": ["المقاسات", "27.5/29 - S / M / L"]}]'::jsonb, '{/site/store/strom/1.webp}'::text[], 1900, null, false, true, 50)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('STROM-S', 'S', 2, 1),
  ('STROM-M', 'M', 3, 2),
  ('STROM-L', 'L', 2, 3)
) as v(sku, size, stock, sort) where p.slug = 'strom'
on conflict (sku) do nothing;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('tourist', 'bikes', 'Alvas', 'Alvas TOURIST', 'ألفاس TOURIST', 'Comfort hybrid · City and corniche rides · 12 kg', 'هجينة مريحة · للمدينة والكورنيش · 12 كغ',
  'The comfortable city hybrid: upright geometry for corniche loops, errands and easy everyday riding.',
  'الهجينة المريحة للمدينة: جلسة مستقيمة لجولات الكورنيش والمشاوير والركوب اليومي السهل.',
  '[{"en": ["Frame", "Aluminum, comfort geometry"], "ar": ["الإطار", "ألمنيوم بهندسة مريحة"]}, {"en": ["Weight", "12 kg"], "ar": ["الوزن", "12 كغ"]}, {"en": ["Use", "City & light touring"], "ar": ["الاستخدام", "المدينة والرحلات الخفيفة"]}, {"en": ["Sizes", "One size"], "ar": ["المقاسات", "مقاس واحد"]}]'::jsonb, '{/site/store/tourist/1.webp}'::text[], 1300, null, false, true, 60)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('TOURIST', null, 3, 1)
) as v(sku, size, stock, sort) where p.slug = 'tourist'
on conflict (sku) do nothing;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('bmx26', 'bikes', 'Alvas', 'ALVAS HAPPY JUMP BMX 26', 'ألفاس HAPPY JUMP BMX 26', '26" BMX · Suspension fork · 11 kg', 'بي إم إكس 26" · شوكة تعليق · 11 كغ',
  'The 26-inch BMX for jumps, parks and play, with a suspension fork and a frame built to take a beating.',
  'دراجة BMX مقاس 26 للقفزات والحدائق واللعب، بشوكة تعليق وإطار يتحمّل الاستخدام القاسي.',
  '[{"en": ["Frame", "Aluminum BMX 26\""], "ar": ["الإطار", "ألمنيوم BMX ‏26\""]}, {"en": ["Fork", "Suspension"], "ar": ["الشوكة", "تعليق"]}, {"en": ["Weight", "11 kg"], "ar": ["الوزن", "11 كغ"]}, {"en": ["Sizes", "One size"], "ar": ["المقاسات", "مقاس واحد"]}]'::jsonb, '{/site/store/bmx26/1.webp}'::text[], 2600, null, false, true, 70)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('BMX26', null, 2, 1)
) as v(sku, size, stock, sort) where p.slug = 'bmx26'
on conflict (sku) do nothing;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('edge850', 'accessories', 'Garmin', 'Garmin Edge 850', 'قارمن Edge 850', 'GPS bike computer · Authorised seller', 'كمبيوتر دراجة GPS · بائع معتمد',
  'Garmin''s touchscreen GPS bike computer with training insights and navigation, with the official Saudi warranty from an authorised seller.',
  'كمبيوتر دراجة GPS بشاشة لمس من قارمن مع تحليلات تدريب وملاحة، بضمان سعودي رسمي من بائع معتمد.',
  '[{"en": ["Type", "GPS bike computer"], "ar": ["النوع", "كمبيوتر دراجة GPS"]}, {"en": ["Battery", "Up to 36 h (saver mode)"], "ar": ["البطارية", "حتى 36 ساعة (وضع التوفير)"]}, {"en": ["Warranty", "Official KSA"], "ar": ["الضمان", "سعودي رسمي"]}]'::jsonb, '{/site/store/edge850/1.webp}'::text[], 2208, null, true, true, 80)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('EDGE850', null, 6, 1)
) as v(sku, size, stock, sort) where p.slug = 'edge850'
on conflict (sku) do nothing;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('varia', 'accessories', 'Garmin', 'Garmin Varia RTL515', 'قارمن Varia RTL515', 'Rear radar and light · Vehicle alerts', 'رادار خلفي مع إضاءة · تنبيهات المركبات',
  'Rear-view radar with a tail light: it alerts you to vehicles approaching from up to 140 m behind.',
  'رادار رؤية خلفية مع ضوء: ينبّهك للمركبات القادمة من مسافة تصل إلى 140 م.',
  '[{"en": ["Radar range", "140 m"], "ar": ["مدى الرادار", "140 م"]}, {"en": ["Light", "65 lumen"], "ar": ["الإضاءة", "65 لومن"]}, {"en": ["Battery", "Up to 16 h"], "ar": ["البطارية", "حتى 16 ساعة"]}]'::jsonb, '{}'::text[], 799, null, true, true, 90)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('VARIA', null, 8, 1)
) as v(sku, size, stock, sort) where p.slug = 'varia'
on conflict (sku) do nothing;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('helmet', 'accessories', null, 'Aero Helmet', 'خوذة انسيابية', 'MIPS protection · Vented for heat', 'حماية MIPS · تهوية للحرارة',
  'MIPS-protected aero helmet with generous venting for Jeddah heat.',
  'خوذة انسيابية بحماية MIPS وتهوية سخية لحرارة جدة.',
  '[{"en": ["Protection", "MIPS"], "ar": ["الحماية", "MIPS"]}, {"en": ["Weight", "280 g"], "ar": ["الوزن", "280 غ"]}, {"en": ["Sizes", "M / L"], "ar": ["المقاسات", "M / L"]}]'::jsonb, '{}'::text[], 520, null, true, true, 100)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('HELMET-M', 'M', 7, 1),
  ('HELMET-L', 'L', 5, 2)
) as v(sku, size, stock, sort) where p.slug = 'helmet'
on conflict (sku) do nothing;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('lights', 'accessories', null, 'Light Set', 'طقم إضاءة', '600 lumen front · USB-C charging', 'أمامي 600 لومن · شحن USB-C',
  '600-lumen front and smart rear light, both USB-C rechargeable.',
  'إضاءة أمامية 600 لومن وخلفية ذكية، كلاهما بشحن USB-C.',
  '[{"en": ["Front", "600 lumen"], "ar": ["الأمامي", "600 لومن"]}, {"en": ["Rear", "Smart brake light"], "ar": ["الخلفي", "ضوء فرامل ذكي"]}, {"en": ["Charging", "USB-C"], "ar": ["الشحن", "USB-C"]}]'::jsonb, '{}'::text[], 240, null, true, true, 110)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('LIGHTS', null, 12, 1)
) as v(sku, size, stock, sort) where p.slug = 'lights'
on conflict (sku) do nothing;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('jersey', 'apparel', 'Micromobility', 'Club Jersey', 'قميص النادي', 'Breathable mesh · Micromobility colours', 'نسيج يتنفس · ألوان مايكروموبيليتي',
  'Breathable club jersey in Micromobility colours, made for hot coastal rides.',
  'قميص نادٍ يتنفس بألوان مايكروموبيليتي، صُنع لرحلات الساحل الحارة.',
  '[{"en": ["Fabric", "Breathable mesh"], "ar": ["القماش", "شبك يتنفس"]}, {"en": ["Fit", "Race / relaxed"], "ar": ["القَصّة", "سباق / مريحة"]}, {"en": ["Sizes", "S–XXL"], "ar": ["المقاسات", "S–XXL"]}]'::jsonb, '{}'::text[], 380, null, true, true, 120)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('JERSEY-S', 'S', 6, 1),
  ('JERSEY-M', 'M', 10, 2),
  ('JERSEY-L', 'L', 10, 3),
  ('JERSEY-XL', 'XL', 6, 4),
  ('JERSEY-XXL', 'XXL', 3, 5)
) as v(sku, size, stock, sort) where p.slug = 'jersey'
on conflict (sku) do nothing;

insert into public.store_products (slug, category, brand, name_en, name_ar, tagline_en, tagline_ar, description_en, description_ar, specs, images, price, compare_at, ship_ksa, published, sort)
values ('cap', 'apparel', 'Micromobility', 'Micro Cycling Cap', 'قبعة مايكرو', 'Cotton twill · Green under-brim', 'قطن محبوك · أخضر تحت الحافة',
  'Classic cotton cycling cap with the Micromobility green under-brim.',
  'قبعة دراجات قطنية كلاسيكية بلون مايكروموبيليتي الأخضر تحت الحافة.',
  '[{"en": ["Fabric", "Cotton twill"], "ar": ["القماش", "قطن محبوك"]}, {"en": ["Fit", "One size"], "ar": ["المقاس", "مقاس واحد"]}, {"en": ["Care", "Machine washable"], "ar": ["العناية", "قابلة للغسل"]}]'::jsonb, '{}'::text[], 120, null, true, true, 130)
on conflict (slug) do nothing;
insert into public.store_variants (product_id, sku, size, stock, sort)
select p.id, v.sku, v.size, v.stock, v.sort from public.store_products p, (values
  ('CAP', null, 15, 1)
) as v(sku, size, stock, sort) where p.slug = 'cap'
on conflict (sku) do nothing;

commit;

-- What it made:
-- select p.slug, p.price, count(v.*) variants, sum(v.stock) stock from store_products p left join store_variants v on v.product_id = p.id group by 1, 2 order by min(p.sort);
