// the surahs page and its search boxes. One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- السور ---------- */
let surahs = null;
const surahAudio = (rec, n) => {
  const a = (rec.links || []).find((l) => /cdn\.mp3quran\.net\/.*\/\d{3}\.mp3$/.test(l.url));
  return a ? a.url.replace(/\d{3}\.mp3$/, String(n).padStart(3, '0') + '.mp3') : null;
};
function readerOptions() {
  const f = reciters.filter((r) => favs.has(r.id)), o = reciters.filter((r) => !favs.has(r.id));
  const opt = (r) => `<option value="${esc(r.id)}">${esc(arName(r))}</option>`;
  return '<option value="">اختر القارئ…</option>' + (f.length ? `<optgroup label="المفضلة">${f.map(opt).join('')}</optgroup>` : '') + `<optgroup label="جميع القرّاء">${o.map(opt).join('')}</optgroup>`;
}
function fillSurahReaders() { document.querySelectorAll('#sgrid select').forEach((s) => { const v = s.value; s.innerHTML = readerOptions(); s.value = v; }); }
const JUZ_START = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,2],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
const juzOf = (id) => JUZ_START.filter(([s, a]) => s < id || (s === id && a === 1)).length;   // the juz in which the surah begins
let juzOn = false;
// juz sections: a surah is listed in EVERY juz it touches (it touches juz j if it ends after the juz starts and begins before the next juz starts)
const cmpKey = (s, a, s2, a2) => (s - s2) || (a - a2);
const juzSurahs = (j) => { const st = JUZ_START[j - 1], nx = JUZ_START[j]; return surahs.filter((s) => cmpKey(s.id, s.verses, st[0], st[1]) >= 0 && (!nx || cmpKey(s.id, 1, nx[0], nx[1]) < 0)); };
const SORDER = { verses: (a, b) => b.verses - a.verses, words: (a, b) => b.words - a.words, fewwords: (a, b) => a.words - b.words, letters: (a, b) => b.letters - a.letters };   // the «ترتيب السور» setting
function renderSurahs() {
  const q = $('ssearch').value.trim().replace(/[ً-ٟ]/g, '').replace(/[إأآٱ]/g, 'ا');
  const sections = juzOn && !q;
  $('sgrid').classList.toggle('juz', sections);
  const card = (s, shared, style) => `<details class="sr${shared ? ' jshare' : ''}"${style ? ` style="${style}"` : ''} data-n="${s.id}"><summary><span class="n">${nA(s.id)}</span><span class="nm">${esc(s.ar)}</span><span class="m">${s.place === 'makkah' ? 'مكية' : 'مدنية'} # ${nA(s.verses)} آية</span></summary>
     <div class="body"><a class="tag" href="https://quran.com/${s.id}" target="_blank" rel="noopener noreferrer" style="color:var(--acc)">📖 افتح السورة في المصحف (Quran.com)</a><br>
     <select aria-label="القارئ">${readerOptions()}</select><div class="tag msg"></div><audio controls preload="none" hidden></audio>
     <details class="vs" data-n="${s.id}"><summary>📜 نص السورة (${nA(s.verses)} آية)</summary><div class="vtext"><span class="tag">جارٍ التحميل…</span></div></details></div></details>`;
  if (sections) {
    const count = {}; for (let j = 1; j <= 30; j++) juzSurahs(j).forEach((s) => { count[s.id] = (count[s.id] || 0) + 1; });
    $('sgrid').innerHTML = Array.from({ length: 30 }, (_, k) => k + 1).map((j) => {
      // surahs in reading order, four to a row; a short row is stretched to its end: the extra columns go to the surahs that continue into another juz (else to the last one)
      const list = juzSurahs(j), pos = {}, five = true, nCols = 6;              // every juz: same-width boxes, six per row
      list.forEach((s, k) => { pos[s.id] = [k % nCols + 1, 1, Math.floor(k / nCols) + 1]; });
      return `<div class="jsec${j % 5 === 0 && j < 30 ? ' jbig' : ''}${five ? ' j6' : ''}"${five ? ` style="--n:${nCols}"` : ''}><span class="jnum" title="الجزء ${nA(j)}">${nA(j)}</span><div class="jgrid">${list.map((s) => card(s, count[s.id] > 1, `--c:${pos[s.id][0]};--s:${pos[s.id][1]};--r:${pos[s.id][2]}`)).join('')}</div></div>`;
    }).join('');
    return;
  }
  const ord = prefs && SORDER[prefs.sorder] && surahs[0].words ? SORDER[prefs.sorder] : null;
  $('sgrid').innerHTML = (ord ? surahs.slice().sort(ord) : surahs).filter((s) => !q || s.ar.replace(/[إأآٱ]/g, 'ا').includes(q) || String(s.id) === q || s.en.toLowerCase().includes(q.toLowerCase())).map((s) => card(s, false) + (!q && !ord && s.id % 24 === 0 && s.id < 114 ? '<div class="jgap s20"></div>' : '')).join('')
    || '<p class="hint">لا توجد نتائج.</p>';
}
async function loadSurahs() {
  if (surahs) return;
  $('sgrid').innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  try { surahs = await (await fetch('/api/surahs')).json(); if (!Array.isArray(surahs)) throw 0;
    try { const st = await (await fetch('/stats.json')).json(); st.surahs.forEach((x) => Object.assign(surahs[x.id - 1], { words: x.words, letters: x.letters })); } catch { /* the mushaf order needs no sizes */ }
    renderSurahs(); }
  catch { surahs = null; $('sgrid').innerHTML = '<p class="hint">تعذّر تحميل قائمة السور.</p>'; }
}
$('sJuz').onclick = (e) => { juzOn = !juzOn; $('sLegend').hidden = !juzOn; e.currentTarget.setAttribute('aria-pressed', juzOn); if (surahs) renderSurahs(); };
$('ssearch').oninput = () => surahs && renderSurahs();
/* ---------- search boxes on the surahs screen: a surah by name, a text in the Quran, a subject in the Quran ---------- */
const qNorm = (t) => String(t).replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, ' ').trim();
let qText = null;
const qShow = (title, html) => { const b = $('qres'); b.innerHTML = `<div class="qh"><span>${title}</span><button type="button" class="qx">✕ إغلاق</button></div>${html}`; b.hidden = false; };
$('qres').addEventListener('click', (e) => { if (e.target.closest('.qx')) $('qres').hidden = true; });
const surahName = (n) => (surahs && surahs[n - 1] ? surahs[n - 1].ar : String(n));
async function searchText(q) {
  const words = qNorm(q).split(' ').filter((w) => w.length > 1);
  if (!words.length) return;
  qShow('جارٍ البحث…', '');
  try { if (!qText) qText = await (await fetch('/quran_text.json')).json(); } catch { qShow('تعذّر تحميل نص القرآن.', ''); return; }
  if (!surahs) try { surahs = await (await fetch('/api/surahs')).json(); } catch { /* names fall back to numbers */ }
  const hits = Object.entries(qText).filter(([, t]) => { const n = qNorm(t); return words.every((w) => n.includes(w)); })
    .sort(([a], [b]) => { const [s1, a1] = a.split(':').map(Number), [s2, a2] = b.split(':').map(Number); return s1 - s2 || a1 - a2; });
  const re = new RegExp('(' + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  const rows = hits.slice(0, 200).map(([k, t]) => { const [sn, an] = k.split(':'); return `<div class="qr"><span class="tag">سورة ${esc(surahName(+sn))} — الآية ${nA(an)}:</span>${esc(qNorm(t)).replace(re, '<mark>$1</mark>')} <a class="qt" href="https://quran.com/${sn}/${an}" target="_blank" rel="noopener noreferrer">↗</a></div>`; });
  qShow(`نتائج البحث عن «${esc(q)}» في نص القرآن: ${nA(hits.length)} آية${hits.length > 200 ? ' (تظهر أول ٢٠٠)' : ''}`, rows.join('') || '<div class="qr">لا توجد آية تحتوي على هذه الكلمات.</div>');
}
const TOPIC_PAGES = () => [...Object.keys(TOPICS).filter((k) => VIEWS.includes(k) && k !== 'jannah2' && k !== 'others').map((k) => [k, TOPICS[k].items]), ['others', TOPICS.others ? TOPICS.others.items : []], ['miracles', MIRACLES]];
const pageName = (v) => { const b = document.querySelector(`#v-home .tile[href="#${v}"] b`); return b ? b.textContent : v; };
function searchTopic(q) {
  const words = qNorm(q).split(' ').filter((w) => w.length > 1);
  if (!words.length) return;
  const hits = [];
  for (const [page, items] of TOPIC_PAGES()) for (const m of items) {
    const tt = qNorm(m.t), nn = qNorm(m.note || '');
    if (words.every((w) => tt.includes(w) || nn.includes(w))) hits.push({ page, t: m.t, note: m.note || '', score: words.filter((w) => tt.includes(w)).length });
  }
  hits.sort((a, b) => b.score - a.score);
  const rows = hits.slice(0, 100).map((h) => `<div class="qr"><a class="qt" href="#${h.page}" data-t="${esc(h.t)}">${esc(h.t)}</a> <small>— ${esc(pageName(h.page))}</small><br><small>${esc(h.note.slice(0, 160))}${h.note.length > 160 ? '…' : ''}</small></div>`);
  qShow(`نتائج البحث عن الموضوع «${esc(q)}»: ${nA(hits.length)}`, rows.join('') || '<div class="qr">لا توجد نتائج في موضوعات الموقع؛ جرّب البحث في نص القرآن.</div>');
}
/* a subject result opens its page and the matching box */
$('qres').addEventListener('click', async (e) => {
  const a = e.target.closest('a.qt[data-t]'); if (!a) return;
  e.preventDefault(); const page = a.getAttribute('href').slice(1), t = a.dataset.t;
  location.hash = '#' + page;
  for (let i = 0; i < 40; i++) {
    const d = [...document.querySelectorAll(`#v-${page} .lesson`)].find((x) => x.querySelector('summary').textContent.startsWith(t));
    if (d) { d.open = true; d.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    await new Promise((res) => setTimeout(res, 150));
  }
});
$('qtext').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchText(e.target.value); });
$('qtopic').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchTopic(e.target.value); });
/* the magnifying-glass button at the end of each box runs that box's search */
document.querySelectorAll('#v-surahs .sfield .gbtn').forEach((b) => b.addEventListener('click', () => {
  const f = b.closest('.sfield'), inp = f.querySelector('input'), kind = f.dataset.g;
  if (kind === 'surah') { if (surahs) renderSurahs(); else loadSurahs(); }
  else if (kind === 'text') searchText(inp.value);
  else searchTopic(inp.value);
  inp.focus();
}));

