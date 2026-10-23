import re

# ---- worker: teacher must not cite verse numbers (the model gets them wrong)
p = 'src/worker.js'
s = open(p, encoding='utf8').read()
old = "وفي المسائل الفقهية الخلافية انصح بالرجوع إلى معلّم مجاز.'"
assert old in s
s = s.replace(old, "ولا تذكر أرقام السور والآيات أبداً (قد تخطئ فيها)، اذكر الكلمة أو الجزء من الآية فقط. وفي المسائل الفقهية الخلافية انصح بالرجوع إلى معلّم مجاز.'", 1)
open(p, 'w', encoding='utf8').write(s)

p = 'public/index.html'
h = open(p, encoding='utf8').read()

def rep(old, new):
    global h
    assert old in h, old[:70]
    h = h.replace(old, new, 1)

# ---- CSS
rep("</style></head>", r"""
/* memorize / learn */
.ctl{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin-bottom:12px}
.ctl label{display:flex;flex-direction:column;font-size:.82rem;color:var(--mut);gap:2px}
.ctl select,.ctl input[type=number]{font:inherit;padding:6px 8px;border-radius:8px;border:1px solid var(--bar);background:var(--card);color:var(--fg);min-width:90px}
.ctl .chk{flex-direction:row;align-items:center;gap:6px;color:var(--fg)}
.vrow{background:var(--card);border-radius:12px;padding:10px 14px;margin-top:8px;border:2px solid transparent}
.vrow.cur{border-color:var(--acc)}
.vrow .top{display:flex;gap:10px;align-items:flex-start;font-weight:400;font-size:1rem}
.vrow .num{color:var(--mut);font-size:.85rem;min-width:2em;padding-top:10px}
.vrow .vt{flex:1;margin:0}
.vrow.hide .vt{filter:blur(9px);cursor:pointer;user-select:none}
.mbtn{border:1px solid var(--acc);background:transparent;color:var(--fg);border-radius:50%;width:38px;height:38px;cursor:pointer;font-size:1.05rem;flex:none}
.mbtn.rec{background:#c0392b;color:#fff;border-color:#c0392b}
.res{margin-top:6px;font-size:1.15rem;line-height:2;font-family:"Amiri","Traditional Arabic","Noto Naskh Arabic",serif}
.res .ok{color:#1c8a4f}.res .bad{color:#c0392b;text-decoration:underline wavy}
.lesson{background:var(--card);border-radius:14px;padding:4px 16px;margin-top:10px}
.lesson>summary{cursor:pointer;font-weight:700;padding:10px 0;font-size:1.05rem}
.lesson ul{margin:6px 0 10px;padding-inline-start:1.3em}.lesson li{margin:3px 0}
.lesson .ex{border-top:1px solid var(--bar);padding:8px 0}
.lesson .exh{display:flex;gap:10px;align-items:center}.lesson .exh .vt{flex:1;margin:0;font-size:1.25rem}
.letters{font-size:1.5rem;letter-spacing:.3em;font-family:"Amiri","Traditional Arabic",serif;line-height:2}
</style></head>""")

# ---- home tiles
rep("""<span>يستمع ويقترح آيات ذات صلة بما يسمعه</span></a>""", """<span>يستمع ويقترح آيات ذات صلة بما يسمعه</span></a>
    <a class="tile" href="#memorize"><div class="ic">🧠</div><b>تحفيظ القرآن</b><span>كرّر الآيات واستمع وسمّع محفوظك وتحقّق منه</span></a>
    <a class="tile" href="#learn"><div class="ic">🎓</div><b>تعليم القرآن</b><span>دروس مبسطة في التجويد مع أمثلة مسموعة</span></a>""")

