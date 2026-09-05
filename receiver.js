// ===== دوال خالصة - كلها مغطّاة باختبارات test.html =====
const STRINGS = {
  ar: { kareem: "القرآن الكريم", ayah: n => "آية " + n, am: "ص", pm: "م", digits: "٠١٢٣٤٥٦٧٨٩" },
  en: { kareem: "The Holy Quran", ayah: n => "Ayah " + n, am: "AM", pm: "PM", digits: "0123456789" }
};

/** 🔑 أي لغة غير العربية تعرض أرقامًا لاتينية ولصائق إنجليزية - أسماء السور والقارئ تصل مترجَمة أصلًا */
function strings(lang) {
  return STRINGS[lang] || STRINGS.en;
}

function shapeDigits(text, lang) {
  const d = strings(lang).digits;
  return String(text).replace(/[0-9]/g, c => d[+c]);
}

/** 🔑 دقائق:ثوانٍ بلا تدوير لساعات - يطابق ما يعرضه مشغّل التطبيق (٨٢:٠١ لا ١:٢٢:٠١) */
function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

/** 🔑 آخر آية بدأت عند هذا الموضع - القائمة مرتّبة، ونثبت على الأخيرة بعد النهاية */
function ayahAt(timings, positionMs) {
  if (!timings || !timings.length) return null;
  let found = null;
  for (const t of timings) {
    if (positionMs >= t.startMs) found = t.ayah; else break;
  }
  // 🔑 الموضع قبل بداية أول آية (أثناء البسملة): نعرض الآية الأولى لا null،
  // لمطابقة الهاتف - PhoneHomeScreen.kt يهيّئ currentAyahIndex=0 ولا يحدّثه
  // إلا إذا idx >= 0، فيبقى على الآية الأولى في هذه الحالة. لا "تصلح" هذا لاحقًا.
  return found === null ? timings[0].ayah : found;
}

/** 🔑 الإدخال ayah=0 هو البسملة ولا يقابله رقم آية معروض - نُسقطه كما يفعل الهاتف */
function parseTimings(json) {
  if (!Array.isArray(json)) return [];
  return json
    .filter(o => Number(o.ayah) > 0)
    .map(o => ({ ayah: Number(o.ayah), startMs: Number(o.start_time), endMs: Number(o.end_time) }));
}

window.QTV = { strings, shapeDigits, formatDuration, ayahAt, parseTimings };
