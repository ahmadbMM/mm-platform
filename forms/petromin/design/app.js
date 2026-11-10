/* The Petromin bike night registration: language switching, tile selection, inline validation, state helpers.
   Replace the submit handler with the real request; everything else can stay. */
(function () {
  var LANGS = { ar: "العربية", en: "English", fr: "Français", hi: "हिन्दी", ur: "اردو", ne: "नेपाली", pt: "Português", es: "Español", tl: "Tagalog", bn: "বাংলা", id: "Bahasa Indonesia", ms: "Bahasa Melayu", de: "Deutsch", ru: "Русский", zh: "简体中文", ja: "日本語" };
  var RTL = { ar: true, ur: true };
  var T = {
    ar: {
      "Your registration for {d} is confirmed.": "تم تأكيد تسجيلك لجلسة {d}.",
      "Booking": "الحجز",
      "Enter a valid mobile number": "أدخل رقم جوال صحيح",
      "Your company": "شركتك",
      "Choose your company": "اختر شركتك",
      "Badge number": "رقم البطاقة",
      "Full name": "الاسم الكامل",
      "Mobile number": "رقم الجوال",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "أدخل رقم جوال سعودي صحيح (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "هذا ليس رقم جوال تابعًا للرمز ‎+{c}. يُرجى التحقق منه.",
      "Height in cm": "الطول بالسنتيمتر",
      "Bike type": "نوع الدراجة",
      "Hybrid": "هايبرد",
      "Mountain": "جبلية",
      "Register": "تسجيل",
      "Registering...": "جارٍ التسجيل...",
      "Enter your badge number": "أدخل رقم بطاقتك",
      "Enter your full name": "أدخل اسمك الكامل",
      "Enter your height in cm (100 to 250)": "أدخل طولك بالسنتيمتر (100 إلى 250)",
      "Choose a bike type": "اختر نوع الدراجة",
      "Could not reach the server": "تعذر الوصول إلى الخادم",
      "Too many submissions from this network": "عدد كبير من الطلبات من هذه الشبكة",
      "Dismiss": "إغلاق",
      "You are registered": "تم تسجيلك",
      "Badge": "بطاقة",
      "MicroMobility, Jeddah": "مايكروموبيليتي، جدة",
      "Need help? WhatsApp us": "تحتاج مساعدة؟ راسلنا على واتساب",
      "Session": "الجلسة",
      "Your details": "بياناتك",
      "Bike": "الدراجة",
      "Choose your session": "اختر جلستك",
      "Choose a session": "اختر جلسة",
      "Height and bike": "الطول والدراجة",
      "Back": "رجوع",
      "Continue": "متابعة",
      "No upcoming sessions": "لا توجد جلسات قادمة",
      "Name": "الاسم",
      "Company": "الشركة",
      "riders": "ركاب",
      "Riding with someone?": "هل تركب مع أحد؟",
      "Add another rider": "إضافة راكب آخر",
      "Rider {n}": "الراكب {n}",
      "Remove": "إزالة",
      "Enter the rider's full name": "أدخل الاسم الكامل للراكب",
      "Enter the rider's height in cm (100 to 250)": "أدخل طول الراكب بالسنتيمتر (100 إلى 250)",
      "Riding with: {names}": "يركب معك: {names}",
      "Up to four companions": "حتى أربعة مرافقين",
      "Edit my booking": "تعديل حجزي",
      "Edit your booking": "تعديل حجزك",
      "Save changes": "حفظ التغييرات",
      "Saving...": "جارٍ الحفظ...",
      "Your booking was updated.": "تم تحديث حجزك.",
      "We could not find your booking. Please register again.": "لم نجد حجزك. يرجى التسجيل من جديد.",
      "You have already checked in. Ask the desk to change your booking.": "لقد سجّلت الدخول بالفعل. اطلب من المكتب تغيير حجزك.",
      "This badge is already registered for that session": "هذا البادج مسجّل بالفعل لتلك الجلسة",
      "Cancel": "إلغاء",
      "This session is no longer open": "هذه الجلسة لم تعد متاحة",
      "Your details were updated.": "تم تحديث بياناتك.",
      "I have read the Privacy Notice.": "قرأت إشعار الخصوصية.",
      "Read the Privacy Notice": "اقرأ إشعار الخصوصية",
      "Please confirm you’ve read the Privacy Notice.": "يرجى تأكيد قراءتك لإشعار الخصوصية.",
      "Privacy Notice": "إشعار الخصوصية",
      "This notice is available in English and Arabic.": "هذا الإشعار متاح باللغتين العربية والإنجليزية.",
      "Close": "إغلاق",
      "Names can only contain letters, spaces and periods.": "يمكن أن يحتوي الاسم على حروف ومسافات ونقاط فقط.",
      "Write your first and last name in full, not initials": "اكتب اسمك الأول واسم العائلة كاملين، لا الأحرف الأولى فقط",
      "Write the rider's name in full, not initials": "اكتب اسم الراكب كاملًا، لا الأحرف الأولى فقط",
      "Ride waiver": "إقرار الركوب",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "لا يمكنك حجز أي رحلة أو نشاط لدى مايكروموبيليتي إلا بعد قراءة هذا الإقرار والموافقة عليه. ركوب الدراجة نشاط بدني ينطوي على مخاطر، وأشارك فيه على مسؤوليتي الشخصية بالكامل، وأتحمل وحدي المسؤولية عن نفسي وسلامتي وممتلكاتي الشخصية. وأنا مسؤول عن أي أضرار ألحقها بالآخرين أو بممتلكاتهم. وإلى أقصى حد يسمح به النظام، لا تتحمل مايكروموبيليتي ولا موظفوها ولا شركاؤها أي مسؤولية عن أي شيء يحدث لي أو لممتلكاتي، بما في ذلك أي إصابة أو كسر أو مرض أو فقدان أو سرقة أو تلف، أيًّا كان سببه، أثناء النشاط أو بسببه. وأتعهد بارتداء الخوذة والالتزام بتعليمات الفريق والمسار، وأتحمل مسؤولية أي ضرر يلحق بالدراجة المستأجرة نتيجة سوء الاستخدام، وتُعاد الدراجة بحالتها عند الاستلام.",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "قرأت الإقرار وأوافق عليه نيابةً عن كل راكب في هذا التسجيل",
      "Please accept the waiver to continue.": "يرجى الموافقة على الإقرار للمتابعة.",
      "Register another": "تسجيل شخص آخر",
      "Other registrations on this phone": "تسجيلات أخرى على هذا الجوال",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "تغيّر إقرار الركوب. أعد تحميل هذه الصفحة لقراءة الإقرار الجديد والموافقة عليه.",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "هذا الحجز مدفوع، لذا لا يمكن نقله إلى جلسة بسعر مختلف. اطلب من المكتب تغييره.",
      "Language": "اللغة",
      "Country code": "رمز الدولة",
      "Progress": "التقدم",
      "Booking QR code": "رمز QR للحجز",
      "Petromin bike night": "ليلة دراجات بترومين",
      "Check and agree": "المراجعة والموافقة",
      "Find my booking": "ابحث عن حجزي",
      "Read the waiver": "اقرأ الإقرار",
      "Agree and register": "أوافق وأسجّل",
      "Bike pickup": "استلام الدراجة",
      "Where": "المكان",
      "Helmets are required. One comes with every bike.": "الخوذة إلزامية، وتأتي خوذة مع كل دراجة.",
      "Add to Apple Wallet": "إضافة إلى Apple Wallet",
      "Add to calendar": "أضف إلى التقويم",
      "Directions": "الاتجاهات",
      "Change": "تغيير",
      "Booking number": "رقم الحجز",
      "Jeddah Corniche Circuit": "حلبة كورنيش جدة",
      "Cancel my booking": "إلغاء حجزي",
      "Save": "حفظ",
      "Enter your booking number": "أدخل رقم حجزك",
      "Bikes from {t}": "الدراجات من {t}",
      "{n} cm": "{n} سم",
      "Remove {name} from this booking?": "إزالة {name} من هذا الحجز؟",
      "Cancel booking {no}? Every rider on it loses their place.": "إلغاء الحجز {no}؟ سيفقد كل راكب فيه مكانه.",
      "Cancel booking": "إلغاء الحجز",
      "Keep it": "الإبقاء عليه",
      "Your booking was cancelled.": "تم إلغاء حجزك.",
      "We could not save this. Please try again.": "لم نتمكن من حفظ ذلك. يرجى المحاولة مرة أخرى.",
      "The desk has this booking. Ask the desk to cancel it.": "هذا الحجز لدى المكتب. اطلب من المكتب إلغاءه.",
      "We could not find a booking with this number and mobile number.": "لم نجد حجزًا بهذا الرقم ورقم الجوال."
    },
    hi: {
      "Your registration for {d} is confirmed.": "{d} के लिए आपका पंजीकरण पक्का हो गया है।",
      "Booking": "बुकिंग",
      "Enter a valid mobile number": "मान्य मोबाइल नंबर दर्ज करें",
      "Your company": "आपकी कंपनी",
      "Choose your company": "अपनी कंपनी चुनें",
      "Badge number": "बैज नंबर",
      "Full name": "पूरा नाम",
      "Mobile number": "मोबाइल नंबर",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "मान्य सऊदी मोबाइल नंबर दर्ज करें (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "यह +{c} का मोबाइल नंबर नहीं है। कृपया इसे जाँचें।",
      "Height in cm": "ऊँचाई (सेमी में)",
      "Bike type": "साइकिल का प्रकार",
      "Hybrid": "हाइब्रिड",
      "Mountain": "माउंटेन",
      "Register": "पंजीकरण करें",
      "Registering...": "पंजीकरण हो रहा है...",
      "Enter your badge number": "अपना बैज नंबर दर्ज करें",
      "Enter your full name": "अपना पूरा नाम दर्ज करें",
      "Enter your height in cm (100 to 250)": "अपनी ऊँचाई सेमी में दर्ज करें (100 से 250)",
      "Choose a bike type": "साइकिल का प्रकार चुनें",
      "Could not reach the server": "सर्वर से संपर्क नहीं हो सका",
      "Too many submissions from this network": "इस नेटवर्क से बहुत अधिक सबमिशन हुए हैं",
      "Dismiss": "बंद करें",
      "You are registered": "आपका पंजीकरण हो गया",
      "Badge": "बैज",
      "MicroMobility, Jeddah": "MicroMobility, जेद्दाह",
      "Need help? WhatsApp us": "मदद चाहिए? हमें WhatsApp करें",
      "Session": "सत्र",
      "Your details": "आपकी जानकारी",
      "Bike": "साइकिल",
      "Choose your session": "अपना सत्र चुनें",
      "Choose a session": "एक सत्र चुनें",
      "Height and bike": "ऊँचाई और साइकिल",
      "Back": "पीछे",
      "Continue": "आगे बढ़ें",
      "No upcoming sessions": "कोई आगामी सत्र नहीं",
      "Name": "नाम",
      "Company": "कंपनी",
      "riders": "सवार",
      "Riding with someone?": "किसी के साथ सवारी कर रहे हैं?",
      "Add another rider": "एक और सवार जोड़ें",
      "Rider {n}": "सवार {n}",
      "Remove": "हटाएँ",
      "Enter the rider's full name": "सवार का पूरा नाम दर्ज करें",
      "Enter the rider's height in cm (100 to 250)": "सवार की लंबाई सेमी में दर्ज करें (100 से 250)",
      "Riding with: {names}": "आपके साथ: {names}",
      "Up to four companions": "अधिकतम चार साथी",
      "Edit my booking": "मेरी बुकिंग संपादित करें",
      "Edit your booking": "अपनी बुकिंग संपादित करें",
      "Save changes": "बदलाव सहेजें",
      "Saving...": "सहेजा जा रहा है...",
      "Your booking was updated.": "आपकी बुकिंग अपडेट हो गई।",
      "We could not find your booking. Please register again.": "हमें आपकी बुकिंग नहीं मिली। कृपया फिर से पंजीकरण करें।",
      "You have already checked in. Ask the desk to change your booking.": "आप पहले ही चेक-इन कर चुके हैं। बुकिंग बदलने के लिए डेस्क से कहें।",
      "This badge is already registered for that session": "यह बैज उस सत्र के लिए पहले से पंजीकृत है",
      "Cancel": "रद्द करें",
      "This session is no longer open": "यह सत्र अब उपलब्ध नहीं है",
      "Your details were updated.": "आपका विवरण अपडेट कर दिया गया।",
      "I have read the Privacy Notice.": "मैंने गोपनीयता सूचना पढ़ ली है।",
      "Read the Privacy Notice": "गोपनीयता सूचना पढ़ें",
      "Please confirm you’ve read the Privacy Notice.": "कृपया पुष्टि करें कि आपने गोपनीयता सूचना पढ़ ली है।",
      "Privacy Notice": "गोपनीयता सूचना",
      "This notice is available in English and Arabic.": "यह सूचना अंग्रेज़ी और अरबी में उपलब्ध है।",
      "Close": "बंद करें",
      "Names can only contain letters, spaces and periods.": "नाम में केवल अक्षर, रिक्त स्थान और बिंदु (.) हो सकते हैं।",
      "Write your first and last name in full, not initials": "अपना पहला और अंतिम नाम पूरा लिखें, सिर्फ़ आद्याक्षर नहीं",
      "Write the rider's name in full, not initials": "सवार का नाम पूरा लिखें, सिर्फ़ आद्याक्षर नहीं",
      "Ride waiver": "राइड छूट-पत्र",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "इस छूट-पत्र को पढ़कर उससे सहमत हुए बिना आप MicroMobility के साथ कोई भी राइड या गतिविधि बुक नहीं कर सकते। साइकिल चलाना एक शारीरिक गतिविधि है जिसमें जोखिम होता है। मैं पूरी तरह अपने जोखिम पर भाग लेता/लेती हूँ, और अपने, अपनी सुरक्षा और अपने निजी सामान के लिए केवल मैं ही ज़िम्मेदार हूँ। दूसरों को या उनकी संपत्ति को मेरे द्वारा पहुँचाए गए किसी भी नुकसान के लिए भी मैं ज़िम्मेदार हूँ। कानून द्वारा अनुमत अधिकतम सीमा तक, MicroMobility, उसके कर्मचारी और उसके साझेदार मेरे या मेरे सामान के साथ होने वाली किसी भी बात के लिए ज़िम्मेदार नहीं हैं, जिसमें कोई भी चोट, हड्डी टूटना, बीमारी, गुम होना, चोरी या नुकसान शामिल है, चाहे उसका कारण कुछ भी हो, गतिविधि के दौरान या उससे जुड़े किसी भी रूप में। मैं हेलमेट पहनने और टीम के निर्देशों और रास्ते का पालन करने के लिए सहमत हूँ, और गलत इस्तेमाल से किराए की साइकिल को हुए किसी भी नुकसान के लिए ज़िम्मेदार हूँ। साइकिल उसी हालत में लौटाई जाती है जिसमें वह मिली थी।",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "मैंने छूट-पत्र पढ़ लिया है और इस पंजीकरण के हर राइडर की ओर से इससे सहमत हूँ",
      "Please accept the waiver to continue.": "जारी रखने के लिए कृपया छूट-पत्र स्वीकार करें।",
      "Register another": "किसी और का पंजीकरण करें",
      "Other registrations on this phone": "इस फ़ोन पर अन्य पंजीकरण",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "राइड छूट-पत्र बदल गया है। नया छूट-पत्र पढ़ने और स्वीकार करने के लिए यह पेज फिर से लोड करें।",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "इस बुकिंग का भुगतान हो चुका है, इसलिए इसे अलग कीमत वाले सत्र में नहीं ले जाया जा सकता। इसे बदलने के लिए डेस्क से कहें।",
      "Language": "भाषा",
      "Country code": "देश कोड",
      "Progress": "प्रगति",
      "Booking QR code": "बुकिंग QR कोड",
      "Petromin bike night": "पेट्रोमिन साइकिल नाइट",
      "Check and agree": "जाँचें और सहमति दें",
      "Find my booking": "मेरी बुकिंग खोजें",
      "Read the waiver": "छूट-पत्र पढ़ें",
      "Agree and register": "सहमत हूँ और पंजीकरण करें",
      "Bike pickup": "साइकिल पिकअप",
      "Where": "कहाँ",
      "Helmets are required. One comes with every bike.": "हेलमेट ज़रूरी है। हर साइकिल के साथ एक हेलमेट मिलता है।",
      "Add to Apple Wallet": "Apple Wallet में जोड़ें",
      "Add to calendar": "कैलेंडर में जोड़ें",
      "Directions": "रास्ता देखें",
      "Change": "बदलें",
      "Booking number": "बुकिंग नंबर",
      "Jeddah Corniche Circuit": "जेद्दाह कॉर्निश सर्किट",
      "Cancel my booking": "मेरी बुकिंग रद्द करें",
      "Save": "सहेजें",
      "Enter your booking number": "अपना बुकिंग नंबर दर्ज करें",
      "Bikes from {t}": "साइकिलें {t} से",
      "{n} cm": "{n} सेमी",
      "Remove {name} from this booking?": "{name} को इस बुकिंग से हटाएँ?",
      "Cancel booking {no}? Every rider on it loses their place.": "बुकिंग {no} रद्द करें? इसमें शामिल हर सवार अपनी जगह खो देगा।",
      "Cancel booking": "बुकिंग रद्द करें",
      "Keep it": "रहने दें",
      "Your booking was cancelled.": "आपकी बुकिंग रद्द कर दी गई।",
      "We could not save this. Please try again.": "हम इसे सहेज नहीं सके। कृपया फिर से कोशिश करें।",
      "The desk has this booking. Ask the desk to cancel it.": "यह बुकिंग डेस्क के पास है। इसे रद्द करने के लिए डेस्क से कहें।",
      "We could not find a booking with this number and mobile number.": "इस नंबर और मोबाइल नंबर से हमें कोई बुकिंग नहीं मिली।"
    },
    tl: {
      "Your registration for {d} is confirmed.": "Kumpirmado ang iyong rehistro para sa {d}.",
      "Booking": "Booking",
      "Enter a valid mobile number": "Maglagay ng wastong numero ng mobile",
      "Your company": "Iyong kumpanya",
      "Choose your company": "Piliin ang iyong kumpanya",
      "Badge number": "Numero ng badge",
      "Full name": "Buong pangalan",
      "Mobile number": "Numero ng mobile",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Maglagay ng wastong Saudi mobile number (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "Hindi ito numero ng mobile para sa +{c}. Pakisuri ito.",
      "Height in cm": "Taas sa cm",
      "Bike type": "Uri ng bisikleta",
      "Hybrid": "Hybrid",
      "Mountain": "Mountain",
      "Register": "Magparehistro",
      "Registering...": "Nagpaparehistro...",
      "Enter your badge number": "Ilagay ang iyong numero ng badge",
      "Enter your full name": "Ilagay ang iyong buong pangalan",
      "Enter your height in cm (100 to 250)": "Ilagay ang iyong taas sa cm (100 hanggang 250)",
      "Choose a bike type": "Pumili ng uri ng bisikleta",
      "Could not reach the server": "Hindi ma-access ang server",
      "Too many submissions from this network": "Masyadong maraming submission mula sa network na ito",
      "Dismiss": "Isara",
      "You are registered": "Nakarehistro ka na",
      "Badge": "Badge",
      "MicroMobility, Jeddah": "MicroMobility, Jeddah",
      "Need help? WhatsApp us": "Kailangan ng tulong? I-WhatsApp kami",
      "Session": "Sesyon",
      "Your details": "Iyong detalye",
      "Bike": "Bisikleta",
      "Choose your session": "Piliin ang iyong sesyon",
      "Choose a session": "Pumili ng sesyon",
      "Height and bike": "Taas at bisikleta",
      "Back": "Bumalik",
      "Continue": "Magpatuloy",
      "No upcoming sessions": "Walang paparating na sesyon",
      "Name": "Pangalan",
      "Company": "Kumpanya",
      "riders": "mga rider",
      "Riding with someone?": "May kasama ka ba?",
      "Add another rider": "Magdagdag ng isa pang rider",
      "Rider {n}": "Rider {n}",
      "Remove": "Alisin",
      "Enter the rider's full name": "Ilagay ang buong pangalan ng rider",
      "Enter the rider's height in cm (100 to 250)": "Ilagay ang taas ng rider sa cm (100 hanggang 250)",
      "Riding with: {names}": "Kasama mo: {names}",
      "Up to four companions": "Hanggang apat na kasama",
      "Edit my booking": "I-edit ang booking ko",
      "Edit your booking": "I-edit ang iyong booking",
      "Save changes": "I-save ang mga pagbabago",
      "Saving...": "Sine-save...",
      "Your booking was updated.": "Na-update ang iyong booking.",
      "We could not find your booking. Please register again.": "Hindi namin nahanap ang iyong booking. Magparehistro muli.",
      "You have already checked in. Ask the desk to change your booking.": "Naka-check in ka na. Hilingin sa desk na baguhin ang iyong booking.",
      "This badge is already registered for that session": "Nakarehistro na ang badge na ito para sa session na iyon",
      "Cancel": "Kanselahin",
      "This session is no longer open": "Hindi na bukas ang session na ito",
      "Your details were updated.": "Na-update ang iyong mga detalye.",
      "I have read the Privacy Notice.": "Nabasa ko ang Abiso sa Privacy.",
      "Read the Privacy Notice": "Basahin ang Abiso sa Privacy",
      "Please confirm you’ve read the Privacy Notice.": "Pakikumpirma na nabasa mo ang Abiso sa Privacy.",
      "Privacy Notice": "Abiso sa Privacy",
      "This notice is available in English and Arabic.": "Ang abisong ito ay nasa English at Arabic.",
      "Close": "Isara",
      "Names can only contain letters, spaces and periods.": "Mga titik, espasyo at tuldok lamang ang puwede sa pangalan.",
      "Write your first and last name in full, not initials": "Isulat nang buo ang iyong pangalan at apelyido, hindi inisyal",
      "Write the rider's name in full, not initials": "Isulat nang buo ang pangalan ng rider, hindi inisyal",
      "Ride waiver": "Ride waiver",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "Hindi ka makakapag-book ng anumang ride o aktibidad sa MicroMobility hangga’t hindi mo nababasa at sinasang-ayunan ang waiver na ito. Ang pagbibisikleta ay pisikal na aktibidad na may kaakibat na panganib. Lumalahok ako nang buo sa sarili kong panganib, at ako lamang ang may pananagutan sa aking sarili, sa aking kaligtasan at sa aking mga personal na gamit. Ako rin ang mananagot sa anumang pinsalang maidudulot ko sa ibang tao o sa kanilang ari-arian. Hanggang sa pinakamalawak na pinapahintulutan ng batas, walang pananagutan ang MicroMobility, ang mga kawani nito at ang mga katuwang nito sa anumang mangyari sa akin o sa aking mga gamit, kabilang ang anumang pinsala sa katawan, bali, sakit, pagkawala, pagnanakaw o pagkasira, anuman ang sanhi, habang nasa aktibidad o may kaugnayan dito. Sumasang-ayon akong magsuot ng helmet at sumunod sa mga tagubilin ng team at sa ruta, at ako ang mananagot sa anumang pinsala sa inuupahang bisikleta dahil sa maling paggamit. Ibinabalik ang bisikleta sa kondisyong natanggap ito.",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "Nabasa ko ang waiver at sumasang-ayon ako rito para sa bawat rider sa rehistrasyong ito",
      "Please accept the waiver to continue.": "Pakitanggap ang waiver para makapagpatuloy.",
      "Register another": "Magparehistro ng ibang tao",
      "Other registrations on this phone": "Iba pang rehistro sa phone na ito",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "Nagbago ang ride waiver. I-reload ang page na ito para basahin at tanggapin ang bago.",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "Bayad na ang booking na ito, kaya hindi ito mailipat sa session na iba ang presyo. Hilingin sa desk na baguhin ito.",
      "Language": "Wika",
      "Country code": "Country code",
      "Progress": "Progreso",
      "Booking QR code": "QR code ng booking",
      "Petromin bike night": "Gabi ng Bisikleta ng Petromin",
      "Check and agree": "Suriin at sumang-ayon",
      "Find my booking": "Hanapin ang booking ko",
      "Read the waiver": "Basahin ang waiver",
      "Agree and register": "Sumang-ayon at magparehistro",
      "Bike pickup": "Pagkuha ng bisikleta",
      "Where": "Saan",
      "Helmets are required. One comes with every bike.": "Kailangan ang helmet. May kasamang helmet ang bawat bisikleta.",
      "Add to Apple Wallet": "Idagdag sa Apple Wallet",
      "Add to calendar": "Idagdag sa Kalendaryo",
      "Directions": "Mga direksyon",
      "Change": "Palitan",
      "Booking number": "Numero ng booking",
      "Jeddah Corniche Circuit": "Jeddah Corniche Circuit",
      "Cancel my booking": "Kanselahin ang booking ko",
      "Save": "I-save",
      "Enter your booking number": "Ilagay ang iyong booking number",
      "Bikes from {t}": "Bisikleta mula {t}",
      "{n} cm": "{n} cm",
      "Remove {name} from this booking?": "Alisin si {name} sa booking na ito?",
      "Cancel booking {no}? Every rider on it loses their place.": "Kanselahin ang booking {no}? Mawawalan ng puwesto ang bawat rider dito.",
      "Cancel booking": "Kanselahin ang booking",
      "Keep it": "Huwag na",
      "Your booking was cancelled.": "Nakansela na ang iyong booking.",
      "We could not save this. Please try again.": "Hindi namin ito na-save. Pakisubukang muli.",
      "The desk has this booking. Ask the desk to cancel it.": "Nasa desk na ang booking na ito. Hilingin sa desk na kanselahin ito.",
      "We could not find a booking with this number and mobile number.": "Wala kaming nahanap na booking na may ganitong numero at mobile number."
    },
    es: {
      "Your registration for {d} is confirmed.": "Tu registro para el {d} está confirmado.",
      "Booking": "Reserva",
      "Enter a valid mobile number": "Introduce un número de móvil válido",
      "Your company": "Tu empresa",
      "Choose your company": "Elige tu empresa",
      "Badge number": "Número de credencial",
      "Full name": "Nombre completo",
      "Mobile number": "Número de móvil",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Introduce un número de móvil saudí válido (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "Este no es un número de móvil de +{c}. Revísalo.",
      "Height in cm": "Altura en cm",
      "Bike type": "Tipo de bicicleta",
      "Hybrid": "Híbrida",
      "Mountain": "Montaña",
      "Register": "Registrarse",
      "Registering...": "Registrando...",
      "Enter your badge number": "Introduce tu número de credencial",
      "Enter your full name": "Introduce tu nombre completo",
      "Enter your height in cm (100 to 250)": "Introduce tu altura en cm (de 100 a 250)",
      "Choose a bike type": "Elige un tipo de bicicleta",
      "Could not reach the server": "No se pudo conectar con el servidor",
      "Too many submissions from this network": "Demasiados envíos desde esta red",
      "Dismiss": "Cerrar",
      "You are registered": "Ya estás registrado",
      "Badge": "Credencial",
      "MicroMobility, Jeddah": "MicroMobility, Yeda",
      "Need help? WhatsApp us": "¿Necesitas ayuda? Escríbenos por WhatsApp",
      "Session": "Sesión",
      "Your details": "Tus datos",
      "Bike": "Bicicleta",
      "Choose your session": "Elige tu sesión",
      "Choose a session": "Elige una sesión",
      "Height and bike": "Altura y bicicleta",
      "Back": "Atrás",
      "Continue": "Continuar",
      "No upcoming sessions": "No hay sesiones próximas",
      "Name": "Nombre",
      "Company": "Empresa",
      "riders": "ciclistas",
      "Riding with someone?": "¿Vienes acompañado?",
      "Add another rider": "Añadir otro ciclista",
      "Rider {n}": "Ciclista {n}",
      "Remove": "Quitar",
      "Enter the rider's full name": "Introduce el nombre completo del ciclista",
      "Enter the rider's height in cm (100 to 250)": "Introduce la altura del ciclista en cm (100 a 250)",
      "Riding with: {names}": "Contigo: {names}",
      "Up to four companions": "Hasta cuatro acompañantes",
      "Edit my booking": "Editar mi reserva",
      "Edit your booking": "Editar tu reserva",
      "Save changes": "Guardar cambios",
      "Saving...": "Guardando...",
      "Your booking was updated.": "Tu reserva se ha actualizado.",
      "We could not find your booking. Please register again.": "No encontramos tu reserva. Inscríbete de nuevo.",
      "You have already checked in. Ask the desk to change your booking.": "Ya has registrado tu llegada. Pide en el mostrador que cambien tu reserva.",
      "This badge is already registered for that session": "Esta acreditación ya está inscrita para esa sesión",
      "Cancel": "Cancelar",
      "This session is no longer open": "Esta sesión ya no está abierta",
      "Your details were updated.": "Tus datos se han actualizado.",
      "I have read the Privacy Notice.": "He leído el aviso de privacidad.",
      "Read the Privacy Notice": "Leer el aviso de privacidad",
      "Please confirm you’ve read the Privacy Notice.": "Confirma que has leído el aviso de privacidad.",
      "Privacy Notice": "Aviso de privacidad",
      "This notice is available in English and Arabic.": "Este aviso está disponible en inglés y árabe.",
      "Close": "Cerrar",
      "Names can only contain letters, spaces and periods.": "El nombre solo puede contener letras, espacios y puntos.",
      "Write your first and last name in full, not initials": "Escribe tu nombre y apellido completos, no solo las iniciales",
      "Write the rider's name in full, not initials": "Escribe el nombre completo del ciclista, no solo las iniciales",
      "Ride waiver": "Exención de responsabilidad",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "No puedes reservar ninguna salida ni actividad con MicroMobility hasta haber leído y aceptado esta exención. Montar en bicicleta es una actividad física que conlleva riesgos. Participo enteramente bajo mi propio riesgo y soy el único responsable de mí mismo, de mi seguridad y de mis pertenencias personales. También soy responsable de cualquier daño que cause a otras personas o a sus bienes. En la máxima medida permitida por la ley, MicroMobility, su personal y sus socios no son responsables de nada de lo que me ocurra a mí o a mis pertenencias, incluidas lesiones, fracturas, enfermedades, pérdidas, robos o daños, sea cual sea su causa, durante la actividad o en relación con ella. Me comprometo a usar casco y a seguir las instrucciones del equipo y el recorrido, y soy responsable de cualquier daño a la bicicleta alquilada causado por un mal uso. La bicicleta se devuelve en el estado en que se recibió.",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "He leído la exención y la acepto en nombre de todos los ciclistas de esta inscripción",
      "Please accept the waiver to continue.": "Acepta la exención para continuar.",
      "Register another": "Inscribir a otra persona",
      "Other registrations on this phone": "Otras inscripciones en este teléfono",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "La exención de responsabilidad ha cambiado. Recarga esta página para leer y aceptar la nueva.",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "Esta reserva ya está pagada, así que no puede pasar a una sesión con otro precio. Pide en el mostrador que la cambien.",
      "Language": "Idioma",
      "Country code": "Prefijo del país",
      "Progress": "Progreso",
      "Booking QR code": "Código QR de la reserva",
      "Petromin bike night": "Noche en bici de Petromin",
      "Check and agree": "Revisar y aceptar",
      "Find my booking": "Buscar mi reserva",
      "Read the waiver": "Leer la exención",
      "Agree and register": "Aceptar e inscribirme",
      "Bike pickup": "Recogida de la bici",
      "Where": "Dónde",
      "Helmets are required. One comes with every bike.": "El casco es obligatorio. Cada bicicleta incluye uno.",
      "Add to Apple Wallet": "Añadir a Apple Wallet",
      "Add to calendar": "Añadir al calendario",
      "Directions": "Cómo llegar",
      "Change": "Cambiar",
      "Booking number": "Número de reserva",
      "Jeddah Corniche Circuit": "Circuito de la Corniche de Yeda",
      "Cancel my booking": "Cancelar mi reserva",
      "Save": "Guardar",
      "Enter your booking number": "Introduce tu número de reserva",
      "Bikes from {t}": "Bicis desde las {t}",
      "{n} cm": "{n} cm",
      "Remove {name} from this booking?": "¿Quitar a {name} de esta reserva?",
      "Cancel booking {no}? Every rider on it loses their place.": "¿Cancelar la reserva {no}? Todos sus ciclistas perderán su plaza.",
      "Cancel booking": "Cancelar la reserva",
      "Keep it": "Mantenerla",
      "Your booking was cancelled.": "Tu reserva se ha cancelado.",
      "We could not save this. Please try again.": "No hemos podido guardarlo. Inténtalo de nuevo.",
      "The desk has this booking. Ask the desk to cancel it.": "El mostrador tiene esta reserva. Pide en el mostrador que la cancelen.",
      "We could not find a booking with this number and mobile number.": "No encontramos ninguna reserva con este número y este móvil."
    },
    ne: {
      "Your registration for {d} is confirmed.": "{d} का लागि तपाईंको दर्ता पक्का भयो।",
      "Booking": "बुकिङ",
      "Enter a valid mobile number": "मान्य मोबाइल नम्बर लेख्नुहोस्",
      "Your company": "तपाईंको कम्पनी",
      "Choose your company": "आफ्नो कम्पनी छान्नुहोस्",
      "Badge number": "ब्याज नम्बर",
      "Full name": "पूरा नाम",
      "Mobile number": "मोबाइल नम्बर",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "मान्य साउदी मोबाइल नम्बर लेख्नुहोस् (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "यो +{c} को मोबाइल नम्बर होइन। कृपया जाँच गर्नुहोस्।",
      "Height in cm": "उचाइ (से.मी.मा)",
      "Bike type": "साइकलको प्रकार",
      "Hybrid": "हाइब्रिड",
      "Mountain": "माउन्टेन",
      "Register": "दर्ता गर्नुहोस्",
      "Registering...": "दर्ता हुँदैछ...",
      "Enter your badge number": "आफ्नो ब्याज नम्बर लेख्नुहोस्",
      "Enter your full name": "आफ्नो पूरा नाम लेख्नुहोस्",
      "Enter your height in cm (100 to 250)": "आफ्नो उचाइ से.मी.मा लेख्नुहोस् (100 देखि 250)",
      "Choose a bike type": "साइकलको प्रकार छान्नुहोस्",
      "Could not reach the server": "सर्भरमा पुग्न सकिएन",
      "Too many submissions from this network": "यो नेटवर्कबाट धेरै पटक पेश गरियो",
      "Dismiss": "बन्द गर्नुहोस्",
      "You are registered": "तपाईं दर्ता भइसक्नुभयो",
      "Badge": "ब्याज",
      "MicroMobility, Jeddah": "MicroMobility, जेद्दा",
      "Need help? WhatsApp us": "सहयोग चाहियो? हामीलाई WhatsApp गर्नुहोस्",
      "Session": "सत्र",
      "Your details": "तपाईंको विवरण",
      "Bike": "साइकल",
      "Choose your session": "आफ्नो सत्र छान्नुहोस्",
      "Choose a session": "एउटा सत्र छान्नुहोस्",
      "Height and bike": "उचाइ र साइकल",
      "Back": "पछाडि",
      "Continue": "अगाडि बढ्नुहोस्",
      "No upcoming sessions": "आगामी सत्र छैन",
      "Name": "नाम",
      "Company": "कम्पनी",
      "riders": "सवार",
      "Riding with someone?": "कसैसँग सवारी गर्दै हुनुहुन्छ?",
      "Add another rider": "अर्को सवार थप्नुहोस्",
      "Rider {n}": "सवार {n}",
      "Remove": "हटाउनुहोस्",
      "Enter the rider's full name": "सवारको पूरा नाम लेख्नुहोस्",
      "Enter the rider's height in cm (100 to 250)": "सवारको उचाइ सेमीमा लेख्नुहोस् (100 देखि 250)",
      "Riding with: {names}": "तपाईंसँग: {names}",
      "Up to four companions": "बढीमा चार साथी",
      "Edit my booking": "मेरो बुकिङ सम्पादन गर्नुहोस्",
      "Edit your booking": "आफ्नो बुकिङ सम्पादन गर्नुहोस्",
      "Save changes": "परिवर्तनहरू सुरक्षित गर्नुहोस्",
      "Saving...": "सुरक्षित गर्दै...",
      "Your booking was updated.": "तपाईंको बुकिङ अद्यावधिक भयो।",
      "We could not find your booking. Please register again.": "तपाईंको बुकिङ फेला परेन। कृपया फेरि दर्ता गर्नुहोस्।",
      "You have already checked in. Ask the desk to change your booking.": "तपाईं पहिले नै चेक-इन भइसक्नुभयो। बुकिङ बदल्न डेस्कलाई भन्नुहोस्।",
      "This badge is already registered for that session": "यो ब्याज त्यो सत्रका लागि पहिले नै दर्ता छ",
      "Cancel": "रद्द गर्नुहोस्",
      "This session is no longer open": "यो सत्र अब खुला छैन",
      "Your details were updated.": "तपाईंको विवरण अद्यावधिक गरियो।",
      "I have read the Privacy Notice.": "मैले गोपनीयता सूचना पढेँ।",
      "Read the Privacy Notice": "गोपनीयता सूचना पढ्नुहोस्",
      "Please confirm you’ve read the Privacy Notice.": "कृपया तपाईंले गोपनीयता सूचना पढ्नुभएको पुष्टि गर्नुहोस्।",
      "Privacy Notice": "गोपनीयता सूचना",
      "This notice is available in English and Arabic.": "यो सूचना अंग्रेजी र अरबीमा उपलब्ध छ।",
      "Close": "बन्द गर्नुहोस्",
      "Names can only contain letters, spaces and periods.": "नाममा अक्षर, खाली ठाउँ र बिन्दु (.) मात्र हुन सक्छन्।",
      "Write your first and last name in full, not initials": "आफ्नो नाम र थर पूरा लेख्नुहोस्, छोटकरी अक्षर होइन",
      "Write the rider's name in full, not initials": "सवारको नाम पूरा लेख्नुहोस्, छोटकरी अक्षर होइन",
      "Ride waiver": "राइड छुट-पत्र",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "यो छुटपत्र पढेर सहमति नजनाएसम्म तपाईं MicroMobility सँग कुनै पनि राइड वा गतिविधि बुक गर्न सक्नुहुन्न। साइकल चलाउनु जोखिम भएको शारीरिक गतिविधि हो। म पूर्ण रूपमा आफ्नै जोखिममा सहभागी हुन्छु, र आफू, आफ्नो सुरक्षा र आफ्ना व्यक्तिगत सामानका लागि म मात्र जिम्मेवार छु। मैले अरूलाई वा उनीहरूको सम्पत्तिलाई गरेको कुनै पनि क्षतिका लागि पनि म जिम्मेवार छु। कानूनले अनुमति दिएको अधिकतम हदसम्म, MicroMobility, यसका कर्मचारी र साझेदारहरू मलाई वा मेरा सामानलाई हुने कुनै पनि कुराका लागि जिम्मेवार हुँदैनन्, जसमा कुनै पनि चोटपटक, हड्डी भाँचिनु, बिरामी, हराउनु, चोरी वा क्षति पर्छ, जुनसुकै कारणले भए पनि, गतिविधिका क्रममा वा त्यससँग सम्बन्धित रूपमा। म हेलमेट लगाउन र टोलीका निर्देशन तथा बाटो पालना गर्न सहमत छु, र गलत प्रयोगले भाडाको साइकललाई हुने कुनै पनि क्षतिका लागि म जिम्मेवार छु। साइकल जुन अवस्थामा लिइएको हो सोही अवस्थामा फिर्ता गरिन्छ।",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "मैले छुट-पत्र पढें र यो दर्ताका हरेक राइडरको तर्फबाट यसमा सहमत छु",
      "Please accept the waiver to continue.": "अगाडि बढ्न कृपया छुट-पत्र स्वीकार गर्नुहोस्।",
      "Register another": "अर्को व्यक्ति दर्ता गर्नुहोस्",
      "Other registrations on this phone": "यो फोनमा अन्य दर्ताहरू",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "राइड छुट-पत्र परिवर्तन भएको छ। नयाँ छुट-पत्र पढ्न र स्वीकार गर्न यो पेज फेरि लोड गर्नुहोस्।",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "यो बुकिङको भुक्तानी भइसकेको छ, त्यसैले यसलाई फरक मूल्यको सत्रमा सार्न सकिँदैन। परिवर्तन गर्न डेस्कलाई भन्नुहोस्।",
      "Language": "भाषा",
      "Country code": "देश कोड",
      "Progress": "प्रगति",
      "Booking QR code": "बुकिङ QR कोड",
      "Petromin bike night": "पेट्रोमिन साइकल साँझ",
      "Check and agree": "जाँच र सहमति",
      "Find my booking": "मेरो बुकिङ खोज्नुहोस्",
      "Read the waiver": "छुट-पत्र पढ्नुहोस्",
      "Agree and register": "सहमत भई दर्ता गर्नुहोस्",
      "Bike pickup": "साइकल लिने",
      "Where": "कहाँ",
      "Helmets are required. One comes with every bike.": "हेलमेट अनिवार्य छ। हरेक साइकलसँग एउटा हेलमेट दिइन्छ।",
      "Add to Apple Wallet": "Apple Wallet मा थप्नुहोस्",
      "Add to calendar": "क्यालेन्डरमा थप्नुहोस्",
      "Directions": "बाटो हेर्नुहोस्",
      "Change": "परिवर्तन गर्नुहोस्",
      "Booking number": "बुकिङ नम्बर",
      "Jeddah Corniche Circuit": "जेद्दा कोर्निश सर्किट",
      "Cancel my booking": "मेरो बुकिङ रद्द गर्नुहोस्",
      "Save": "सुरक्षित गर्नुहोस्",
      "Enter your booking number": "आफ्नो बुकिङ नम्बर लेख्नुहोस्",
      "Bikes from {t}": "साइकल {t} देखि",
      "{n} cm": "{n} से.मी.",
      "Remove {name} from this booking?": "{name} लाई यो बुकिङबाट हटाउने?",
      "Cancel booking {no}? Every rider on it loses their place.": "बुकिङ {no} रद्द गर्ने? यसमा भएका सबै सवारले आफ्नो ठाउँ गुमाउनेछन्।",
      "Cancel booking": "बुकिङ रद्द गर्नुहोस्",
      "Keep it": "राख्नुहोस्",
      "Your booking was cancelled.": "तपाईंको बुकिङ रद्द गरियो।",
      "We could not save this. Please try again.": "हामीले यो सुरक्षित गर्न सकेनौं। कृपया फेरि प्रयास गर्नुहोस्।",
      "The desk has this booking. Ask the desk to cancel it.": "यो बुकिङ डेस्कमा छ। रद्द गर्न डेस्कलाई भन्नुहोस्।",
      "We could not find a booking with this number and mobile number.": "यो नम्बर र मोबाइल नम्बरसँग कुनै बुकिङ फेला परेन।"
    },
    fr: {
      "Your registration for {d} is confirmed.": "Votre inscription pour le {d} est confirmée.",
      "Booking": "Réservation",
      "Enter a valid mobile number": "Saisissez un numéro de mobile valide",
      "Your company": "Votre entreprise",
      "Choose your company": "Choisissez votre entreprise",
      "Badge number": "Numéro de badge",
      "Full name": "Nom complet",
      "Mobile number": "Numéro de mobile",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Saisissez un numéro de mobile saoudien valide (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "Ce n’est pas un numéro de mobile pour le +{c}. Vérifiez-le.",
      "Height in cm": "Taille en cm",
      "Bike type": "Type de vélo",
      "Hybrid": "Hybride",
      "Mountain": "VTT",
      "Register": "S'inscrire",
      "Registering...": "Inscription en cours...",
      "Enter your badge number": "Saisissez votre numéro de badge",
      "Enter your full name": "Saisissez votre nom complet",
      "Enter your height in cm (100 to 250)": "Saisissez votre taille en cm (de 100 à 250)",
      "Choose a bike type": "Choisissez un type de vélo",
      "Could not reach the server": "Impossible de joindre le serveur",
      "Too many submissions from this network": "Trop d'envois depuis ce réseau",
      "Dismiss": "Fermer",
      "You are registered": "Vous êtes inscrit",
      "Badge": "Badge",
      "MicroMobility, Jeddah": "MicroMobility, Djeddah",
      "Need help? WhatsApp us": "Besoin d'aide ? Écrivez-nous sur WhatsApp",
      "Session": "Séance",
      "Your details": "Vos informations",
      "Bike": "Vélo",
      "Choose your session": "Choisissez votre séance",
      "Choose a session": "Choisissez une séance",
      "Height and bike": "Taille et vélo",
      "Back": "Retour",
      "Continue": "Continuer",
      "No upcoming sessions": "Aucune séance à venir",
      "Name": "Nom",
      "Company": "Entreprise",
      "riders": "cyclistes",
      "Riding with someone?": "Vous venez accompagné ?",
      "Add another rider": "Ajouter un cycliste",
      "Rider {n}": "Cycliste {n}",
      "Remove": "Retirer",
      "Enter the rider's full name": "Saisissez le nom complet du cycliste",
      "Enter the rider's height in cm (100 to 250)": "Saisissez la taille du cycliste en cm (100 à 250)",
      "Riding with: {names}": "Avec vous : {names}",
      "Up to four companions": "Jusqu'à quatre accompagnants",
      "Edit my booking": "Modifier ma réservation",
      "Edit your booking": "Modifier votre réservation",
      "Save changes": "Enregistrer les modifications",
      "Saving...": "Enregistrement...",
      "Your booking was updated.": "Votre réservation a été mise à jour.",
      "We could not find your booking. Please register again.": "Nous n'avons pas trouvé votre réservation. Veuillez vous inscrire à nouveau.",
      "You have already checked in. Ask the desk to change your booking.": "Vous avez déjà été enregistré à l'arrivée. Demandez au comptoir de modifier votre réservation.",
      "This badge is already registered for that session": "Ce badge est déjà inscrit pour cette session",
      "Cancel": "Annuler",
      "This session is no longer open": "Cette session n'est plus ouverte",
      "Your details were updated.": "Vos informations ont été mises à jour.",
      "I have read the Privacy Notice.": "J’ai lu l’avis de confidentialité.",
      "Read the Privacy Notice": "Lire l’avis de confidentialité",
      "Please confirm you’ve read the Privacy Notice.": "Veuillez confirmer que vous avez lu l’avis de confidentialité.",
      "Privacy Notice": "Avis de confidentialité",
      "This notice is available in English and Arabic.": "Cet avis est disponible en anglais et en arabe.",
      "Close": "Fermer",
      "Names can only contain letters, spaces and periods.": "Le nom ne peut contenir que des lettres, des espaces et des points.",
      "Write your first and last name in full, not initials": "Écrivez votre prénom et votre nom en entier, pas seulement les initiales",
      "Write the rider's name in full, not initials": "Écrivez le nom du cycliste en entier, pas seulement les initiales",
      "Ride waiver": "Décharge de responsabilité",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "Vous ne pouvez réserver aucune sortie ni activité auprès de MicroMobility avant d’avoir lu et accepté cette décharge. Le vélo est une activité physique qui comporte des risques. J’y participe entièrement à mes propres risques et je suis seul responsable de moi-même, de ma sécurité et de mes effets personnels. Je suis également responsable de tout dommage que je cause à autrui ou à ses biens. Dans toute la mesure permise par la loi, MicroMobility, son personnel et ses partenaires ne sont responsables de rien de ce qui peut m’arriver ou arriver à mes effets, y compris toute blessure, fracture, maladie, perte, vol ou dommage, quelle qu’en soit la cause, pendant l’activité ou en lien avec elle. Je m’engage à porter un casque et à suivre les consignes de l’équipe et le parcours, et je suis responsable de tout dommage causé au vélo loué par une mauvaise utilisation. Le vélo est rendu dans l’état où il a été reçu.",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "J’ai lu la décharge et je l’accepte au nom de chaque cycliste de cette inscription",
      "Please accept the waiver to continue.": "Veuillez accepter la décharge pour continuer.",
      "Register another": "Inscrire une autre personne",
      "Other registrations on this phone": "Autres inscriptions sur ce téléphone",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "La décharge de responsabilité a changé. Rechargez cette page pour lire et accepter la nouvelle.",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "Cette réservation est déjà payée : elle ne peut pas passer à une séance d'un autre prix. Demandez au comptoir de la modifier.",
      "Language": "Langue",
      "Country code": "Indicatif du pays",
      "Progress": "Progression",
      "Booking QR code": "Code QR de la réservation",
      "Petromin bike night": "Soirée vélo Petromin",
      "Check and agree": "Vérifier et accepter",
      "Find my booking": "Retrouver ma réservation",
      "Read the waiver": "Lire la décharge",
      "Agree and register": "Accepter et m’inscrire",
      "Bike pickup": "Retrait du vélo",
      "Where": "Où",
      "Helmets are required. One comes with every bike.": "Le casque est obligatoire. Un casque est fourni avec chaque vélo.",
      "Add to Apple Wallet": "Ajouter à Apple Wallet",
      "Add to calendar": "Ajouter au calendrier",
      "Directions": "Itinéraire",
      "Change": "Modifier",
      "Booking number": "Numéro de réservation",
      "Jeddah Corniche Circuit": "Circuit de la Corniche de Djeddah",
      "Cancel my booking": "Annuler ma réservation",
      "Save": "Enregistrer",
      "Enter your booking number": "Saisissez votre numéro de réservation",
      "Bikes from {t}": "Vélos dès {t}",
      "{n} cm": "{n} cm",
      "Remove {name} from this booking?": "Retirer {name} de cette réservation ?",
      "Cancel booking {no}? Every rider on it loses their place.": "Annuler la réservation {no} ? Chaque cycliste qui y figure perdra sa place.",
      "Cancel booking": "Annuler la réservation",
      "Keep it": "La garder",
      "Your booking was cancelled.": "Votre réservation a été annulée.",
      "We could not save this. Please try again.": "Nous n’avons pas pu enregistrer. Veuillez réessayer.",
      "The desk has this booking. Ask the desk to cancel it.": "Cette réservation est entre les mains du comptoir. Demandez au comptoir de l’annuler.",
      "We could not find a booking with this number and mobile number.": "Aucune réservation ne correspond à ce numéro et à ce mobile."
    },
    pt: {
      "Your registration for {d} is confirmed.": "O seu registo para {d} está confirmado.",
      "Booking": "Reserva",
      "Enter a valid mobile number": "Introduza um número de telemóvel válido",
      "Your company": "A sua empresa",
      "Choose your company": "Escolha a sua empresa",
      "Badge number": "Número do crachá",
      "Full name": "Nome completo",
      "Mobile number": "Número de telemóvel",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Introduza um número de telemóvel saudita válido (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "Este não é um número de telemóvel do indicativo +{c}. Verifique-o, por favor.",
      "Height in cm": "Altura em cm",
      "Bike type": "Tipo de bicicleta",
      "Hybrid": "Híbrida",
      "Mountain": "Montanha",
      "Register": "Registar",
      "Registering...": "A registar...",
      "Enter your badge number": "Introduza o número do seu crachá",
      "Enter your full name": "Introduza o seu nome completo",
      "Enter your height in cm (100 to 250)": "Introduza a sua altura em cm (100 a 250)",
      "Choose a bike type": "Escolha um tipo de bicicleta",
      "Could not reach the server": "Não foi possível contactar o servidor",
      "Too many submissions from this network": "Demasiados envios a partir desta rede",
      "Dismiss": "Fechar",
      "You are registered": "Está registado",
      "Badge": "Crachá",
      "MicroMobility, Jeddah": "MicroMobility, Jeddah",
      "Need help? WhatsApp us": "Precisa de ajuda? Fale connosco no WhatsApp",
      "Session": "Sessão",
      "Your details": "Os seus dados",
      "Bike": "Bicicleta",
      "Choose your session": "Escolha a sua sessão",
      "Choose a session": "Escolha uma sessão",
      "Height and bike": "Altura e bicicleta",
      "Back": "Voltar",
      "Continue": "Continuar",
      "No upcoming sessions": "Sem sessões próximas",
      "Name": "Nome",
      "Company": "Empresa",
      "riders": "ciclistas",
      "Riding with someone?": "Vem acompanhado?",
      "Add another rider": "Adicionar outro ciclista",
      "Rider {n}": "Ciclista {n}",
      "Remove": "Remover",
      "Enter the rider's full name": "Introduza o nome completo do ciclista",
      "Enter the rider's height in cm (100 to 250)": "Introduza a altura do ciclista em cm (100 a 250)",
      "Riding with: {names}": "Consigo: {names}",
      "Up to four companions": "Até quatro acompanhantes",
      "Edit my booking": "Editar a minha reserva",
      "Edit your booking": "Editar a sua reserva",
      "Save changes": "Guardar alterações",
      "Saving...": "A guardar...",
      "Your booking was updated.": "A sua reserva foi atualizada.",
      "We could not find your booking. Please register again.": "Não encontrámos a sua reserva. Inscreva-se novamente.",
      "You have already checked in. Ask the desk to change your booking.": "Já fez o check-in. Peça ao balcão para alterar a sua reserva.",
      "This badge is already registered for that session": "Este crachá já está inscrito para essa sessão",
      "Cancel": "Cancelar",
      "This session is no longer open": "Esta sessão já não está aberta",
      "Your details were updated.": "Os seus dados foram atualizados.",
      "I have read the Privacy Notice.": "Li o aviso de privacidade.",
      "Read the Privacy Notice": "Ler o aviso de privacidade",
      "Please confirm you’ve read the Privacy Notice.": "Confirme que leu o aviso de privacidade.",
      "Privacy Notice": "Aviso de privacidade",
      "This notice is available in English and Arabic.": "Este aviso está disponível em inglês e árabe.",
      "Close": "Fechar",
      "Names can only contain letters, spaces and periods.": "O nome só pode conter letras, espaços e pontos.",
      "Write your first and last name in full, not initials": "Escreva o seu nome e apelido por extenso, não apenas as iniciais",
      "Write the rider's name in full, not initials": "Escreva o nome do ciclista por extenso, não apenas as iniciais",
      "Ride waiver": "Termo de responsabilidade",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "Você não pode reservar nenhum passeio ou atividade com a MicroMobility antes de ler e aceitar este termo de responsabilidade. Andar de bicicleta é uma atividade física que envolve riscos. Participo inteiramente por minha conta e risco e sou o único responsável por mim, pela minha segurança e pelos meus pertences pessoais. Também sou responsável por qualquer dano que eu cause a outras pessoas ou aos seus bens. Na máxima extensão permitida por lei, a MicroMobility, sua equipe e seus parceiros não são responsáveis por nada que aconteça comigo ou com os meus pertences, incluindo qualquer lesão, fratura, doença, perda, furto ou dano, seja qual for a causa, durante a atividade ou em relação a ela. Comprometo-me a usar capacete e a seguir as instruções da equipe e o percurso, e sou responsável por qualquer dano à bicicleta alugada causado por mau uso. A bicicleta é devolvida no estado em que foi recebida.",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "Li o termo e concordo com ele em nome de todos os ciclistas desta inscrição",
      "Please accept the waiver to continue.": "Aceite o termo de responsabilidade para continuar.",
      "Register another": "Registar outra pessoa",
      "Other registrations on this phone": "Outros registos neste telemóvel",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "O termo de responsabilidade mudou. Recarregue esta página para ler e aceitar o novo.",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "Esta reserva já está paga, por isso não pode passar para uma sessão com outro preço. Peça ao balcão para a alterar.",
      "Language": "Idioma",
      "Country code": "Indicativo do país",
      "Progress": "Progresso",
      "Booking QR code": "Código QR da reserva",
      "Petromin bike night": "Noite de bicicleta Petromin",
      "Check and agree": "Rever e aceitar",
      "Find my booking": "Encontrar a minha reserva",
      "Read the waiver": "Ler o termo",
      "Agree and register": "Aceitar e registar",
      "Bike pickup": "Retirada da bicicleta",
      "Where": "Onde",
      "Helmets are required. One comes with every bike.": "O capacete é obrigatório. Cada bicicleta vem com um.",
      "Add to Apple Wallet": "Adicionar à Apple Wallet",
      "Add to calendar": "Adicionar ao calendário",
      "Directions": "Como chegar",
      "Change": "Alterar",
      "Booking number": "Número da reserva",
      "Jeddah Corniche Circuit": "Circuito da Corniche de Jeddah",
      "Cancel my booking": "Cancelar a minha reserva",
      "Save": "Guardar",
      "Enter your booking number": "Introduza o seu número de reserva",
      "Bikes from {t}": "Bicicletas a partir das {t}",
      "{n} cm": "{n} cm",
      "Remove {name} from this booking?": "Remover {name} desta reserva?",
      "Cancel booking {no}? Every rider on it loses their place.": "Cancelar a reserva {no}? Todos os ciclistas nela perdem o lugar.",
      "Cancel booking": "Cancelar a reserva",
      "Keep it": "Manter",
      "Your booking was cancelled.": "A sua reserva foi cancelada.",
      "We could not save this. Please try again.": "Não foi possível guardar. Tente novamente.",
      "The desk has this booking. Ask the desk to cancel it.": "Esta reserva está com o balcão. Peça ao balcão para a cancelar.",
      "We could not find a booking with this number and mobile number.": "Não encontrámos nenhuma reserva com este número e este telemóvel."
    },
    bn: {
      "Your registration for {d} is confirmed.": "{d} সেশনের জন্য আপনার রেজিস্ট্রেশন নিশ্চিত হয়েছে।",
      "Booking": "বুকিং",
      "Enter a valid mobile number": "একটি সঠিক মোবাইল নম্বর লিখুন",
      "Your company": "আপনার কোম্পানি",
      "Choose your company": "আপনার কোম্পানি বেছে নিন",
      "Badge number": "ব্যাজ নম্বর",
      "Full name": "পুরো নাম",
      "Mobile number": "মোবাইল নম্বর",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "একটি সঠিক সৌদি মোবাইল নম্বর লিখুন (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "এটি +{c}-এর কোনো মোবাইল নম্বর নয়। অনুগ্রহ করে দেখে নিন।",
      "Height in cm": "উচ্চতা (সেমি)",
      "Bike type": "সাইকেলের ধরন",
      "Hybrid": "হাইব্রিড",
      "Mountain": "মাউন্টেন",
      "Register": "রেজিস্টার করুন",
      "Registering...": "রেজিস্টার করা হচ্ছে...",
      "Enter your badge number": "আপনার ব্যাজ নম্বর লিখুন",
      "Enter your full name": "আপনার পুরো নাম লিখুন",
      "Enter your height in cm (100 to 250)": "সেন্টিমিটারে আপনার উচ্চতা লিখুন (100 থেকে 250)",
      "Choose a bike type": "সাইকেলের একটি ধরন বেছে নিন",
      "Could not reach the server": "সার্ভারে পৌঁছানো গেল না",
      "Too many submissions from this network": "এই নেটওয়ার্ক থেকে অনেক বেশিবার জমা দেওয়া হয়েছে",
      "Dismiss": "বন্ধ করুন",
      "You are registered": "আপনার রেজিস্ট্রেশন হয়ে গেছে",
      "Badge": "ব্যাজ",
      "MicroMobility, Jeddah": "MicroMobility, জেদ্দা",
      "Need help? WhatsApp us": "সাহায্য দরকার? আমাদের WhatsApp করুন",
      "Session": "সেশন",
      "Your details": "আপনার তথ্য",
      "Bike": "সাইকেল",
      "Choose your session": "আপনার সেশন বেছে নিন",
      "Choose a session": "একটি সেশন বেছে নিন",
      "Height and bike": "উচ্চতা ও সাইকেল",
      "Back": "পেছনে",
      "Continue": "চালিয়ে যান",
      "No upcoming sessions": "আসন্ন কোনো সেশন নেই",
      "Name": "নাম",
      "Company": "কোম্পানি",
      "riders": "রাইডার",
      "Riding with someone?": "কারও সঙ্গে রাইড করছেন?",
      "Add another rider": "আরেকজন রাইডার যোগ করুন",
      "Rider {n}": "রাইডার {n}",
      "Remove": "সরান",
      "Enter the rider's full name": "রাইডারের পুরো নাম লিখুন",
      "Enter the rider's height in cm (100 to 250)": "সেন্টিমিটারে রাইডারের উচ্চতা লিখুন (100 থেকে 250)",
      "Riding with: {names}": "সঙ্গে রাইড করছেন: {names}",
      "Up to four companions": "সর্বোচ্চ চারজন সঙ্গী",
      "Edit my booking": "আমার বুকিং সম্পাদনা করুন",
      "Edit your booking": "আপনার বুকিং সম্পাদনা করুন",
      "Save changes": "পরিবর্তন সংরক্ষণ করুন",
      "Saving...": "সংরক্ষণ হচ্ছে...",
      "Your booking was updated.": "আপনার বুকিং হালনাগাদ হয়েছে।",
      "We could not find your booking. Please register again.": "আমরা আপনার বুকিংটি খুঁজে পাইনি। অনুগ্রহ করে আবার রেজিস্টার করুন।",
      "You have already checked in. Ask the desk to change your booking.": "আপনি আগেই চেক ইন করেছেন। বুকিং বদলাতে ডেস্কে বলুন।",
      "This badge is already registered for that session": "এই ব্যাজটি ওই সেশনের জন্য আগে থেকেই রেজিস্টার করা আছে",
      "Cancel": "বাতিল",
      "This session is no longer open": "এই সেশনটি আর খোলা নেই",
      "Your details were updated.": "আপনার তথ্য হালনাগাদ হয়েছে।",
      "I have read the Privacy Notice.": "আমি গোপনীয়তা বিজ্ঞপ্তি পড়েছি।",
      "Read the Privacy Notice": "গোপনীয়তা বিজ্ঞপ্তি পড়ুন",
      "Please confirm you’ve read the Privacy Notice.": "অনুগ্রহ করে নিশ্চিত করুন যে আপনি গোপনীয়তা বিজ্ঞপ্তি পড়েছেন।",
      "Privacy Notice": "গোপনীয়তা বিজ্ঞপ্তি",
      "This notice is available in English and Arabic.": "এই বিজ্ঞপ্তি ইংরেজি ও আরবিতে পাওয়া যায়।",
      "Close": "বন্ধ করুন",
      "Names can only contain letters, spaces and periods.": "নামে শুধু অক্ষর, ফাঁকা জায়গা ও বিন্দু (.) থাকতে পারে।",
      "Write your first and last name in full, not initials": "প্রথম ও শেষ নাম পুরোটা লিখুন, শুধু আদ্যক্ষর নয়",
      "Write the rider's name in full, not initials": "রাইডারের নাম পুরোটা লিখুন, শুধু আদ্যক্ষর নয়",
      "Ride waiver": "রাইড দায়মুক্তিপত্র",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "এই দায়মুক্তিপত্র পড়ে তাতে সম্মতি না দেওয়া পর্যন্ত আপনি MicroMobility-এর সাথে কোনো রাইড বা কার্যক্রম বুক করতে পারবেন না। সাইকেল চালানো একটি ঝুঁকিপূর্ণ শারীরিক কার্যক্রম। আমি সম্পূর্ণ নিজের ঝুঁকিতে অংশ নিচ্ছি, এবং নিজের, নিজের নিরাপত্তার ও নিজের ব্যক্তিগত জিনিসপত্রের জন্য শুধু আমিই দায়ী। অন্যদের বা তাদের সম্পত্তির যে ক্ষতি আমি করি, তার জন্যও আমি দায়ী। আইনে অনুমোদিত সর্বোচ্চ সীমা পর্যন্ত, MicroMobility, এর কর্মী ও অংশীদাররা আমার বা আমার জিনিসপত্রের সাথে যা-ই ঘটুক তার জন্য দায়ী নয়, যার মধ্যে যেকোনো আঘাত, হাড় ভাঙা, অসুস্থতা, হারানো, চুরি বা ক্ষতি অন্তর্ভুক্ত, কারণ যা-ই হোক, কার্যক্রম চলাকালে বা এর সাথে সম্পর্কিতভাবে। আমি হেলমেট পরতে এবং দলের নির্দেশনা ও পথ মেনে চলতে সম্মত, এবং ভুল ব্যবহারের কারণে ভাড়া করা সাইকেলের যেকোনো ক্ষতির জন্য আমি দায়ী। সাইকেলটি যে অবস্থায় নেওয়া হয়েছিল সেই অবস্থায় ফেরত দেওয়া হয়।",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "আমি দায়মুক্তিপত্রটি পড়েছি এবং এই নিবন্ধনের প্রত্যেক রাইডারের পক্ষে এতে সম্মতি দিচ্ছি",
      "Please accept the waiver to continue.": "চালিয়ে যেতে অনুগ্রহ করে দায়মুক্তিপত্রে সম্মতি দিন।",
      "Register another": "আরেকজনকে রেজিস্টার করুন",
      "Other registrations on this phone": "এই ফোনে অন্যান্য রেজিস্ট্রেশন",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "রাইড দায়মুক্তিপত্র বদলেছে। নতুনটি পড়তে ও তাতে সম্মতি দিতে এই পেজটি আবার লোড করুন।",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "এই বুকিংয়ের টাকা আগেই দেওয়া হয়েছে, তাই এটি অন্য দামের সেশনে সরানো যাবে না। বদলাতে ডেস্কে বলুন।",
      "Language": "ভাষা",
      "Country code": "দেশের কোড",
      "Progress": "অগ্রগতি",
      "Booking QR code": "বুকিং QR কোড",
      "Petromin bike night": "পেট্রোমিন সাইকেল সন্ধ্যা",
      "Check and agree": "দেখে নিন ও সম্মতি দিন",
      "Find my booking": "আমার বুকিং খুঁজুন",
      "Read the waiver": "দায়মুক্তিপত্র পড়ুন",
      "Agree and register": "সম্মতি দিয়ে রেজিস্টার করুন",
      "Bike pickup": "সাইকেল সংগ্রহ",
      "Where": "কোথায়",
      "Helmets are required. One comes with every bike.": "হেলমেট বাধ্যতামূলক। প্রতিটি সাইকেলের সাথে একটি হেলমেট দেওয়া হয়।",
      "Add to Apple Wallet": "Apple Wallet-এ যোগ করুন",
      "Add to calendar": "ক্যালেন্ডারে যোগ করুন",
      "Directions": "পথনির্দেশ",
      "Change": "পরিবর্তন করুন",
      "Booking number": "বুকিং নম্বর",
      "Jeddah Corniche Circuit": "জেদ্দা কর্নিশ সার্কিট",
      "Cancel my booking": "আমার বুকিং বাতিল করুন",
      "Save": "সংরক্ষণ করুন",
      "Enter your booking number": "আপনার বুকিং নম্বর লিখুন",
      "Bikes from {t}": "সাইকেল {t} থেকে",
      "{n} cm": "{n} সেমি",
      "Remove {name} from this booking?": "{name}-কে এই বুকিং থেকে সরাবেন?",
      "Cancel booking {no}? Every rider on it loses their place.": "বুকিং {no} বাতিল করবেন? এতে থাকা প্রত্যেক রাইডার তাঁদের জায়গা হারাবেন।",
      "Cancel booking": "বুকিং বাতিল করুন",
      "Keep it": "রেখে দিন",
      "Your booking was cancelled.": "আপনার বুকিং বাতিল হয়েছে।",
      "We could not save this. Please try again.": "আমরা এটি সংরক্ষণ করতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।",
      "The desk has this booking. Ask the desk to cancel it.": "এই বুকিংটি ডেস্কের কাছে আছে। বাতিল করতে ডেস্কে বলুন।",
      "We could not find a booking with this number and mobile number.": "এই নম্বর ও মোবাইল নম্বরে কোনো বুকিং পাওয়া যায়নি।"
    },
    ur: {
      "Your registration for {d} is confirmed.": "{d} کے لیے آپ کی رجسٹریشن کی تصدیق ہو گئی ہے۔",
      "Booking": "بکنگ",
      "Enter a valid mobile number": "درست موبائل نمبر درج کریں",
      "Your company": "آپ کی کمپنی",
      "Choose your company": "اپنی کمپنی منتخب کریں",
      "Badge number": "بیج نمبر",
      "Full name": "پورا نام",
      "Mobile number": "موبائل نمبر",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "درست سعودی موبائل نمبر درج کریں (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "یہ ‎+{c} کا موبائل نمبر نہیں ہے۔ براہِ کرم اسے چیک کریں۔",
      "Height in cm": "قد (سینٹی میٹر میں)",
      "Bike type": "سائیکل کی قسم",
      "Hybrid": "ہائبرڈ",
      "Mountain": "ماؤنٹین",
      "Register": "رجسٹر کریں",
      "Registering...": "رجسٹریشن ہو رہی ہے...",
      "Enter your badge number": "اپنا بیج نمبر درج کریں",
      "Enter your full name": "اپنا پورا نام درج کریں",
      "Enter your height in cm (100 to 250)": "اپنا قد سینٹی میٹر میں درج کریں (100 سے 250 تک)",
      "Choose a bike type": "سائیکل کی قسم منتخب کریں",
      "Could not reach the server": "سرور تک رسائی نہیں ہو سکی",
      "Too many submissions from this network": "اس نیٹ ورک سے بہت زیادہ درخواستیں بھیجی گئی ہیں",
      "Dismiss": "بند کریں",
      "You are registered": "آپ کی رجسٹریشن ہو گئی ہے",
      "Badge": "بیج",
      "MicroMobility, Jeddah": "MicroMobility، جدہ",
      "Need help? WhatsApp us": "مدد چاہیے؟ ہمیں WhatsApp کریں",
      "Session": "سیشن",
      "Your details": "آپ کی تفصیلات",
      "Bike": "سائیکل",
      "Choose your session": "اپنا سیشن منتخب کریں",
      "Choose a session": "ایک سیشن منتخب کریں",
      "Height and bike": "قد اور سائیکل",
      "Back": "واپس",
      "Continue": "جاری رکھیں",
      "No upcoming sessions": "کوئی آنے والا سیشن نہیں",
      "Name": "نام",
      "Company": "کمپنی",
      "riders": "رائیڈرز",
      "Riding with someone?": "کسی کے ساتھ رائیڈ کر رہے ہیں؟",
      "Add another rider": "ایک اور رائیڈر شامل کریں",
      "Rider {n}": "رائیڈر {n}",
      "Remove": "ہٹائیں",
      "Enter the rider's full name": "رائیڈر کا پورا نام درج کریں",
      "Enter the rider's height in cm (100 to 250)": "رائیڈر کا قد سینٹی میٹر میں درج کریں (100 سے 250 تک)",
      "Riding with: {names}": "ساتھ رائیڈ کر رہے ہیں: {names}",
      "Up to four companions": "زیادہ سے زیادہ چار ساتھی",
      "Edit my booking": "میری بکنگ میں ترمیم کریں",
      "Edit your booking": "اپنی بکنگ میں ترمیم کریں",
      "Save changes": "تبدیلیاں محفوظ کریں",
      "Saving...": "محفوظ ہو رہا ہے...",
      "Your booking was updated.": "آپ کی بکنگ اپ ڈیٹ ہو گئی۔",
      "We could not find your booking. Please register again.": "ہمیں آپ کی بکنگ نہیں ملی۔ براہِ کرم دوبارہ رجسٹر کریں۔",
      "You have already checked in. Ask the desk to change your booking.": "آپ پہلے ہی چیک اِن کر چکے ہیں۔ اپنی بکنگ بدلنے کے لیے ڈیسک سے کہیں۔",
      "This badge is already registered for that session": "یہ بیج اس سیشن کے لیے پہلے ہی رجسٹرڈ ہے",
      "Cancel": "منسوخ کریں",
      "This session is no longer open": "یہ سیشن اب کھلا نہیں ہے",
      "Your details were updated.": "آپ کی تفصیلات اپ ڈیٹ ہو گئیں۔",
      "I have read the Privacy Notice.": "میں نے پرائیویسی نوٹس پڑھ لیا ہے۔",
      "Read the Privacy Notice": "پرائیویسی نوٹس پڑھیں",
      "Please confirm you’ve read the Privacy Notice.": "براہ کرم تصدیق کریں کہ آپ نے پرائیویسی نوٹس پڑھ لیا ہے۔",
      "Privacy Notice": "پرائیویسی نوٹس",
      "This notice is available in English and Arabic.": "یہ نوٹس انگریزی اور عربی میں دستیاب ہے۔",
      "Close": "بند کریں",
      "Names can only contain letters, spaces and periods.": "نام میں صرف حروف، خالی جگہ اور نقطے (.) ہو سکتے ہیں۔",
      "Write your first and last name in full, not initials": "اپنا پہلا اور آخری نام پورا لکھیں، صرف ابتدائی حروف نہیں",
      "Write the rider's name in full, not initials": "رائیڈر کا نام پورا لکھیں، صرف ابتدائی حروف نہیں",
      "Ride waiver": "رائیڈ ویور",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "اس اقرار نامے کو پڑھ کر اس سے اتفاق کیے بغیر آپ MicroMobility کے ساتھ کوئی رائیڈ یا سرگرمی بک نہیں کر سکتے۔ سائیکل چلانا ایک جسمانی سرگرمی ہے جس میں خطرات ہوتے ہیں۔ میں مکمل طور پر اپنی ذمہ داری پر حصہ لیتا/لیتی ہوں، اور اپنی ذات، اپنی حفاظت اور اپنے ذاتی سامان کا ذمہ دار صرف میں ہوں۔ دوسروں کو یا ان کی املاک کو میری طرف سے پہنچنے والے کسی بھی نقصان کا ذمہ دار بھی میں ہوں۔ قانون کی اجازت کی آخری حد تک، MicroMobility، اس کا عملہ اور اس کے شراکت دار مجھے یا میرے سامان کو پیش آنے والی کسی بھی چیز کے ذمہ دار نہیں، بشمول کوئی بھی چوٹ، ہڈی ٹوٹنا، بیماری، گمشدگی، چوری یا نقصان، خواہ اس کی وجہ کچھ بھی ہو، سرگرمی کے دوران یا اس کے سلسلے میں۔ میں ہیلمٹ پہننے اور ٹیم کی ہدایات اور راستے پر عمل کرنے کا عہد کرتا/کرتی ہوں، اور غلط استعمال سے کرائے کی سائیکل کو پہنچنے والے کسی بھی نقصان کا ذمہ دار ہوں۔ سائیکل اسی حالت میں واپس کی جاتی ہے جس حالت میں وصول کی گئی تھی۔",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "میں نے ویور پڑھ لیا ہے اور اس رجسٹریشن کے ہر رائیڈر کی طرف سے اس سے اتفاق کرتا/کرتی ہوں",
      "Please accept the waiver to continue.": "جاری رکھنے کے لیے براہِ کرم ویور قبول کریں۔",
      "Register another": "کسی اور کو رجسٹر کریں",
      "Other registrations on this phone": "اس فون پر دیگر رجسٹریشنز",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "رائیڈ ویور بدل گیا ہے۔ نیا ویور پڑھنے اور قبول کرنے کے لیے یہ صفحہ دوبارہ لوڈ کریں۔",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "اس بکنگ کی ادائیگی ہو چکی ہے، اس لیے اسے مختلف قیمت والے سیشن میں منتقل نہیں کیا جا سکتا۔ اسے بدلنے کے لیے ڈیسک سے کہیں۔",
      "Language": "زبان",
      "Country code": "ملک کا کوڈ",
      "Progress": "پیش رفت",
      "Booking QR code": "بکنگ کا QR کوڈ",
      "Petromin bike night": "پیٹرومن سائیکل نائٹ",
      "Check and agree": "جانچیں اور اتفاق کریں",
      "Find my booking": "میری بکنگ تلاش کریں",
      "Read the waiver": "ویور پڑھیں",
      "Agree and register": "اتفاق کریں اور رجسٹر کریں",
      "Bike pickup": "سائیکل کی وصولی",
      "Where": "کہاں",
      "Helmets are required. One comes with every bike.": "ہیلمٹ لازمی ہے۔ ہر سائیکل کے ساتھ ایک ہیلمٹ ملتا ہے۔",
      "Add to Apple Wallet": "Apple Wallet میں شامل کریں",
      "Add to calendar": "کیلنڈر میں شامل کریں",
      "Directions": "راستہ",
      "Change": "تبدیل کریں",
      "Booking number": "بکنگ نمبر",
      "Jeddah Corniche Circuit": "جدہ کورنیش سرکٹ",
      "Cancel my booking": "میری بکنگ منسوخ کریں",
      "Save": "محفوظ کریں",
      "Enter your booking number": "اپنا بکنگ نمبر درج کریں",
      "Bikes from {t}": "سائیکلیں {t} سے",
      "{n} cm": "{n} سینٹی میٹر",
      "Remove {name} from this booking?": "{name} کو اس بکنگ سے ہٹائیں؟",
      "Cancel booking {no}? Every rider on it loses their place.": "بکنگ {no} منسوخ کریں؟ اس میں شامل ہر رائیڈر اپنی جگہ کھو دے گا۔",
      "Cancel booking": "بکنگ منسوخ کریں",
      "Keep it": "رہنے دیں",
      "Your booking was cancelled.": "آپ کی بکنگ منسوخ کر دی گئی۔",
      "We could not save this. Please try again.": "ہم اسے محفوظ نہیں کر سکے۔ براہِ کرم دوبارہ کوشش کریں۔",
      "The desk has this booking. Ask the desk to cancel it.": "یہ بکنگ ڈیسک کے پاس ہے۔ اسے منسوخ کرنے کے لیے ڈیسک سے کہیں۔",
      "We could not find a booking with this number and mobile number.": "اس نمبر اور موبائل نمبر سے کوئی بکنگ نہیں ملی۔"
    },
    id: {
      "Your registration for {d} is confirmed.": "Pendaftaran Anda untuk {d} sudah dikonfirmasi.",
      "Booking": "Pemesanan",
      "Enter a valid mobile number": "Masukkan nomor ponsel yang valid",
      "Your company": "Perusahaan Anda",
      "Choose your company": "Pilih perusahaan Anda",
      "Badge number": "Nomor kartu karyawan",
      "Full name": "Nama lengkap",
      "Mobile number": "Nomor ponsel",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Masukkan nomor ponsel Arab Saudi yang valid (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "Ini bukan nomor ponsel untuk kode +{c}. Mohon periksa kembali.",
      "Height in cm": "Tinggi badan dalam cm",
      "Bike type": "Jenis sepeda",
      "Hybrid": "Hybrid",
      "Mountain": "Gunung",
      "Register": "Daftar",
      "Registering...": "Mendaftarkan...",
      "Enter your badge number": "Masukkan nomor kartu karyawan Anda",
      "Enter your full name": "Masukkan nama lengkap Anda",
      "Enter your height in cm (100 to 250)": "Masukkan tinggi badan Anda dalam cm (100 hingga 250)",
      "Choose a bike type": "Pilih jenis sepeda",
      "Could not reach the server": "Tidak dapat terhubung ke server",
      "Too many submissions from this network": "Terlalu banyak pengiriman dari jaringan ini",
      "Dismiss": "Tutup",
      "You are registered": "Anda sudah terdaftar",
      "Badge": "Kartu karyawan",
      "MicroMobility, Jeddah": "MicroMobility, Jeddah",
      "Need help? WhatsApp us": "Butuh bantuan? Hubungi kami via WhatsApp",
      "Session": "Sesi",
      "Your details": "Data Anda",
      "Bike": "Sepeda",
      "Choose your session": "Pilih sesi Anda",
      "Choose a session": "Pilih sesi",
      "Height and bike": "Tinggi badan dan sepeda",
      "Back": "Kembali",
      "Continue": "Lanjutkan",
      "No upcoming sessions": "Belum ada sesi mendatang",
      "Name": "Nama",
      "Company": "Perusahaan",
      "riders": "pesepeda",
      "Riding with someone?": "Bersepeda bersama orang lain?",
      "Add another rider": "Tambahkan pesepeda lain",
      "Rider {n}": "Pesepeda {n}",
      "Remove": "Hapus",
      "Enter the rider's full name": "Masukkan nama lengkap pesepeda",
      "Enter the rider's height in cm (100 to 250)": "Masukkan tinggi badan pesepeda dalam cm (100 hingga 250)",
      "Riding with: {names}": "Bersepeda bersama: {names}",
      "Up to four companions": "Hingga empat pendamping",
      "Edit my booking": "Ubah pemesanan saya",
      "Edit your booking": "Ubah pemesanan Anda",
      "Save changes": "Simpan perubahan",
      "Saving...": "Menyimpan...",
      "Your booking was updated.": "Pemesanan Anda sudah diperbarui.",
      "We could not find your booking. Please register again.": "Kami tidak dapat menemukan pemesanan Anda. Silakan daftar ulang.",
      "You have already checked in. Ask the desk to change your booking.": "Anda sudah check-in. Minta petugas loket untuk mengubah pemesanan Anda.",
      "This badge is already registered for that session": "Kartu karyawan ini sudah terdaftar untuk sesi tersebut",
      "Cancel": "Batalkan",
      "This session is no longer open": "Sesi ini sudah tidak dibuka lagi",
      "Your details were updated.": "Data Anda sudah diperbarui.",
      "I have read the Privacy Notice.": "Saya telah membaca Pemberitahuan Privasi.",
      "Read the Privacy Notice": "Baca Pemberitahuan Privasi",
      "Please confirm you’ve read the Privacy Notice.": "Harap konfirmasi bahwa Anda telah membaca Pemberitahuan Privasi.",
      "Privacy Notice": "Pemberitahuan Privasi",
      "This notice is available in English and Arabic.": "Pemberitahuan ini tersedia dalam bahasa Inggris dan Arab.",
      "Close": "Tutup",
      "Names can only contain letters, spaces and periods.": "Nama hanya boleh berisi huruf, spasi, dan titik.",
      "Write your first and last name in full, not initials": "Tulis nama depan dan nama belakang Anda secara lengkap, bukan inisial",
      "Write the rider's name in full, not initials": "Tulis nama pesepeda secara lengkap, bukan inisial",
      "Ride waiver": "Pernyataan risiko bersepeda",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "Anda tidak dapat memesan sesi bersepeda atau aktivitas apa pun di MicroMobility sebelum membaca dan menyetujui pernyataan risiko ini. Bersepeda adalah aktivitas fisik yang memiliki risiko. Saya ikut serta sepenuhnya atas risiko saya sendiri, dan hanya saya yang bertanggung jawab atas diri saya, keselamatan saya, dan barang-barang pribadi saya. Saya juga bertanggung jawab atas kerugian apa pun yang saya timbulkan pada orang lain atau harta benda mereka. Sejauh diizinkan oleh hukum hingga batas maksimal, MicroMobility, stafnya, dan mitranya tidak bertanggung jawab atas apa pun yang terjadi pada saya atau barang-barang saya, termasuk cedera, patah tulang, penyakit, kehilangan, pencurian, atau kerusakan apa pun, apa pun penyebabnya, selama aktivitas berlangsung atau yang berkaitan dengannya. Saya setuju untuk memakai helm serta mengikuti arahan tim dan rute, dan saya bertanggung jawab atas setiap kerusakan pada sepeda sewaan akibat penyalahgunaan. Sepeda dikembalikan dalam kondisi seperti saat diterima.",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "Saya telah membaca pernyataan risiko dan menyetujuinya atas nama setiap pesepeda dalam pendaftaran ini",
      "Please accept the waiver to continue.": "Harap setujui pernyataan risiko untuk melanjutkan.",
      "Register another": "Daftarkan orang lain",
      "Other registrations on this phone": "Pendaftaran lain di ponsel ini",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "Pernyataan risiko bersepeda telah berubah. Muat ulang halaman ini untuk membaca dan menyetujui versi barunya.",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "Pemesanan ini sudah dibayar, jadi tidak dapat dipindahkan ke sesi dengan harga berbeda. Minta petugas loket untuk mengubahnya.",
      "Language": "Bahasa",
      "Country code": "Kode negara",
      "Progress": "Progres",
      "Booking QR code": "Kode QR pemesanan",
      "Petromin bike night": "Malam Bersepeda Petromin",
      "Check and agree": "Periksa dan setujui",
      "Find my booking": "Cari pemesanan saya",
      "Read the waiver": "Baca surat pernyataan",
      "Agree and register": "Setujui dan daftar",
      "Bike pickup": "Pengambilan sepeda",
      "Where": "Di mana",
      "Helmets are required. One comes with every bike.": "Helm wajib dipakai. Setiap sepeda sudah termasuk helm.",
      "Add to Apple Wallet": "Tambahkan ke Apple Wallet",
      "Add to calendar": "Tambahkan ke kalender",
      "Directions": "Petunjuk arah",
      "Change": "Ubah",
      "Booking number": "Nomor pemesanan",
      "Jeddah Corniche Circuit": "Sirkuit Jeddah Corniche",
      "Cancel my booking": "Batalkan pemesanan saya",
      "Save": "Simpan",
      "Enter your booking number": "Masukkan nomor pemesanan Anda",
      "Bikes from {t}": "Sepeda mulai {t}",
      "{n} cm": "{n} cm",
      "Remove {name} from this booking?": "Hapus {name} dari pemesanan ini?",
      "Cancel booking {no}? Every rider on it loses their place.": "Batalkan pemesanan {no}? Setiap pesepeda di dalamnya kehilangan tempatnya.",
      "Cancel booking": "Batalkan pemesanan",
      "Keep it": "Tetap simpan",
      "Your booking was cancelled.": "Pemesanan Anda sudah dibatalkan.",
      "We could not save this. Please try again.": "Kami tidak dapat menyimpannya. Silakan coba lagi.",
      "The desk has this booking. Ask the desk to cancel it.": "Pemesanan ini sudah ditangani meja layanan. Minta meja layanan untuk membatalkannya.",
      "We could not find a booking with this number and mobile number.": "Kami tidak menemukan pemesanan dengan nomor dan nomor ponsel ini."
    },
    ms: {
      "Your registration for {d} is confirmed.": "Pendaftaran anda untuk {d} telah disahkan.",
      "Booking": "Tempahan",
      "Enter a valid mobile number": "Masukkan nombor telefon yang sah",
      "Your company": "Syarikat anda",
      "Choose your company": "Pilih syarikat anda",
      "Badge number": "Nombor kad pekerja",
      "Full name": "Nama penuh",
      "Mobile number": "Nombor telefon",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Masukkan nombor telefon Arab Saudi yang sah (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "Ini bukan nombor telefon bagi kod +{c}. Sila semak semula.",
      "Height in cm": "Ketinggian dalam cm",
      "Bike type": "Jenis basikal",
      "Hybrid": "Hibrid",
      "Mountain": "Gunung",
      "Register": "Daftar",
      "Registering...": "Mendaftar...",
      "Enter your badge number": "Masukkan nombor kad pekerja anda",
      "Enter your full name": "Masukkan nama penuh anda",
      "Enter your height in cm (100 to 250)": "Masukkan ketinggian anda dalam cm (100 hingga 250)",
      "Choose a bike type": "Pilih jenis basikal",
      "Could not reach the server": "Tidak dapat menghubungi pelayan",
      "Too many submissions from this network": "Terlalu banyak penghantaran daripada rangkaian ini",
      "Dismiss": "Tutup",
      "You are registered": "Anda telah berdaftar",
      "Badge": "Kad pekerja",
      "MicroMobility, Jeddah": "MicroMobility, Jeddah",
      "Need help? WhatsApp us": "Perlukan bantuan? WhatsApp kami",
      "Session": "Sesi",
      "Your details": "Butiran anda",
      "Bike": "Basikal",
      "Choose your session": "Pilih sesi anda",
      "Choose a session": "Pilih sesi",
      "Height and bike": "Ketinggian dan basikal",
      "Back": "Kembali",
      "Continue": "Teruskan",
      "No upcoming sessions": "Tiada sesi akan datang",
      "Name": "Nama",
      "Company": "Syarikat",
      "riders": "penunggang",
      "Riding with someone?": "Berkayuh bersama orang lain?",
      "Add another rider": "Tambah penunggang lain",
      "Rider {n}": "Penunggang {n}",
      "Remove": "Buang",
      "Enter the rider's full name": "Masukkan nama penuh penunggang",
      "Enter the rider's height in cm (100 to 250)": "Masukkan ketinggian penunggang dalam cm (100 hingga 250)",
      "Riding with: {names}": "Berkayuh bersama: {names}",
      "Up to four companions": "Sehingga empat peneman",
      "Edit my booking": "Ubah tempahan saya",
      "Edit your booking": "Ubah tempahan anda",
      "Save changes": "Simpan perubahan",
      "Saving...": "Menyimpan...",
      "Your booking was updated.": "Tempahan anda telah dikemas kini.",
      "We could not find your booking. Please register again.": "Kami tidak dapat mencari tempahan anda. Sila daftar semula.",
      "You have already checked in. Ask the desk to change your booking.": "Anda telah mendaftar masuk. Minta petugas kaunter untuk menukar tempahan anda.",
      "This badge is already registered for that session": "Kad pekerja ini sudah didaftarkan untuk sesi tersebut",
      "Cancel": "Batalkan",
      "This session is no longer open": "Sesi ini tidak lagi dibuka",
      "Your details were updated.": "Butiran anda telah dikemas kini.",
      "I have read the Privacy Notice.": "Saya telah membaca Notis Privasi.",
      "Read the Privacy Notice": "Baca Notis Privasi",
      "Please confirm you’ve read the Privacy Notice.": "Sila sahkan bahawa anda telah membaca Notis Privasi.",
      "Privacy Notice": "Notis Privasi",
      "This notice is available in English and Arabic.": "Notis ini tersedia dalam bahasa Inggeris dan bahasa Arab.",
      "Close": "Tutup",
      "Names can only contain letters, spaces and periods.": "Nama hanya boleh mengandungi huruf, ruang dan titik.",
      "Write your first and last name in full, not initials": "Tulis nama pertama dan nama akhir anda dengan penuh, bukan inisial",
      "Write the rider's name in full, not initials": "Tulis nama penunggang dengan penuh, bukan inisial",
      "Ride waiver": "Penepian liabiliti kayuhan",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "Anda tidak boleh menempah sebarang kayuhan atau aktiviti dengan MicroMobility sehingga anda telah membaca dan bersetuju dengan penepian liabiliti ini. Berbasikal ialah aktiviti fizikal yang mempunyai risiko. Saya mengambil bahagian sepenuhnya atas risiko saya sendiri, dan hanya saya yang bertanggungjawab atas diri saya, keselamatan saya dan barang peribadi saya. Saya juga bertanggungjawab atas sebarang kerosakan yang saya sebabkan kepada orang lain atau harta benda mereka. Setakat maksimum yang dibenarkan oleh undang-undang, MicroMobility, kakitangannya dan rakan kongsinya tidak bertanggungjawab atas apa-apa yang berlaku kepada saya atau barang saya, termasuk sebarang kecederaan, patah tulang, penyakit, kehilangan, kecurian atau kerosakan, walau apa pun puncanya, semasa aktiviti atau berkaitan dengannya. Saya bersetuju untuk memakai topi keledar serta mematuhi arahan pasukan dan laluan, dan saya bertanggungjawab atas sebarang kerosakan pada basikal sewaan akibat salah guna. Basikal dipulangkan dalam keadaan yang sama seperti semasa diterima.",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "Saya telah membaca penepian liabiliti dan bersetuju dengannya bagi pihak setiap penunggang dalam pendaftaran ini",
      "Please accept the waiver to continue.": "Sila terima penepian liabiliti untuk meneruskan.",
      "Register another": "Daftar seorang lagi",
      "Other registrations on this phone": "Pendaftaran lain pada telefon ini",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "Penepian liabiliti kayuhan telah berubah. Muat semula halaman ini untuk membaca dan menerima versi baharu.",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "Tempahan ini sudah dibayar, jadi ia tidak boleh dipindahkan ke sesi dengan harga yang berbeza. Minta petugas kaunter untuk menukarnya.",
      "Language": "Bahasa",
      "Country code": "Kod negara",
      "Progress": "Kemajuan",
      "Booking QR code": "Kod QR tempahan",
      "Petromin bike night": "Malam Berbasikal Petromin",
      "Check and agree": "Semak dan setuju",
      "Find my booking": "Cari tempahan saya",
      "Read the waiver": "Baca surat penepian",
      "Agree and register": "Setuju dan daftar",
      "Bike pickup": "Pengambilan basikal",
      "Where": "Di mana",
      "Helmets are required. One comes with every bike.": "Topi keledar wajib dipakai. Satu disediakan bersama setiap basikal.",
      "Add to Apple Wallet": "Tambah ke Apple Wallet",
      "Add to calendar": "Tambah ke kalendar",
      "Directions": "Arah ke lokasi",
      "Change": "Tukar",
      "Booking number": "Nombor tempahan",
      "Jeddah Corniche Circuit": "Litar Corniche Jeddah",
      "Cancel my booking": "Batalkan tempahan saya",
      "Save": "Simpan",
      "Enter your booking number": "Masukkan nombor tempahan anda",
      "Bikes from {t}": "Basikal dari {t}",
      "{n} cm": "{n} cm",
      "Remove {name} from this booking?": "Buang {name} daripada tempahan ini?",
      "Cancel booking {no}? Every rider on it loses their place.": "Batalkan tempahan {no}? Setiap penunggang di dalamnya akan kehilangan tempat.",
      "Cancel booking": "Batalkan tempahan",
      "Keep it": "Kekalkan",
      "Your booking was cancelled.": "Tempahan anda telah dibatalkan.",
      "We could not save this. Please try again.": "Kami tidak dapat menyimpannya. Sila cuba lagi.",
      "The desk has this booking. Ask the desk to cancel it.": "Tempahan ini dipegang oleh kaunter. Minta kaunter membatalkannya.",
      "We could not find a booking with this number and mobile number.": "Kami tidak menemui tempahan dengan nombor dan nombor telefon ini."
    },
    de: {
      "Your registration for {d} is confirmed.": "Deine Anmeldung für {d} ist bestätigt.",
      "Booking": "Buchung",
      "Enter a valid mobile number": "Gib eine gültige Handynummer ein",
      "Your company": "Dein Unternehmen",
      "Choose your company": "Wähle dein Unternehmen",
      "Badge number": "Badge-Nummer",
      "Full name": "Vollständiger Name",
      "Mobile number": "Handynummer",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Gib eine gültige saudische Handynummer ein (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "Das ist keine Handynummer für +{c}. Bitte prüfe sie.",
      "Height in cm": "Körpergröße in cm",
      "Bike type": "Radtyp",
      "Hybrid": "Trekkingrad",
      "Mountain": "Mountainbike",
      "Register": "Anmelden",
      "Registering...": "Wird angemeldet …",
      "Enter your badge number": "Gib deine Badge-Nummer ein",
      "Enter your full name": "Gib deinen vollständigen Namen ein",
      "Enter your height in cm (100 to 250)": "Gib deine Körpergröße in cm ein (100 bis 250)",
      "Choose a bike type": "Wähle einen Radtyp",
      "Could not reach the server": "Der Server ist nicht erreichbar",
      "Too many submissions from this network": "Zu viele Anmeldungen aus diesem Netzwerk",
      "Dismiss": "Schließen",
      "You are registered": "Du bist angemeldet",
      "Badge": "Badge",
      "MicroMobility, Jeddah": "MicroMobility, Dschidda",
      "Need help? WhatsApp us": "Brauchst du Hilfe? Schreib uns auf WhatsApp",
      "Session": "Veranstaltung",
      "Your details": "Deine Angaben",
      "Bike": "Rad",
      "Choose your session": "Wähle deinen Termin",
      "Choose a session": "Wähle einen Termin",
      "Height and bike": "Körpergröße und Rad",
      "Back": "Zurück",
      "Continue": "Weiter",
      "No upcoming sessions": "Keine anstehenden Termine",
      "Name": "Name",
      "Company": "Unternehmen",
      "riders": "Personen",
      "Riding with someone?": "Kommst du in Begleitung?",
      "Add another rider": "Weitere Person hinzufügen",
      "Rider {n}": "Person {n}",
      "Remove": "Entfernen",
      "Enter the rider's full name": "Gib den vollständigen Namen der Person ein",
      "Enter the rider's height in cm (100 to 250)": "Gib die Körpergröße der Person in cm ein (100 bis 250)",
      "Riding with: {names}": "Mit dabei: {names}",
      "Up to four companions": "Bis zu vier Begleitpersonen",
      "Edit my booking": "Meine Buchung bearbeiten",
      "Edit your booking": "Deine Buchung bearbeiten",
      "Save changes": "Änderungen speichern",
      "Saving...": "Wird gespeichert …",
      "Your booking was updated.": "Deine Buchung wurde aktualisiert.",
      "We could not find your booking. Please register again.": "Wir konnten deine Buchung nicht finden. Bitte melde dich erneut an.",
      "You have already checked in. Ask the desk to change your booking.": "Du hast schon eingecheckt. Wende dich an den Schalter, um deine Buchung zu ändern.",
      "This badge is already registered for that session": "Dieser Badge ist für diesen Termin schon angemeldet",
      "Cancel": "Stornieren",
      "This session is no longer open": "Dieser Termin ist nicht mehr offen",
      "Your details were updated.": "Deine Angaben wurden aktualisiert.",
      "I have read the Privacy Notice.": "Ich habe die Datenschutzhinweise gelesen.",
      "Read the Privacy Notice": "Datenschutzhinweise lesen",
      "Please confirm you’ve read the Privacy Notice.": "Bitte bestätige, dass du die Datenschutzhinweise gelesen hast.",
      "Privacy Notice": "Datenschutzhinweise",
      "This notice is available in English and Arabic.": "Diese Hinweise sind auf Englisch und Arabisch verfügbar.",
      "Close": "Schließen",
      "Names can only contain letters, spaces and periods.": "Namen dürfen nur Buchstaben, Leerzeichen und Punkte enthalten.",
      "Write your first and last name in full, not initials": "Schreib Vor- und Nachnamen vollständig aus, keine Initialen",
      "Write the rider's name in full, not initials": "Schreib den Namen der Person vollständig aus, keine Initialen",
      "Ride waiver": "Haftungserklärung Radfahren",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "Du kannst bei MicroMobility keine Fahrt und keine Aktivität buchen, bevor du diese Haftungserklärung gelesen und ihr zugestimmt hast. Radfahren ist eine körperliche Aktivität, die Risiken birgt. Ich nehme vollständig auf eigene Gefahr teil und bin allein verantwortlich für mich selbst, meine Sicherheit und meine persönlichen Sachen. Ich bin außerdem für jeden Schaden verantwortlich, den ich anderen Personen oder ihrem Eigentum zufüge. Im größtmöglichen gesetzlich zulässigen Umfang sind MicroMobility, seine Mitarbeitenden und seine Partner für nichts verantwortlich, was mir oder meinen Sachen zustößt, einschließlich Verletzungen, Knochenbrüchen, Erkrankungen, Verlust, Diebstahl oder Beschädigung, gleich aus welcher Ursache, während der Aktivität oder im Zusammenhang mit ihr. Ich verpflichte mich, einen Helm zu tragen und die Anweisungen des Teams sowie die Route einzuhalten, und ich hafte für jeden Schaden am Leihrad, der durch unsachgemäße Nutzung entsteht. Das Rad wird in dem Zustand zurückgegeben, in dem es übernommen wurde.",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "Ich habe die Haftungserklärung gelesen und stimme ihr im Namen aller Fahrenden dieser Anmeldung zu",
      "Please accept the waiver to continue.": "Bitte akzeptiere die Haftungserklärung, um fortzufahren.",
      "Register another": "Noch jemanden anmelden",
      "Other registrations on this phone": "Weitere Anmeldungen auf diesem Handy",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "Die Haftungserklärung zur Ausfahrt hat sich geändert. Lade diese Seite neu, um die neue zu lesen und zu akzeptieren.",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "Diese Buchung ist schon bezahlt und kann daher nicht auf einen Termin mit anderem Preis verschoben werden. Wende dich zum Ändern an den Schalter.",
      "Language": "Sprache",
      "Country code": "Ländervorwahl",
      "Progress": "Fortschritt",
      "Booking QR code": "QR-Code der Buchung",
      "Petromin bike night": "Petromin-Radabend",
      "Check and agree": "Prüfen und zustimmen",
      "Find my booking": "Meine Buchung finden",
      "Read the waiver": "Haftungsausschluss lesen",
      "Agree and register": "Zustimmen und anmelden",
      "Bike pickup": "Radausgabe",
      "Where": "Wo",
      "Helmets are required. One comes with every bike.": "Helm ist Pflicht. Zu jedem Rad gibt es einen.",
      "Add to Apple Wallet": "Zu Apple Wallet hinzufügen",
      "Add to calendar": "In den Kalender",
      "Directions": "Anfahrt",
      "Change": "Ändern",
      "Booking number": "Buchungsnummer",
      "Jeddah Corniche Circuit": "Jeddah Corniche Circuit",
      "Cancel my booking": "Meine Buchung stornieren",
      "Save": "Speichern",
      "Enter your booking number": "Gib deine Buchungsnummer ein",
      "Bikes from {t}": "Räder ab {t}",
      "{n} cm": "{n} cm",
      "Remove {name} from this booking?": "{name} aus dieser Buchung entfernen?",
      "Cancel booking {no}? Every rider on it loses their place.": "Buchung {no} stornieren? Alle Personen darauf verlieren ihren Platz.",
      "Cancel booking": "Buchung stornieren",
      "Keep it": "Behalten",
      "Your booking was cancelled.": "Deine Buchung wurde storniert.",
      "We could not save this. Please try again.": "Das konnten wir nicht speichern. Bitte versuche es noch einmal.",
      "The desk has this booking. Ask the desk to cancel it.": "Diese Buchung liegt beim Empfang. Bitte den Empfang, sie zu stornieren.",
      "We could not find a booking with this number and mobile number.": "Wir haben keine Buchung mit dieser Nummer und Handynummer gefunden."
    },
    ru: {
      "Your registration for {d} is confirmed.": "Ваша регистрация подтверждена: {d}.",
      "Booking": "Бронирование",
      "Enter a valid mobile number": "Введите корректный номер мобильного",
      "Your company": "Ваша компания",
      "Choose your company": "Выберите компанию",
      "Badge number": "Номер пропуска",
      "Full name": "Имя и фамилия",
      "Mobile number": "Номер мобильного",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Введите корректный саудовский номер мобильного (05XXXXXXXX)",
      "This is not a mobile number for +{c}. Please check it.": "Это не номер мобильного для кода +{c}. Проверьте его.",
      "Height in cm": "Рост в см",
      "Bike type": "Тип велосипеда",
      "Hybrid": "Гибрид",
      "Mountain": "Горный",
      "Register": "Зарегистрироваться",
      "Registering...": "Регистрируем…",
      "Enter your badge number": "Введите номер пропуска",
      "Enter your full name": "Введите имя и фамилию",
      "Enter your height in cm (100 to 250)": "Укажите свой рост в см (от 100 до 250)",
      "Choose a bike type": "Выберите тип велосипеда",
      "Could not reach the server": "Не удалось связаться с сервером",
      "Too many submissions from this network": "Слишком много заявок из этой сети",
      "Dismiss": "Закрыть",
      "You are registered": "Вы зарегистрированы",
      "Badge": "Пропуск",
      "MicroMobility, Jeddah": "MicroMobility, Джидда",
      "Need help? WhatsApp us": "Нужна помощь? Напишите нам в WhatsApp",
      "Session": "Занятие",
      "Your details": "Ваши данные",
      "Bike": "Велосипед",
      "Choose your session": "Выберите сеанс",
      "Choose a session": "Выберите сеанс",
      "Height and bike": "Рост и велосипед",
      "Back": "Назад",
      "Continue": "Продолжить",
      "No upcoming sessions": "Нет ближайших сеансов",
      "Name": "Имя",
      "Company": "Компания",
      "riders": "чел.",
      "Riding with someone?": "Едете с кем-то?",
      "Add another rider": "Добавить ещё участника",
      "Rider {n}": "Участник {n}",
      "Remove": "Удалить",
      "Enter the rider's full name": "Введите имя и фамилию участника",
      "Enter the rider's height in cm (100 to 250)": "Укажите рост участника в см (от 100 до 250)",
      "Riding with: {names}": "Едут с вами: {names}",
      "Up to four companions": "Не более четырёх спутников",
      "Edit my booking": "Изменить моё бронирование",
      "Edit your booking": "Изменить бронирование",
      "Save changes": "Сохранить изменения",
      "Saving...": "Сохранение…",
      "Your booking was updated.": "Бронирование обновлено.",
      "We could not find your booking. Please register again.": "Не удалось найти ваше бронирование. Зарегистрируйтесь ещё раз.",
      "You have already checked in. Ask the desk to change your booking.": "Вы уже отметились по прибытии. Чтобы изменить бронирование, обратитесь на стойку.",
      "This badge is already registered for that session": "Этот пропуск уже зарегистрирован на этот сеанс",
      "Cancel": "Отменить",
      "This session is no longer open": "Этот сеанс уже закрыт",
      "Your details were updated.": "Ваши данные обновлены.",
      "I have read the Privacy Notice.": "Я прочитал(а) Уведомление о конфиденциальности.",
      "Read the Privacy Notice": "Прочитать Уведомление о конфиденциальности",
      "Please confirm you’ve read the Privacy Notice.": "Подтвердите, что вы прочитали Уведомление о конфиденциальности.",
      "Privacy Notice": "Уведомление о конфиденциальности",
      "This notice is available in English and Arabic.": "Это уведомление доступно на английском и арабском языках.",
      "Close": "Закрыть",
      "Names can only contain letters, spaces and periods.": "Имя может содержать только буквы, пробелы и точки.",
      "Write your first and last name in full, not initials": "Напишите имя и фамилию полностью, а не инициалы",
      "Write the rider's name in full, not initials": "Напишите имя участника полностью, а не инициалы",
      "Ride waiver": "Отказ от ответственности: заезд",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "Вы не можете забронировать ни заезд, ни другое мероприятие MicroMobility, пока не прочитаете этот отказ от ответственности и не согласитесь с ним. Езда на велосипеде — физическая активность, сопряжённая с риском. Я участвую полностью на свой страх и риск и единолично отвечаю за себя, свою безопасность и свои личные вещи. Я также несу ответственность за любой ущерб, причинённый мной другим людям или их имуществу. В максимальной степени, допускаемой законом, MicroMobility, её сотрудники и партнёры не несут ответственности ни за что, что произойдёт со мной или с моими вещами, включая любые травмы, переломы, заболевания, утрату, кражу или повреждение, независимо от причины, во время мероприятия или в связи с ним. Я обязуюсь носить шлем, следовать указаниям команды и маршруту и несу ответственность за любой ущерб арендованному велосипеду, причинённый неправильным использованием. Велосипед возвращается в том состоянии, в котором был получен.",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "Я прочитал(а) отказ от ответственности и соглашаюсь с ним от имени всех участников этой регистрации",
      "Please accept the waiver to continue.": "Чтобы продолжить, примите отказ от ответственности.",
      "Register another": "Ещё одна регистрация",
      "Other registrations on this phone": "Другие регистрации на этом телефоне",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "Отказ от ответственности для заезда изменился. Перезагрузите страницу, чтобы прочитать и принять новый.",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "Это бронирование уже оплачено, поэтому его нельзя перенести на сеанс с другой ценой. Чтобы изменить его, обратитесь на стойку.",
      "Language": "Язык",
      "Country code": "Код страны",
      "Progress": "Прогресс",
      "Booking QR code": "QR-код бронирования",
      "Petromin bike night": "Велосипедный вечер Petromin",
      "Check and agree": "Проверка и согласие",
      "Find my booking": "Найти моё бронирование",
      "Read the waiver": "Прочитать отказ от претензий",
      "Agree and register": "Согласиться и зарегистрироваться",
      "Bike pickup": "Выдача велосипедов",
      "Where": "Где",
      "Helmets are required. One comes with every bike.": "Шлем обязателен. Он выдаётся с каждым велосипедом.",
      "Add to Apple Wallet": "Добавить в Apple Wallet",
      "Add to calendar": "Добавить в календарь",
      "Directions": "Как добраться",
      "Change": "Изменить",
      "Booking number": "Номер бронирования",
      "Jeddah Corniche Circuit": "Трасса Джидда-Корниш",
      "Cancel my booking": "Отменить моё бронирование",
      "Save": "Сохранить",
      "Enter your booking number": "Введите номер бронирования",
      "Bikes from {t}": "Велосипеды с {t}",
      "{n} cm": "{n} см",
      "Remove {name} from this booking?": "Удалить {name} из этого бронирования?",
      "Cancel booking {no}? Every rider on it loses their place.": "Отменить бронирование {no}? Все участники в нём потеряют свои места.",
      "Cancel booking": "Отменить бронирование",
      "Keep it": "Оставить",
      "Your booking was cancelled.": "Бронирование отменено.",
      "We could not save this. Please try again.": "Не удалось сохранить. Попробуйте ещё раз.",
      "The desk has this booking. Ask the desk to cancel it.": "Этим бронированием занимается стойка регистрации. Попросите её отменить его.",
      "We could not find a booking with this number and mobile number.": "Бронирование с таким номером и номером телефона не найдено."
    },
    zh: {
      "Your registration for {d} is confirmed.": "您在 {d} 的登记已确认。",
      "Booking": "预订",
      "Enter a valid mobile number": "请输入有效的手机号",
      "Your company": "您的公司",
      "Choose your company": "请选择您的公司",
      "Badge number": "工牌号",
      "Full name": "姓名",
      "Mobile number": "手机号",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "请输入有效的沙特手机号（05XXXXXXXX）",
      "This is not a mobile number for +{c}. Please check it.": "这不是 +{c} 的手机号，请检查。",
      "Height in cm": "身高（厘米）",
      "Bike type": "车型",
      "Hybrid": "城市休闲车",
      "Mountain": "山地车",
      "Register": "登记",
      "Registering...": "正在登记…",
      "Enter your badge number": "请输入您的工牌号",
      "Enter your full name": "请输入您的完整姓名",
      "Enter your height in cm (100 to 250)": "请输入您的身高（厘米，100 到 250）",
      "Choose a bike type": "请选择车型",
      "Could not reach the server": "无法连接服务器",
      "Too many submissions from this network": "来自此网络的提交次数过多",
      "Dismiss": "关闭",
      "You are registered": "登记成功",
      "Badge": "工牌",
      "MicroMobility, Jeddah": "MicroMobility，吉达",
      "Need help? WhatsApp us": "需要帮助？通过 WhatsApp 联系我们",
      "Session": "活动",
      "Your details": "您的信息",
      "Bike": "自行车",
      "Choose your session": "请选择您的场次",
      "Choose a session": "请选择场次",
      "Height and bike": "身高与自行车",
      "Back": "返回",
      "Continue": "继续",
      "No upcoming sessions": "暂无即将开始的场次",
      "Name": "姓名",
      "Company": "公司",
      "riders": "位骑行者",
      "Riding with someone?": "有人与您同行吗？",
      "Add another rider": "再添加一位骑行者",
      "Rider {n}": "骑行者 {n}",
      "Remove": "移除",
      "Enter the rider's full name": "请输入骑行者的完整姓名",
      "Enter the rider's height in cm (100 to 250)": "请输入骑行者的身高（厘米，100 到 250）",
      "Riding with: {names}": "同行者：{names}",
      "Up to four companions": "最多四位同伴",
      "Edit my booking": "修改我的预订",
      "Edit your booking": "修改您的预订",
      "Save changes": "保存修改",
      "Saving...": "正在保存…",
      "Your booking was updated.": "您的预订已更新。",
      "We could not find your booking. Please register again.": "找不到您的预订。请重新登记。",
      "You have already checked in. Ask the desk to change your booking.": "您已签到。如需修改预订，请联系服务台。",
      "This badge is already registered for that session": "此工牌已登记过该场次",
      "Cancel": "取消预订",
      "This session is no longer open": "该场次已不再开放",
      "Your details were updated.": "您的信息已更新。",
      "I have read the Privacy Notice.": "我已阅读隐私声明。",
      "Read the Privacy Notice": "阅读隐私声明",
      "Please confirm you’ve read the Privacy Notice.": "请确认您已阅读隐私声明。",
      "Privacy Notice": "隐私声明",
      "This notice is available in English and Arabic.": "本声明提供英文版和阿拉伯文版。",
      "Close": "关闭",
      "Names can only contain letters, spaces and periods.": "姓名只能包含文字、空格和句点。",
      "Write your first and last name in full, not initials": "请完整填写名和姓，不要只写首字母",
      "Write the rider's name in full, not initials": "请完整填写骑行者姓名，不要只写首字母",
      "Ride waiver": "骑行免责声明",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "在阅读并同意本免责声明之前，您无法在 MicroMobility 预订任何骑行或活动。骑行是一项存在风险的体育活动。我自愿参与，风险完全由本人承担，并由本人独自对自身、自身安全及个人物品负责。对于本人给他人或他人财产造成的任何损害，本人亦须负责。在法律允许的最大范围内，MicroMobility 及其员工和合作伙伴对我本人或我的物品发生的任何事情概不负责，包括任何受伤、骨折、疾病、遗失、被盗或损坏，无论因何原因造成，亦无论发生在活动期间还是与活动相关。我同意佩戴头盔，遵守团队指示和路线，并对因使用不当对所租自行车造成的任何损坏负责。自行车须按领取时的状态归还。",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "我已阅读免责声明，并代表本次登记中的每位骑行者表示同意",
      "Please accept the waiver to continue.": "请接受免责声明以继续。",
      "Register another": "再登记一位",
      "Other registrations on this phone": "此手机上的其他登记",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "骑行免责声明已更新。请重新加载此页面，阅读并接受新版本。",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "此预订已付款，因此无法改到价格不同的场次。如需更改，请联系服务台。",
      "Language": "语言",
      "Country code": "国家/地区代码",
      "Progress": "进度",
      "Booking QR code": "预订二维码",
      "Petromin bike night": "Petromin 骑行之夜",
      "Check and agree": "核对并同意",
      "Find my booking": "查找我的预订",
      "Read the waiver": "阅读免责声明",
      "Agree and register": "同意并登记",
      "Bike pickup": "取车",
      "Where": "地点",
      "Helmets are required. One comes with every bike.": "必须佩戴头盔。每辆自行车都配有一顶。",
      "Add to Apple Wallet": "添加到 Apple 钱包",
      "Add to calendar": "添加到日历",
      "Directions": "导航",
      "Change": "更改",
      "Booking number": "预订编号",
      "Jeddah Corniche Circuit": "吉达滨海赛道",
      "Cancel my booking": "取消我的预订",
      "Save": "保存",
      "Enter your booking number": "请输入您的预订号",
      "Bikes from {t}": "{t} 起取车",
      "{n} cm": "{n} 厘米",
      "Remove {name} from this booking?": "要将 {name} 从此预订中移除吗？",
      "Cancel booking {no}? Every rider on it loses their place.": "要取消预订 {no} 吗？其中每位骑行者都将失去名额。",
      "Cancel booking": "取消预订",
      "Keep it": "保留",
      "Your booking was cancelled.": "您的预订已取消。",
      "We could not save this. Please try again.": "无法保存。请重试。",
      "The desk has this booking. Ask the desk to cancel it.": "此预订已由服务台处理。请让服务台为您取消。",
      "We could not find a booking with this number and mobile number.": "找不到与此预订号和手机号相符的预订。"
    },
    ja: {
      "Your registration for {d} is confirmed.": "{d}の登録が確定しました。",
      "Booking": "予約",
      "Enter a valid mobile number": "有効な携帯電話番号を入力してください",
      "Your company": "所属会社",
      "Choose your company": "所属会社を選択してください",
      "Badge number": "社員証番号",
      "Full name": "氏名",
      "Mobile number": "携帯電話番号",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "有効なサウジアラビアの携帯電話番号を入力してください（05XXXXXXXX）",
      "This is not a mobile number for +{c}. Please check it.": "+{c}の携帯電話番号ではありません。ご確認ください。",
      "Height in cm": "身長（cm）",
      "Bike type": "車種",
      "Hybrid": "クロスバイク",
      "Mountain": "マウンテンバイク",
      "Register": "登録する",
      "Registering...": "登録中…",
      "Enter your badge number": "社員証番号を入力してください",
      "Enter your full name": "フルネームを入力してください",
      "Enter your height in cm (100 to 250)": "身長をcmで入力してください（100〜250）",
      "Choose a bike type": "車種を選択してください",
      "Could not reach the server": "サーバーに接続できませんでした",
      "Too many submissions from this network": "このネットワークからの送信が多すぎます",
      "Dismiss": "閉じる",
      "You are registered": "登録が完了しました",
      "Badge": "社員証",
      "MicroMobility, Jeddah": "MicroMobility、ジェッダ",
      "Need help? WhatsApp us": "お困りですか？WhatsAppでご連絡ください",
      "Session": "セッション",
      "Your details": "ご連絡先",
      "Bike": "自転車",
      "Choose your session": "セッションを選択してください",
      "Choose a session": "セッションを選択",
      "Height and bike": "身長と自転車",
      "Back": "戻る",
      "Continue": "続ける",
      "No upcoming sessions": "今後のセッションはありません",
      "Name": "お名前",
      "Company": "会社",
      "riders": "名",
      "Riding with someone?": "同行者はいますか？",
      "Add another rider": "ライダーを追加",
      "Rider {n}": "ライダー{n}",
      "Remove": "削除",
      "Enter the rider's full name": "ライダーのフルネームを入力してください",
      "Enter the rider's height in cm (100 to 250)": "ライダーの身長をcmで入力してください（100〜250）",
      "Riding with: {names}": "同行者：{names}",
      "Up to four companions": "同行者は4名まで",
      "Edit my booking": "予約を変更",
      "Edit your booking": "予約の変更",
      "Save changes": "変更を保存",
      "Saving...": "保存中…",
      "Your booking was updated.": "予約を更新しました。",
      "We could not find your booking. Please register again.": "予約が見つかりませんでした。もう一度登録してください。",
      "You have already checked in. Ask the desk to change your booking.": "すでにチェックイン済みです。予約の変更は受付にお申し付けください。",
      "This badge is already registered for that session": "この社員証は、そのセッションにすでに登録されています",
      "Cancel": "キャンセル",
      "This session is no longer open": "このセッションの受付は終了しました",
      "Your details were updated.": "登録情報を更新しました。",
      "I have read the Privacy Notice.": "プライバシー通知を読みました。",
      "Read the Privacy Notice": "プライバシー通知を読む",
      "Please confirm you’ve read the Privacy Notice.": "プライバシー通知を読んだことを確認してください。",
      "Privacy Notice": "プライバシー通知",
      "This notice is available in English and Arabic.": "この通知は英語とアラビア語でご覧いただけます。",
      "Close": "閉じる",
      "Names can only contain letters, spaces and periods.": "名前に使えるのは、文字、スペース、ピリオドのみです。",
      "Write your first and last name in full, not initials": "姓と名はイニシャルではなく、省略せずに入力してください",
      "Write the rider's name in full, not initials": "ライダーのお名前は、イニシャルではなくフルネームで入力してください",
      "Ride waiver": "ライドの免責同意書",
      "You cannot book any ride or activity with MicroMobility until you have read and agreed to this waiver. Cycling is a physical activity that carries risk. I take part entirely at my own risk, and I alone am responsible for myself, my safety and my personal belongings. I am also responsible for any damage I cause to other people or their property. To the fullest extent permitted by law, MicroMobility, its staff and its partners are not responsible for anything that happens to me or to my belongings, including any injury, fracture, illness, loss, theft or damage, however it is caused, during the activity or in connection with it. I agree to wear a helmet and to follow the team’s instructions and the route, and I am responsible for any damage to the rented bike caused by misuse. The bike is returned in the condition it was received.": "この免責同意書を読んで同意するまで、MicroMobilityのライドやアクティビティは一切予約できません。サイクリングはリスクを伴う身体活動です。私は全面的に自己の責任において参加し、自分自身、自分の安全および私物について、私のみが責任を負います。また、私が他の人またはその財産に与えた損害についても、私が責任を負います。法律で認められる最大限の範囲において、MicroMobility、そのスタッフおよびパートナーは、私または私の所持品に生じるいかなる事態についても責任を負いません。これには、原因を問わず、アクティビティ中またはこれに関連して生じたけが、骨折、病気、紛失、盗難または損傷が含まれます。ヘルメットを着用し、スタッフの指示とルートに従うことに同意します。また、誤った使用によりレンタル自転車に生じた損傷について、私が責任を負います。自転車は受け取った時と同じ状態で返却します。",
      "I have read the waiver and agree to it on behalf of every rider on this registration": "免責同意書を読み、この登録のライダー全員を代表して同意します",
      "Please accept the waiver to continue.": "続けるには、免責同意書に同意してください。",
      "Register another": "別の方を登録",
      "Other registrations on this phone": "この端末でのほかの登録",
      "The ride waiver has changed. Reload this page to read and accept the new one.": "ライドの免責同意書が変更されました。このページを再読み込みして、新しい同意書をお読みのうえ同意してください。",
      "This booking is already paid, so it cannot move to a session with a different price. Ask the desk to change it.": "この予約は支払い済みのため、料金の異なるセッションには変更できません。変更は受付にお申し付けください。",
      "Language": "言語",
      "Country code": "国番号",
      "Progress": "進捗",
      "Booking QR code": "予約のQRコード",
      "Petromin bike night": "Petromin サイクリングナイト",
      "Check and agree": "確認と同意",
      "Find my booking": "予約を探す",
      "Read the waiver": "免責同意書を読む",
      "Agree and register": "同意して登録",
      "Bike pickup": "自転車の受け取り",
      "Where": "場所",
      "Helmets are required. One comes with every bike.": "ヘルメットの着用は必須です。自転車1台につき1つお貸しします。",
      "Add to Apple Wallet": "Apple Walletに追加",
      "Add to calendar": "カレンダーに追加",
      "Directions": "経路案内",
      "Change": "変更",
      "Booking number": "予約番号",
      "Jeddah Corniche Circuit": "ジェッダ・コーニッシュ・サーキット",
      "Cancel my booking": "予約をキャンセル",
      "Save": "保存",
      "Enter your booking number": "予約番号を入力してください",
      "Bikes from {t}": "自転車の受け取りは{t}から",
      "{n} cm": "{n} cm",
      "Remove {name} from this booking?": "{name}さんをこの予約から外しますか？",
      "Cancel booking {no}? Every rider on it loses their place.": "予約{no}をキャンセルしますか？この予約の全員が参加枠を失います。",
      "Cancel booking": "予約をキャンセル",
      "Keep it": "そのままにする",
      "Your booking was cancelled.": "予約をキャンセルしました。",
      "We could not save this. Please try again.": "保存できませんでした。もう一度お試しください。",
      "The desk has this booking. Ask the desk to cancel it.": "この予約は受付で管理されています。キャンセルは受付にお申し出ください。",
      "We could not find a booking with this number and mobile number.": "この予約番号と携帯電話番号に一致する予約は見つかりませんでした。"
    }
  };
  var $ = function (s) { return document.querySelector(s); };
  var html = document.documentElement;
  // On the website's page for the form (apps/web/src/components/forms/SiteForm.tsx) the page speaks the language the
  // site's globe picked, and talks to the database the website does (staging's on staging): window.MM_SITE_FORM =
  // {lang, db: {url, key}}. The form's own page (?classic=1) has its own picker and none of this.
  var SITE_FORM = window.MM_SITE_FORM || null;
  var params = new URLSearchParams(location.search);
  var REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* Language */
  function t(key, args) {
    var dict = T[html.lang], s = (dict && dict[key]) || key;
    if (args) Object.keys(args).forEach(function (k) { s = s.split("{" + k + "}").join(args[k]); });
    return s;
  }
  function render(el) {
    var args = el.getAttribute("data-args");
    el.textContent = t(el.getAttribute("data-t"), args ? JSON.parse(args) : null);
  }
  // What else repaints in a new language (the review, the companions, the ticket): added further down.
  var langHooks = [];
  // The website's copy carries one language's words (the page's), fetched with the page (forms/petromin build,
  // t/<lang>.json): another language picked later is fetched first, then painted.
  var T_BASE = SITE_FORM && SITE_FORM.tBase;
  function applyLang(lang) {
    if (!LANGS[lang]) lang = "en";
    if (T_BASE && lang !== "en" && !T[lang] && window.fetch) {
      fetch(T_BASE[lang]).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d) { T[lang] = d; applyLang(lang); } }, function () {});
      return;
    }
    html.lang = lang;
    html.dir = RTL[lang] ? "rtl" : "ltr";
    document.querySelectorAll("[data-t]").forEach(render);
    document.querySelectorAll("[data-t-placeholder]").forEach(function (el) { el.placeholder = t(el.getAttribute("data-t-placeholder")); });
    document.querySelectorAll("[data-t-label]").forEach(function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-t-label"))); });
    if (typeof syncPhone === "function" && cc) syncPhone();
    var sel = $("#lang"); if (sel && sel.value !== lang) sel.value = lang;
    if (typeof renderSessions === "function" && sessionsEl) renderSessions();
    langHooks.forEach(function (f) { try { f(); } catch (e) {} });
    if (!SITE_FORM) try { localStorage.setItem("mm-lang", lang); } catch (e) {}
  }
  function initialLang() {
    if (SITE_FORM && LANGS[SITE_FORM.lang]) return SITE_FORM.lang;
    var q = params.get("lang"); if (q && LANGS[q]) return q;
    try { var s = localStorage.getItem("mm-lang"); if (s && LANGS[s]) return s; } catch (e) {}
    var nav = (navigator.languages || [navigator.language || "en"]);
    for (var i = 0; i < nav.length; i++) { var code = String(nav[i] || "").toLowerCase().split(/[-_]/)[0]; if (code === "fil") code = "tl"; if (LANGS[code]) return code; }
    return "en";
  }
  (function buildSelect() {
    var sel = $("#lang"); if (!sel) return;
    sel.innerHTML = "";
    Object.keys(LANGS).forEach(function (code) {
      var o = document.createElement("option"); o.value = code; o.textContent = LANGS[code]; sel.appendChild(o);
    });
    sel.addEventListener("change", function () { applyLang(sel.value); });
  })();
  applyLang(initialLang());

  /* Choices drawn as buttons with role=radio (night, company, bike type): one stop in the tab order per group, the
     arrow keys move the choice (the visual direction in Arabic and Urdu), Home and End go to the ends - the radio
     group a screen reader expects. */
  function radios(group) { return Array.prototype.slice.call(group.querySelectorAll('[role="radio"]:not([disabled])')); }
  function syncRoving(group) {
    var all = radios(group); if (!all.length) return;
    var on = all.filter(function (b) { return b.getAttribute("aria-checked") === "true"; })[0] || all[0];
    all.forEach(function (b) { b.tabIndex = b === on ? 0 : -1; });
  }
  function radioKeys(group) {
    group.addEventListener("keydown", function (e) {
      var all = radios(group), i = all.indexOf(document.activeElement); if (i < 0) return;
      var rtl = html.dir === "rtl", k = e.key, j = -1;
      if (k === "ArrowDown" || k === (rtl ? "ArrowLeft" : "ArrowRight")) j = (i + 1) % all.length;
      else if (k === "ArrowUp" || k === (rtl ? "ArrowRight" : "ArrowLeft")) j = (i - 1 + all.length) % all.length;
      else if (k === "Home") j = 0;
      else if (k === "End") j = all.length - 1;
      if (j < 0) return;
      e.preventDefault(); all[j].focus(); all[j].click();
    });
  }

  /* Sessions (fed from the MicroMobility Rentals calendar). Every time is Jeddah's, whatever zone the phone is in. */
  var sessions = [], selectedSession = null;
  var sessionsEl = $("#sessions");
  var TZ = "Asia/Riyadh";
  function fmtDate(iso) {
    var d = new Date(iso); var loc = html.lang + "-u-ca-gregory-nu-latn"; // Gregorian, Western digits, in every language
    try { return d.toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return d.toDateString(); }
  }
  function fmtTime(iso) {
    var d = new Date(iso); var loc = html.lang + "-u-ca-gregory-nu-latn"; // Gregorian, Western digits, in every language
    try { return d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; }
  }
  // When bikes are handed out: the night's own "HH:MM" (bike_slots._collect, 18:45 on Petromin nights), on its day.
  function collectIso(s) {
    if (!s || !s.collect || !/^\d{1,2}:\d{2}$/.test(s.collect) || !s.start) return null;
    var hm = s.collect.split(":");
    return String(s.start).slice(0, 10) + "T" + ("0" + hm[0]).slice(-2) + ":" + hm[1] + ":00+03:00";
  }
  // Where: the night's own place, else the circuit every Petromin night is ridden at.
  function placeOf(s) { return (s && s.place) || t("Jeddah Corniche Circuit"); }
  function factsLine(s) {
    var c = collectIso(s), parts = [];
    if (c) parts.push(t("Bikes from {t}", { t: fmtTime(c) }));
    parts.push(placeOf(s));
    return parts.join(" · ");
  }
  function renderSessions() {
    sessionsEl.innerHTML = "";
    if (!sessions.length) {
      var p = document.createElement("p"); p.className = "sessions-empty"; p.setAttribute("data-t", "No upcoming sessions"); render(p); sessionsEl.appendChild(p); return;
    }
    sessions.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "session"; b.setAttribute("role", "radio");
      b.setAttribute("data-id", s.id); b.setAttribute("aria-checked", String(selectedSession === s.id));
      // No cap here: the session's capacity limits website bookings only. A partner
      // registration is never disabled or marked full, however many have signed up.
      var date = document.createElement("span"); date.className = "session-date"; date.textContent = fmtDate(s.start) + (s.title ? " · " + s.title : "");
      var time = document.createElement("span"); time.className = "session-time"; time.textContent = fmtTime(s.start) + (s.end ? " – " + fmtTime(s.end) : "");
      var facts = document.createElement("span"); facts.className = "session-facts"; facts.textContent = factsLine(s);
      b.appendChild(date); b.appendChild(time); b.appendChild(facts);
      sessionsEl.appendChild(b);
    });
    syncRoving(sessionsEl);
  }
  function setSessions(list) { sessions = list || []; if (!sessions.some(function (s) { return s.id === selectedSession; })) selectedSession = null; renderSessions(); }
  sessionsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".session"); if (!b || b.disabled) return;
    selectedSession = b.getAttribute("data-id");
    sessionsEl.querySelectorAll(".session").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
    syncRoving(sessionsEl);
    setError("f-session", false);
  });
  radioKeys(sessionsEl);

  /* Steps: the night, the rider, the bikes, then everything on one page to check before agreeing. */
  var STEPS = 4, step = 1, returnTo = 0, booted = false;
  var stepHooks = [];
  function goStep(n) {
    var was = step;
    step = Math.min(STEPS, Math.max(1, n));
    $("#card").setAttribute("data-step", step);
    document.querySelectorAll(".step").forEach(function (f) { f.hidden = Number(f.getAttribute("data-step")) !== step; });
    document.querySelectorAll(".stepper-item").forEach(function (li) {
      var k = Number(li.getAttribute("data-step"));
      li.classList.toggle("active", k === step); li.classList.toggle("done", k < step);
      if (k === step) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    $("#back").hidden = step === 1;
    $("#next").hidden = step === STEPS;
    $("#submit").hidden = step !== STEPS;
    hideBanner();
    stepHooks.forEach(function (f) { try { f(step, was); } catch (e) {} });
    if (!booted) return;
    // The new step starts at its heading: on the website's long page the step that was shown left the page part-way
    // down, with the next step's title and progress above the screen. The heading takes the focus (a screen reader
    // starts there, and no phone keyboard opens by itself).
    scrollToCard();
    var head = document.querySelector('.step[data-step="' + step + '"] .step-title');
    if (head) { head.setAttribute("tabindex", "-1"); try { head.focus({ preventScroll: true }); } catch (e) { head.focus(); } }
  }
  function scrollToCard() {
    var card = $("#card"); if (!card || !card.getBoundingClientRect) return;
    var r = card.getBoundingClientRect(), top = SITE_FORM ? 60 : 0;
    if (r.top < top || r.top > window.innerHeight * 0.5) { try { card.scrollIntoView({ block: "start", behavior: REDUCED ? "auto" : "smooth" }); } catch (e) { card.scrollIntoView(); } }
  }
  function next() {
    if (!validateStep(step)) { focusInvalid(); return; }
    if (returnTo) { var r = returnTo; returnTo = 0; goStep(r); return; }
    goStep(step + 1);
  }
  $("#back").addEventListener("click", function () { returnTo = 0; goStep(step - 1); });
  $("#next").addEventListener("click", next);

  /* Phone: country code + national number, stored as E.164 in #phone-e164 */
  var COUNTRIES = [
    ["SA", "966"], ["AE", "971"], ["BH", "973"], ["KW", "965"], ["OM", "968"], ["QA", "974"],
    ["EG", "20"], ["JO", "962"], ["LB", "961"], ["SY", "963"], ["YE", "967"], ["SD", "249"], ["MA", "212"], ["TN", "216"],
    ["IN", "91"], ["PK", "92"], ["BD", "880"], ["NP", "977"], ["LK", "94"], ["PH", "63"], ["ID", "62"],
    ["ES", "34"], ["FR", "33"], ["PT", "351"], ["BR", "55"], ["MX", "52"], ["GB", "44"], ["US", "1"], ["TR", "90"]
  ];
  // The picker shows the Gulf first, then every other code in alphabetical order with Saudi Arabia
  // again in its place (the owner, 2026-10-05). Both Saudi rows carry "966", so the same number is
  // stored either way, and setting cc.value picks the top one. COUNTRIES stays one row per code.
  var CC_SHOWN = COUNTRIES.slice(0, 6).concat(COUNTRIES.slice(6).concat([COUNTRIES[0]]).sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; }));
  var cc = $("#cc"), phoneIn = $("#phone"), phoneOut = $("#phone-e164");
  function fillCC(sel) {
    sel.innerHTML = "";
    CC_SHOWN.forEach(function (x) { var o = document.createElement("option"); o.value = x[1]; o.setAttribute("data-iso", x[0]); o.textContent = x[0] + " +" + x[1]; sel.appendChild(o); });
    sel.value = "966";
  }
  fillCC(cc);
  var DIGIT_ZEROS = [0x0660, 0x06F0, 0x0966, 0x09E6];
  function asciiDigits(v) {
    return String(v || "").replace(/[٠-٩۰-۹०-९০-৯]/g, function (ch) {
      var c = ch.charCodeAt(0);
      for (var i = 0; i < DIGIT_ZEROS.length; i++) if (c >= DIGIT_ZEROS[i] && c <= DIGIT_ZEROS[i] + 9) return String(c - DIGIT_ZEROS[i]);
      return ch;
    });
  }
  // A mobile number's length without its country code, for each code above. A number typed with its
  // code but no + or 00 ("971501234567") loses the code when what is left has that length and the
  // whole does not, as the community form's ccIncluded does with the phone rules; it was sent as
  // "+971971501234567".
  var NATIONAL_LEN = { "971": [9], "973": [8], "965": [8], "968": [8], "974": [8], "20": [10], "962": [9], "961": [7, 8], "963": [9], "967": [9], "249": [9], "212": [9], "216": [8],
    "91": [10], "92": [10], "880": [10], "977": [10], "94": [9], "63": [10], "62": [9, 10, 11, 12], "34": [9], "33": [9], "351": [9], "55": [10, 11], "52": [10], "44": [10], "1": [10], "90": [10] };
  // The digits a mobile number starts with, for each code above (the same libphonenumber mobile rules
  // the community form checks a number with). A number is a mobile of its code when it has one of the
  // code's lengths and starts so: anything else is refused, naming the code. Under PK +92 a Saudi
  // "0501234567" was sent as "+92501234567", and under AE +971 "966501234567" as "+971966501234567".
  var MOBILE_START = { "971": "5", "973": "36", "965": "4569", "968": "179", "974": "3567", "20": "1", "962": "47", "961": "378", "963": "59", "967": "7", "249": "19", "212": "67", "216": "23459",
    "91": "16789", "92": "3", "880": "1346", "977": "9", "94": "7", "63": "89", "62": "8", "34": "5679", "33": "67", "351": "169", "55": "123456789", "52": "23456789", "44": "7", "1": "23456789", "90": "5" };
  function mobileOf(code, n) {
    var lens = NATIONAL_LEN[code], first = MOBILE_START[code];
    if (!lens) return /^\d{6,12}$/.test(n);
    return lens.indexOf(n.length) >= 0 && (!first || first.indexOf(n.charAt(0)) >= 0);
  }
  // Indonesia's lengths overlap (62 and a 10-digit mobile is 12 digits, itself a length): the whole
  // number is then read as the national one only if it starts as a mobile does. "628123456789" is the
  // code typed (an Indonesian mobile starts with 8); it was sent as "+62628123456789".
  function codeTyped(d, code) {
    if (d.indexOf(code) !== 0) return false;
    var lens = NATIONAL_LEN[code], rest = d.slice(code.length).replace(/^0+/, "");
    if (!lens) return d.length >= 11 && rest.length >= 8;
    return lens.indexOf(rest.length) >= 0 && !mobileOf(code, d.replace(/^0+/, ""));
  }
  // The digits after a + or 00 typed before the number (a number given with its country code), else null.
  function typedIntl() {
    var raw = asciiDigits(phoneIn.value).replace(/[^0-9+]/g, "");
    if (raw.charAt(0) === "+") return raw.replace(/\D/g, "");
    if (raw.indexOf("00") === 0) return raw.slice(2).replace(/\D/g, "");
    return null;
  }
  // A number typed with its + or 00 code names its country, whatever the picker says: the picker
  // follows it (the longest code that starts it, as an edit's prefill reads a saved number), as the
  // community form's does. Under the default SA, "+62 812 3456 789" lost its + on leaving the box
  // and was sent as +966 followed by 62...
  function followTypedCode() {
    var d = typedIntl(), code = null;
    if (d == null || d.indexOf(cc.value) === 0) return;
    COUNTRIES.forEach(function (x) { if (d.indexOf(x[1]) === 0 && (!code || x[1].length > code.length)) code = x[1]; });
    if (code) cc.value = code;
  }
  function nationalDigits() {
    var raw = asciiDigits(phoneIn.value).replace(/[^0-9+]/g, "");
    var code = cc.value;
    if (raw.indexOf("+" + code) === 0) raw = raw.slice(code.length + 1);
    else if (raw.indexOf("00" + code) === 0) raw = raw.slice(code.length + 2);
    raw = raw.replace(/\D/g, "");
    if (code === "966") { if (raw.indexOf("966") === 0 && raw.length > 9) raw = raw.slice(3); }
    else if (codeTyped(raw, code)) raw = raw.slice(code.length);
    return raw.replace(/^0+/, "");
  }
  function phoneE164() { var n = nationalDigits(); return n ? "+" + cc.value + n : ""; }
  function phoneValid() {
    var n = nationalDigits(), d = typedIntl();
    if (d != null && d.indexOf(cc.value) !== 0) return false; // given with a code the picker does not have
    if (cc.value === "966") return /^5\d{8}$/.test(n);
    return mobileOf(cc.value, n);
  }
  // The number is long enough to judge: a Saudi one at nine digits after the 0, another at its code's shortest length.
  function phoneComplete() {
    var n = nationalDigits(), lens = cc.value === "966" ? [9] : NATIONAL_LEN[cc.value] || [8];
    return n.length >= Math.min.apply(null, lens);
  }
  function syncPhone() {
    phoneOut.value = phoneE164();
    var err = document.querySelector("#f-phone .err");
    var own = cc.value === "966" ? "Enter a valid Saudi mobile number (05XXXXXXXX)" : nationalDigits() ? "This is not a mobile number for +{c}. Please check it." : "Enter a valid mobile number";
    err.setAttribute("data-args", JSON.stringify({ c: cc.value }));
    err.setAttribute("data-t0", own); err.setAttribute("data-t", own); render(err);
    phoneIn.placeholder = cc.value === "966" ? "5X XXX XXXX" : "";
  }
  phoneIn.addEventListener("input", function () {
    followTypedCode(); syncPhone();
    // Judged as soon as it is long enough, and again on every key once it was wrong (Baymard: reward early).
    var bad = $("#f-phone").classList.contains("invalid");
    if (bad || phoneComplete()) setError("f-phone", !phoneValid());
  });
  // Leaving the box shows the number without its code, as it is sent - unless it was given with a code
  // the picker does not have: it keeps its + then, as its digits alone would read as a number there.
  phoneIn.addEventListener("blur", function () {
    followTypedCode();
    var d = typedIntl(), n = nationalDigits();
    if (n && (d == null || d.indexOf(cc.value) === 0)) phoneIn.value = n;
    syncPhone();
  });
  cc.addEventListener("change", function () { syncPhone(); setError("f-phone", false); });
  syncPhone();

  /* Company */
  var companies = $("#companies"), selectedCompany = null;
  companies.addEventListener("click", function (e) {
    var b = e.target.closest(".company"); if (!b) return;
    selectedCompany = b.getAttribute("data-v");
    companies.querySelectorAll(".company").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
    syncRoving(companies);
    setError("f-company", false);
  });
  radioKeys(companies); syncRoving(companies);

  /* Tiles */
  var types = $("#types"), selectedType = null;
  types.addEventListener("click", function (e) {
    var tile = e.target.closest(".tile"); if (!tile) return;
    selectedType = tile.getAttribute("data-v");
    types.querySelectorAll(".tile").forEach(function (b) { b.setAttribute("aria-checked", String(b === tile)); });
    syncRoving(types);
    setError("f-type", false);
  });
  radioKeys(types); syncRoving(types);

  /* Errors and banner */
  // A message passed in (the server's "This badge is already registered...") is for this time only:
  // the next error without one shows the box's own message again (kept in data-t0).
  function setError(fieldId, on, msg) {
    var f = document.getElementById(fieldId);
    f.classList.toggle("invalid", !!on);
    var err = f.querySelector(".err"); if (!err) return;
    if (!err.hasAttribute("data-t0")) err.setAttribute("data-t0", err.getAttribute("data-t"));
    if (msg || on) { err.setAttribute("data-t", msg || err.getAttribute("data-t0")); render(err); }
    describeError(f.querySelector("input:not([type=hidden]), [role=radiogroup]"), err, on);
  }
  // A screen reader hears the message with the box it is about: aria-invalid on the box, and the
  // message as its description while it shows (the message itself is a polite live region).
  function describeError(box, err, on) {
    if (!box) return;
    if (!err.id) err.id = (err.closest(".field").id || "field") + "-err";
    var ids = (box.getAttribute("aria-describedby") || "").split(/\s+/).filter(function (x) { return x && x !== err.id; });
    if (on) { ids.push(err.id); box.setAttribute("aria-invalid", "true"); } else box.removeAttribute("aria-invalid");
    if (ids.length) box.setAttribute("aria-describedby", ids.join(" ")); else box.removeAttribute("aria-describedby");
  }
  // A refusal from the server is said at the top of the card, which may be far above the button pressed: the page
  // goes to it and it takes the focus, so the rider sees it rather than a spinner that just stops.
  function showBanner(msg) {
    var b = $("#banner"), txt = b.querySelector(".banner-text");
    txt.setAttribute("data-t", msg); render(txt);
    b.hidden = false;
    if (booted) {
      try { b.scrollIntoView({ block: SITE_FORM ? "center" : "nearest", behavior: REDUCED ? "auto" : "smooth" }); } catch (e) {}
      try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); }
    }
  }
  function hideBanner() { $("#banner").hidden = true; }
  $(".banner-close").addEventListener("click", hideBanner);

  /* One rule per box, said when Continue is pressed; a box already in red is judged again on every key and clears the
     moment it is right (the badge and name), and the height is judged when the rider leaves it. */
  function heightOf(v) { var d = asciiDigits(v).replace(/\s/g, ""); return /^\d{2,3}$/.test(d) ? Number(d) : NaN; }
  function heightOk(v) { var h = heightOf(v); return h >= 100 && h <= 250; }
  var CHECK = {
    badge: function () { return !!$("#badge").value.trim(); },
    name: function () { return !!$("#name").value.trim(); },
    height: function () { return heightOk($("#height").value); }
  };
  ["badge", "name", "height"].forEach(function (id) {
    $("#" + id).addEventListener("input", function () { if ($("#f-" + id).classList.contains("invalid") && CHECK[id]()) setError("f-" + id, false); });
  });
  $("#height").addEventListener("blur", function () { if (this.value.trim()) setError("f-height", !CHECK.height()); });

  function validateStep(n) {
    var ok = true;
    if (n === 1) { if (!selectedSession) { setError("f-session", true); ok = false; } }
    if (n === 2) {
      if (!selectedCompany) { setError("f-company", true); ok = false; }
      if (!CHECK.badge()) { setError("f-badge", true); ok = false; }
      if (!CHECK.name()) { setError("f-name", true); ok = false; }
      syncPhone();
      if (!phoneValid()) { setError("f-phone", true); ok = false; }
    }
    if (n === 3) {
      if (!CHECK.height()) { setError("f-height", true); ok = false; }
      if (!selectedType) { setError("f-type", true); ok = false; }
    }
    return ok;
  }
  function validate() { for (var i = 1; i < STEPS; i++) { if (!validateStep(i)) { goStep(i); return false; } } return validateStep(STEPS); }
  function focusInvalid() { var first = $(".field.invalid input, .field.invalid [role=radio]"); first && first.focus(); }

  /* Loading and success */
  function setLoading(on) { $("#submit").classList.toggle("loading", !!on); $("#submit").disabled = !!on; }
  var STORE = "mm-petromin-registration";
  /* Sequential booking numbers: p-001, p-002 ... The server should issue the real one; this demo counter lives on the device. */
  function bookingNumber() {
    var n = 1; try { n = (parseInt(localStorage.getItem("mm-petromin-seq") || "0", 10) || 0) + 1; localStorage.setItem("mm-petromin-seq", String(n)); } catch (e) {}
    return "p-" + String(n).padStart(3, "0");
  }
  function sessionLabel(s) { return s ? fmtDate(s.start) + ", " + fmtTime(s.start) : ""; }
  function collect() {
    var s = sessions.filter(function (x) { return x.id === selectedSession; })[0];
    return { badge: asciiDigits($("#badge").value).trim(), name: $("#name").value.trim(), company: selectedCompany, phone: phoneE164(), height: heightOf($("#height").value) || null, type: selectedType, session: s || null };
  }
  /* Renders the confirmation and saves it on this device so a refresh keeps it. */
  function showSuccess(data) {
    data = data || collect();
    if (!data.bookingNo) data.bookingNo = bookingNumber();
    if (!data.submittedAt) data.submittedAt = new Date().toISOString();
    $("#chip-booking-value").textContent = data.bookingNo;
    var r = $("#result");
    r.setAttribute("data-t", "Your registration for {d} is confirmed.");
    r.setAttribute("data-args", JSON.stringify({ d: sessionLabel(data.session) }));
    render(r);
    $("#chip-value").textContent = data.badge || "";
    $("#chip-company").hidden = !data.company;
    if (data.company) $("#chip-company-value").textContent = data.company;
    $("#chip-session").hidden = !data.session;
    if (data.session) $("#chip-session-value").textContent = sessionLabel(data.session);
    $("#card").setAttribute("data-state", "success");
    $("#success").hidden = false;
    var title = $("#success .title"); title.setAttribute("tabindex", "-1");
    if (booted) { try { title.focus({ preventScroll: true }); } catch (e) {} scrollToCard(); }
    try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) {}
    current = data;
  }
  var current = null;
  function restore() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) {}
    if (!saved) return false;
    var end = saved.session && (saved.session.end || saved.session.start);
    if (end && new Date(end).getTime() + 6 * 3600000 < Date.now()) { try { localStorage.removeItem(STORE); } catch (e) {} return false; }
    showSuccess(saved); return true;
  }
  function reset() {
    $("#form").reset(); cc.value = "966"; syncPhone(); selectedType = null; selectedSession = null; selectedCompany = null; renderSessions();
    types.querySelectorAll(".tile").forEach(function (b) { b.setAttribute("aria-checked", "false"); });
    companies.querySelectorAll(".company").forEach(function (b) { b.setAttribute("aria-checked", "false"); });
    syncRoving(types); syncRoving(companies);
    ["f-session", "f-company", "f-badge", "f-name", "f-phone", "f-height", "f-type"].forEach(function (id) { setError(id, false); });
    returnTo = 0; goStep(1);
    hideBanner(); setLoading(false);
    $("#success").hidden = true;
    $("#card").setAttribute("data-state", "form");
    current = null; try { localStorage.removeItem(STORE); } catch (e) {}
  }

  /* Submit: demo behaviour. Wire the real request here. */
  $("#form").addEventListener("submit", function (e) {
    e.preventDefault();
    hideBanner();
    if (step < STEPS) { next(); return; }
    if (!validate()) { focusInvalid(); return; }
    setLoading(true);
    var data = collect();
    setTimeout(function () { setLoading(false); showSuccess(data); }, 1200);
  });

  /* Preview states via ?state= (used by the design review page) */
  var demo = { badge: "104582", name: "Faisal Al Harbi", phone: "0551234567", height: "178" };
  function nextWed(offsetWeeks) { var d = new Date(); d.setHours(18, 0, 0, 0); d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7) + offsetWeeks * 7); return d; }
  setSessions([0, 1, 2, 3].map(function (w, i) {
    var s = nextWed(w), e = new Date(s.getTime() + 2 * 3600000);
    return { id: "s" + i, title: i === 0 ? "Petromin's Circuit Night" : "", start: s.toISOString(), end: e.toISOString(), collect: "18:45" };
  }));
  function pickSession() { sessionsEl.querySelector('.session:not([disabled])').click(); }
  function fill() { pickSession(); companies.querySelector('[data-v="Petromin"]').click(); $("#badge").value = demo.badge; $("#name").value = demo.name; $("#phone").value = demo.phone; syncPhone(); $("#height").value = demo.height; types.querySelector('[data-v="Hybrid"]').click(); }
  goStep(Number(params.get("step")) || 1);
  booted = true;
  var state = params.get("state");
  if (!state && !params.get("step") && restore()) state = "restored";
  switch (state) {
    case "errors": validateStep(step); break;
    case "server": fill(); goStep(4); showBanner("Could not reach the server"); break;
    case "loading": fill(); goStep(4); setLoading(true); break;
    case "success": fill(); var d = collect(); d.bookingNo = "p-001"; showSuccess(d); try { localStorage.removeItem(STORE); } catch (e) {} break;
    default: if (Number(params.get("step")) > 1) pickSession();
  }

  window.RiderRegistration = { languages: LANGS, translations: T, applyLang: applyLang, setSessions: setSessions, goStep: goStep, getSelection: function () { return { session: selectedSession, company: selectedCompany, type: selectedType, phone: phoneE164() }; }, getPhone: phoneE164, setError: setError, showBanner: showBanner, hideBanner: hideBanner, setLoading: setLoading, showSuccess: showSuccess, reset: reset, validate: validate, collect: collect, restore: restore, getSaved: function () { return current; } };
})();
