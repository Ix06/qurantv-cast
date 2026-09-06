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

/** 🔑 الإدخال ayah=0 هو البسملة ولا يقابله رقم آية معروض - نُسقطه كما يفعل الهاتف.
 *  🔑 start_time غير محدود (NaN مثلًا) يكسر ayahAt: الحلقة تتوقف عند "else break" مبكرًا
 *  فيتجمّد رقم الآية بدل أن يتدهور بهدوء - نُسقط هذه الإدخالات كإدخال البسملة تمامًا */
function parseTimings(json) {
  if (!Array.isArray(json)) return [];
  return json
    .filter(o => Number(o.ayah) > 0 && Number.isFinite(Number(o.start_time)))
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

  // 🔑 يطابق إزاحة المزامنة على الهاتف - PhoneHomeScreen.kt: syncOffsetMs = 150L،
  // تُضاف قبل indexOfLast؛ بدونها يختلف رقم الآية عن الهاتف لحظيًا عند حدود الآيات
  const AYAH_SYNC_OFFSET_MS = 150;

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
    // 🔑 بعض مسارات استرجاع الهاتف تبني عنصر الوسائط بـ artist/title فارغين
    // (PlaybackService.kt: buildMediaItem(surahNumber, moshafServer, "", "", context)) -
    // كتابتهما بلا شرط تمسح اسم السورة والقارئ الصحيحين المعروضين سلفًا؛ عناصر قائمة
    // مشغّل الهاتف الفعلي تحمل دائمًا اسمًا حقيقيًا فلا نخسر شيئًا مشروعًا بهذا الشرط
    if (md.artist) el('reciter').textContent = md.artist;
    if (md.title)  el('surah').textContent   = md.title;
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
    const n = QTV.ayahAt(timings, p * 1000 + AYAH_SYNC_OFFSET_MS);
    el('ayahNow').textContent   = QTV.strings(lang).ayah(QTV.shapeDigits(n, lang));
    el('ayahTotal').textContent = QTV.shapeDigits(totalAyahs, lang);
    fills()[1].style.width = (totalAyahs > 0 ? (n / totalAyahs) * 100 : 0) + "%";
  }

  /** الأزرار مرآة للحالة فقط - جهاز الاستقبال لا يستقبل تنقّل D-pad إطلاقًا */
  function renderTransport() {
    // 🔑 BUFFERING يحدث في كل انتقال بين عناصر القائمة - معاملته كإيقاف يجعل القرص
    // يومض إلى "تشغيل" (مثلث) بينما المستخدم لم يوقف شيئًا
    const state = playerManager.getPlayerState();
    const playing =
      state === cast.framework.messages.PlayerState.PLAYING ||
      state === cast.framework.messages.PlayerState.BUFFERING;
    el('playIcon').innerHTML = playing ? ICON_PAUSE : ICON_PLAY;

    const q = playerManager.getQueueManager();
    const items = q ? q.getItems() || [] : [];
    const idx = q ? q.getCurrentItemIndex() : 0;
    const smalls = document.querySelectorAll('.small');
    smalls[0].classList.toggle('off', idx <= 0);
    smalls[1].classList.toggle('off', idx >= items.length - 1);
  }

  /** رقم السورة من الرابط - مسار احتياطي وحيد لو غاب trackNumber (نسخة مُرسِل قديمة) */
  function surahFromUrl(url) {
    // 🔑 مثبَّت بـ "/" قبل الأرقام ونهاية المسار بعدها - نمط غير مثبَّت كـ /(\d{3})\.mp3/
    // قد يلتقط أول ثلاثة أرقام قبل ".mp3" في أي مكان بالرابط، بما فيها اسم مضيف
    // كـ serverNNN.mp3quran.net لو بلغ رقم الخادم ثلاثة أرقام
    const m = String(url || "").match(/\/(\d{3})\.mp3.*$/);
    return m ? Number(m[1]) : null;
  }

  /** قائمة الروايات - المسار الاحتياطي حين يغيب discNumber لأن كاش الهاتف كان باردًا */
  async function readIdForUrl(url) {
    const res = await fetch("https://www.mp3quran.net/api/v3/ayat_timing/reads");
    const reads = await res.json();
    const folder = String(url || "").replace(/\/\d{3}\.mp3.*$/, "");
    const hit = reads.find(r => String(r.folder_url || "").replace(/\/$/, "") === folder);
    return hit ? Number(hit.id) : null;
  }

  async function loadTimings(media) {
    // 🔑 نلتقط هوية العنصر المستهدف الآن - إن تقدّمت القائمة أثناء انتظار fallback
    // الشبكة أدناه فسيتغيّر loadedContentId قبل اكتمالنا، ونتحقق منه قبل الكتابة أدناه
    const targetId = media.contentId || media.contentUrl;
    timings = []; totalAyahs = 0;
    try {
      const md = media.metadata || {};
      const url = media.contentId || media.contentUrl;
      // 🔑 Number(x) || fallback يُعامل صفرًا حقيقيًا كغائب - غير قابل للاستغلال هنا لأن
      // أرقام السور ومعرّفات الروايات في mp3quran لا تكون صفرًا أبدًا؛ افتراض مقصود ومُوزَن
      const surah = Number(md.trackNumber) || surahFromUrl(url);
      if (!surah) return; // 🔑 لا داعٍ لجلب قائمة الروايات كاملة إن لم نحدد السورة أصلًا
      const read = Number(md.discNumber) || await readIdForUrl(url);
      if (!read) return;
      const res = await fetch(
        "https://www.mp3quran.net/api/v3/ayat_timing?surah=" + surah + "&read=" + read);
      const parsed = QTV.parseTimings(await res.json());
      // 🔑 رد متأخر لسورة لم تعد قيد التشغيل يُسقَط لا يُعتمَد - القائمة قد تقدّمت
      // لعنصر آخر أثناء انتظار الجلب أعلاه، فلا يجوز أن يكتب فوق توقيتاته
      if (loadedContentId !== targetId) return;
      timings = parsed;
      totalAyahs = parsed.length ? parsed[parsed.length - 1].ayah : 0;
    } catch (e) {
      // 🔑 لا يفشل البث بسبب صف زينة - renderProgress يخفيه لأن timings بقيت فارغة
      console.warn("ayah timings unavailable", e);
    }
  }

  playerManager.addEventListener(cast.framework.events.EventType.MEDIA_STATUS, e => {
    const media = e.mediaStatus && e.mediaStatus.media;
    if (media) {
      applyMetadata(media);
      const id = media.contentId || media.contentUrl;
      // 🔑 نجلب مرة واحدة لكل عنصر - MEDIA_STATUS يتكرر كثيرًا أثناء التشغيل الطبيعي
      if (id !== loadedContentId) { loadedContentId = id; loadTimings(media); }
    }
    renderTransport();
  });

  setInterval(renderClock, 10000);
  setInterval(renderProgress, 500);
  renderClock();
  renderTransport();
  ctx.start();
}