# ---- sections
rep("<script type=\"module\">", r"""<!-- تحفيظ القرآن -->
<section class="view wrap wide" id="v-memorize" hidden>
  <h2>تحفيظ القرآن</h2>
  <p class="hint">اختر السورة ونطاق الآيات والقارئ وعدد التكرار، ثم اضغط «تشغيل». يمكنك إخفاء النص لاختبار حفظك، وتسميع كل آية بالميكروفون ليُقارن الموقع كلماتك بالآية.</p>
  <div class="ctl">
    <label>السورة<select id="mSurah"></select></label>
    <label>من الآية<input type="number" id="mFrom" min="1" value="1"></label>
    <label>إلى الآية<input type="number" id="mTo" min="1" value="5"></label>
    <label>القارئ<select id="mReader"></select></label>
    <label>التكرار<select id="mRep"><option>1</option><option>3</option><option selected>5</option><option>10</option></select></label>
    <label class="chk"><input type="checkbox" id="mHide"> إخفاء النص</label>
    <button class="btn pri" id="mLoad">عرض الآيات</button>
    <button class="btn" id="mPlay">▶ تشغيل</button>
  </div>
  <div class="tag" id="mMsg"></div>
  <audio id="mAudio" hidden></audio>
  <div id="mList"></div>
  <p class="note">التحقق من التسميع تقريبي يعتمد على التعرّف الآلي على الكلام؛ ولا يغني عن التلقّي من معلّم مجاز.</p>
</section>

<!-- تعليم القرآن -->
<section class="view wrap" id="v-learn" hidden>
  <h2>تعليم القرآن</h2>
  <p class="hint">دروس مختصرة في الحروف وأحكام التجويد. اضغط على الدرس لفتحه، واستمع إلى الأمثلة بصوت القارئ الذي تختاره.</p>
  <div class="ctl"><label>القارئ للأمثلة<select id="lReader"></select></label></div>
  <audio id="lAudio" hidden></audio>
  <div id="lessons"></div>
  <div class="aib" style="margin-top:16px"><h3>اسأل المعلّم</h3>
    <form id="tForm"><input id="tQ" maxlength="300" placeholder="مثال: ما الفرق بين المد المتصل والمنفصل؟" aria-label="سؤالك"><button>اسأل</button></form>
    <div class="ans" id="tAns"></div>
    <div class="tag">إجابات الذكاء الاصطناعي قد تحتوي أخطاء في أحكام التجويد؛ اعتمد الدروس أعلاه وراجع معلماً مجازاً.</div></div>
</section>

<script type="module">""")

# ---- JS
rep("const VIEWS = ['home', 'identify', 'readers', 'surahs', 'companion'];", "const VIEWS = ['home', 'identify', 'readers', 'surahs', 'companion', 'memorize', 'learn'];")
rep("  if (v === 'surahs') loadSurahs();", "  if (v === 'surahs') loadSurahs();\n  if (v === 'memorize') initMemorize();\n  if (v === 'learn') initLearn();")

