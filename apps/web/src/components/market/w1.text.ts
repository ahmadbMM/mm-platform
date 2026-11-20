// The Marketplace: browse, the listing page and the shop page (W1). This builder's own words, in English and Arabic; every other
// language translates the English (src/i18n/tx). The shared words are in Market.text.ts.
//
// Nothing here explains or hints: a control is named, a state is said, and that is all (the house rule). What a
// seller wrote - a title, a description, a fault, a shop's name - is never translated and is not here.
export const T = {
  en: {
    metaDesc: "Used and new sports gear from people and shops across Saudi Arabia.",
    // the browse page
    search: "Search", searchHint: "Search listings",
    sports: "Sports", all: "All",
    seller: "Seller", sellers: { private: "Private", shop: "Shops", company: "MicroMobility" } as Record<string, string>,
    city: "City", allCities: "All cities",
    sort: "Sort", sorts: { new: "Newest", price_asc: "Price: low to high", price_desc: "Price: high to low" } as Record<string, string>,
    filters: "Filters", filtersOn: (n: number) => `Filters (${n})`,
    type: "Product type", allTypes: "All types",
    condition: "Condition", anyCondition: "Any condition",
    price: "Price", priceMin: "From", priceMax: "To",
    apply: "Show results", clear: "Clear filters", clearAll: "Clear all",
    listings: "Listings",
    more: "Show more", loading: "Loading…",
    empty: "No listings yet.",
    none: "Nothing matches your search.",
    nearby: "Try another category", allListings: "All listings",
    newest: "Newest listings",
    loadError: "The listings could not be loaded.",
    // a listing's page
    crumbs: "Breadcrumb",
    photos: "Photos", photoOf: (i: number, n: number) => `Photo ${i} of ${n}`,
    enlarge: "Enlarge photo", prevPhoto: "Previous photo", nextPhoto: "Next photo", zoomIn: "Zoom in", zoomOut: "Zoom out",
    details: "Details", description: "Description", faults: "Known faults",
    facts: {
      category: "Category", brand: "Brand", model: "Model", year: "Year", frame_size: "Frame size", wheel_size: "Wheel size",
      size: "Size", for_whom: "Made for", condition: "Condition", city: "City", serial: "Frame or serial number",
    } as Record<string, string>,
    who: { men: "Men", women: "Women", unisex: "Unisex", kids: "Kids" } as Record<string, string>,
    other: "Other",
    declared: "Declared by the seller",
    declarations: {
      complete: "Complete device", unmodified: "Not modified", speed_25: "Top assisted speed 25 km/h or less", charger: "Original charger included",
    } as Record<string, string>,
    share: "Share", copied: "Link copied",
    similar: "Similar items",
    // what a seller reads on their own listing's page
    yours: "This is your listing", edit: "Edit", until: (date: string) => `On sale until ${date}`, reason: "Reason",
    // a listing that is no longer shown
    goneTitle: "This listing is no longer available", browse: "Browse the Marketplace",
    // a shop's page
    shopDetails: "Shop details", cr: "Commercial registration", activity: "Registered activity", vat: "VAT number", address: "Address",
    returns: "Return terms", aboutShop: "About the shop", sells: "What it sells",
    shopItems: "On sale from this shop", shopEmpty: "This shop has nothing on sale right now.",
    // the site's search
    searchListing: "Marketplace listing", searchShop: "Shop in the Marketplace",
  },
  ar: {
    metaDesc: "معدات رياضية مستعملة وجديدة يعرضها أفراد ومتاجر من أنحاء المملكة.",
    search: "بحث", searchHint: "ابحث في الإعلانات",
    sports: "الرياضات", all: "الكل",
    seller: "البائع", sellers: { private: "أفراد", shop: "متاجر", company: "MicroMobility" } as Record<string, string>,
    city: "المدينة", allCities: "كل المدن",
    sort: "الترتيب", sorts: { new: "الأحدث", price_asc: "السعر: من الأقل إلى الأعلى", price_desc: "السعر: من الأعلى إلى الأقل" } as Record<string, string>,
    filters: "التصفية", filtersOn: (n: number) => `التصفية (${n})`,
    type: "نوع المنتج", allTypes: "كل الأنواع",
    condition: "الحالة", anyCondition: "أي حالة",
    price: "السعر", priceMin: "من", priceMax: "إلى",
    apply: "اعرض النتائج", clear: "امسح التصفية", clearAll: "امسح الكل",
    listings: "الإعلانات",
    more: "اعرض المزيد", loading: "جارٍ التحميل…",
    empty: "لا توجد إعلانات بعد.",
    none: "لا شيء يطابق بحثك.",
    nearby: "جرّب قسماً آخر", allListings: "كل الإعلانات",
    newest: "أحدث الإعلانات",
    loadError: "تعذّر تحميل الإعلانات.",
    crumbs: "مسار الصفحة",
    photos: "الصور", photoOf: (i: number, n: number) => `الصورة ${i} من ${n}`,
    enlarge: "كبّر الصورة", prevPhoto: "الصورة السابقة", nextPhoto: "الصورة التالية", zoomIn: "تكبير", zoomOut: "تصغير",
    details: "التفاصيل", description: "الوصف", faults: "عيوب معروفة",
    facts: {
      category: "القسم", brand: "العلامة", model: "الموديل", year: "سنة الصنع", frame_size: "مقاس الهيكل", wheel_size: "مقاس العجلة",
      size: "المقاس", for_whom: "مخصّص لـ", condition: "الحالة", city: "المدينة", serial: "رقم الهيكل أو الرقم التسلسلي",
    } as Record<string, string>,
    who: { men: "الرجال", women: "النساء", unisex: "الجنسين", kids: "الأطفال" } as Record<string, string>,
    other: "آخر",
    declared: "أقرّ به البائع",
    declarations: {
      complete: "جهاز كامل", unmodified: "غير معدَّل", speed_25: "أقصى سرعة بمساعدة المحرك 25 كم/س أو أقل", charger: "الشاحن الأصلي مرفق",
    } as Record<string, string>,
    share: "مشاركة", copied: "نُسخ الرابط",
    similar: "أغراض مشابهة",
    yours: "هذا إعلانك", edit: "تعديل", until: (date: string) => `معروض حتى ${date}`, reason: "السبب",
    goneTitle: "هذا الإعلان لم يعد متاحاً", browse: "تصفّح السوق",
    shopDetails: "بيانات المتجر", cr: "السجل التجاري", activity: "النشاط المسجَّل", vat: "الرقم الضريبي", address: "العنوان",
    returns: "شروط الإرجاع", aboutShop: "عن المتجر", sells: "ماذا يبيع",
    shopItems: "معروض من هذا المتجر", shopEmpty: "لا يعرض هذا المتجر شيئاً للبيع حالياً.",
    searchListing: "إعلان في السوق", searchShop: "متجر في السوق",
  },
};
export type W1Words = typeof T.en;
