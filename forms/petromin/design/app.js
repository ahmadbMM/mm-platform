/* Employees Bike Registration Form: language switching, tile selection, inline validation, state helpers.
   Replace the submit handler with the real request; everything else can stay. */
(function () {
  var LANGS = { ar: "العربية", en: "English", fr: "Français", hi: "हिन्दी", ur: "اردو", ne: "नेपाली", pt: "Português", es: "Español", tl: "Tagalog", bn: "বাংলা" };
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
      "MicroMobility, Jeddah": "माइक्रोमोबिलिटी, जेद्दा",
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
      "MicroMobility, Jeddah": "माइक्रोमोबिलिटी, जेद्दा",
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
      "MicroMobility, Jeddah": "মাইক্রোমোবিলিটি, জেদ্দা",
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
    }
  };

  var $ = function (s) { return document.querySelector(s); };
  var html = document.documentElement;
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
    var sel = $("#lang"); if (sel.value !== lang) sel.value = lang;
    if (typeof renderSessions === "function" && sessionsEl) renderSessions();
    if (typeof current !== "undefined" && current) { var rr = $("#result"); rr.setAttribute("data-args", JSON.stringify({ d: sessionLabel(current.session) })); render(rr); $("#chip-session-value").textContent = sessionLabel(current.session); }
    try { localStorage.setItem("mm-lang", lang); } catch (e) {}
  }
  function initialLang() {
    var q = params.get("lang"); if (q && LANGS[q]) return q;
    try { var s = localStorage.getItem("mm-lang"); if (s && LANGS[s]) return s; } catch (e) {}
    var nav = (navigator.languages || [navigator.language || "en"]);
    for (var i = 0; i < nav.length; i++) { var code = String(nav[i] || "").toLowerCase().split(/[-_]/)[0]; if (code === "fil") code = "tl"; if (LANGS[code]) return code; }
    return "en";
  }
  (function buildSelect() {
    var sel = $("#lang"); sel.innerHTML = "";
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
  var cc = $("#cc"), phoneIn = $("#phone"), phoneOut = $("#phone-e164");
  (function buildCC() {
    cc.innerHTML = "";
    COUNTRIES.forEach(function (x) { var o = document.createElement("option"); o.value = x[1]; o.setAttribute("data-iso", x[0]); o.textContent = x[0] + " +" + x[1]; cc.appendChild(o); });
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
