/* Employees Bike Registration Form: language switching, tile selection, inline validation, state helpers.
   Replace the submit handler with the real request; everything else can stay. */
(function () {
  var LANGS = { ar: "العربية", en: "English", fr: "Français", hi: "हिन्दी", ur: "اردو", ne: "नेपाली", pt: "Português", es: "Español", tl: "Tagalog", bn: "বাংলা", id: "Bahasa Indonesia", ms: "Bahasa Melayu", de: "Deutsch", ru: "Русский", zh: "简体中文", ja: "日本語" };
  var RTL = { ar: true, ur: true };
  var T = {
    ar: {
      "Your registration for {d} is confirmed.": "تم تأكيد تسجيلك لجلسة {d}.",
      "Booking": "الحجز",
      "Show this screen and your booking number at the desk to collect your bike.": "أظهر هذه الشاشة ورقم حجزك عند المكتب لاستلام دراجتك.",
      "Enter a valid mobile number": "أدخل رقم جوال صحيح",
      "Your company": "شركتك",
      "Choose your company": "اختر شركتك",
      "Employees Bike Registration Form": "نموذج تسجيل الدراجات للموظفين",
      "Fill this in before you pick up your bike at the desk.": "أكمل هذه البيانات قبل استلام دراجتك من المكتب.",
      "Badge number": "رقم البطاقة",
      "Full name": "الاسم الكامل",
      "Use the same name you booked with so we can find your booking": "استخدم نفس الاسم الذي حجزت به حتى نجد حجزك",
      "Mobile number": "رقم الجوال",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "أدخل رقم جوال سعودي صحيح (05XXXXXXXX)",
      "Height in cm": "الطول بالسنتيمتر",
      "Bike type": "نوع الدراجة",
      "Road": "طريق", "Hybrid": "هايبرد", "Mountain": "جبلية",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "اختر الجلسة التي تريد ركوبها. الجلسات مأخوذة من تقويم مايكروموبيليتي للتأجير.",
      "Choose a session": "اختر جلسة",
      "We use these to find your booking and reach you at the desk.": "نستخدم هذه البيانات للعثور على حجزك والتواصل معك عند المكتب.",
      "Height and bike": "الطول والدراجة",
      "We size the bike to your height.": "نختار مقاس الدراجة حسب طولك.",
      "Back": "رجوع",
      "Continue": "متابعة",
      "{n} spots left": "{n} أماكن متبقية",
      "Full": "مكتملة",
      "No upcoming sessions": "لا توجد جلسات قادمة"
    },
    hi: {
      "Your registration for {d} is confirmed.": "{d} के लिए आपका पंजीकरण पक्का हो गया है।",
      "Booking": "बुकिंग",
      "Show this screen and your booking number at the desk to collect your bike.": "साइकिल लेने के लिए यह स्क्रीन और अपना बुकिंग नंबर डेस्क पर दिखाएँ।",
      "Enter a valid mobile number": "मान्य मोबाइल नंबर दर्ज करें",
      "Your company": "आपकी कंपनी",
      "Choose your company": "अपनी कंपनी चुनें",
      "Employees Bike Registration Form": "कर्मचारी साइकिल पंजीकरण फ़ॉर्म",
      "Fill this in before you pick up your bike at the desk.": "डेस्क से साइकिल लेने से पहले यह फ़ॉर्म भरें।",
      "Badge number": "बैज नंबर",
      "Full name": "पूरा नाम",
      "Use the same name you booked with so we can find your booking": "वही नाम लिखें जिससे आपने बुकिंग की थी, ताकि हम आपकी बुकिंग ढूँढ सकें",
      "Mobile number": "मोबाइल नंबर",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "मान्य सऊदी मोबाइल नंबर दर्ज करें (05XXXXXXXX)",
      "Height in cm": "ऊँचाई (सेमी में)",
      "Bike type": "साइकिल का प्रकार",
      "Road": "रोड", "Hybrid": "हाइब्रिड", "Mountain": "माउंटेन",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "वह सत्र चुनें जिसमें आप सवारी करना चाहते हैं। सत्र MicroMobility Rentals कैलेंडर से आते हैं।",
      "Choose a session": "एक सत्र चुनें",
      "We use these to find your booking and reach you at the desk.": "इनसे हम आपकी बुकिंग ढूँढते हैं और डेस्क पर आपसे संपर्क करते हैं।",
      "Height and bike": "ऊँचाई और साइकिल",
      "We size the bike to your height.": "हम आपकी ऊँचाई के अनुसार साइकिल का साइज़ तय करते हैं।",
      "Back": "पीछे",
      "Continue": "आगे बढ़ें",
      "{n} spots left": "{n} जगहें बाकी",
      "Full": "भर गया",
      "No upcoming sessions": "कोई आगामी सत्र नहीं"
    },
    tl: {
      "Your registration for {d} is confirmed.": "Kumpirmado ang iyong rehistro para sa {d}.",
      "Booking": "Booking",
      "Show this screen and your booking number at the desk to collect your bike.": "Ipakita ang screen na ito at ang iyong booking number sa desk para kunin ang iyong bisikleta.",
      "Enter a valid mobile number": "Maglagay ng wastong numero ng mobile",
      "Your company": "Iyong kumpanya",
      "Choose your company": "Piliin ang iyong kumpanya",
      "Employees Bike Registration Form": "Form ng Pagpaparehistro ng Bisikleta para sa mga Empleyado",
      "Fill this in before you pick up your bike at the desk.": "Punan ito bago kunin ang iyong bisikleta sa desk.",
      "Badge number": "Numero ng badge",
      "Full name": "Buong pangalan",
      "Use the same name you booked with so we can find your booking": "Gamitin ang parehong pangalan na ginamit mo sa booking para mahanap namin ito",
      "Mobile number": "Numero ng mobile",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Maglagay ng wastong Saudi mobile number (05XXXXXXXX)",
      "Height in cm": "Taas sa cm",
      "Bike type": "Uri ng bisikleta",
      "Road": "Road", "Hybrid": "Hybrid", "Mountain": "Mountain",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "Piliin ang sesyon na gusto mong sakyan. Ang mga sesyon ay mula sa kalendaryo ng MicroMobility Rentals.",
      "Choose a session": "Pumili ng sesyon",
      "We use these to find your booking and reach you at the desk.": "Ginagamit namin ito para mahanap ang iyong booking at makontak ka sa desk.",
      "Height and bike": "Taas at bisikleta",
      "We size the bike to your height.": "Ibinabagay namin ang bisikleta sa iyong taas.",
      "Back": "Bumalik",
      "Continue": "Magpatuloy",
      "{n} spots left": "{n} puwesto ang natitira",
      "Full": "Puno",
      "No upcoming sessions": "Walang paparating na sesyon"
    },
    es: {
      "Your registration for {d} is confirmed.": "Tu registro para el {d} está confirmado.",
      "Booking": "Reserva",
      "Show this screen and your booking number at the desk to collect your bike.": "Muestra esta pantalla y tu número de reserva en el mostrador para recoger tu bicicleta.",
      "Enter a valid mobile number": "Introduce un número de móvil válido",
      "Your company": "Tu empresa",
      "Choose your company": "Elige tu empresa",
      "Employees Bike Registration Form": "Formulario de registro de bicicletas para empleados",
      "Fill this in before you pick up your bike at the desk.": "Completa este formulario antes de recoger tu bicicleta en el mostrador.",
      "Badge number": "Número de credencial",
      "Full name": "Nombre completo",
      "Use the same name you booked with so we can find your booking": "Usa el mismo nombre con el que reservaste para que podamos encontrar tu reserva",
      "Mobile number": "Número de móvil",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Introduce un número de móvil saudí válido (05XXXXXXXX)",
      "Height in cm": "Altura en cm",
      "Bike type": "Tipo de bicicleta",
      "Road": "Carretera", "Hybrid": "Híbrida", "Mountain": "Montaña",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "Elige la sesión en la que quieres montar. Las sesiones provienen del calendario de MicroMobility Rentals.",
      "Choose a session": "Elige una sesión",
      "We use these to find your booking and reach you at the desk.": "Los usamos para encontrar tu reserva y contactarte en el mostrador.",
      "Height and bike": "Altura y bicicleta",
      "We size the bike to your height.": "Ajustamos la talla de la bicicleta a tu altura.",
      "Back": "Atrás",
      "Continue": "Continuar",
      "{n} spots left": "{n} plazas libres",
      "Full": "Completa",
      "No upcoming sessions": "No hay sesiones próximas"
    },
    ne: {
      "Your registration for {d} is confirmed.": "{d} का लागि तपाईंको दर्ता पक्का भयो।",
      "Booking": "बुकिङ",
      "Show this screen and your booking number at the desk to collect your bike.": "साइकल लिनका लागि यो स्क्रिन र आफ्नो बुकिङ नम्बर डेस्कमा देखाउनुहोस्।",
      "Enter a valid mobile number": "मान्य मोबाइल नम्बर लेख्नुहोस्",
      "Your company": "तपाईंको कम्पनी",
      "Choose your company": "आफ्नो कम्पनी छान्नुहोस्",
      "Employees Bike Registration Form": "कर्मचारी साइकल दर्ता फारम",
      "Fill this in before you pick up your bike at the desk.": "डेस्कबाट साइकल लिनुअघि यो फारम भर्नुहोस्।",
      "Badge number": "ब्याज नम्बर",
      "Full name": "पूरा नाम",
      "Use the same name you booked with so we can find your booking": "बुकिङ गर्दा प्रयोग गरेको नाम नै लेख्नुहोस्, ताकि हामी तपाईंको बुकिङ फेला पार्न सकौं",
      "Mobile number": "मोबाइल नम्बर",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "मान्य साउदी मोबाइल नम्बर लेख्नुहोस् (05XXXXXXXX)",
      "Height in cm": "उचाइ (से.मी.मा)",
      "Bike type": "साइकलको प्रकार",
      "Road": "रोड", "Hybrid": "हाइब्रिड", "Mountain": "माउन्टेन",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "तपाईं चढ्न चाहेको सत्र छान्नुहोस्। सत्रहरू MicroMobility Rentals क्यालेन्डरबाट आउँछन्।",
      "Choose a session": "एउटा सत्र छान्नुहोस्",
      "We use these to find your booking and reach you at the desk.": "यी विवरणले हामी तपाईंको बुकिङ फेला पार्छौं र डेस्कमा सम्पर्क गर्छौं।",
      "Height and bike": "उचाइ र साइकल",
      "We size the bike to your height.": "हामी तपाईंको उचाइअनुसार साइकलको साइज मिलाउँछौं।",
      "Back": "पछाडि",
      "Continue": "अगाडि बढ्नुहोस्",
      "{n} spots left": "{n} स्थान बाँकी",
      "Full": "भरियो",
      "No upcoming sessions": "आगामी सत्र छैन"
    },
    fr: {
      "Your registration for {d} is confirmed.": "Votre inscription pour le {d} est confirmée.",
      "Booking": "Réservation",
      "Show this screen and your booking number at the desk to collect your bike.": "Montrez cet écran et votre numéro de réservation au comptoir pour récupérer votre vélo.",
      "Enter a valid mobile number": "Saisissez un numéro de mobile valide",
      "Your company": "Votre entreprise",
      "Choose your company": "Choisissez votre entreprise",
      "Employees Bike Registration Form": "Formulaire d'inscription vélo pour les employés",
      "Fill this in before you pick up your bike at the desk.": "Remplissez ce formulaire avant de récupérer votre vélo au comptoir.",
      "Badge number": "Numéro de badge",
      "Full name": "Nom complet",
      "Use the same name you booked with so we can find your booking": "Utilisez le même nom que pour votre réservation afin que nous puissions la retrouver",
      "Mobile number": "Numéro de mobile",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Saisissez un numéro de mobile saoudien valide (05XXXXXXXX)",
      "Height in cm": "Taille en cm",
      "Bike type": "Type de vélo",
      "Road": "Route", "Hybrid": "Hybride", "Mountain": "VTT",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "Choisissez la séance à laquelle vous voulez rouler. Les séances proviennent du calendrier MicroMobility Rentals.",
      "Choose a session": "Choisissez une séance",
      "We use these to find your booking and reach you at the desk.": "Elles nous servent à retrouver votre réservation et à vous joindre au comptoir.",
      "Height and bike": "Taille et vélo",
      "We size the bike to your height.": "Nous adaptons la taille du vélo à la vôtre.",
      "Back": "Retour",
      "Continue": "Continuer",
      "{n} spots left": "{n} places restantes",
      "Full": "Complet",
      "No upcoming sessions": "Aucune séance à venir"
    },
    pt: {
      "Your registration for {d} is confirmed.": "O seu registo para {d} está confirmado.",
      "Booking": "Reserva",
      "Show this screen and your booking number at the desk to collect your bike.": "Mostre este ecrã e o seu número de reserva no balcão para levantar a sua bicicleta.",
      "Enter a valid mobile number": "Introduza um número de telemóvel válido",
      "Your company": "A sua empresa",
      "Choose your company": "Escolha a sua empresa",
      "Employees Bike Registration Form": "Formulário de registo de bicicletas para colaboradores",
      "Fill this in before you pick up your bike at the desk.": "Preencha este formulário antes de levantar a sua bicicleta no balcão.",
      "Badge number": "Número do crachá",
      "Full name": "Nome completo",
      "Use the same name you booked with so we can find your booking": "Use o mesmo nome da sua reserva para que possamos encontrá-la",
      "Mobile number": "Número de telemóvel",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Introduza um número de telemóvel saudita válido (05XXXXXXXX)",
      "Height in cm": "Altura em cm",
      "Bike type": "Tipo de bicicleta",
      "Road": "Estrada", "Hybrid": "Híbrida", "Mountain": "Montanha",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "Escolha a sessão em que quer pedalar. As sessões vêm do calendário da MicroMobility Rentals.",
      "Choose a session": "Escolha uma sessão",
      "We use these to find your booking and reach you at the desk.": "Usamos estes dados para encontrar a sua reserva e contactá-lo no balcão.",
      "Height and bike": "Altura e bicicleta",
      "We size the bike to your height.": "Ajustamos o tamanho da bicicleta à sua altura.",
      "Back": "Voltar",
      "Continue": "Continuar",
      "{n} spots left": "{n} lugares disponíveis",
      "Full": "Esgotada",
      "No upcoming sessions": "Sem sessões próximas"
    },
    bn: {
      "Your registration for {d} is confirmed.": "{d} সেশনের জন্য আপনার রেজিস্ট্রেশন নিশ্চিত হয়েছে।",
      "Booking": "বুকিং",
      "Show this screen and your booking number at the desk to collect your bike.": "সাইকেল নিতে ডেস্কে এই স্ক্রিনটি ও আপনার বুকিং নম্বর দেখান।",
      "Enter a valid mobile number": "একটি সঠিক মোবাইল নম্বর লিখুন",
      "Your company": "আপনার কোম্পানি",
      "Choose your company": "আপনার কোম্পানি বেছে নিন",
      "Employees Bike Registration Form": "কর্মীদের সাইকেল রেজিস্ট্রেশন ফর্ম",
      "Fill this in before you pick up your bike at the desk.": "ডেস্ক থেকে সাইকেল নেওয়ার আগে এটি পূরণ করুন।",
      "Badge number": "ব্যাজ নম্বর",
      "Full name": "পুরো নাম",
      "Use the same name you booked with so we can find your booking": "যে নামে বুক করেছেন সেই নামটিই লিখুন, যাতে আমরা আপনার বুকিং খুঁজে পাই",
      "Mobile number": "মোবাইল নম্বর",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "একটি সঠিক সৌদি মোবাইল নম্বর লিখুন (05XXXXXXXX)",
      "Height in cm": "উচ্চতা (সেমি)",
      "Bike type": "সাইকেলের ধরন",
      "Road": "রোড",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "আপনি যে সেশনে রাইড করতে চান সেটি বেছে নিন। সেশনগুলো MicroMobility Rentals ক্যালেন্ডার থেকে আসে।",
      "Choose a session": "একটি সেশন বেছে নিন",
      "We use these to find your booking and reach you at the desk.": "আপনার বুকিং খুঁজে বের করতে ও ডেস্কে আপনার সঙ্গে যোগাযোগ করতে আমরা এগুলো ব্যবহার করি।",
      "Height and bike": "উচ্চতা ও সাইকেল",
      "We size the bike to your height.": "আপনার উচ্চতা অনুযায়ী সাইকেলের মাপ ঠিক করি।",
      "Back": "পেছনে",
      "Continue": "চালিয়ে যান",
      "{n} spots left": "{n}টি জায়গা বাকি",
      "Full": "পূর্ণ",
      "No upcoming sessions": "আসন্ন কোনো সেশন নেই"
    },
    ur: {
      "Your registration for {d} is confirmed.": "{d} کے لیے آپ کی رجسٹریشن کی تصدیق ہو گئی ہے۔",
      "Booking": "بکنگ",
      "Show this screen and your booking number at the desk to collect your bike.": "اپنی سائیکل لینے کے لیے ڈیسک پر یہ اسکرین اور اپنا بکنگ نمبر دکھائیں۔",
      "Enter a valid mobile number": "درست موبائل نمبر درج کریں",
      "Your company": "آپ کی کمپنی",
      "Choose your company": "اپنی کمپنی منتخب کریں",
      "Employees Bike Registration Form": "ملازمین کے لیے سائیکل رجسٹریشن فارم",
      "Fill this in before you pick up your bike at the desk.": "ڈیسک سے اپنی سائیکل لینے سے پہلے یہ فارم پُر کریں۔",
      "Badge number": "بیج نمبر",
      "Full name": "پورا نام",
      "Use the same name you booked with so we can find your booking": "وہی نام لکھیں جس سے آپ نے بکنگ کی تھی، تاکہ ہم آپ کی بکنگ تلاش کر سکیں",
      "Mobile number": "موبائل نمبر",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "درست سعودی موبائل نمبر درج کریں (05XXXXXXXX)",
      "Height in cm": "قد (سینٹی میٹر میں)",
      "Bike type": "سائیکل کی قسم",
      "Road": "روڈ", "Hybrid": "ہائبرڈ", "Mountain": "ماؤنٹین",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "وہ سیشن منتخب کریں جس میں آپ رائیڈ کرنا چاہتے ہیں۔ سیشن MicroMobility Rentals کے کیلنڈر سے آتے ہیں۔",
      "Choose a session": "ایک سیشن منتخب کریں",
      "We use these to find your booking and reach you at the desk.": "ان سے ہم آپ کی بکنگ تلاش کرتے ہیں اور ڈیسک پر آپ سے رابطہ کرتے ہیں۔",
      "Height and bike": "قد اور سائیکل",
      "We size the bike to your height.": "ہم سائیکل کا سائز آپ کے قد کے مطابق رکھتے ہیں۔",
      "Back": "واپس",
      "Continue": "جاری رکھیں",
      "{n} spots left": "{n} جگہیں باقی",
      "Full": "بھر گیا",
      "No upcoming sessions": "کوئی آنے والا سیشن نہیں"
    },
    id: {
      "Your registration for {d} is confirmed.": "Pendaftaran Anda untuk {d} sudah dikonfirmasi.",
      "Booking": "Pemesanan",
      "Show this screen and your booking number at the desk to collect your bike.": "Tunjukkan layar ini dan nomor pemesanan Anda di loket untuk mengambil sepeda Anda.",
      "Enter a valid mobile number": "Masukkan nomor ponsel yang valid",
      "Your company": "Perusahaan Anda",
      "Choose your company": "Pilih perusahaan Anda",
      "Employees Bike Registration Form": "Formulir Pendaftaran Sepeda Karyawan",
      "Fill this in before you pick up your bike at the desk.": "Isi formulir ini sebelum mengambil sepeda di loket.",
      "Badge number": "Nomor kartu karyawan",
      "Full name": "Nama lengkap",
      "Use the same name you booked with so we can find your booking": "Gunakan nama yang sama dengan saat Anda memesan agar kami bisa menemukan pemesanan Anda",
      "Mobile number": "Nomor ponsel",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Masukkan nomor ponsel Arab Saudi yang valid (05XXXXXXXX)",
      "Height in cm": "Tinggi badan dalam cm",
      "Bike type": "Jenis sepeda",
      "Road": "Balap",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "Pilih sesi bersepeda yang ingin Anda ikuti. Sesi diambil dari kalender MicroMobility Rentals.",
      "Choose a session": "Pilih sesi",
      "We use these to find your booking and reach you at the desk.": "Kami menggunakan data ini untuk menemukan pemesanan Anda dan menghubungi Anda di loket.",
      "Height and bike": "Tinggi badan dan sepeda",
      "We size the bike to your height.": "Kami menyesuaikan ukuran sepeda dengan tinggi badan Anda.",
      "Back": "Kembali",
      "Continue": "Lanjutkan",
      "{n} spots left": "Sisa {n} tempat",
      "Full": "Penuh",
      "No upcoming sessions": "Belum ada sesi mendatang",
      "Name": "Nama",
      "Company": "Perusahaan",
      "riders": "pesepeda",
      "Riding with someone?": "Bersepeda bersama orang lain?",
      "Add up to four companions. Each gets their own bike under your booking number.": "Tambahkan hingga empat pendamping. Masing-masing mendapat sepedanya sendiri di bawah nomor pemesanan Anda.",
      "Add another rider": "Tambahkan pesepeda lain",
      "Rider {n}": "Pesepeda {n}",
      "Remove": "Hapus",
      "Enter the rider's full name": "Masukkan nama lengkap pesepeda",
      "Enter the rider's height in cm (100 to 250)": "Masukkan tinggi badan pesepeda dalam cm (100 hingga 250)",
      "Riders": "Pesepeda",
      "Riding with: {names}": "Bersepeda bersama: {names}",
      "Up to four companions": "Hingga empat pendamping",
      "Scan this code at the desk": "Pindai kode ini di loket",
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
      "Booking QR code": "Kode QR pemesanan"
    },
    ms: {
      "Your registration for {d} is confirmed.": "Pendaftaran anda untuk {d} telah disahkan.",
      "Booking": "Tempahan",
      "Show this screen and your booking number at the desk to collect your bike.": "Tunjukkan skrin ini dan nombor tempahan anda di kaunter untuk mengambil basikal anda.",
      "Enter a valid mobile number": "Masukkan nombor telefon yang sah",
      "Your company": "Syarikat anda",
      "Choose your company": "Pilih syarikat anda",
      "Employees Bike Registration Form": "Borang Pendaftaran Basikal Pekerja",
      "Fill this in before you pick up your bike at the desk.": "Isi borang ini sebelum mengambil basikal di kaunter.",
      "Badge number": "Nombor kad pekerja",
      "Full name": "Nama penuh",
      "Use the same name you booked with so we can find your booking": "Gunakan nama yang sama seperti semasa anda menempah supaya kami dapat mencari tempahan anda",
      "Mobile number": "Nombor telefon",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Masukkan nombor telefon Arab Saudi yang sah (05XXXXXXXX)",
      "Height in cm": "Ketinggian dalam cm",
      "Bike type": "Jenis basikal",
      "Road": "Jalan raya",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "Pilih sesi kayuhan yang anda mahu sertai. Sesi diambil daripada kalendar MicroMobility Rentals.",
      "Choose a session": "Pilih sesi",
      "We use these to find your booking and reach you at the desk.": "Kami menggunakan butiran ini untuk mencari tempahan anda dan menghubungi anda di kaunter.",
      "Height and bike": "Ketinggian dan basikal",
      "We size the bike to your height.": "Kami menyesuaikan saiz basikal dengan ketinggian anda.",
      "Back": "Kembali",
      "Continue": "Teruskan",
      "{n} spots left": "Tinggal {n} tempat",
      "Full": "Penuh",
      "No upcoming sessions": "Tiada sesi akan datang",
      "Name": "Nama",
      "Company": "Syarikat",
      "riders": "penunggang",
      "Riding with someone?": "Berkayuh bersama orang lain?",
      "Add up to four companions. Each gets their own bike under your booking number.": "Tambah sehingga empat peneman. Setiap seorang mendapat basikal sendiri di bawah nombor tempahan anda.",
      "Add another rider": "Tambah penunggang lain",
      "Rider {n}": "Penunggang {n}",
      "Remove": "Buang",
      "Enter the rider's full name": "Masukkan nama penuh penunggang",
      "Enter the rider's height in cm (100 to 250)": "Masukkan ketinggian penunggang dalam cm (100 hingga 250)",
      "Riders": "Penunggang",
      "Riding with: {names}": "Berkayuh bersama: {names}",
      "Up to four companions": "Sehingga empat peneman",
      "Scan this code at the desk": "Imbas kod ini di kaunter",
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
      "Booking QR code": "Kod QR tempahan"
    },
    de: {
      "Your registration for {d} is confirmed.": "Deine Anmeldung für {d} ist bestätigt.",
      "Booking": "Buchung",
      "Show this screen and your booking number at the desk to collect your bike.": "Zeig am Schalter diesen Bildschirm und deine Buchungsnummer, um dein Rad abzuholen.",
      "Enter a valid mobile number": "Gib eine gültige Handynummer ein",
      "Your company": "Dein Unternehmen",
      "Choose your company": "Wähle dein Unternehmen",
      "Employees Bike Registration Form": "Rad-Anmeldung für Mitarbeitende",
      "Fill this in before you pick up your bike at the desk.": "Füll das aus, bevor du dein Rad am Schalter abholst.",
      "Badge number": "Badge-Nummer",
      "Full name": "Vollständiger Name",
      "Use the same name you booked with so we can find your booking": "Verwende denselben Namen wie bei der Buchung, damit wir deine Buchung finden",
      "Mobile number": "Handynummer",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Gib eine gültige saudische Handynummer ein (05XXXXXXXX)",
      "Height in cm": "Körpergröße in cm",
      "Bike type": "Radtyp",
      "Road": "Rennrad",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "Wähle den Termin, an dem du fahren möchtest. Die Termine stammen aus dem Kalender von MicroMobility Rentals.",
      "Choose a session": "Wähle einen Termin",
      "We use these to find your booking and reach you at the desk.": "Damit finden wir deine Buchung und erreichen dich am Schalter.",
      "Height and bike": "Körpergröße und Rad",
      "We size the bike to your height.": "Wir stimmen die Radgröße auf deine Körpergröße ab.",
      "Back": "Zurück",
      "Continue": "Weiter",
      "{n} spots left": "Noch frei: {n}",
      "Full": "Ausgebucht",
      "No upcoming sessions": "Keine anstehenden Termine",
      "Name": "Name",
      "Company": "Unternehmen",
      "riders": "Personen",
      "Riding with someone?": "Kommst du in Begleitung?",
      "Add up to four companions. Each gets their own bike under your booking number.": "Füge bis zu vier Begleitpersonen hinzu. Jede bekommt ihr eigenes Rad unter deiner Buchungsnummer.",
      "Add another rider": "Weitere Person hinzufügen",
      "Rider {n}": "Person {n}",
      "Remove": "Entfernen",
      "Enter the rider's full name": "Gib den vollständigen Namen der Person ein",
      "Enter the rider's height in cm (100 to 250)": "Gib die Körpergröße der Person in cm ein (100 bis 250)",
      "Riders": "Fahrer",
      "Riding with: {names}": "Mit dabei: {names}",
      "Up to four companions": "Bis zu vier Begleitpersonen",
      "Scan this code at the desk": "Lass diesen Code am Schalter scannen",
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
      "Booking QR code": "QR-Code der Buchung"
    },
    ru: {
      "Your registration for {d} is confirmed.": "Ваша регистрация подтверждена: {d}.",
      "Booking": "Бронирование",
      "Show this screen and your booking number at the desk to collect your bike.": "Покажите этот экран и номер бронирования на стойке, чтобы получить велосипед.",
      "Enter a valid mobile number": "Введите корректный номер мобильного",
      "Your company": "Ваша компания",
      "Choose your company": "Выберите компанию",
      "Employees Bike Registration Form": "Регистрационная форма: велосипеды для сотрудников",
      "Fill this in before you pick up your bike at the desk.": "Заполните форму, прежде чем получить велосипед на стойке.",
      "Badge number": "Номер пропуска",
      "Full name": "Имя и фамилия",
      "Use the same name you booked with so we can find your booking": "Укажите то же имя, что и при бронировании, чтобы мы могли найти ваше бронирование",
      "Mobile number": "Номер мобильного",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "Введите корректный саудовский номер мобильного (05XXXXXXXX)",
      "Height in cm": "Рост в см",
      "Bike type": "Тип велосипеда",
      "Road": "Шоссейный",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "Выберите сеанс, на котором хотите покататься. Сеансы берутся из календаря MicroMobility Rentals.",
      "Choose a session": "Выберите сеанс",
      "We use these to find your booking and reach you at the desk.": "По этим данным мы найдём ваше бронирование и свяжемся с вами у стойки.",
      "Height and bike": "Рост и велосипед",
      "We size the bike to your height.": "Мы подбираем размер велосипеда по вашему росту.",
      "Back": "Назад",
      "Continue": "Продолжить",
      "{n} spots left": "Осталось мест: {n}",
      "Full": "Мест нет",
      "No upcoming sessions": "Нет ближайших сеансов",
      "Name": "Имя",
      "Company": "Компания",
      "riders": "чел.",
      "Riding with someone?": "Едете с кем-то?",
      "Add up to four companions. Each gets their own bike under your booking number.": "Добавьте до четырёх спутников. Каждый получит свой велосипед по вашему номеру бронирования.",
      "Add another rider": "Добавить ещё участника",
      "Rider {n}": "Участник {n}",
      "Remove": "Удалить",
      "Enter the rider's full name": "Введите имя и фамилию участника",
      "Enter the rider's height in cm (100 to 250)": "Укажите рост участника в см (от 100 до 250)",
      "Riders": "Велосипедисты",
      "Riding with: {names}": "Едут с вами: {names}",
      "Up to four companions": "Не более четырёх спутников",
      "Scan this code at the desk": "Покажите этот код на стойке для сканирования",
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
      "Booking QR code": "QR-код бронирования"
    },
    zh: {
      "Your registration for {d} is confirmed.": "您在 {d} 的登记已确认。",
      "Booking": "预订",
      "Show this screen and your booking number at the desk to collect your bike.": "请在服务台出示此页面和您的预订编号，以领取自行车。",
      "Enter a valid mobile number": "请输入有效的手机号",
      "Your company": "您的公司",
      "Choose your company": "请选择您的公司",
      "Employees Bike Registration Form": "员工自行车登记表",
      "Fill this in before you pick up your bike at the desk.": "请在服务台领取自行车之前填写此表。",
      "Badge number": "工牌号",
      "Full name": "姓名",
      "Use the same name you booked with so we can find your booking": "请使用预订时填写的姓名，以便我们找到您的预订",
      "Mobile number": "手机号",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "请输入有效的沙特手机号（05XXXXXXXX）",
      "Height in cm": "身高（厘米）",
      "Bike type": "车型",
      "Road": "公路车",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "请选择您想参加骑行的场次。场次来自 MicroMobility Rentals 日历。",
      "Choose a session": "请选择场次",
      "We use these to find your booking and reach you at the desk.": "我们会用这些信息查找您的预订，并在服务台与您联系。",
      "Height and bike": "身高与自行车",
      "We size the bike to your height.": "我们会根据您的身高选择自行车尺寸。",
      "Back": "返回",
      "Continue": "继续",
      "{n} spots left": "剩余 {n} 个名额",
      "Full": "已满",
      "No upcoming sessions": "暂无即将开始的场次",
      "Name": "姓名",
      "Company": "公司",
      "riders": "位骑行者",
      "Riding with someone?": "有人与您同行吗？",
      "Add up to four companions. Each gets their own bike under your booking number.": "最多可添加四位同伴。每人都将在您的预订编号下获得一辆自行车。",
      "Add another rider": "再添加一位骑行者",
      "Rider {n}": "骑行者 {n}",
      "Remove": "移除",
      "Enter the rider's full name": "请输入骑行者的完整姓名",
      "Enter the rider's height in cm (100 to 250)": "请输入骑行者的身高（厘米，100 到 250）",
      "Riders": "骑行者",
      "Riding with: {names}": "同行者：{names}",
      "Up to four companions": "最多四位同伴",
      "Scan this code at the desk": "请在服务台扫描此码",
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
      "Booking QR code": "预订二维码"
    },
    ja: {
      "Your registration for {d} is confirmed.": "{d}の登録が確定しました。",
      "Booking": "予約",
      "Show this screen and your booking number at the desk to collect your bike.": "受付でこの画面と予約番号を提示して、自転車をお受け取りください。",
      "Enter a valid mobile number": "有効な携帯電話番号を入力してください",
      "Your company": "所属会社",
      "Choose your company": "所属会社を選択してください",
      "Employees Bike Registration Form": "社員用自転車登録フォーム",
      "Fill this in before you pick up your bike at the desk.": "受付で自転車を受け取る前にご記入ください。",
      "Badge number": "社員証番号",
      "Full name": "氏名",
      "Use the same name you booked with so we can find your booking": "予約を照合できるよう、予約時と同じお名前を入力してください",
      "Mobile number": "携帯電話番号",
      "Enter a valid Saudi mobile number (05XXXXXXXX)": "有効なサウジアラビアの携帯電話番号を入力してください（05XXXXXXXX）",
      "Height in cm": "身長（cm）",
      "Bike type": "車種",
      "Road": "ロードバイク",
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
      "Pick the session you want to ride. Sessions come from the MicroMobility Rentals calendar.": "参加したいセッションを選んでください。セッションはMicroMobility Rentalsのカレンダーから表示しています。",
      "Choose a session": "セッションを選択",
      "We use these to find your booking and reach you at the desk.": "これらの情報は、予約の照合と、受付でのご連絡に使います。",
      "Height and bike": "身長と自転車",
      "We size the bike to your height.": "身長に合わせて自転車のサイズを選びます。",
      "Back": "戻る",
      "Continue": "続ける",
      "{n} spots left": "残り{n}枠",
      "Full": "満員",
      "No upcoming sessions": "今後のセッションはありません",
      "Name": "お名前",
      "Company": "会社",
      "riders": "名",
      "Riding with someone?": "同行者はいますか？",
      "Add up to four companions. Each gets their own bike under your booking number.": "同行者は4名まで追加できます。あなたの予約番号で、それぞれに自転車をご用意します。",
      "Add another rider": "ライダーを追加",
      "Rider {n}": "ライダー{n}",
      "Remove": "削除",
      "Enter the rider's full name": "ライダーのフルネームを入力してください",
      "Enter the rider's height in cm (100 to 250)": "ライダーの身長をcmで入力してください（100〜250）",
      "Riders": "ライダー",
      "Riding with: {names}": "同行者：{names}",
      "Up to four companions": "同行者は4名まで",
      "Scan this code at the desk": "受付でこのコードをスキャンしてください",
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
      "Booking QR code": "予約のQRコード"
    }
  };

  var $ = function (s) { return document.querySelector(s); };
  var html = document.documentElement;
  // On the website's page for the form (apps/web/src/components/forms/SiteForm.tsx) the page speaks the language the
  // site's globe picked, and talks to the database the website does (staging's on staging): window.MM_SITE_FORM =
  // {lang, db: {url, key}}. The form's own page (?classic=1) has its own picker and none of this.
  var SITE_FORM = window.MM_SITE_FORM || null;
  var params = new URLSearchParams(location.search);

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
  function applyLang(lang) {
    if (!LANGS[lang]) lang = "en";
    html.lang = lang;
    html.dir = RTL[lang] ? "rtl" : "ltr";
    document.querySelectorAll("[data-t]").forEach(render);
    document.querySelectorAll("[data-t-placeholder]").forEach(function (el) { el.placeholder = t(el.getAttribute("data-t-placeholder")); });
    if (typeof syncPhone === "function" && cc) syncPhone();
    var sel = $("#lang"); if (sel && sel.value !== lang) sel.value = lang;
    if (typeof renderSessions === "function" && sessionsEl) renderSessions();
    if (typeof current !== "undefined" && current) { var rr = $("#result"); rr.setAttribute("data-args", JSON.stringify({ d: sessionLabel(current.session) })); render(rr); $("#chip-session-value").textContent = sessionLabel(current.session); }
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

  /* Sessions (fed from the MicroMobility Rentals calendar) */
  var sessions = [], selectedSession = null;
  var sessionsEl = $("#sessions");
  function fmtDate(iso) {
    var d = new Date(iso); var loc = html.lang + "-u-ca-gregory-nu-latn"; // Gregorian, Western digits, in every language
    try { return d.toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return d.toDateString(); }
  }
  function fmtTime(iso) {
    var d = new Date(iso); var loc = html.lang + "-u-ca-gregory-nu-latn"; // Gregorian, Western digits, in every language
    try { return d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; }
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
      b.appendChild(date); b.appendChild(time);
      sessionsEl.appendChild(b);
    });
  }
  function setSessions(list) { sessions = list || []; if (!sessions.some(function (s) { return s.id === selectedSession; })) selectedSession = null; renderSessions(); }
  sessionsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".session"); if (!b || b.disabled) return;
    selectedSession = b.getAttribute("data-id");
    sessionsEl.querySelectorAll(".session").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
    setError("f-session", false);
  });

  /* Steps */
  var STEPS = 3, step = 1;
  function goStep(n) {
    step = Math.min(STEPS, Math.max(1, n));
    $("#card").setAttribute("data-step", step);
    document.querySelectorAll(".step").forEach(function (f) { f.hidden = Number(f.getAttribute("data-step")) !== step; });
    document.querySelectorAll(".stepper-item").forEach(function (li) {
      var k = Number(li.getAttribute("data-step"));
      li.classList.toggle("active", k === step); li.classList.toggle("done", k < step);
      li.setAttribute("aria-current", k === step ? "step" : "false");
    });
    $("#back").hidden = step === 1;
    $("#next").hidden = step === STEPS;
    $("#submit").hidden = step !== STEPS;
    hideBanner();
    var first = document.querySelector('.step[data-step="' + step + '"] input, .step[data-step="' + step + '"] [role="radio"]');
    if (first && document.activeElement && document.activeElement.tagName === "BUTTON") first.focus({ preventScroll: true });
  }
  $("#back").addEventListener("click", function () { goStep(step - 1); });
  $("#next").addEventListener("click", function () { if (validateStep(step)) goStep(step + 1); else focusInvalid(); });

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
  (function buildCC() {
    cc.innerHTML = "";
    CC_SHOWN.forEach(function (x) { var o = document.createElement("option"); o.value = x[1]; o.setAttribute("data-iso", x[0]); o.textContent = x[0] + " +" + x[1]; cc.appendChild(o); });
    cc.value = "966";
  })();
  var DIGIT_ZEROS = [0x0660, 0x06F0, 0x0966, 0x09E6];
  function asciiDigits(v) {
    return String(v || "").replace(/[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\u09E6-\u09EF]/g, function (ch) {
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
  function codeTyped(d, code) {
    if (d.indexOf(code) !== 0) return false;
    var lens = NATIONAL_LEN[code], rest = d.slice(code.length).replace(/^0+/, "");
    if (!lens) return d.length >= 11 && rest.length >= 8;
    return lens.indexOf(rest.length) >= 0 && lens.indexOf(d.replace(/^0+/, "").length) < 0;
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
    var n = nationalDigits();
    if (cc.value === "966") return /^5\d{8}$/.test(n);
    return /^\d{6,12}$/.test(n);
  }
  function syncPhone() {
    phoneOut.value = phoneE164();
    var err = document.querySelector("#f-phone .err");
    var own = cc.value === "966" ? "Enter a valid Saudi mobile number (05XXXXXXXX)" : "Enter a valid mobile number";
    err.setAttribute("data-t0", own); err.setAttribute("data-t", own); render(err);
    phoneIn.placeholder = cc.value === "966" ? "5X XXX XXXX" : "";
  }
  phoneIn.addEventListener("input", syncPhone);
  phoneIn.addEventListener("blur", function () { var n = nationalDigits(); if (n) phoneIn.value = n; syncPhone(); });
  cc.addEventListener("change", function () { syncPhone(); setError("f-phone", false); });
  syncPhone();

  /* Company */
  var companies = $("#companies"), selectedCompany = null;
  companies.addEventListener("click", function (e) {
    var b = e.target.closest(".company"); if (!b) return;
    selectedCompany = b.getAttribute("data-v");
    companies.querySelectorAll(".company").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
    setError("f-company", false);
  });

  /* Tiles */
  var types = $("#types"), selectedType = null;
  types.addEventListener("click", function (e) {
    var tile = e.target.closest(".tile"); if (!tile) return;
    selectedType = tile.getAttribute("data-v");
    types.querySelectorAll(".tile").forEach(function (b) { b.setAttribute("aria-checked", String(b === tile)); });
    setError("f-type", false);
  });

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
  function showBanner(msg) {
    var b = $("#banner"), txt = b.querySelector(".banner-text");
    txt.setAttribute("data-t", msg); render(txt);
    b.hidden = false;
  }
  function hideBanner() { $("#banner").hidden = true; }
  $(".banner-close").addEventListener("click", hideBanner);
  ["badge", "name", "phone", "height"].forEach(function (id) {
    $("#" + id).addEventListener("input", function () { setError("f-" + id, false); });
  });

  function validateStep(n) {
    var ok = true;
    if (n === 1) { if (!selectedSession) { setError("f-session", true); ok = false; } }
    if (n === 2) {
      if (!selectedCompany) { setError("f-company", true); ok = false; }
      var badge = $("#badge").value.trim(), name = $("#name").value.trim();
      if (!badge) { setError("f-badge", true); ok = false; }
      if (!name) { setError("f-name", true); ok = false; }
      syncPhone();
      if (!phoneValid()) { setError("f-phone", true); ok = false; }
    }
    if (n === 3) {
      var h = Number($("#height").value);
      if (!h || h < 100 || h > 250) { setError("f-height", true); ok = false; }
      if (!selectedType) { setError("f-type", true); ok = false; }
    }
    return ok;
  }
  function validate() { for (var i = 1; i <= STEPS; i++) { if (!validateStep(i)) { goStep(i); return false; } } return true; }
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
    return { badge: asciiDigits($("#badge").value).trim(), name: $("#name").value.trim(), company: selectedCompany, phone: phoneE164(), height: Number($("#height").value), type: selectedType, session: s || null };
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
    $("#success .title").setAttribute("tabindex", "-1"); $("#success .title").focus({ preventScroll: true });
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
    ["f-session", "f-company", "f-badge", "f-name", "f-phone", "f-height", "f-type"].forEach(function (id) { setError(id, false); });
    goStep(1);
    hideBanner(); setLoading(false);
    $("#success").hidden = true;
    $("#card").setAttribute("data-state", "form");
    current = null; try { localStorage.removeItem(STORE); } catch (e) {}
  }

  /* Submit: demo behaviour. Wire the real request here. */
  $("#form").addEventListener("submit", function (e) {
    e.preventDefault();
    hideBanner();
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
    return { id: "s" + i, title: i === 0 ? "JCC Wednesday" : "", start: s.toISOString(), end: e.toISOString(), spots: [12, 5, 0, 20][i] };
  }));
  function pickSession() { sessionsEl.querySelector('.session:not([disabled])').click(); }
  function fill() { pickSession(); companies.querySelector('[data-v="Petromin"]').click(); $("#badge").value = demo.badge; $("#name").value = demo.name; $("#phone").value = demo.phone; syncPhone(); $("#height").value = demo.height; }
  goStep(Number(params.get("step")) || 1);
  var state = params.get("state");
  if (!state && !params.get("step") && restore()) state = "restored";
  switch (state) {
    case "errors": validateStep(step); break;
    case "server": fill(); goStep(3); types.querySelector('[data-v="Hybrid"]').click(); showBanner("Could not reach the server"); break;
    case "network": fill(); goStep(3); types.querySelector('[data-v="Hybrid"]').click(); showBanner("Too many submissions from this network"); break;
    case "loading": fill(); goStep(3); types.querySelector('[data-v="Hybrid"]').click(); setLoading(true); break;
    case "success": fill(); goStep(3); types.querySelector('[data-v="Hybrid"]').click(); var d = collect(); d.bookingNo = "p-001"; showSuccess(d); try { localStorage.removeItem(STORE); } catch (e) {} break;
    default: if (params.get("step") === "2" || params.get("step") === "3") pickSession();
  }

  window.RiderRegistration = { languages: LANGS, translations: T, applyLang: applyLang, setSessions: setSessions, goStep: goStep, getSelection: function () { return { session: selectedSession, company: selectedCompany, type: selectedType, phone: phoneE164() }; }, getPhone: phoneE164, setError: setError, showBanner: showBanner, hideBanner: hideBanner, setLoading: setLoading, showSuccess: showSuccess, reset: reset, validate: validate, collect: collect, restore: restore, getSaved: function () { return current; } };
})();
