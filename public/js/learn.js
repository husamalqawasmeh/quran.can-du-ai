// learning tajweed (#learn). One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- تعليم القرآن ---------- */
const LESSONS = [
  { t: 'الحروف الهجائية والحركات', body: `<p>حروف الهجاء العربية ثمانية وعشرون حرفاً:</p><div class="lgrid">${'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' ').map((c, i) => `<span style="grid-column:${(i % 14) + Math.floor((i % 14) / 4) + 1}">${c}</span>`).join('')}</div>
    <p>العلامات التي تضبط نطق الحرف:</p><div class="rgrid" style="--c:3">${[['بَ', 'الفتحة', 'صوت «أ» قصير فوق الحرف.'], ['بِ', 'الكسرة', 'صوت «إ» قصير تحت الحرف.'], ['بُ', 'الضمة', 'صوت «أُ» قصير فوق الحرف.'], ['بْ', 'السكون', 'الحرف بلا حركة.'], ['بّ', 'الشدّة', 'الحرف المشدّد حرفان؛ الأول ساكن والثاني متحرك.'], ['بً بٍ بٌ', 'التنوين', 'نون ساكنة تلحق آخر الاسم، تُنطق ولا تُكتب.']].map(([m, n, d]) => `<div><div class="rh"><b>${m}</b> : <strong>${n}</strong></div><div>${d}</div></div>`).join('')}</div>`, ex: ['1:1', '1:2'] },
  { t: 'أحكام النون الساكنة والتنوين', body: `<p>للنون الساكنة والتنوين أربعة أحكام بحسب الحرف الذي يأتي بعدهما:</p><div class="rgrid" style="--c:2"><div><div class="rh"><strong>الإظهار</strong></div><div>إذا جاء بعدهما أحد حروف الحلق الستة: <b>ء ه ع ح غ خ</b>؛ فتُنطق النون واضحة بلا غنّة.</div></div><div><div class="rh"><strong>الإدغام</strong></div><div>إذا جاء بعدهما أحد حروف «<b>يرملون</b>»: ي ر م ل و ن؛ ويكون بغنّة في (ي ن م و) وبغير غنّة في (ل ر).</div></div><div><div class="rh"><strong>الإقلاب</strong></div><div>إذا جاء بعدهما حرف <b>الباء</b>؛ فتُقلب النون ميماً مخفاة مع غنّة.</div></div><div><div class="rh"><strong>الإخفاء</strong></div><div>إذا جاء بعدهما أحد الحروف الخمسة عشر الباقية؛ فتُنطق بين الإظهار والإدغام مع غنّة.</div></div></div>
    <p>الأمثلة: <b>إظهار</b> «مَنْ آمَنَ»، <b>إدغام</b> «مَن يَقُولُ»، <b>إقلاب</b> «مِن بَعْدِ»، <b>إخفاء</b> «مِن ذَكَرٍ».</p>`, ex: ['2:62', '2:8', '2:27', '49:13'] },
  { t: 'أحكام الميم الساكنة', body: `<div class="rgrid" style="--c:3"><div><div class="rh"><strong>الإخفاء الشفوي</strong></div><div>إذا جاء بعد الميم الساكنة حرف <b>الباء</b>؛ تُخفى مع غنّة.</div></div><div><div class="rh"><strong>الإدغام الشفوي (المثلين الصغير)</strong></div><div>إذا جاء بعدها ميم أخرى؛ تُدغم فيها بغنّة.</div></div><div><div class="rh"><strong>الإظهار الشفوي</strong></div><div>إذا جاء بعدها أي حرف آخر غير الباء والميم؛ تُنطق واضحة، ويُنتبه عند الواو والفاء حتى لا تُخفى.</div></div></div>`, ex: ['105:4', '2:25'] },
  { t: 'أحكام المدّ', body: `<p>حروف المدّ ثلاثة: الألف بعد فتحة، والواو الساكنة بعد ضمة، والياء الساكنة بعد كسرة.</p><div class="rgrid" style="--c:3"><div><div class="rh"><strong>المدّ الطبيعي</strong></div><div>مقداره حركتان، ولا يأتي بعده همز ولا سكون.</div></div><div><div class="rh"><strong>المدّ المتصل</strong></div><div>حرف مدّ يليه همزة في كلمة واحدة، ويُمدّ أربع أو خمس حركات.</div></div><div><div class="rh"><strong>المدّ المنفصل</strong></div><div>حرف مدّ في آخر كلمة وهمزة في أول الكلمة التي بعدها، ويُمدّ أربع أو خمس حركات.</div></div><div><div class="rh"><strong>المدّ اللازم</strong></div><div>حرف مدّ يليه سكون أصلي في كلمة واحدة، ويُمدّ ست حركات.</div></div><div><div class="rh"><strong>المدّ العارض للسكون</strong></div><div>يكون عند الوقف على آخر الكلمة، ويجوز فيه حركتان أو أربع أو ست.</div></div></div>`, ex: ['2:19', '2:4', '1:7'] },
  { t: 'القلقلة', body: `<p>القلقلة اضطراب خفيف في المخرج عند النطق بالحرف الساكن حتى يُسمع له نبرة. وحروفها خمسة يجمعها قولك: <b>قطب جد</b>.</p><div class="rgrid" style="--c:2"><div><div class="rh"><strong>القلقلة الصغرى</strong></div><div>إذا كان الحرف ساكناً في وسط الكلمة.</div></div><div><div class="rh"><strong>القلقلة الكبرى</strong></div><div>إذا كان الحرف في آخر الكلمة وتوقفتَ عليه، وهي أقوى.</div></div></div>`, ex: ['112:1', '111:1'] },
  { t: 'التفخيم', body: `<p>حروف الاستعلاء سبعة يجمعها قولك: <b>خُصَّ ضغطٍ قِظ</b>، وهي: خ ص ض غ ط ق ظ؛ وتُنطق مفخّمة (غليظة) دائماً.</p><p>تدرّب على نطقها في الأمثلة التالية.</p>`, ex: ['112:2', '1:6'] },
];
let lInit = false;
const lAudio = $('lAudio');
async function initLearn() {
  leaveHooks.push(() => lAudio.pause());
  await ensureReaders(); fillEveryReader($('lReader'));
  if (lInit) return; lInit = true;
  $('lessons').innerHTML = LESSONS.map((l, i) => `<details class="lesson" data-i="${i}"><summary>${nA(i + 1)}. ${esc(l.t)}</summary><div>${l.body}</div><div class="exs">${l.ex ? '<div class="tag">جارٍ تحميل الأمثلة…</div>' : ''}</div></details>`).join('');
  panelize($('lessons'));   // three lessons a row; an opened lesson shows under its row
  $('lessons').addEventListener('toggle', async (e) => {
    const d = e.target; if (!d.open || d.dataset.done) return; d.dataset.done = 1;
    const l = LESSONS[+d.dataset.i], box = (d._p || d).querySelector('.exs'); if (!l.ex) return;
    try {
      const vs = await ayat(l.ex);
      box.innerHTML = '<h3 class="tag" style="margin:6px 0">أمثلة من القرآن</h3>' + vs.map((v) =>
        `<div class="ex"><div class="vt" data-ak="${esc(v.key)}"><span class="tag">سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)}:</span> ${esc(v.text)}</div><button class="mbtn" data-key="${esc(v.key)}" aria-label="استمع">▶</button></div>`).join('');
    } catch { box.innerHTML = '<div class="tag">تعذّر تحميل الأمثلة.</div>'; }
  }, true);
}
$('lessons').addEventListener('click', (e) => {
  const b = e.target.closest('.mbtn'); if (!b) return;
  const rec = reciters.find((r) => r.id === $('lReader').value), folder = rec && everyFolder(rec); if (!folder) return;
  const [s, a] = b.dataset.key.split(':'); lAudio.src = ayahUrl(folder, s, a); lAudio.play().catch(() => {});
});
$('tForm').onsubmit = async (e) => {
  e.preventDefault(); const q = $('tQ').value.trim(), o = $('tAns'); if (q.length < 3) return;
  o.textContent = 'جارٍ التفكير…';
  try {
    const r = await fetch('/api/teach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: q }) });
    const d = await r.json(); o.textContent = d.answer || (r.status === 429 ? d.error : 'تعذّرت الإجابة الآن.');
  } catch { o.textContent = 'الذكاء الاصطناعي غير متاح حالياً.'; }
};
$('lReader').onchange = () => lAudio.pause();