/* one button: opens every surah's details, or folds them all when they are all open */
const sAllOpen = () => { const c = [...document.querySelectorAll('#sgrid .sr')]; return c.length > 0 && c.every((d) => d.open); };
const sLabel = () => { $('sToggle').innerHTML = sAllOpen() ? '<span class="tri" aria-hidden="true">▲</span> طيّ تفاصيل السور' : '<span class="tri" aria-hidden="true">▼</span> فتح تفاصيل السور'; };
$('sToggle').onclick = () => {
  if (sAllOpen()) document.querySelectorAll('#sgrid .sr').forEach((d) => { d.open = false; (d._p || d).querySelectorAll('.vs').forEach((v) => (v.open = false)); });
  else document.querySelectorAll('#sgrid .sr').forEach((d) => (d.open = true));
  sLabel();
};
$('sgrid').addEventListener('toggle', (e) => { if (e.target.classList.contains('sr')) sLabel(); }, true);
/* an opened surah stays in its place (highlighted); its contents open as a full-width panel under its row, like the topic pages */
{
  const place = (d) => { const top = d.offsetTop; let last = d; for (let n = d.nextElementSibling; n; n = n.nextElementSibling) if (n.classList.contains('sr') && n.offsetTop === top) last = n; last.after(d._p); };
  $('sgrid').addEventListener('toggle', (e) => {
    const d = e.target; if (!d.classList || !d.classList.contains('sr')) return;
    if (!d._p) { d._p = document.createElement('div'); d._p.className = 'srp'; d._p.dataset.n = d.dataset.n; [...d.children].slice(1).forEach((c) => d._p.append(c)); }
    if (d.open) place(d); else d._p.remove();
  }, true);
  addEventListener('resize', () => document.querySelectorAll('#sgrid .sr[open]').forEach((d) => d._p && place(d)));
}
sLabel();
$('sgrid').addEventListener('toggle', async (e) => {
  const d = e.target; if (!d.classList.contains('vs') || !d.open || d.dataset.done) return; d.dataset.done = 1;
  const n = +d.dataset.n, box = d.querySelector('.vtext');
  try {
    const vs = await (await fetch('/api/verses?s=' + n)).json(); if (!Array.isArray(vs)) throw 0;
    box.innerHTML = (n === 1 || n === 9 ? '' : '<span class="bm">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</span>') +
      vs.map((v) => `<span class="ay" data-n="${v.n}" data-ak="${n}:${v.n}">${esc(v.text.trim())} <span class="no">﴿${nA(v.n)}﴾</span></span>`).join(' ');
  } catch { delete d.dataset.done; box.innerHTML = '<span class="tag">تعذّر تحميل نص السورة.</span>'; }
}, true);
/* verse timing from mp3quran.net (exact start/end of every verse in the full-surah recording) */
let timingMap = null; const timingCache = {};
async function surahTiming(rec, n) {
  try {
    if (!timingMap) timingMap = await (await fetch('/timing.json')).json();
    const t = timingMap[rec.id]; if (!t) return null;
    const k = t.read + ':' + n; if (k in timingCache) return timingCache[k];
    const j = await (await fetch(`https://www.mp3quran.net/api/v3/ayat_timing?surah=${n}&read=${t.read}`)).json();
    return (timingCache[k] = Array.isArray(j) && j.length ? j.filter((x) => x.ayah >= 1).map((x) => ({ n: x.ayah, s: x.start_time, e: x.end_time })) : null);
  } catch { return null; }
}
/* colour the verse being recited amber, and keep it in view */
function setCurAyah(box, n) {
  const prev = box.querySelector('.ay.cur'); if (prev && +prev.dataset.n === n) return;
  if (prev) prev.classList.remove('cur');
  if (!n) return;
  const el = box.querySelector(`.ay[data-n="${n}"]`); if (!el) return;
  el.classList.add('cur');
  const r = el.getBoundingClientRect();
  if (r.top < 90 || r.bottom > innerHeight - 90) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
let sPlay = 0;
$('sgrid').addEventListener('change', async (e) => {
  const sel = e.target.closest('select'); if (!sel) return;
  const box = sel.closest('.sr, .srp'), au = box.querySelector('audio'), msg = box.querySelector('.msg'), n = +box.dataset.n, my = ++sPlay;
  document.querySelectorAll('#sgrid audio').forEach((x) => { if (x !== au) x.pause(); });
  au.ontimeupdate = au.onended = null; au.pause(); setCurAyah(box, 0);
  const rec = reciters.find((r) => r.id === sel.value);
  if (!rec) { au.hidden = true; msg.textContent = ''; return; }
  const vs = box.querySelector('.vs'); vs.open = true;            // show the text so the verse being read can be coloured
  const url = surahAudio(rec, n), folder = everyFolder(rec);
  const timing = url ? await surahTiming(rec, n) : null;
  if (my !== sPlay) return;
  const unavailable = () => { au.hidden = true; msg.textContent = 'لا يتوفر تسجيل لهذه السورة بصوت هذا القارئ.'; };
  au.onerror = unavailable;
  if (url && timing) {                                              // exact timings: one file, colour follows the playhead
    msg.textContent = ''; au.hidden = false; au.src = url;
    au.ontimeupdate = () => { const t = au.currentTime * 1000, a = timing.find((x) => t >= x.s && t < x.e); setCurAyah(box, a ? a.n : 0); };
    au.onended = () => setCurAyah(box, 0); return;   // paused: it starts with the play button
  }
  if (folder) {                                                     // verse-by-verse recordings: play them in order
    const total = (surahs.find((x) => x.id === n) || {}).verses || 0; let a = 1;
    const next = (play = true) => { if (my !== sPlay) return; if (a > total) { setCurAyah(box, 0); return; } setCurAyah(box, a); au.src = ayahUrl(folder, n, a); if (play) au.play().catch(() => {}); };
    au.onended = () => { a++; next(); };
    au.onerror = () => { msg.textContent = 'تعذّر تحميل صوت الآية ' + nA(a) + '.'; };
    msg.textContent = 'يُشغَّل هذا القارئ آيةً آيةً.'; au.hidden = false; next(false); return;   // the first verse waits for the play button; the next ones follow on their own
  }
  if (url) { msg.textContent = 'تلوين الآية تلقائياً غير متاح لهذا القارئ.'; au.hidden = false; au.src = url; return; }   // paused: it starts with the play button
  unavailable();
});
