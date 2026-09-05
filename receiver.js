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

// ===== ربط CAF =====
if (typeof cast !== "undefined") {
  const ctx = cast.framework.CastReceiverContext.getInstance();
  const playerManager = ctx.getPlayerManager();

  const el = id => document.getElementById(id);
  const ICON_PAUSE = '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>';
  const ICON_PLAY  = '<path d="M8 5v14l11-7z"/>';

  let lang = "ar";
  let timings = [];
  let totalAyahs = 0;
  let loadedContentId = null;

  const fills   = () => document.querySelectorAll('.fill');
  const ayahRow = () => document.querySelectorAll('.row')[1];

  function renderClock() {
    const now = new Date();
    const h24 = now.getHours();
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const s = QTV.strings(lang);
    el('time').innerHTML =
      QTV.shapeDigits(h12 + ":" + String(now.getMinutes()).padStart(2, "0"), lang) +
      ' <small>' + (h24 < 12 ? s.am : s.pm) + '</small>';
    el('date').textContent = QTV.shapeDigits(
      String(now.getDate()).padStart(2, "0") + "/" +
      String(now.getMonth() + 1).padStart(2, "0") + "/" + now.getFullYear(), lang);
  }

  function applyMetadata(media) {
    const md = (media && media.metadata) || {};
    // 🔑 composer يحمل رمز اللغة من الهاتف؛ غيابه (نسخة مُرسِل قديمة) يعني عربي كما كان
    lang = String(md.composer || "ar").toLowerCase();
    el('kareem').textContent  = md.albumName || QTV.strings(lang).kareem;
    el('reciter').textContent = md.artist || "";
    el('surah').textContent   = md.title || "";
    document.documentElement.lang = lang;
    renderClock();
  }

  function renderProgress() {
    const d = playerManager.getDurationSec() || 0;
    const p = playerManager.getCurrentTimeSec() || 0;
    el('elapsed').textContent = QTV.shapeDigits(QTV.formatDuration(p), lang);
    el('remain').textContent  = "-" + QTV.shapeDigits(QTV.formatDuration(Math.max(0, d - p)), lang);
    fills()[0].style.width = (d > 0 ? (p / d) * 100 : 0) + "%";

    // 🔑 صف الآية زينة - يُخفى بهدوء متى تعذّرت التوقيتات، ولا يمس صف الوقت إطلاقًا
    if (!timings.length) { ayahRow().hidden = true; return; }
    ayahRow().hidden = false;
    const n = QTV.ayahAt(timings, p * 1000);
    el('ayahNow').textContent   = QTV.strings(lang).ayah(QTV.shapeDigits(n, lang));
    el('ayahTotal').textContent = QTV.shapeDigits(totalAyahs, lang);
    fills()[1].style.width = (totalAyahs > 0 ? (n / totalAyahs) * 100 : 0) + "%";
  }

  /** الأزرار مرآة للحالة فقط - جهاز الاستقبال لا يستقبل تنقّل D-pad إطلاقًا */
  function renderTransport() {
    const playing =
      playerManager.getPlayerState() === cast.framework.messages.PlayerState.PLAYING;
    el('playIcon').innerHTML = playing ? ICON_PAUSE : ICON_PLAY;

    const q = playerManager.getQueueManager();
    const items = q ? q.getItems() || [] : [];
    const idx = q ? q.getCurrentItemIndex() : 0;
    const smalls = document.querySelectorAll('.small');
    smalls[0].classList.toggle('off', idx <= 0);
    smalls[1].classList.toggle('off', idx >= items.length - 1);
  }

  playerManager.addEventListener(cast.framework.events.EventType.MEDIA_STATUS, e => {
    const media = e.mediaStatus && e.mediaStatus.media;
    if (media) applyMetadata(media);
    renderTransport();
  });

  setInterval(renderClock, 10000);
  setInterval(renderProgress, 500);
  renderClock();
  renderTransport();
  ctx.start();
}