js = r"""
/* ---------- صوت الآيات (everyayah.com) ---------- */
const everyFolder = (rec) => { const l = (rec.links || []).find((x) => /everyayah\.com\/data\//.test(x.url)); const m = l && /data\/([^/]+)\//.exec(l.url); return m && m[1]; };
const ayahUrl = (folder, s, a) => `https://everyayah.com/data/${folder}/${String(s).padStart(3, '0')}${String(a).padStart(3, '0')}.mp3`;
function everyReaders() { return reciters.filter(everyFolder); }
function fillEveryReader(sel) {
  const rs = everyReaders(), f = rs.filter((r) => favs.has(r.id)), o = rs.filter((r) => !favs.has(r.id));
  const keep = sel.value;
  const opt = (r) => `<option value="${esc(r.id)}">${esc(arName(r))}</option>`;
  sel.innerHTML = (f.length ? `<optgroup label="المفضلة">${f.map(opt).join('')}</optgroup>` : '') + `<optgroup label="القرّاء">${o.map(opt).join('')}</optgroup>`;
  sel.value = keep && rs.some((r) => r.id === keep) ? keep : (f[0] || rs.find((r) => r.id === 'r123') || rs[0] || {}).id || '';
}
async function ensureReaders() { for (let i = 0; i < 50 && !reciters.length; i++) await new Promise((r) => setTimeout(r, 100)); }

/* ---------- تحفيظ القرآن ---------- */
let mInit = false, mVerses = [], mSurah = 1, mPlaying = false, mRec = null;
const mAudio = $('mAudio');
function mStop() { mPlaying = false; mAudio.pause(); $('mPlay').textContent = '▶ تشغيل'; document.querySelectorAll('.vrow.cur').forEach((e) => e.classList.remove('cur')); }
async function initMemorize() {
  leaveHooks.push(() => { mStop(); if (mRec) mRec.cancel(); });
  if (mInit) return; mInit = true;
  await ensureReaders(); fillEveryReader($('mReader'));
  try {
    if (!surahs) surahs = await (await fetch('/api/surahs')).json();
    $('mSurah').innerHTML = surahs.map((s) => `<option value="${s.id}">${nA(s.id)}. ${esc(s.ar)}</option>`).join('');
  } catch { $('mMsg').textContent = 'تعذّر تحميل قائمة السور.'; }
}
async function mShow() {
  mStop();
  mSurah = +$('mSurah').value;
  $('mMsg').textContent = 'جارٍ تحميل الآيات…';
  try { mVerses = await (await fetch('/api/verses?s=' + mSurah)).json(); if (!Array.isArray(mVerses)) throw 0; } catch { $('mMsg').textContent = 'تعذّر تحميل الآيات.'; return false; }
  const max = mVerses.length;
  let from = Math.min(Math.max(+$('mFrom').value || 1, 1), max), to = Math.min(Math.max(+$('mTo').value || from, from), max);
  $('mFrom').value = from; $('mTo').value = to; $('mFrom').max = $('mTo').max = max;
  $('mMsg').textContent = `${nA(to - from + 1)} آية من ${nA(max)} آية في السورة.`;
  const hide = $('mHide').checked;
  $('mList').innerHTML = mVerses.filter((v) => v.n >= from && v.n <= to).map((v) =>
    `<div class="vrow${hide ? ' hide' : ''}" data-n="${v.n}"><div class="top"><span class="num">${nA(v.n)}</span><div class="vt">${esc(v.text)}</div><button class="mbtn" title="سمّع هذه الآية" aria-label="سمّع الآية ${nA(v.n)}">🎤</button></div><div class="res"></div></div>`).join('');
  return true;
}
$('mLoad').onclick = mShow;
$('mSurah').onchange = () => { $('mFrom').value = 1; $('mTo').value = 5; mShow(); };
$('mHide').onchange = () => document.querySelectorAll('#mList .vrow').forEach((r) => r.classList.toggle('hide', $('mHide').checked));
$('mList').onclick = (e) => {
  const row = e.target.closest('.vrow'); if (!row) return;
  if (e.target.closest('.vt') && row.classList.contains('hide')) { row.classList.remove('hide'); return; }
  if (e.target.closest('.mbtn')) mRecite(row, e.target.closest('.mbtn'));
};
$('mPlay').onclick = async () => {
  if (mPlaying) { mStop(); return; }
  if (!(await mShow())) return;
  const rec = reciters.find((r) => r.id === $('mReader').value), folder = rec && everyFolder(rec);
  if (!folder) { $('mMsg').textContent = 'اختر قارئاً.'; return; }
  const rep = +$('mRep').value, from = +$('mFrom').value, to = +$('mTo').value;
  const queue = []; for (let a = from; a <= to; a++) for (let k = 1; k <= rep; k++) queue.push([a, k]);
  let i = 0; mPlaying = true; $('mPlay').textContent = '⏹ إيقاف';
  const next = () => {
    if (!mPlaying) return;
    if (i >= queue.length) { mStop(); $('mMsg').textContent = 'انتهى التشغيل. أحسنت!'; return; }
    const [a, k] = queue[i++];
    document.querySelectorAll('.vrow.cur').forEach((e) => e.classList.remove('cur'));
    const row = document.querySelector(`#mList .vrow[data-n="${a}"]`);
    if (row) { row.classList.add('cur'); row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    $('mMsg').textContent = `الآية ${nA(a)} — المرة ${nA(k)} من ${nA(rep)}`;
    mAudio.src = ayahUrl(folder, mSurah, a); mAudio.play().catch(() => { $('mMsg').textContent = 'تعذّر تشغيل الصوت.'; mStop(); });
  };
  mAudio.onended = () => setTimeout(next, 350);
  mAudio.onerror = () => { $('mMsg').textContent = 'تعذّر تحميل صوت هذه الآية.'; mStop(); };
  next();
};
async function mRecite(row, b) {
  if (mRec) { const r = mRec; mRec = null; r.finish(); return; }
  mStop();
  let stream;
  try { stream = await micStream(); } catch (e) { row.querySelector('.res').textContent = micError(e); return; }
  const rec = new MediaRecorder(stream), chunks = []; let cancelled = false;
  rec.ondataavailable = (e) => chunks.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  const timer = setTimeout(() => api.finish(), 25000);
  const api = { finish: () => { clearTimeout(timer); if (rec.state !== 'inactive') rec.stop(); }, cancel: () => { cancelled = true; api.finish(); } };
  mRec = api; rec.start(); b.classList.add('rec'); b.textContent = '⏹';
  row.querySelector('.res').textContent = 'أستمع إلى تسميعك… اضغط ⏹ عند الانتهاء.';
  await stopped; stream.getTracks().forEach((x) => x.stop()); mRec = null; b.classList.remove('rec'); b.textContent = '🎤';
  if (cancelled) return;
  const res = row.querySelector('.res'); res.textContent = 'جارٍ التحقق…';
  try {
    const pcm = await toPcm(await new Blob(chunks).arrayBuffer());
    const r = await fetch(`/api/check?key=${mSurah}:${row.dataset.n}`, { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wav16(pcm) });
    const d = await r.json();
    if (!r.ok) { res.textContent = r.status === 429 ? d.error : 'تعذّر التحقق الآن.'; return; }
    res.innerHTML = d.words.map((w) => `<span class="${w.ok ? 'ok' : 'bad'}">${esc(w.w)}</span>`).join(' ') +
      `<div class="tag">${d.score === 100 ? '🌟 ممتاز! ' : ''}نسبة الكلمات الصحيحة: ${nA(d.score)}٪ — سُمع: «${esc(d.heard)}»</div>`;
  } catch { res.textContent = 'تعذّر التحقق الآن.'; }
}

/* ---------- تعليم القرآن ---------- */
const LESSONS = [
  { t: 'الحروف الهجائية والحركات', body: `<p>حروف الهجاء العربية ثمانية وعشرون حرفاً:</p><div class="letters">ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي</div>
    <p>العلامات التي تضبط نطق الحرف:</p><ul><li><b>الفتحة</b> (َ): صوت «أ» قصير فوق الحرف.</li><li><b>الكسرة</b> (ِ): صوت «إ» قصير تحت الحرف.</li><li><b>الضمة</b> (ُ): صوت «أُ» قصير فوق الحرف.</li><li><b>السكون</b> (ْ): الحرف بلا حركة.</li><li><b>الشدّة</b> (ّ): الحرف المشدّد حرفان؛ الأول ساكن والثاني متحرك.</li><li><b>التنوين</b> (ً ٍ ٌ): نون ساكنة تلحق آخر الاسم، تُنطق ولا تُكتب.</li></ul>`, ex: ['1:1', '1:2'] },
  { t: 'أحكام النون الساكنة والتنوين', body: `<p>للنون الساكنة والتنوين أربعة أحكام بحسب الحرف الذي يأتي بعدهما:</p><ul>
    <li><b>الإظهار:</b> إذا جاء بعدهما أحد حروف الحلق الستة: <b>ء ه ع ح غ خ</b>؛ فتُنطق النون واضحة بلا غنّة.</li>
    <li><b>الإدغام:</b> إذا جاء بعدهما أحد حروف «<b>يرملون</b>»: ي ر م ل و ن؛ ويكون بغنّة في (ي ن م و) وبغير غنّة في (ل ر).</li>
    <li><b>الإقلاب:</b> إذا جاء بعدهما حرف <b>الباء</b>؛ فتُقلب النون ميماً مخفاة مع غنّة.</li>
    <li><b>الإخفاء:</b> إذا جاء بعدهما أحد الحروف الخمسة عشر الباقية؛ فتُنطق بين الإظهار والإدغام مع غنّة.</li></ul>
    <p>الأمثلة: <b>إظهار</b> «مَنْ آمَنَ»، <b>إدغام</b> «مَن يَقُولُ»، <b>إقلاب</b> «مِن بَعْدِ»، <b>إخفاء</b> «مِن ذَكَرٍ».</p>`, ex: ['2:62', '2:8', '2:27', '49:13'] },
  { t: 'أحكام الميم الساكنة', body: `<ul><li><b>الإخفاء الشفوي:</b> إذا جاء بعد الميم الساكنة حرف <b>الباء</b>؛ تُخفى مع غنّة.</li>
    <li><b>الإدغام الشفوي (المثلين الصغير):</b> إذا جاء بعدها ميم أخرى؛ تُدغم فيها بغنّة.</li>
    <li><b>الإظهار الشفوي:</b> إذا جاء بعدها أي حرف آخر غير الباء والميم؛ تُنطق واضحة، ويُنتبه عند الواو والفاء حتى لا تُخفى.</li></ul>`, ex: ['105:4', '2:25'] },
  { t: 'أحكام المدّ', body: `<p>حروف المدّ ثلاثة: الألف بعد فتحة، والواو الساكنة بعد ضمة، والياء الساكنة بعد كسرة.</p><ul>
    <li><b>المدّ الطبيعي:</b> مقداره حركتان، ولا يأتي بعده همز ولا سكون.</li>
    <li><b>المدّ المتصل:</b> حرف مدّ يليه همزة في كلمة واحدة، ويُمدّ أربع أو خمس حركات.</li>
    <li><b>المدّ المنفصل:</b> حرف مدّ في آخر كلمة وهمزة في أول الكلمة التي بعدها، ويُمدّ أربع أو خمس حركات.</li>
    <li><b>المدّ اللازم:</b> حرف مدّ يليه سكون أصلي في كلمة واحدة، ويُمدّ ست حركات.</li>
    <li><b>المدّ العارض للسكون:</b> يكون عند الوقف على آخر الكلمة، ويجوز فيه حركتان أو أربع أو ست.</li></ul>`, ex: ['2:19', '2:4', '1:7'] },
  { t: 'القلقلة', body: `<p>القلقلة اضطراب خفيف في المخرج عند النطق بالحرف الساكن حتى يُسمع له نبرة. وحروفها خمسة يجمعها قولك: <b>قطب جد</b>.</p><ul>
    <li><b>القلقلة الصغرى:</b> إذا كان الحرف ساكناً في وسط الكلمة.</li><li><b>القلقلة الكبرى:</b> إذا كان الحرف في آخر الكلمة وتوقفتَ عليه، وهي أقوى.</li></ul>`, ex: ['112:1', '111:1'] },
  { t: 'التفخيم', body: `<p>حروف الاستعلاء سبعة يجمعها قولك: <b>خُصَّ ضغطٍ قِظ</b>، وهي: خ ص ض غ ط ق ظ؛ وتُنطق مفخّمة (غليظة) دائماً.</p><p>تدرّب على نطقها في الأمثلة التالية.</p>`, ex: ['112:2', '1:6'] },
];
let lInit = false;
const lAudio = $('lAudio');
async function initLearn() {
  leaveHooks.push(() => lAudio.pause());
  await ensureReaders(); fillEveryReader($('lReader'));
  if (lInit) return; lInit = true;
  $('lessons').innerHTML = LESSONS.map((l, i) => `<details class="lesson" data-i="${i}"><summary>${nA(i + 1)}. ${esc(l.t)}</summary><div>${l.body}</div><div class="exs">${l.ex ? '<div class="tag">جارٍ تحميل الأمثلة…</div>' : ''}</div></details>`).join('');
  $('lessons').addEventListener('toggle', async (e) => {
    const d = e.target; if (!d.open || d.dataset.done) return; d.dataset.done = 1;
    const l = LESSONS[+d.dataset.i], box = d.querySelector('.exs'); if (!l.ex) return;
    try {
      const vs = await (await fetch('/api/ayat?keys=' + l.ex.join(','))).json();
      box.innerHTML = '<h3 class="tag" style="margin:6px 0">أمثلة من القرآن</h3>' + vs.map((v) =>
        `<div class="ex"><div class="exh"><div class="vt">${esc(v.text)}</div><button class="mbtn" data-key="${esc(v.key)}" aria-label="استمع">▶</button></div><div class="tag">سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)}</div></div>`).join('');
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
"""
rep("route();\n</script>", js + "route();\n</script>")

# keep selectors in sync when favourites change
rep("saveFavs(); renderList(); fillSurahReaders();", "saveFavs(); renderList(); fillSurahReaders(); if (mInit) fillEveryReader($('mReader')); if (lInit) fillEveryReader($('lReader'));")
open(p, 'w', encoding='utf8').write(h)
print('patched')
