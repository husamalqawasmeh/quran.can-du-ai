


const $ = (id) => document.getElementById(id);
const nA = (n) => Number(n).toLocaleString('ar-EG');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const arName = (x) => (x.name_ar || x.name).replace(/^شيخ\s+/, '');

/* ---------- التنقل ---------- */
const VIEWS = ['jannah2', 'names', 'qiyamah', 'hafiz', 'jews', 'jesus', 'prophets', 'others', 'duasp', 'duasb', 'numbers', 'animals', 'jannah', 'management', 'stats', 'home', 'identify', 'readers', 'surahs', 'whisper', 'memorize', 'learn', 'about', 'miracles'];
let leaveHooks = [];
/* title row on every inner screen: heading + description, with the green back button */
document.querySelectorAll('.view:not(#v-home)').forEach((v) => {
  const t = v.querySelector(':scope > h1, :scope > h2'); if (!t) return;
  const d = t.nextElementSibling && t.nextElementSibling.matches('p.sub, p.hint') ? t.nextElementSibling : null;
  const head = document.createElement('div'), box = document.createElement('div');
  head.className = 'vhead'; box.className = 'vtitle';
  t.before(head); box.append(t); if (d) box.append(d); head.append(box);
  head.insertAdjacentHTML('beforeend', '<a class="back" href="#home"><span class="tri" aria-hidden="true">▶</span> الرجوع إلى القائمة الرئيسية</a>');
});
/* surahs screen: its two buttons sit next to the back button */
{ const back = document.querySelector('#v-surahs .vhead .back'), wrap = document.createElement('div');
  wrap.className = 'vactions'; back.replaceWith(wrap); wrap.append(back, $('sToggle'), $('sJuz'));
  wrap.closest('.vhead').insertAdjacentHTML('afterend', '<div class="slegend" id="sLegend" hidden><span><i class="sw share"></i>سورة تبدأ في جزء وتنتهي في الجزء الذي يليه</span><span><i class="sw one"></i>سورة تبدأ وتنتهي في الجزء نفسه</span></div>'); }
/* expand all / collapse all, under the back button, on the pages made of expandable cards */
['miracles', 'qiyamah', 'hafiz', 'jannah', 'jannah2', 'animals', 'management', 'jesus', 'jews', 'prophets', 'others', 'duasp', 'duasb', 'numbers', 'learn', 'stats', 'names'].forEach((v) => {
  const view = document.getElementById('v-' + v), head = view && view.querySelector('.vhead'), back = head && head.querySelector('.back');
  if (!back) return;
  const wrap = document.createElement('div'); wrap.className = 'vactions'; back.replaceWith(wrap); wrap.append(back);
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'back'; wrap.append(btn);
  const cards = () => [...view.querySelectorAll('.lesson')];
  const allOpen = () => { const c = cards(); return c.length > 0 && c.every((x) => x.open); };
  const label = () => { btn.innerHTML = allOpen() ? '<span class="tri" aria-hidden="true">▲</span> طيّ الكل' : '<span class="tri" aria-hidden="true">▼</span> فتح الكل'; };
  let token = 0;
  btn.onclick = () => {
    const c = cards(); if (!c.length) return;
    const my = ++token;
    if (allOpen()) { c.forEach((x) => (x.open = false)); label(); return; }
    const todo = c.filter((x) => !x.open); let i = 0;
    const step = () => { if (my !== token) return; todo.slice(i, i + 4).forEach((x) => (x.open = true)); i += 4; if (i < todo.length) setTimeout(step, 250); };   // a few at a time: each opening loads its verses
    step();
  };
  view.addEventListener('toggle', label, true); label();
});
function route() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  leaveHooks.splice(0).forEach((f) => f());
  for (const n of VIEWS) $('v-' + n).hidden = n !== v;
  if (v === 'surahs') loadSurahs();
  if (v === 'memorize') initMemorize();
  if (v === 'learn') initLearn();
  if (v === 'miracles') initMiracles();
  if (v === 'stats') initStats();
  if (TOPICS[v]) initTopic(v);
  window.scrollTo(0, 0);
}
addEventListener('hashchange', route);

/* ---------- صوت ---------- */
async function toPcm(arrayBuf) {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const buf = await ac.decodeAudioData(arrayBuf); ac.close();
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * SR), SR);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  return (await off.startRendering()).getChannelData(0);
}
function wav16(pcm) {
  const n = Math.min(pcm.length, SR * 25), b = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, SR, true); b.setUint32(28, SR * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) b.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
  return b.buffer;
}
async function recordChunk(stream, ms) {
  const rec = new MediaRecorder(stream), chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start(); await new Promise((r) => setTimeout(r, ms)); rec.stop(); await done;
  return toPcm(await new Blob(chunks).arrayBuffer());
}
const micStream = () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
const micError = (e) => (e.name === 'NotAllowedError' || e.name === 'SecurityError'
  ? 'الميكروفون غير مسموح. اضغط على أيقونة القفل 🔒 (أو إعدادات الموقع) بجانب عنوان الموقع، واختر «الميكروفون» ثم «السماح»، وأعد تحميل الصفحة ثم اضغط «تشغيل» من جديد.'
  : e.name === 'NotFoundError' ? 'لم يُعثر على ميكروفون في هذا الجهاز. وصّل ميكروفوناً ثم حاول مرة أخرى.'
  : e.name === 'NotReadableError' ? 'الميكروفون مشغول بتطبيق آخر. أغلق التطبيق الآخر ثم حاول مرة أخرى.'
  : 'حدث خطأ: ' + e.message);

/* ---------- القرّاء والمفضلة ---------- */
let reciters = [];
const links = (x) => (x.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${l.kind === 'audio' ? '🎧' : l.kind === 'video' ? '▶️' : '🎵'} ${esc(l.label)}</a>`).join('');
let favs = new Set();
try { favs = new Set(JSON.parse(localStorage.getItem('qr_favs') || '[]')); } catch {}
const saveFavs = () => { try { localStorage.setItem('qr_favs', JSON.stringify([...favs])); } catch {} $('favn').textContent = nA(favs.size); };
let favOnly = false;
function renderList() {
  const shown = reciters.map((x, i) => [x, i]).filter(([x]) => !favOnly || favs.has(x.id));
  const cols = [];
  for (let c = 0; c < 5; c++) {
    const items = shown.filter(([, i]) => Math.floor(i / 20) === c);
    if (!items.length) continue;
    cols.push('<ol class="col">' + items.map(([x, i]) => `<li class="rd${favs.has(x.id) ? ' fav' : ''}"><span class="n">${nA(i + 1)}</span><details><summary><span class="nm">${esc(arName(x))}</span></summary><div class="lk">${links(x)}</div></details><button class="heart${favs.has(x.id) ? ' on' : ''}" data-id="${esc(x.id)}" aria-label="المفضلة: ${esc(arName(x))}" aria-pressed="${favs.has(x.id)}">${favs.has(x.id) ? '♥' : '♡'}</button></li>`).join('') + '</ol>');
  }
  $('cols').innerHTML = cols.join('') || '<p class="hint">لا توجد مفضلة بعد — اضغط ♡ بجانب القارئ.</p>';
}
$('cols').onclick = (e) => {
  const b = e.target.closest('.heart'); if (!b) return;
  favs.has(b.dataset.id) ? favs.delete(b.dataset.id) : favs.add(b.dataset.id);
  saveFavs(); renderList(); fillSurahReaders(); if (mInit) fillEveryReader($('mReader')); if (lInit) fillEveryReader($('lReader'));
};
$('favonly').onclick = () => { favOnly = !favOnly; $('favonly').classList.toggle('on', favOnly); $('favonly').setAttribute('aria-pressed', favOnly); renderList(); };
saveFavs();
fetch('/api/reciters').then((r) => r.json()).then((r) => {
  reciters = r.sort((a, b) => arName(a).localeCompare(arName(b), 'ar'));
  $('cnt').textContent = '(' + nA(r.length) + ')';
  renderList(); fillSurahReaders();
}).catch(() => {});

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
function fillSurahReaders() { document.querySelectorAll('.sr select').forEach((s) => { const v = s.value; s.innerHTML = readerOptions(); s.value = v; }); }
const JUZ_START = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,2],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
const juzOf = (id) => JUZ_START.filter(([s, a]) => s < id || (s === id && a === 1)).length;   // the juz in which the surah begins
let juzOn = false;
// juz sections: a surah is listed in EVERY juz it touches (it touches juz j if it ends after the juz starts and begins before the next juz starts)
const cmpKey = (s, a, s2, a2) => (s - s2) || (a - a2);
const juzSurahs = (j) => { const st = JUZ_START[j - 1], nx = JUZ_START[j]; return surahs.filter((s) => cmpKey(s.id, s.verses, st[0], st[1]) >= 0 && (!nx || cmpKey(s.id, 1, nx[0], nx[1]) < 0)); };
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
  $('sgrid').innerHTML = surahs.filter((s) => !q || s.ar.replace(/[إأآٱ]/g, 'ا').includes(q) || String(s.id) === q || s.en.toLowerCase().includes(q.toLowerCase())).map((s) => card(s, false) + (!q && s.id % 24 === 0 && s.id < 114 ? '<div class="jgap s20"></div>' : '')).join('')
    || '<p class="hint">لا توجد نتائج.</p>';
}
async function loadSurahs() {
  if (surahs) return;
  $('sgrid').innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  try { surahs = await (await fetch('/api/surahs')).json(); if (!Array.isArray(surahs)) throw 0; renderSurahs(); }
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
  if (sAllOpen()) document.querySelectorAll('#sgrid .sr').forEach((d) => { d.open = false; d.querySelectorAll('.vs').forEach((v) => (v.open = false)); });
  else document.querySelectorAll('#sgrid .sr').forEach((d) => (d.open = true));
  sLabel();
};
$('sgrid').addEventListener('toggle', (e) => { if (e.target.classList.contains('sr')) sLabel(); }, true);
sLabel();
$('sgrid').addEventListener('toggle', async (e) => {
  const d = e.target; if (!d.classList.contains('vs') || !d.open || d.dataset.done) return; d.dataset.done = 1;
  const n = +d.dataset.n, box = d.querySelector('.vtext');
  try {
    const vs = await (await fetch('/api/verses?s=' + n)).json(); if (!Array.isArray(vs)) throw 0;
    box.innerHTML = (n === 1 || n === 9 ? '' : '<span class="bm">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</span>') +
      vs.map((v) => `<span class="ay" data-n="${v.n}">${esc(v.text.trim())} <span class="no">﴿${nA(v.n)}﴾</span></span>`).join(' ');
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
  const box = sel.closest('.sr'), au = box.querySelector('audio'), msg = box.querySelector('.msg'), n = +box.dataset.n, my = ++sPlay;
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
    au.onended = () => setCurAyah(box, 0); au.play().catch(() => {}); return;
  }
  if (folder) {                                                     // verse-by-verse recordings: play them in order
    const total = (surahs.find((x) => x.id === n) || {}).verses || 0; let a = 1;
    const next = () => { if (my !== sPlay) return; if (a > total) { setCurAyah(box, 0); return; } setCurAyah(box, a); au.src = ayahUrl(folder, n, a); au.play().catch(() => {}); };
    au.onended = () => { a++; next(); };
    au.onerror = () => { msg.textContent = 'تعذّر تحميل صوت الآية ' + nA(a) + '.'; };
    msg.textContent = 'يُشغَّل هذا القارئ آيةً آيةً.'; au.hidden = false; next(); return;
  }
  if (url) { msg.textContent = 'تلوين الآية تلقائياً غير متاح لهذا القارئ.'; au.hidden = false; au.src = url; au.play().catch(() => {}); return; }
  unavailable();
});

/* ---------- التعرّف على القارئ ---------- */
const btn = $('btn'), st = $('st'), out = $('out'), LISTEN_MS = 20000;
function box(html) { const d = document.createElement('div'); d.className = 'aib'; d.innerHTML = html; $('ai').appendChild(d); return d; }
function showVerse(el, v, tagText) {
  el.insertAdjacentHTML('beforeend', `<div class="vt">${esc(v.text)}</div><div>سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)} <span class="tag">[${esc(v.key)}]</span></div>${tagText ? `<div class="tag">${esc(tagText)}</div>` : ''}`);
}
async function aiExtras(pcm, top, confident) {
  $('ai').innerHTML = '';
  const vb = box('<h3>الآية المسموعة</h3><span class="tag">جارٍ الاستماع إلى الكلمات…</span>');
  fetch('/api/verse', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wav16(pcm) }).then((r) => r.json()).then((d) => {
    vb.innerHTML = '<h3>الآية المسموعة</h3>';
    if (d.verse) showVerse(vb, d.verse, `مطابقة من التعرّف على الكلام (توافق ${nA(d.verse.match)}٪ من الكلمات) وقد لا تكون دقيقة.`);
    else vb.insertAdjacentHTML('beforeend', '<span class="tag">تعذّرت مطابقة الكلمات مع آية بثقة كافية.</span>');
  }).catch(() => (vb.innerHTML = '<h3>الآية المسموعة</h3><span class="tag">ميزة تحديد الآية غير متاحة حالياً.</span>'));
  if (!confident) return;
  const bb = box('<h3>نبذة عن القارئ</h3><span class="tag">جارٍ التحميل…</span>');
  fetch('/api/bio?id=' + encodeURIComponent(top.id)).then((r) => r.json()).then((d) => {
    bb.innerHTML = '<h3>نبذة عن القارئ</h3>'; const p = document.createElement('div'); p.textContent = d.bio || 'لا توجد معلومات متاحة.'; bb.appendChild(p);
    if (d.bio) bb.insertAdjacentHTML('beforeend', '<div class="tag">نبذة مكتوبة بالذكاء الاصطناعي — قد تحتوي أخطاء.</div>');
  }).catch(() => bb.remove());
  const ab = box('<h3>اسأل عن هذا القارئ</h3><form><input maxlength="300" placeholder="مثال: من أين هو؟ وما أسلوبه في التلاوة؟" aria-label="السؤال"><button>اسأل</button></form><div class="ans"></div>');
  ab.querySelector('form').onsubmit = async (e) => {
    e.preventDefault(); const q = ab.querySelector('input').value.trim(), o = ab.querySelector('.ans'); if (q.length < 3) return;
    o.textContent = 'جارٍ التفكير…';
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: top.id, question: q }) });
      const d = await r.json();
      o.textContent = d.answer || (r.status === 429 ? d.error : 'تعذّرت الإجابة الآن.');
      if (d.answer) o.insertAdjacentHTML('beforeend', '<div class="tag">إجابة بالذكاء الاصطناعي — قد تحتوي أخطاء.</div>');
    } catch { o.textContent = 'الذكاء الاصطناعي غير متاح حالياً.'; }
  };
}
function askFeedback(results, vectors) {
  const fb = $('fb'), top = results[0];
  const send = async (is_correct, actual_id, actual_name) => {
    fb.textContent = 'شكراً على ملاحظاتك!';
    try { await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ predicted_id: top.id, confidence: top.confidence, is_correct, actual_id, actual_name, vectors }) }); }
    catch { fb.textContent = 'تعذّر حفظ الملاحظات.'; }
  };
  fb.innerHTML = 'اختياري: هل النتيجة صحيحة؟ <button class="btn" id="yes">👍 نعم</button><button class="btn" id="no">👎 لا</button>';
  $('yes').onclick = () => send(true);
  $('no').onclick = () => {
    fb.innerHTML = '<div>من كان القارئ؟ اختر من القائمة أو اكتب اسمه (حتى لو لم يكن بين القرّاء المائة):</div>' +
      '<div style="margin-top:8px"><select id="who"><option value="">اختر من القائمة…</option>' + reciters.map((r) => `<option value="${esc(r.id)}">${esc(arName(r))}</option>`).join('') + '</select></div>' +
      '<div style="margin-top:8px"><input id="whoName" class="inp" maxlength="80" placeholder="اسم القارئ الصحيح (اختياري)" aria-label="اسم القارئ الصحيح" style="width:100%;max-width:360px"></div>' +
      '<div style="margin-top:8px"><button class="btn pri" id="go">إرسال</button></div>';
    $('go').onclick = () => send(false, $('who').value || null, $('whoName').value.trim() || null);
  };
}
async function identify(pcm) {
  st.textContent = 'جارٍ تحليل الصوت…';
  let d, r, vectors;
  try {                                                  // neural model (runs in the browser), scored on the server
    const embs = await embed(pcm);
    if (embs.length) { r = await fetch('/api/identify2', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ emb: embs }) }); if (r.ok) { d = await r.json(); vectors = embs; } }
  } catch (e) { console.warn('neural model unavailable, using fallback', e); }
  if (!d) {                                              // fallback: the earlier statistical method
    vectors = voiceprints(pcm, 5);
    if (!vectors.length) { st.textContent = 'لم يُسمع كلام كافٍ. حاول مرة أخرى وأنت أقرب إلى مصدر الصوت.'; return; }
    try { r = await fetch('/api/identify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vectors }) }); d = await r.json(); }
    catch { st.textContent = 'تعذّر الاتصال بالخادم.'; return; }
    if (!r.ok) { st.textContent = 'حدث خطأ أثناء التحليل.'; return; }
  }
  st.textContent = '';
  askFeedback(d.results, vectors);
  const top = d.results[0], low = top.confidence < 0.8;
  aiExtras(pcm, top, !low);
  const pct = (x) => nA(Math.round(x * 100)) + '٪';
  const warn = low ? '<div class="card warn"><b>لست متأكداً.</b> لم أستطع تحديد هذا القارئ بثقة كافية (أقل من ٨٠٪). قد يكون التخمين أدناه خاطئاً — جرّب مرة أخرى بالقرب من مصدر الصوت وبضجيج أقل ولمدة أطول.</div>' : '';
  const line = (x) => `<div class="row">${esc(arName(x))} — ${pct(x.confidence)}<div class="bar"><i style="width:${x.confidence * 100}%"></i></div></div>`;
  out.innerHTML = warn + (low
    ? '<div class="row" style="color:var(--mut);margin-top:14px">أقرب النتائج:</div>' + d.results.map(line).join('')
    : `<div class="card"><div class="top">${esc(arName(top))}</div><div class="row">نسبة الثقة ${pct(top.confidence)}<div class="bar"><i style="width:${top.confidence * 100}%"></i></div></div><div class="lk">استمع لهذا القارئ:<br>${links(top)}</div></div>` + d.results.slice(1).map(line).join(''));
}
const reset = () => { out.innerHTML = ''; $('ai').innerHTML = ''; $('fb').innerHTML = ''; };
btn.onclick = async () => {
  reset(); btn.disabled = true;
  try {
    const stream = await micStream();
    btn.classList.add('rec'); btn.textContent = 'أستمع…';
    let left = LISTEN_MS / 1000; st.textContent = `أستمع… ${nA(left)} ث`;
    const t = setInterval(() => (st.textContent = `أستمع… ${nA(--left)} ث`), 1000);
    const pcm = await recordChunk(stream, LISTEN_MS);
    clearInterval(t); stream.getTracks().forEach((x) => x.stop());
    await identify(pcm);
  } catch (e) { st.textContent = micError(e); }
  btn.classList.remove('rec'); btn.textContent = 'استمع'; btn.disabled = false;
};
$('file').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return; reset();
  try { await identify(await toPcm(await f.arrayBuffer())); } catch { st.textContent = 'تعذّرت قراءة الملف الصوتي.'; }
};

/* ---------- Whisper: المستشار الهامس المباشر ---------- */
const wbtn = $('wbtn'), wst = $('wst'), wlive = $('wlive'), whist = $('whist'), wring = $('wring'), wlvl = $('wlvl'), wlvlbox = $('wlvlbox');
const TICK_MS = 3000, FIRST_TICK_MS = 2500, WIN_S = 8, SESSION_MS = 20 * 60 * 1000, RL = 16000 * 14;
const KIND = { answer: 'يجيب عن سؤال سمعتُه', match: 'يطابق ما قلتَه', next: 'يُثري ما سيأتي', reflect: 'تذكرة تناسب المقام', revise: 'تصحيح للاقتراح السابق', extend: 'يُكمل الآية نفسها' };
const WORKLET = `class P extends AudioWorkletProcessor{constructor(){super();this.b=[];this.n=0}process(i){const c=i[0]&&i[0][0];if(c){this.b.push(c.slice(0));this.n+=c.length;if(this.n>=2048){const o=new Float32Array(this.n);let p=0;for(const x of this.b){o.set(x,p);p+=x.length}this.port.postMessage(o,[o.buffer]);this.b=[];this.n=0}}return true}}registerProcessor('cap',P)`;
let W = null;                                            // the running session, or null when OFF
function pushSamples(S, chunk) {                         // mono @ device rate -> 16 kHz ring buffer (box-filter downsample)
  const r = S.ratio;
  for (let i = 0; i < chunk.length; i++) {
    S.acc += chunk[i]; S.cnt++; S.phase += 1;
    if (S.phase >= r) { S.phase -= r; S.ring[S.wp % RL] = S.acc / S.cnt; S.wp++; S.acc = 0; S.cnt = 0; }
  }
}
function lastSeconds(S, secs) {
  const n = Math.min(S.wp, Math.round(secs * 16000)), out = new Float32Array(n);
  for (let k = 0; k < n; k++) out[k] = S.ring[(S.wp - n + k) % RL];
  return out;
}
function blockRms(S, secs) {                             // RMS of every 0.25 s block in the last `secs`
  const n = Math.min(S.wp, Math.round(secs * 16000)), bs = 4000, out = [];
  for (let s = 0; s + bs <= n; s += bs) { let e = 0; for (let k = 0; k < bs; k += 4) { const v = S.ring[(S.wp - n + s + k) % RL]; e += v * v; } out.push(Math.sqrt(e / (bs / 4))); }
  return out;
}
function boost(win) {                                    // bring quiet speech up before it is sent for transcription
  let pk = 0; for (let i = 0; i < win.length; i += 2) pk = Math.max(pk, Math.abs(win[i]));
  const g = pk > 1e-4 ? Math.min(40, 0.8 / pk) : 1; if (g <= 1.05) return win;
  const o = new Float32Array(win.length); for (let i = 0; i < win.length; i++) o[i] = win[i] * g; return o;
}
const refHTML = (s) => `سورة ${esc(s.surah_ar)} — الآية ${nA(s.ayah)} <span class="tag">[${esc(s.key)}]</span> · ${nA(s.confidence)}٪`;
function showSuggestion(S, s) {
  const old = S.lastS;
  if (old && old.key !== s.key) {                        // a different verse: the previous one moves into the history (growing the same verse just replaces it)
    if (!whist.firstChild) whist.innerHTML = '<div class="hh">اقتراحات سابقة</div>';
    whist.querySelector('.hh').insertAdjacentHTML('afterend', `<div class="hline"><div class="vt">${old.partial ? '… ' : ''}${esc(old.excerpt)}${old.partial ? ' …' : ''}</div><div class="ref">${refHTML(old)}</div></div>`);
    while (whist.querySelectorAll('.hline').length > 10) whist.querySelector('.hline:last-child').remove();
  }
  S.lastS = s;
  wlive.innerHTML = `<div class="card adv"><div class="advtop"><span class="badge">${esc(KIND[s.kind] || KIND.match)}</span><span class="why">${esc(s.why)}${s.votes === 2 ? ' · اتفق مستشاران' : s.votes > 2 ? ` · اتفق ${nA(s.votes)} مستشارين` : ''}</span></div>` +
    `<div class="arow"><div class="vt">${s.partial ? '… ' : ''}${esc(s.excerpt)}${s.partial ? ' …' : ''}</div><div class="ref">${refHTML(s)}</div></div></div>`;
}
async function wTick(S) {
  if (S !== W) return;
  const win = lastSeconds(S, WIN_S);
  if (win.length < 16000 * 2) return;
  // speech = a recent block clearly above the room's own noise floor (so it also works for quiet microphones)
  const recent = blockRms(S, 3), all = blockRms(S, 12).sort((a, b) => a - b);
  const floor = all.length ? all[Math.floor(all.length * 0.05)] : 0, loud = recent.length ? Math.max(...recent) : 0;   // 5th percentile: the pauses between words count as "floor"
  if (loud < Math.max(0.0008, floor * 1.8)) { if (!S.inflight) wst.textContent = 'أنتظر الكلام…'; return; }
  if (S.inflight >= 2) return;
  const n = ++S.tickNo; S.inflight++;
  const fd = new FormData();
  fd.append('audio', new Blob([wav16(boost(win))], { type: 'audio/wav' }), 'w.wav');
  fd.append('ctx', JSON.stringify({ history: S.history.slice(-3), recent: S.recent.slice(-8), prev: S.prev }));
  if (!S.history.length) wst.textContent = 'أستمع وأفكّر…';
  try {
    const r = await fetch('/api/advisor', { method: 'POST', body: fd, signal: S.ctrl.signal });
    const d = await r.json();
    if (S !== W) return;
    if (!r.ok) { if (r.status === 429) wStop(d.error); else wst.textContent = 'تعذّر التحليل الآن… سأحاول مجدداً.'; return; }
    if (d.transcript) { S.history.push(d.transcript); wst.textContent = 'سمعتُ: ' + d.transcript.slice(-100); }
    if (d.suggestion && n > S.shown) { S.shown = n; S.recent.push(d.suggestion.key); S.prev = d.suggestion.excerpt + ' [' + d.suggestion.key + ']'; showSuggestion(S, d.suggestion); }
  } catch { /* aborted or offline: the next tick tries again */ }
  finally { S.inflight--; }
}
async function wStart() {
  wbtn.disabled = true; wst.textContent = 'جارٍ تشغيل الميكروفون…';
  let stream, ac;
  try {
    // for live speech we WANT the browser's automatic gain and noise suppression (unlike voice identification)
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
    const S = { stream, ac, ring: new Float32Array(RL), wp: 0, ratio: ac.sampleRate / 16000, acc: 0, cnt: 0, phase: 0, inflight: 0, tickNo: 0, shown: 0, history: [], recent: [], prev: '', ctrl: new AbortController(), lastS: null };
    const mute = ac.createGain(); mute.gain.value = 0; mute.connect(ac.destination);           // muted: processing runs, nothing is played back
    const source = ac.createMediaStreamSource(stream); let node = null;
    if (ac.audioWorklet) {
      try {
        const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
        await ac.audioWorklet.addModule(url); URL.revokeObjectURL(url);
        node = new AudioWorkletNode(ac, 'cap'); node.port.onmessage = (e) => pushSamples(S, e.data);
      } catch { node = null; }
    }
    if (!node) { node = ac.createScriptProcessor(4096, 1, 1); node.onaudioprocess = (e) => pushSamples(S, e.inputBuffer.getChannelData(0)); }   // older browsers
    source.connect(node); node.connect(mute);
    W = S; wlive.innerHTML = ''; whist.innerHTML = '';
    wbtn.textContent = 'إيقاف'; wbtn.classList.add('rec'); wbtn.setAttribute('aria-pressed', 'true'); wbtn.disabled = false;
    wring.classList.add('cycle'); wlvlbox.hidden = false; wst.textContent = 'أستمع… تحدّث وسيظهر أول اقتراح بعد لحظات.';
    S.meter = setInterval(() => { const b = blockRms(S, 0.3); const v = b.length ? b[b.length - 1] : 0; wlvl.style.width = Math.min(100, Math.sqrt(v) * 420) + '%'; }, 150);
    S.first = setTimeout(() => { wTick(S); S.timer = setInterval(() => wTick(S), TICK_MS); }, FIRST_TICK_MS);
    S.end = setTimeout(() => wStop('انتهت الجلسة بعد ٢٠ دقيقة. اضغط «تشغيل» للمتابعة.'), SESSION_MS);
    leaveHooks.push(() => wStop());
  } catch (e) {
    if (stream) stream.getTracks().forEach((x) => x.stop()); if (ac) ac.close();
    wst.textContent = e && e.name ? micError(e) : 'تعذّر تشغيل التقاط الصوت في هذا المتصفح.'; wbtn.disabled = false;
  }
}
function wStop(msg) {
  const S = W; W = null;
  if (S) { clearInterval(S.timer); clearInterval(S.meter); clearTimeout(S.first); clearTimeout(S.end); S.ctrl.abort(); S.stream.getTracks().forEach((x) => x.stop()); S.ac.close().catch(() => {}); }
  wring.classList.remove('cycle'); wlvlbox.hidden = true; wlvl.style.width = '0'; wbtn.classList.remove('rec'); wbtn.setAttribute('aria-pressed', 'false'); wbtn.textContent = 'تشغيل'; wbtn.disabled = false;
  if (S) wst.textContent = msg || 'تم الإيقاف.';
}
wbtn.onclick = () => (W ? wStop() : wStart());

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

/* ---------- الإعجاز العلمي ---------- */
const MIRACLE_GROUPS = [
  { g: 'الإنسان والحياة', ic: '🧬' },
  { g: 'الفلك والكون', ic: '🔭' },
  { g: 'الأرض والجغرافيا', ic: '🌍' },
  { g: 'البحار والمياه والجو', ic: '🌊' },
  { g: 'الحيوان', ic: '🕷️' },
  { g: 'التاريخ والآثار', ic: '🏺' },
  { g: 'النبات والزراعة', ic: '🌿' },
  { g: 'التحدي والإعجاز البياني', ic: '🏛️' },
];
const MIRACLES = [
  { g: 0, t: 'مراحل خلق الإنسان', note: 'تصف الآيات تطور الخلق من نطفة فعلقة فمضغة فعظام يكسوها اللحم؛ ويرى المهتمون أن هذا التسلسل يوافق ما عُرف لاحقاً عن أطوار الجنين.', keys: ['23:12', '23:13', '23:14'] },
  { g: 0, t: 'أصل الحياة من الماء', note: 'يشير كثيرون إلى أن الماء عنصر أساسي في كل خلية حية، وإلى أن الحياة نشأت في الماء.', keys: ['21:30'] },
  { g: 0, t: 'الأزواج في الخلق', note: 'تذكر الآية أن الأزواج في النبات والإنسان وفيما لا يعلمه الناس؛ ويشير بعضهم إلى الأزواج في الذرة (الشحنات الموجبة والسالبة) والنبات.', keys: ['36:36'] },
  { g: 0, t: 'البنان (بصمة الأصابع)', note: 'يتأمل بعضهم في تخصيص «البنان» بالذكر إشارة إلى دقة تكوين الإنسان وتميّز بصمات الأصابع.', keys: ['75:3', '75:4'] },
  { g: 0, t: 'الجلد والإحساس بالألم', note: 'يرى بعضهم في الآية إشارة إلى أن مستقبلات الألم في الجلد هي موضع الإحساس بالألم.', keys: ['4:56'] },
  { g: 4, t: 'النحل والعسل', note: 'تذكر الآيات وحي الله إلى النحل وخروج شراب مختلف الألوان فيه شفاء للناس، ويتأمل فيها المهتمون بعلم الأحياء والطب.', keys: ['16:68', '16:69'] },
  { g: 0, t: 'تقليب أهل الكهف', note: 'يشير بعضهم إلى أن تقليب النائم مدةً طويلة يقي من تقرّحات الفراش وتلف الأنسجة، ويرون في قوله «نقلّبهم» حفظاً لأجسادهم. ويلاحظون أن التقليب ذُكر للفتية وحدهم، أما كلبهم فبقي على حاله «باسطٌ ذراعيه بالوصيد» (عتبة الكهف) من غير ذكر تقليب له. والمعنى الظاهر عند المفسرين بيان حفظ الله لهم في نومهم الطويل.', keys: ['18:18'] },
  { g: 0, t: 'قلبان في جوف الرجل', note: 'خصّت الآية «الرجل» بالذكر ولم تقل «الإنسان»؛ ويلاحظ بعضهم أن الرجل لا يكون في جوفه إلا قلب واحد، بخلاف المرأة الحامل التي يكون في جوفها قلبان: قلبها وقلب جنينها. والمعنى الظاهر عند المفسرين أن الله لم يجعل للرجل قلبين، ردّاً على من زعم ذلك وعلى عادات جاهلية كالتبنّي والظهار؛ ويرى آخرون أن «القلب» هنا مجاز لا يدخل في الإعجاز العلمي.', keys: ['33:4'] },
  { g: 1, t: 'الخُنَّس الجواري الكُنَّس', note: 'يرى بعض المعاصرين في الخنّس (التي تختفي) الجواري (التي تجري) الكنّس (التي تكنس وتبتلع ما حولها) إشارة إلى الثقوب السوداء. أما المفسرون القدامى فحملوها على الكواكب أو النجوم التي تختفي نهاراً وتجري وتغيب، وقيل غير ذلك؛ فهو اجتهاد محتمل لا قطعي.', keys: ['81:15', '81:16'] },
  { g: 1, t: 'الشمس تجري لمستقرّ لها', note: 'يرى بعضهم أن للشمس حركة في الفضاء نحو وجهة معينة وفي مدارها حول مركز المجرة. وفسّرها المفسرون القدامى بأن مستقرها نهاية أجلها أو موضع انتهاء سيرها يوم القيامة.', keys: ['36:38'] },
  { g: 4, t: 'قالت نملة', note: 'جمعت النملة في كلامها: نداءً لقومها، وأمراً بالاحتماء («ادخلوا مساكنكم»)، وسبب التحذير («لا يحطمنّكم»)، وإعذاراً لسليمان («وهم لا يشعرون»: أي لا يقصدون أذاكم لأنهم لا يرونكم). ويلاحظ بعضهم دقة الفعل «يحطمنّكم»: فالحَطْم في اللغة كسرُ الشيء اليابس الصلب وتفتيتُه إلى قطع (ومنه «الحُطام»)، لا سحقُ الجسم الرخو. وهذا يوافق ما يُعرف عن النمل من أن جسمه مغطى بهيكل خارجي صلب من الكيتين يشبه الدرع الهشّ، فإذا وقع عليه ثِقَل تحطّم وتشقّق كالزجاج الرقيق. كما يلاحظ المهتمون بعلم الحشرات أن النمل يتواصل بالإشارات الكيميائية (الفيرمونات) واللمس والاهتزازات لإنذار المستعمرة، وأن العاملات إناث، وفي تأنيث «قالت نملة» ما يوافق ذلك. والمعنى الظاهر عند المفسرين أن الله علّم سليمان عليه السلام منطق الطير والنمل، فسمع قولها حقيقةً فتبسّم ضاحكاً من قولها، وهي من معجزات سليمان عليه السلام.', keys: ['27:18', '27:19'] },
  { g: 4, t: 'وادي النمل', note: 'سمّت الآية الموضع «وادي النمل» لكثرة النمل فيه. ويلاحظ المهتمون بعلم الحشرات أن النمل يعيش في مستعمرات منظمة قد تمتد على مساحات واسعة، وأن بعض أنواعه يكوّن مستعمرات ضخمة تضمّ ملايين الأفراد، فيصحّ أن يُنسب وادٍ إليه. أما تحديد مكان هذا الوادي فقد اختلف فيه المفسرون (قيل في الشام وقيل في غيرها)، ولا يُجزم فيه بشيء.', keys: ['27:18'] },
  { g: 4, t: 'بيت العنكبوت', note: 'يتأمل بعضهم في «اتخذت» بصيغة المؤنث إشارةً إلى أن الأنثى هي التي تنسج البيت، وفي هشاشة بيت العنكبوت كمسكن وفي علاقات أفراده. والمعنى الظاهر مَثَلٌ لضعف من اتخذ من دون الله أولياء.', keys: ['29:41'] },
  { g: 5, t: 'هامان وزير فرعون', note: 'يذكر القرآن هامان بوصفه من خاصة فرعون ومن أهل البناء: يأمره فرعون أن يوقد على الطين (يحرق الطوب) ويبني له صرحاً. ويرى بعضهم أن في ذلك دقة تاريخية، لأن القرآن نزل قبل فكّ رموز الكتابة الهيروغليفية (عام ١٨٢٢م)، وقد ظنّ بعض المستشرقين قديماً أن اسم هامان مأخوذ من قصة أستير الفارسية، ثم ذكر آخرون أن اسماً قريباً من «هامان» ورد في نقش مصري بوصفه رئيس عمّال المحاجر والبناء (يُشار إلى لوحة في متحف فيينا). ويُنازع بعض علماء المصريات في قراءة هذا النقش وفي نسبته إلى هذا الاسم، فهو مما يُذكر ولا يُجزم به. والمعنى الظاهر عند المفسرين أن هامان وزير فرعون وعونه في طغيانه.', keys: ['28:6', '28:38', '40:36'] },
  { g: 5, t: 'نجاة بدن فرعون', note: 'تذكر الآية أن الله ينجّي بدن فرعون ليكون آيةً لمن بعده. ويرى بعضهم أن في ذلك إشارة إلى حفظ جثمانه، وأن جثماناً محنّطاً يُعرض اليوم في مصر؛ ويختلف الباحثون في تحديد صاحبه (رمسيس الثاني أو مرنبتاح أو غيرهما). والمعنى الظاهر عند المفسرين أن البحر ألقى جسده على الشاطئ ليراه الناس فيتيقنوا من هلاكه.', keys: ['10:92'] },
  { g: 1, t: 'الطارق (النجم الثاقب)', note: 'يرى بعضهم في «الطارق» (الذي يطرق) و«النجم الثاقب» إشارةً إلى النجوم النابضة (البلسارات)، وهي نجوم نيوترونية تدور بسرعة وتُصدر نبضات إشعاعية منتظمة كالطَّرْق، وتنفذ بإشعاعها عبر الفضاء. وفسّره المفسرون القدامى بأن الطارق ما يأتي ليلاً (من «طَرَقَ»: جاء ليلاً)، وهو النجم أو الكوكب الذي يطلع في الليل، و«الثاقب» المضيء الذي ينفذ بضوئه في الظلام؛ وقيل هو الثريا أو كل نجم. فالقراءة الفلكية الحديثة اجتهاد يُذكر ولا يُجزم به.', keys: ['86:1', '86:2', '86:3'] },
  { g: 1, t: 'اتساع السماء', note: 'يرى بعضهم في كلمة «لموسعون» إشارة إلى توسّع الكون الذي رصده علم الفلك الحديث.', keys: ['51:47'] },
  { g: 1, t: 'بداية السماء «دخان»', note: 'يرى بعضهم في وصف السماء بالدخان إشارة إلى الحالة الغازية الأولى للكون.', keys: ['41:11'] },
  { g: 1, t: 'الأفلاك والمدارات', note: 'تذكر الآية أن الشمس والقمر والليل والنهار يجري كلٌّ في فَلَك، ويرى المهتمون فيها إشارة إلى المدارات الفلكية.', keys: ['21:33', '36:40'] },
  { g: 1, t: 'تكوير الليل والنهار', note: 'يتأمل بعضهم في فعل «يكوّر» (يلفّ) إشارة إلى كروية الأرض وتعاقب الليل والنهار عليها.', keys: ['39:5'] },
  { g: 2, t: 'الجبال أوتاداً', note: 'يربط بعضهم وصف الجبال بالأوتاد بوجود جذور عميقة للجبال تثبّت القشرة الأرضية.', keys: ['78:6', '78:7'] },
  { g: 2, t: 'حركة الجبال', note: 'يرى بعضهم في الآية إشارة إلى حركة الأرض التي تحمل الجبال وهي تبدو ساكنة.', keys: ['27:88'] },
  { g: 2, t: 'دَحْو الأرض', note: 'يتأمل بعضهم في «دحاها» (بسطها ومهّدها) إشارة إلى تهيئة الأرض للحياة، ويذكر آخرون شكلها الكروي المبسوط.', keys: ['79:30'] },
  { g: 2, t: 'إنزال الحديد', note: 'يتأمل بعضهم في التعبير بـ«أنزلنا» عن الحديد، وقد ذُكر في علم الفلك أن الحديد يتكوّن في النجوم ولا يتكوّن على الأرض.', keys: ['57:25'] },
  { g: 3, t: 'البرزخ بين البحرين', note: 'يرى بعضهم في الآيتين إشارة إلى اختلاف خصائص الماء عند التقاء البحار مع بقاء حدّ فاصل بينها.', keys: ['55:19', '55:20', '25:53'] },
  { g: 3, t: 'ظلمات البحر اللجّي', note: 'يرى بعضهم في وصف الظلمات والموج فوق الموج إشارة إلى الأمواج الداخلية في أعماق البحار وانعدام الضوء فيها.', keys: ['24:40'] },
  { g: 3, t: 'السحاب والمطر', note: 'تصف الآية تكوّن السحاب وتجمّعه حتى ينزل المطر، ويتأمل فيها المهتمون بعلم الأرصاد.', keys: ['24:43', '30:48'] },
  { g: 3, t: 'الرياح لواقح', note: 'يربط بعضهم وصف الرياح بـ«لواقح» بدورها في تلقيح النبات وتكوين السحب.', keys: ['15:22'] },

  { g: 0, t: 'أمشاج النطفة', note: 'يرى بعضهم في «نطفة أمشاج» (مختلطة) إشارة إلى اختلاط مادة الأب والأم الوراثية عند الإخصاب. وفسّرها المفسرون القدامى بأنها مختلطة من ماء الرجل وماء المرأة، أو من أخلاط مختلفة.', keys: ['76:2'] },
  { g: 0, t: 'الصُّلب والترائب', note: 'يرى بعضهم أن في «يخرج من بين الصلب والترائب» إشارة إلى أن الخصية تنشأ في الجنين قرب الكلية في منطقة الظهر ثم تنزل. وللمفسرين فيها أقوال أخرى، منها: أنه يخرج من بين صلب الرجل وترائب المرأة (عظام صدرها)، وقيل غير ذلك.', keys: ['86:6', '86:7'] },
  { g: 0, t: 'الظلمات الثلاث', note: 'يرى بعضهم في «ظلمات ثلاث» إشارة إلى ما يحيط بالجنين: جدار البطن وجدار الرحم والأغشية المحيطة بالجنين. وفسّرها المفسرون بظلمة البطن والرحم والمشيمة.', keys: ['39:6'] },
  { g: 0, t: 'تحديد جنس الجنين', note: 'يشير بعضهم إلى أن الآية تنسب خلق الزوجين الذكر والأنثى إلى النطفة، وإلى أن الحيوان المنوي هو الذي يحدد جنس الجنين (X أو Y). والمعنى الظاهر عند المفسرين بيان قدرة الله في خلق الزوجين من نطفة واحدة.', keys: ['53:45', '53:46'] },
  { g: 0, t: 'السمع قبل البصر', note: 'تذكر الآيات السمع قبل البصر في الإنسان، ويلاحظ بعضهم أن حاسة السمع تتكوّن في الجنين وتعمل قبل البصر. وهو ترتيب مطّرد في القرآن، ولا يعني أن الآية سيقت لبيان ذلك.', keys: ['76:2', '32:9'] },
  { g: 0, t: 'ناصية كاذبة خاطئة', note: 'يرى بعضهم أن «الناصية» (مقدّم الرأس) تقابل الفص الجبهي في الدماغ، وهو المتعلق بالتخطيط واتخاذ القرار والسلوك. والمعنى الظاهر عند المفسرين أنها مقدّم الرأس التي يُؤخذ بها المجرم يوم القيامة، وأنها وصف للشخص كله بالكذب والخطأ.', keys: ['96:15', '96:16'] },
  { g: 0, t: 'خلق الإنسان من صلصال', note: 'يلاحظ بعضهم أن العناصر الكيميائية المكوّنة لجسم الإنسان موجودة في التراب. والمعنى الظاهر عند المفسرين بيان أصل خلق آدم عليه السلام من طين يابس يُسمع له صلصلة كالفخار.', keys: ['55:14'] },
  { g: 1, t: 'الرتق والفتق', note: 'يربط بعضهم «كانتا رتقاً ففتقناهما» (كانتا ملتصقتين ففصلناهما) بنظرية الانفجار العظيم ونشأة الكون من حالة واحدة. ويرى آخرون أن ربط الآية بنظرية فيزيائية بعينها تحميلٌ للنص، لأن النظريات تتغير. وفسّرها المفسرون القدامى بأن السماء كانت لا تمطر والأرض لا تنبت ففتقهما الله بالمطر والنبات، وقيل غير ذلك.', keys: ['21:30'] },
  { g: 1, t: 'السماء سقفاً محفوظاً', note: 'يربط بعضهم «سقفاً محفوظاً» بالغلاف الجوي الذي يحمي الأرض من الشهب والأشعة الضارة. والمعنى الظاهر عند المفسرين أن السماء محفوظة من السقوط ومن استراق الشياطين.', keys: ['21:32'] },
  { g: 1, t: 'السماء ذات الرجع', note: 'يرى بعضهم في «الرجع» إشارة إلى ارتداد طبقات الجو للأشعة والموجات وإلى دورة الماء. وفسّرها المفسرون القدامى بأن الرجع المطر، لأنه يرجع كل عام.', keys: ['86:11'] },
  { g: 1, t: 'رفع السماوات بغير عمد', note: 'يرى بعضهم أن «بغير عمد ترونها» إشارة إلى قوى الجاذبية التي تمسك الأجرام ولا تُرى. وفسّرها المفسرون بأنه لا عمد ترونها أصلاً، وقيل: لها عمد لا ترونها.', keys: ['13:2'] },
  { g: 1, t: 'الشمس ضياء والقمر نور', note: 'يلاحظ بعضهم التفريق في القرآن بين الشمس «ضياءً/سراجاً» (مصدر الضوء) والقمر «نوراً» (يعكس الضوء)، وهو ما يوافق أن القمر لا يصدر ضوءاً من ذاته. ويرى آخرون أن هذا التمييز اللغوي لا يُراد به بيان علمي بعينه.', keys: ['10:5', '71:16'] },
  { g: 1, t: 'انشقاق القمر', note: 'ذهب أكثر المفسرين إلى أن القمر انشق فلقتين في مكة في زمن النبي ﷺ معجزةً حسيّة، استناداً إلى أحاديث في الصحيحين، وذهب بعضهم إلى أن المراد انشقاقه قرب قيام الساعة. وقد راج في بعض المواقع أن صوراً أو دراسات فضائية أثبتت ذلك (كالأخاديد القمرية)، ولم أجد لذلك مصدراً علمياً موثوقاً، ويرفضه علماء الفلك. فالمعتمد هو ثبوته بالخبر الصحيح لا بالاكتشافات.', keys: ['54:1'] },
  { g: 1, t: 'مواقع النجوم', note: 'يرى بعضهم في القسم بـ«مواقع النجوم» وتعظيمه إشارةً إلى اتساع الكون وبعد المسافات بين النجوم. والمعنى الظاهر عند المفسرين أن المواقع مساقط النجوم ومغاربها، أو منازلها في السماء.', keys: ['56:75', '56:76'] },
  { g: 1, t: 'المشرقان والمغربان', note: 'يرى بعضهم في «رب المشرقين ورب المغربين» إشارة إلى اختلاف مطلع الشمس ومغربها بين الصيف والشتاء. وللمفسرين أقوال أخرى، منها أنهما مشرق الشمس والقمر أو مشرق الصيف والشتاء.', keys: ['55:17'] },
  { g: 1, t: 'سلخ النهار من الليل', note: 'يرى بعضهم في «نسلخ منه النهار» إشارة إلى أن الأصل في الكون الظلام وأن النهار يطرأ عليه بضوء الشمس عبر الغلاف الجوي. والمعنى الظاهر عند المفسرين أن الله يفصل النهار عن الليل فتحلّ الظلمة.', keys: ['36:37'] },
  { g: 1, t: 'ضيق الصدر في الصعود', note: 'يربط بعضهم «كأنما يصّعّد في السماء» بضيق التنفس عند الارتفاع الشاهق لنقص الأكسجين. وقد نبّه بعض الباحثين إلى أن هذا من الأمثلة الشائعة التي تحتاج إلى تدقيق، فالمعنى الظاهر عند المفسرين تشبيه لشدة ضيق صدر من أراد الله ضلاله.', keys: ['6:125'] },
  { g: 1, t: 'سنين أهل الكهف ال 309', note: 'يلاحظ بعضهم أن «ثلاثمائة سنين وازدادوا تسعاً» توافق الفرق بين ثلاثمائة سنة شمسية وما يقابلها من السنين القمرية (نحو ثلاثمائة وتسع). وقد ذكر بعض المفسرين أن الزيادة هي فرق ما بين الحساب الشمسي والقمري.', keys: ['18:25'] },
  { g: 2, t: 'الأرض ذات الصدع', note: 'يربط بعضهم «والأرض ذات الصدع» بالصدوع والشقوق في القشرة الأرضية وحركة الصفائح، ويُشير آخرون إلى انشقاقها بالنبات. وفسّرها المفسرون بانصداع الأرض عن النبات.', keys: ['86:12'] },
  { g: 2, t: 'أدنى الأرض', note: 'يرى بعضهم في «في أدنى الأرض» إشارة إلى منطقة البحر الميت، وهي أخفض بقعة على اليابسة، وقد دارت فيها معركة الروم والفرس. وفسّرها بعض المفسرين بأنها أقرب الأرض إلى بلاد العرب، فهو احتمال لا يُجزم به.', keys: ['30:2', '30:3'] },
  { g: 2, t: 'سبع أرضين', note: 'يرى بعضهم في «ومن الأرض مثلهن» إشارة إلى طبقات الأرض أو إلى تعدّد الأرضين. وللمفسرين فيها أقوال عدة، فلا يُجزم بمعنى علمي معين.', keys: ['65:12'] },
  { g: 2, t: 'ألوان الجبال', note: 'يلاحظ بعضهم أن الآية تصف الجبال بخطوط وألوان بيضاء وحمراء وسوداء، وهو ما يُعزى علمياً إلى اختلاف المعادن والصخور المكوّنة لها. والمعنى الظاهر بيان تنوّع خلق الله في الجبال والثمار والناس.', keys: ['35:27'] },
  { g: 2, t: 'اهتزاز الأرض ورُبُوّها', note: 'يربط بعضهم «اهتزت وربت» بانتفاخ حبيبات التربة وتحرّكها عند نزول الماء عليها وإنباتها. والمعنى الظاهر بيان إحياء الأرض بعد موتها دليلاً على البعث.', keys: ['22:5'] },
  { g: 3, t: 'الماء وما أنتم له بخازنين', note: 'تذكر الآية إنزال الماء من السماء وسقياه للناس، ثم تقول: «وما أنتم له بخازنين»، أي لستم أنتم الذين تحفظونه وتخزنونه. ويرى بعضهم في ذلك إشارة إلى أن الماء العذب يُخزَّن في الطبيعة بنظام لا يد للإنسان فيه: في المياه الجوفية وفي الأنهار الجليدية وفي الأغطية الجليدية القطبية وفي البحيرات، ويُعاد توزيعه بدورة الماء، وأن ما يملكه الإنسان من خزانات صناعية قليل بالنسبة إلى ذلك. ويربط آخرون «بقدر» في الآية الأخرى (٢٣:١٨) بتوازن كمية الماء على الأرض. والمعنى الظاهر عند المفسرين أن الله هو الذي ينزّل الماء ويحفظه في الأرض ويرزقكم منه، وليس لكم أن تحبسوه عن غيركم.', keys: ['15:22', '23:18'] },
  { g: 3, t: 'دورة الماء', note: 'يرى بعضهم في «فسلكه ينابيع في الأرض» و«أنزلنا من السماء ماءً بقدر فأسكناه في الأرض» إشارة إلى تغذية المياه الجوفية بماء المطر وإلى دورة الماء في الطبيعة. وهو معنى لا يخالف ظاهر الآيات.', keys: ['39:21', '23:18'] },
  { g: 4, t: 'اللبن من بين فرث ودم', note: 'يرى بعضهم أن في «من بين فرث ودم لبناً خالصاً» إشارة إلى أن مكوّنات اللبن تتكوّن من نواتج هضم الغذاء التي ينقلها الدم إلى الغدد اللبنية. والمعنى الظاهر عند المفسرين بيان نعمة الله في إخراج اللبن الخالص من بين فرث ودم.', keys: ['16:66'] },
  { g: 4, t: 'الإبل وخلقها', note: 'يلاحظ بعضهم ما في الإبل من صفات تلائم الصحراء، كتحمّل العطش والحرّ وتخزين الدهون في السنام وتركيب الجفون والأنف. والمعنى الظاهر دعوة إلى التأمل في خلق الإبل.', keys: ['88:17'] },
  { g: 4, t: 'الطير صافّات ويقبضن', note: 'يتأمل بعضهم في وصف الطيران بـ«صافّات ويقبضن» (يبسطن أجنحتهن ويضممنها) ودقة حركة الأجنحة في الطيران والتحليق. والمعنى الظاهر دعوة إلى النظر في إمساك الله للطير في الجو.', keys: ['67:19'] },
  { g: 4, t: 'الدواب والطير أمم أمثالنا', note: 'يلاحظ بعضهم أن الحيوانات تعيش في مجتمعات منظمة ولها أنماط من التواصل والتدبير، وفي ذلك موافقة لقوله «أمم أمثالكم». والمعنى الظاهر أنها أصناف مخلوقة محكومة بقدر الله كالبشر.', keys: ['6:38'] },
  { g: 5, t: 'غُلبت الروم', note: 'تخبر الآيات أن الروم غُلبوا في أدنى الأرض وأنهم سيغلبون في بضع سنين، وقد انتصر الروم على الفرس بعد سنوات قليلة (نحو عام ٦٢٧م). ويرى كثير من العلماء أنه من إخبار القرآن بالغيب المستقبلي، وهو خبر تاريخي لا علمي.', keys: ['30:2', '30:3', '30:4'] },
  { g: 6, t: 'النار من الشجر الأخضر', note: 'يرى بعضهم في «جعل لكم من الشجر الأخضر ناراً» إشارة إلى البناء الضوئي الذي تخزّن فيه النباتات طاقة الشمس، فنحصل منها على الطاقة بالحرق (خشباً أو فحماً). وهو معنى لا يخالف ظاهر الآية، وفسّرها المفسرون بشجر المرخ والعفار الذي يُقدح به النار.', keys: ['36:80'] },
  { g: 6, t: 'الزوجية في النبات', note: 'يشير بعضهم إلى أن الآية تذكر أن من كل الثمرات جعل الله فيها زوجين اثنين، ويرون فيه موافقة لوجود الذكورة والأنوثة في كثير من النباتات. والمعنى الظاهر بيان تنوّع الخلق ودقته.', keys: ['13:3'] },
  { g: 6, t: 'فالق الحبّ والنوى', note: 'يتأمل بعضهم في «فالق الحب والنوى» وما يجري في الحبة من انشقاقها عند الإنبات وخروج الجذر والساق. والمعنى الظاهر أن الله هو الذي يشقّ الحبّ والنوى فيُخرج منهما الحيّ.', keys: ['6:95'] },

  { g: 7, t: 'التحدي بالإتيان بقرآن مثله', note: 'تتحدى الآية الإنس والجن مجتمعين أن يأتوا بمثل هذا القرآن ولو تعاونوا. وهو أعلى مراتب التحدي. ويرى جمهور العلماء أن وجه الإعجاز في بلاغة القرآن ونظمه وأسلوبه (وهو ما صنّف فيه الباقلاني والجرجاني وغيرهما)، وذهب بعض المتكلمين كالنظّام إلى القول بـ«الصَّرْفة»، أي أن الله صرف العرب عن معارضته. وتبقى دعوى الإعجاز مرتبطة بذوق اللغة وأهلها.', keys: ['17:88'] },
  { g: 7, t: 'التحدي بعشر سور', note: 'بعد أن اتُّهم القرآن بأنه مفترى جاءهم التحدي بأن يأتوا بعشر سور مثله مفتريات، ويدعوا من استطاعوا. وهو تخفيف من التحدي بالقرآن كله، وقد نزل في مكة.', keys: ['11:13', '11:14'] },
  { g: 7, t: 'التحدي بسورة', note: 'خُفّف التحدي إلى سورة واحدة: «فأتوا بسورة من مثله»، وفي البقرة زاد عليه: «ولن تفعلوا»، وهو إخبار بأنهم لن يستطيعوا. ويذكر العلماء أن أقصر سورة (الكوثر) ثلاث آيات، فيرون أن التحدي يتحقق بأقل ما يُسمى سورة. وقد وُجدت في التاريخ محاولات لمعارضة القرآن (كما نُسب إلى مسيلمة)، ويرى العلماء أنها لا تبلغ شيئاً من بلاغته.', keys: ['10:38', '2:23', '2:24'] },
  { g: 7, t: 'التحدي بحديث مثله', note: 'أخفّ مراتب التحدي: «فليأتوا بحديث مثله»، فهو لا يشترط عدداً من الآيات ولا سورة كاملة. ويستدل به بعضهم على أن الإعجاز لا يقتصر على الطول، وهو من مواضع بحث العلماء في أقل ما يتحقق به التحدي.', keys: ['52:33', '52:34'] },
  { g: 7, t: 'تحدي أن يُسلم أبو لهب', note: 'نزلت سورة المسد في مكة تُخبر بأن أبا لهب سيصلى ناراً ذات لهب وأن امرأته كذلك، أي أنهما سيموتان على الكفر. ويرى كثير من العلماء أن في ذلك إخباراً بالغيب وتحدياً: فقد عاش أبو لهب بعد نزولها سنوات (وتوفي بعد غزوة بدر)، وكان يكفيه أن يُظهر الإسلام ولو نفاقاً لينقض ما أخبرت به السورة، ولم يفعل ذلك هو ولا امرأته. ويُذكر هذا في باب الإعجاز بالإخبار بالغيب. ويراعي من يناقشه أنه يعتمد على أخبار التاريخ والسيرة في تحديد زمن نزول السورة وموت أبي لهب.', keys: ['111:1', '111:2', '111:3', '111:4', '111:5'] },
  { g: 7, t: 'ذلك الكتاب لا ريب فيه', note: 'يفتتح القرآن سورة البقرة بعد الحروف المقطعة بوصف الكتاب بأنه «لا ريب فيه» (لا شك في صدقه ولا في كونه من عند الله)، وكأن الحروف المقطعة (الم) تذكّر بأنه مؤلَّف من حروف العرب نفسها ثم عجزوا عن مثله. ويستنبط العلماء من هذا الوصف أنه كتاب تام لا يحتاج إلى مراجعة ولا تنقيح ولا تعديل ولا إصدار جديد: فالكتب البشرية تُراجَع وتُصحَّح وتصدر منها طبعات منقّحة كلما ظهر فيها نقص أو خطأ، أما القرآن فنصه ثابت كما نزل، وقد وصفه الله بأنه «غير ذي عوج» (لا اعوجاج فيه ولا خلل)، وأنه «لا يأتيه الباطل من بين يديه ولا من خلفه» فلا يدخله تبديل ولا زيادة ولا نقصان. ويتحقق ذلك عملياً بتواتر نقله بالحفظ والكتابة، فالنص المتداول اليوم واحد. وقد فهم المفسرون «لا ريب فيه» بمعنى أنه حق في نفسه لا يتطرق إليه الشك عند التأمل، وإن ارتاب فيه من ارتاب.', keys: ['2:1', '2:2', '18:1', '39:28', '41:42'] },
  { g: 7, t: 'سلامة القرآن من الاختلاف', note: 'تدعو الآية إلى تدبّر القرآن وتقول: لو كان من عند غير الله لوجدوا فيه اختلافاً كثيراً. ويلاحظ العلماء أن القرآن نزل منجَّماً على نحو ثلاث وعشرين سنة في أحوال مختلفة ثم هو متسق لا تناقض فيه. وقد أُثيرت شبهات حول تعارض بعض الآيات، وأجاب عنها العلماء في كتب «مشكل القرآن» و«دفع إيهام الاضطراب».', keys: ['4:82'] },
  { g: 7, t: 'حفظ القرآن من التبديل', note: 'يخبر القرآن أن الله تولّى حفظ الذِّكر، وأنه «لا يأتيه الباطل من بين يديه ولا من خلفه». ويرى العلماء أن هذا الحفظ تحقق بتواتر القراءة والحفظ في الصدور والكتابة في المصاحف عبر القرون، حتى إن المصاحف في مختلف البلاد تتفق في النص. وهو مما يذكره العلماء في الإعجاز بالغيب لأنه وعدٌ بالحفظ تحقق.', keys: ['15:9', '41:41', '41:42'] },

  { g: 0, t: 'فكسونا العظام لحماً', note: 'تذكر الآية أن الله خلق المضغة عظاماً ثم كسا العظام لحماً. يرى المؤيدون أن الهيكل الغضروفي يتكوّن نموذجاً أولياً ثم تتجمع حوله الأنسجة التي تصير عضلات، وأن الفاء تدل على سرعة التتابع، وأن العضلة لا تتصل بعظم لم يتكوّن بعد، وأن الآية لا تنفي وجود خلايا مبكرة للعضلات. ويرى المنتقدون أن العظام والعضلات تنشأ من الطبقة الجنينية نفسها (الأديم المتوسط) وتبدآن في التكوّن معاً تقريباً، فلا يصحّ عندهم الحديث عن عظام تتكوّن أولاً ثم يُكسوها لحم، ويعتمد الطرفان في الحُكم على ما يُقصد بـ«العظام» وبـ«اللحم» ومتى يبدأ تكوّن كلٍّ منهما. ولم أجد في المصادر مرجعاً علمياً محكّماً يحسم المسألة، فهي من أكثر المسائل جدلاً في هذا الباب. والمعنى الظاهر عند المفسرين بيان تدرّج خلق الإنسان وكمال قدرة الله فيه.', keys: ['23:14'] },
  { g: 2, t: 'مدّ الظلّ', note: 'يتأمل بعضهم في «ألم تر إلى ربك كيف مدّ الظل» وفي جعل الشمس عليه «دليلاً»، فالظل لا يتكوّن إلا بوجود ضوء الشمس وتتبّعه لحركتها، وهو ما يُستفاد منه في معرفة الوقت. والمعنى الظاهر عند المفسرين دعوة إلى التأمل في نعمة الظل ودلالته على قدرة الله.', keys: ['25:45', '25:46'] },
  { g: 0, t: 'الضرب على الآذان', note: 'يلاحظ بعضهم أن الآية عبّرت عن النوم الطويل بقوله «فضربنا على آذانهم»، وهو يوافق أن السمع هو الحاسة التي تبقى يقظة في النوم وأن الأذن تُغلَق عن الإيقاظ في النوم العميق. والمعنى الظاهر عند المفسرين أن الله ألقى عليهم النوم فلم تسمع آذانهم.', keys: ['18:11'] },
  { g: 3, t: 'السراب', note: 'يرى بعضهم في تشبيه الآية للسراب بقيعة (أرض منبسطة) يحسبه العطشان ماءً إشارةً إلى ظاهرة بصرية تنشأ من انكسار الضوء في الهواء الحار فوق الأرض المنبسطة. والمعنى الظاهر عند المفسرين تشبيه لأعمال الكافرين التي لا تنفعهم.', keys: ['24:39'] },
  { g: 1, t: 'الشهب والحرس الشديد', note: 'يلاحظ بعضهم أن الآيات تذكر الشهب تتبع من يستمع في السماء، ويربطونها بالشهب والنيازك التي تحترق عند دخول الغلاف الجوي. والمعنى الظاهر عند المفسرين أن الشهب تُرجَم بها الشياطين التي تسترق السمع.', keys: ['72:8', '72:9', '37:10'] },
  { g: 0, t: 'مَنِيّ يُمنى', note: 'يتأمل بعضهم في قوله «من مني يُمنى» (يُدفق ويُصَبّ)، ويرون فيه إشارة إلى أن الذي يُدفق هو مادة منها قليل جداً يخلق الإنسان (حيوان منوي واحد من ملايين). والمعنى الظاهر عند المفسرين بيان أصل الإنسان من نطفة تُصبّ في الرحم دليلاً على البعث.', keys: ['75:37', '75:38'] },
  { g: 1, fit: true, t: 'سنريهم آياتنا في الآفاق وفي أنفسهم', note: 'تذكر الآية وعداً بأن يُري الله الناس آياته في الآفاق (الكون) وفي أنفسهم حتى يتبيّن لهم أنه الحق. ويجعلها كثيرون أصلاً لباب النظر في الآيات الكونية والنفسية، ويذكرها المؤيدون عند الحديث عن الإعجاز العلمي. ويبقى ما يُعدّ آيةً في الآفاق وفي الأنفس موضع اجتهاد.', keys: ['41:53', '51:21'] },
];
let miInit = false;
async function initMiracles() {
  if (miInit) return; miInit = true;
  try {                                                  // items approved from the weekly research agent
    const extra = await (await fetch('/api/miracles-extra')).json();
    if (Array.isArray(extra)) {
      const pg = MIRACLE_GROUPS.length, pend = extra.filter((e) => e.pending && e.keys?.length);   // pending items: one group at the bottom, marked, until the admin decides
      for (const e of extra) if (!e.pending && e.g >= 0 && e.g < pg && e.keys?.length) MIRACLES.push({ g: e.g, t: e.t, note: e.note, keys: e.keys });
      if (pend.length) { MIRACLE_GROUPS.push({ ic: '⏳', g: 'اقتراحات قيد المراجعة' }); pend.forEach((e) => MIRACLES.push({ g: pg, t: e.t, note: e.note, keys: e.keys, pending: true })); }
    }
  } catch { /* the built-in items are enough */ }
  { const i = MIRACLES.findIndex((m) => m.t === 'تحدي أن يُسلم أبو لهب'); if (i >= 0) MIRACLES.push(MIRACLES.splice(i, 1)[0]); }   // last in its group
  const FIRST_G = [7, 6, 5];                                                       // shown first: التحدي، النبات والزراعة، التاريخ والآثار
  const gOrder = [...FIRST_G, ...MIRACLE_GROUPS.map((_, i) => i).filter((i) => !FIRST_G.includes(i))];
  $('mirList').innerHTML = gOrder.map((gi) => [MIRACLE_GROUPS[gi], gi]).map(([G, gi]) => `<div class="mgroup" id="mg-${gi}"><h3><span>${G.ic}</span>${esc(G.g)} <small class="cnt">(${nA(MIRACLES.filter((m) => m.g === gi).length)})</small></h3><div class="mgrid">` +
    MIRACLES.map((m, i) => [m, i]).filter(([m]) => m.g === gi).map(([m, i]) => `<details class="lesson${m.pending ? ' pending' : ''}" data-i="${i}"><summary${m.fit ? ' class="fit"' : ''}>${esc(m.t)}${m.pending ? '<span class="pend">قيد المراجعة</span>' : ''}</summary><div>${esc(m.note)}</div><div class="exs"><div class="tag">جارٍ تحميل الآيات…</div></div></details>`).join('') + '</div></div>').join('');
  $('mirList').addEventListener('toggle', async (e) => {
    const d = e.target; if (!d.open || d.dataset.done) return; d.dataset.done = 1;
    const m = MIRACLES[+d.dataset.i], box = d.querySelector('.exs');
    try {
      const vs = await (await fetch('/api/ayat?keys=' + m.keys.join(','))).json();
      box.innerHTML = vs.map((v) => `<div class="ex"><div class="vt"><span class="tag">سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)}:</span> ${esc(v.text)}</div></div>`).join('') || '<div class="tag">تعذّر تحميل الآيات.</div>';
    } catch { box.innerHTML = '<div class="tag">تعذّر تحميل الآيات.</div>'; }
  }, true);
  panelize($('mirList'));
}

/* ---------- إحصاءات لغوية ---------- */
let stInit = false;
async function initStats() {
  if (stInit) return; stInit = true;
  const body = $('statsBody');
  let S;
  try { S = await (await fetch('/stats.json')).json(); } catch { stInit = false; body.innerHTML = '<p class="hint">تعذّر تحميل الإحصاءات.</p>'; return; }
  const t = S.totals, N = (n) => nA(n), pct = (a, b) => nA(((100 * a) / b).toFixed(1)) + '٪';
  const bars = (rows, max, fmt) => rows.map((r) => `<div class="srow"><span class="k">${esc(r.k)}</span><div class="sbarw"><i style="width:${(100 * r.n) / max}%"></i></div><span class="v">${fmt(r)}</span></div>`).join('');
  const panel = (title, html, open) => `<details class="lesson"${open ? ' open' : ''}><summary>${esc(title)}</summary><div>${html}</div></details>`;
  const NCD = await loadNameCounts();
  let P = null; try { P = await (await fetch('/pos.json')).json(); } catch { /* panel is skipped */ }
  const posPanel = () => {
    const c = new Proxy(P.cats, { get: (t, k) => t[k] || 0 }), T = P.total;
    // [label, count, examples, indent]  — an indented row is a part of the row above it
    const G = [
      { k: 'noun', name: 'الأسماء', desc: 'كل كلمة تدل على ذات أو معنى (إنسان، شيء، مكان، زمن، صفة) بلا زمن', rows: [
        ['الأسماء العامة', c.noun, 'رب، أرض، قوم، يوم، عذاب'],
        ['اسم الفاعل', c.actPcpl, 'كافر، صادق، عالم، ظالم', 1], ['اسم المفعول', c.passPcpl, 'مبعوث، مسحور، مقتول', 1], ['المصدر', c.vn, 'ذكر، علم، خلق، عمل', 1],
        ['الصفات', c.adj, 'رحيم، عظيم، عليم، حكيم، رحمن'], ['أسماء الأعلام', c.pn, 'الله، موسى، مريم، مصر'],
        ['ظروف الزمان', c.timeAdv, 'يوم، إذ، حين، بعد'], ['ظروف المكان', c.placeAdv, 'عند، بين، فوق، تحت'], ['أسماء أخرى ملتصقة', c.otherN, '']] },
      { k: 'verb', name: 'الأفعال', desc: 'كل كلمة تدل على حدث مقترن بزمن', rows: [
        ['الفعل الماضي', c.verbPerf, 'قال، كان، آمن، جاء'], ['الفعل المضارع', c.verbImpf, 'يقول، تعلمون، يعبدون'], ['فعل الأمر', c.verbImpv, 'قل، اعبدوا، اتقوا'],
        ['المبني للمجهول (من الأفعال أعلاه)', c.verbPass, 'قُتل، أُنزل، خُلق', 1, 1]] },
      { k: 'pron', name: 'الضمائر وأسماء الإشارة والموصول والاستفهام', desc: 'أسماء تحلّ محل غيرها أو تشير إليه أو تسأل عنه', rows: [
        ['الضمائر المتصلة', c.pronAttached, 'ـه، ـهم، ـك، ـنا، ـكم'], ['الضمائر المنفصلة', c.pronSeparate, 'هو، هم، أنت، نحن'],
        ['الأسماء الموصولة', c.rel, 'الذي، الذين، التي، ما، من'], ['أسماء الإشارة', c.dem, 'هذا، ذلك، أولئك، تلك'], ['أسماء الاستفهام', c.intg, 'من، ما، أين، كيف']] },
      { k: 'part', name: 'الحروف', desc: 'كلمات ربط ومعنى لا يكتمل معناها وحدها', rows: [
        ['«ال» التعريف', c.pDet, 'الـ'], ['حروف العطف', c.pConj, 'و، ف، ثم، أو'], ['حروف الاستئناف', c.pRem, 'و، ف'], ['حروف النفي', c.pNeg, 'لا، ما، لم، لن'],
        ['حروف التوكيد', c.pEmph, 'لـ، قد'], ['حروف الشرط', c.pCond, 'إن، لو، لولا'], ['حروف النداء', c.pAddr, 'يا'], ['حروف أخرى (جر ونصب وغيرها)', c.pOther + c.pIntg, 'من، في، على، إلى، أن، إنّ']] },
    ];
    const tot = (g) => g.rows.filter((r) => !r[4]).reduce((a, r) => a + (r[3] ? 0 : r[1]), 0);
    const sum = G.map(tot), all = sum.reduce((a, b) => a + b, 0);
    const strip = `<div class="pstack">${G.map((g, i) => `<i class="pc-${g.k}" style="width:${(100 * sum[i]) / all}%"></i>`).join('')}</div><div class="pleg">${G.map((g, i) => `<span><b class="pc-${g.k}"></b>${esc(g.name.split(' ')[0])} ${pct(sum[i], all)}</span>`).join('')}</div>`;
    const block = (g, i) => `<section class="pg pc-${g.k}"><div class="pgh"><h4>${esc(g.name)}</h4><div class="pgn"><b>${N(sum[i])}</b><small>${pct(sum[i], all)} من الكل</small></div></div><p class="pgd">${esc(g.desc)}</p>` +
      g.rows.filter((r) => r[1]).map(([lab, n, ex, ind]) => `<div class="pr${ind ? ' pi' : ''}"><div class="pl"><b>${esc(lab)}</b>${ex ? `<small>${esc(ex)}</small>` : ''}</div><div class="pb"><i style="width:${Math.max(1.5, (100 * n) / sum[i])}%"></i></div><div class="pv"><b>${N(n)}</b><small>${pct(n, all)}</small></div></div>`).join('') + '</section>';
    const top = (title, arr, uniq) => `<h3 class="ptl">${title} <small>(${N(uniq)} لفظاً مختلفاً)</small></h3>` + bars(arr.map((x) => ({ k: x.w, n: x.n })), arr[0].n, (r) => N(r.n));
    return `<p class="how">كل كلمة في القرآن تُقسَّم إلى أجزائها (فـ«وبالله» ثلاثة أجزاء: و + بـ + الله)، فمجموع الأجزاء ${N(all)} وهو أكثر من عدد الكلمات. وطول كل شريط نسبة الجزء من <b>مجموعه داخل بطاقته</b>، والنسبة المئوية بجانبه من <b>كل الأجزاء</b>.<br>التصنيف من «مدونة القرآن العربية» (Quranic Arabic Corpus)، وهو اجتهاد لغوي قد يخالفه بعض النحاة، وعدد «الصفات» أقل من الواقع لأن المدونة تصنّف كثيراً منها تحت اسم الفاعل أو الأسماء.</p>` + strip + G.map(block).join('') +
      top('أكثر الأسماء ورودًا', P.top.noun, P.unique.noun) + top('أكثر الصفات ورودًا', P.top.adj, P.unique.adj) + top('أكثر الأفعال ورودًا (بجذر الفعل)', P.top.verb, P.unique.verb) + top('أكثر أسماء الأعلام ورودًا', P.top.pn, P.unique.pn);
  };
  const SCAT = [["👤", "أسماء أنبياء وأشخاص", [3, 10, 11, 12, 14, 19, 21, 31, 47, 71], ""], ["🐪", "حيوانات وحشرات", [2, 6, 16, 27, 29, 100, 105], ""], ["🌌", "ظواهر الكون والطبيعة", [13, 24, 51, 53, 54, 77, 79, 85, 86, 89, 91, 92, 93, 95, 113], ""], ["⏳", "يوم القيامة وأحواله", [44, 45, 56, 59, 64, 69, 70, 75, 78, 81, 82, 84, 88, 99, 101], ""], ["👥", "أقوام وفئات من الناس", [4, 26, 30, 33, 34, 37, 39, 58, 60, 63, 72, 76, 83, 104, 106, 109, 114], ""], ["📍", "أماكن ومواضع", [7, 15, 18, 46, 52, 90], ""], ["🧱", "أشياء وأدوات", [5, 57, 68, 107, 108, 111], ""], ["📜", "أحداث وشعائر وأحكام", [8, 9, 17, 22, 48, 49, 61, 62, 65, 66, 80, 94, 97, 110], ""], ["🕋", "القرآن والوحي والقيم", [1, 23, 25, 28, 32, 35, 41, 42, 43, 73, 74, 96, 98, 102, 103], ""], ["💚", "أسماء الله وصفاته والتوحيد", [40, 55, 67, 87, 112], ""], ["🔤", "حروف مقطعة", [20, 36, 38, 50], ""]];
  const catPanel = () => {
    const by = Object.fromEntries(S.surahs.map((s) => [s.id, s]));
    return `<p class="how">تصنيف أسماء السور الـ ١١٤ بحسب ما يدل عليه اسم السورة. وهذا التصنيف اجتهاد مني بعد النظر في معنى كل اسم، وليس نصاً ثابتاً؛ فبعض الأسماء يحتمل أكثر من تصنيف، وقد وضعتُ كل سورة في تصنيف واحد. ويُعرض اسم السورة بعدد آياتها.</p>` +
      SCAT.map(([ic, name, list, note], idx) => `<h3 class="ptl${idx && idx % 3 === 0 ? ' gsp' : ''}"><span>${ic}</span> ${esc(name)} <small>(${N(list.length)} سورة · ${N(list.reduce((a, i) => a + by[i].verses, 0))} آية)</small></h3><div class="chips">${list.map((i) => `<span class="chip">${esc(by[i].ar)} <small>${N(by[i].verses)}</small></span>`).join('')}</div>`).join('');
  };
  const TW = S.topWords.filter((x) => x.w !== 'الله');      // the divine name has its own boxes and panel
  const kpi = (v, l) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
  const place = (p) => S.byPlace[p];
  const mk = place('makkah'), md = place('madinah');
  const verseBox = (v, label) => `<div class="aib"><h3>${label} — ${N(v.words)} ${v.words === 1 ? 'كلمة' : 'كلمات'} [${esc(v.key)}]</h3><div class="vt">${esc(v.text)}</div></div>`;
  body.innerHTML =
    `<div class="kpis">${kpi(N(t.surahs), 'سورة')}${kpi(N(t.verses), 'آية')}${NCD && NCD['الله'] ? kpi(N(NCD['الله'].n), 'مرة ورد فيها لفظ الجلالة «الله»') : ''}${NCD ? kpi(N(Object.values(NCD).reduce((a, x) => a + x.n, 0)), 'مرة وردت فيها أسماء الله الحسنى كلها (تقريباً)') : ''}${kpi(N(t.words), 'كلمة (بالتكرار)')}${kpi(N(t.letters), 'حرفاً')}` +
    `${kpi(N(t.uniqueWords), 'كلمة مختلفة')}${kpi(N(t.hapax), 'كلمة وردت مرة واحدة')}${kpi(N((t.words / t.surahs).toFixed(1)), 'متوسط الكلمات في السورة')}${kpi(N(t.wordsPerVerse), 'متوسط الكلمات في الآية')}${kpi(N(t.lettersPerWord), 'متوسط الحروف في الكلمة')}</div>` +
    panel('عدد مرات ورود أسماء الله الحسنى في القرآن', '<div id="namesCounts"><p class="hint">جارٍ التحميل…</p></div>', false) +
    (P ? panel('أنواع الكلمات: الأسماء والصفات والأفعال والحروف', posPanel(), false) : '') +
    panel(`تصنيف أسماء السور (${N(SCAT.length)})`, catPanel(), false) +
    panel(`أكثر ${N(TW.length)} كلمة تكراراً`, bars(TW.map((x) => ({ k: x.w, n: x.n })), TW[0].n, (r) => `${N(r.n)} · ${pct(r.n, t.words)}`), false) +
    panel('تكرار الحروف', bars(S.letters.map((x) => ({ k: x.l === 'ء' ? 'ء (همزة)' : x.l === 'ة' ? 'ة' : x.l, n: x.n })), S.letters[0].n, (r) => `${N(r.n)} · ${pct(r.n, t.letters)}`), false) +
    panel('توزيع أطوال الكلمات (بعدد الحروف)', bars(S.wordLength.map((x) => ({ k: x.len === 10 ? '١٠ فأكثر' : N(x.len) + ' حروف', n: x.n })), Math.max(...S.wordLength.map((x) => x.n)), (r) => `${N(r.n)} · ${pct(r.n, t.words)}`), false) +
    panel('المكي والمدني', `<table class="tbl"><tr><th></th><th class="num">السور</th><th class="num">الآيات</th><th class="num">الكلمات</th><th class="num">الحروف</th></tr>` +
      [['مكية', mk], ['مدنية', md]].map(([n, p]) => `<tr><td>${n}</td><td class="num">${N(p.surahs)}</td><td class="num">${N(p.verses)} (${pct(p.verses, t.verses)})</td><td class="num">${N(p.words)} (${pct(p.words, t.words)})</td><td class="num">${N(p.letters)}</td></tr>`).join('') + `</table>` +
      `<p class="tag">التصنيف المكي/المدني كما ورد في بيانات Quran.com.</p>`, false) +
    panel('أطول آية وأقصر آية', verseBox(S.longestVerse, 'أطول آية (بعدد الكلمات)') + verseBox(S.shortestVerse, 'أقصر آية (بعدد الكلمات)'), false) +
    panel('جميع السور مرتّبة حسب…', `<div class="sorters"></div><div class="tscroll"><table class="tbl"><thead><tr><th>#</th><th>السورة</th><th></th><th class="num">آياتها</th><th class="num">كلماتها</th><th class="num">حروفها</th></tr></thead><tbody></tbody></table></div>`, false) +
    `<p class="note">المصدر: ${esc(S.source)} — حُسبت بتاريخ ${esc(S.generated)}. تُعدّ الكلمة ما يفصله فراغ في الرسم الإملائي المعتاد، وتُحسب ى ياءً وؤ/ئ همزةً.</p>`;
  const ncPanel = body.querySelector('#namesCounts').closest('details');
  ncPanel.addEventListener('toggle', () => { if (ncPanel.open && !ncPanel.dataset.done) { ncPanel.dataset.done = 1; renderNameCounts(document.getElementById('namesCounts')); } });
  const tb = body.querySelector('tbody'), sorters = body.querySelector('.sorters');
  const SORTS = [['الترتيب في المصحف', (a, b) => a.id - b.id], ['الأكثر آيات', (a, b) => b.verses - a.verses], ['الأكثر كلمات', (a, b) => b.words - a.words], ['الأقل كلمات', (a, b) => a.words - b.words], ['الأكثر حروفاً', (a, b) => b.letters - a.letters]];
  const draw = (i) => {
    sorters.querySelectorAll('.btn').forEach((b, j) => b.classList.toggle('on', i === j));
    tb.innerHTML = S.surahs.slice().sort(SORTS[i][1]).map((s) => `<tr><td>${N(s.id)}</td><td>${esc(s.ar)}</td><td>${s.place === 'makkah' ? 'مكية' : 'مدنية'}</td><td class="num">${N(s.verses)}</td><td class="num">${N(s.words)}</td><td class="num">${N(s.letters)}</td></tr>`).join('');
  };
  sorters.innerHTML = SORTS.map(([n], i) => `<button class="btn" data-i="${i}">${n}</button>`).join('');
  sorters.onclick = (e) => { const b = e.target.closest('.btn'); if (b) draw(+b.dataset.i); };
  draw(0);
}

/* ---------- موضوعات: الحيوان / الجنة / الإدارة (نفس واجهة الإعجاز: مجموعات وبطاقات قابلة للطي) ---------- */
const TOPICS = {
  animals: {
    groups: [['🐜', 'الحشرات وصغار الحيوان'], ['🐦', 'الطيور'], ['🐪', 'الأنعام والدواب'], ['📖', 'حيوانات في القصص والأحداث']],
    items: [
      { g: 0, t: 'النملة', note: 'نملة تحذّر قومها من أن يحطمهم سليمان وجنوده وهم لا يشعرون. فيها حرص القائد الصغير على جماعته وسرعة التحذير.', keys: ['27:18'] },
      { g: 0, t: 'النحل', note: 'أوحى الله إلى النحل أن تتخذ بيوتاً وتأكل من الثمرات وتسلك سبل ربها ذللاً، فيخرج من بطونها شراب مختلف ألوانه فيه شفاء للناس.', keys: ['16:68', '16:69'] },
      { g: 0, t: 'العنكبوت', note: 'ضرب الله مثلاً بالعنكبوت التي اتخذت بيتاً، وأن أوهن البيوت لبيتها، تشبيهاً لضعف من اتخذ من دون الله أولياء.', keys: ['29:41'] },
      { g: 0, t: 'الذباب', note: 'مثلٌ في عجز ما يُعبد من دون الله: لن يخلقوا ذباباً ولو اجتمعوا له، وإن يسلبهم الذباب شيئاً لا يستنقذوه منه.', keys: ['22:73'] },
      { g: 0, t: 'البعوضة', note: 'يضرب الله مثلاً بالبعوضة فما فوقها، فيعلم المؤمنون أنه الحق من ربهم ويقول الذين كفروا ماذا أراد الله بهذا مثلاً.', keys: ['2:26'] },
      { g: 0, t: 'الجراد والقمل والضفادع', note: 'من الآيات التي أرسلها الله على قوم فرعون: الطوفان والجراد والقمل والضفادع والدم، آيات مفصّلات.', keys: ['7:133'] },
      { g: 0, t: 'الفَراش المبثوث', note: 'شبّه القرآن الناس يوم القيامة بالفراش المبثوث، تصويراً لانتشارهم وحيرتهم.', keys: ['101:4'] },
      { g: 1, t: 'الهدهد', note: 'تفقّد سليمان الطير فلم يجد الهدهد، ثم جاءه بنبأ يقين من سبأ. وفيه متابعة القائد لأحوال جنده وسماع التقارير.', keys: ['27:20', '27:21', '27:22'] },
      { g: 1, t: 'الغراب', note: 'بعث الله غراباً يبحث في الأرض ليُري ابن آدم كيف يواري سوأة أخيه، فكان معلّماً للدفن.', keys: ['5:31'] },
      { g: 1, t: 'الطير الأبابيل', note: 'أرسل الله على أصحاب الفيل طيراً أبابيل ترميهم بحجارة من سجّيل فجعلهم كعصف مأكول.', keys: ['105:3', '105:4', '105:5'] },
      { g: 1, t: 'طير إبراهيم', note: 'سأل إبراهيم عليه السلام ربه أن يريه كيف يحيي الموتى، فأمره بأخذ أربعة من الطير وتقطيعها ثم دعائها فتأتيه سعياً.', keys: ['2:260'] },
      { g: 1, t: 'الطير صافّات', note: 'يسبّح لله من في السماوات والأرض والطير صافّات، كلٌّ قد علم صلاته وتسبيحه.', keys: ['24:41'] },
      { g: 2, t: 'الإبل', note: 'يدعو القرآن إلى النظر في خلق الإبل كيف خُلقت، وجاء ذكر الجمل مثلاً في استحالة دخول المكذبين الجنة.', keys: ['88:17', '7:40'] },
      { g: 2, t: 'البقرة', note: 'قصة البقرة التي أمر الله بني إسرائيل بذبحها، وفيها تشدّدهم في الأسئلة حتى شُدّد عليهم.', keys: ['2:67', '2:68'] },
      { g: 2, t: 'الكلب', note: 'ذُكر كلب أهل الكهف باسطاً ذراعيه بالوصيد، وضُرب الكلب مثلاً لمن آتاه الله الآيات فانسلخ منها وأخلد إلى الأرض.', keys: ['18:18', '7:176'] },
      { g: 2, t: 'الحمار', note: 'مثل الذين حُمّلوا التوراة ثم لم يحملوها كمثل الحمار يحمل أسفاراً، وذُكر في الأمر بخفض الصوت أن أنكر الأصوات لصوت الحمير.', keys: ['62:5', '31:19'] },
      { g: 2, t: 'الخيل والبغال والحمير', note: 'خلقها الله للركوب والزينة، وذكرها القرآن ضمن نعمه على الناس.', keys: ['16:8'] },
      { g: 2, t: 'الأنعام ومنافعها', note: 'خلق الله الأنعام لكم فيها دفء ومنافع ومنها تأكلون، ولكم فيها جمال حين تريحون وحين تسرحون، وتحمل أثقالكم.', keys: ['16:5', '16:6', '16:7'] },
      { g: 2, t: 'تذليل الأنعام', note: 'ذكّر الله الناس بأنه خلق لهم الأنعام فهم لها مالكون، وذلّلها لهم فمنها ركوبهم ومنها يأكلون.', keys: ['36:71', '36:72', '36:73'] },
      { g: 3, t: 'ذئب يوسف', note: 'احتجّ إخوة يوسف بأن الذئب أكله، وهي حجة كاذبة جاؤوا عليها بدم كذب، وكان جواب يعقوب: بل سوّلت لكم أنفسكم أمراً.', keys: ['12:13', '12:17', '12:18'] },
      { g: 3, t: 'الفيل', note: 'أصحاب الفيل: أرادوا هدم الكعبة فجعل الله كيدهم في تضليل. وسُمّيت السورة باسم الفيل.', keys: ['105:1', '105:2'] },
      { g: 3, t: 'حوت يونس', note: 'التقم الحوت يونس عليه السلام وهو مليم، فنادى في الظلمات أن لا إله إلا أنت سبحانك إني كنت من الظالمين فنجّاه الله.', keys: ['37:142', '21:87', '68:48'] },
      { g: 3, t: 'ناقة صالح', note: 'ناقة الله آية لثمود، أُمروا أن يذروها تأكل في أرض الله ولا يمسّوها بسوء، فعقروها.', keys: ['7:73'] },
      { g: 3, t: 'فداء إسماعيل', note: 'فدى الله إسماعيل عليه السلام بذبح عظيم بعد أن أسلم هو وأبوه لأمر الله.', keys: ['37:107'] },
      { g: 3, t: 'عصا موسى حيّة', note: 'ألقى موسى عصاه فإذا هي حية تسعى، آيةً أيّد الله بها نبيه، ثم أمره ألا يخاف.', keys: ['20:20', '20:21'] },
      { g: 3, t: 'دابة الأرض', note: 'ذُكرت دابة الأرض التي أكلت منسأة سليمان عليه السلام فخرّ، وذُكرت دابة تخرج من الأرض آيةً قرب الساعة.', keys: ['34:14', '27:82'] },
      { g: 3, t: 'القردة', note: 'ذُكرت قصة قوم اعتدوا في السبت فقيل لهم كونوا قردة خاسئين، عبرةً للمتقين.', keys: ['2:65', '7:166'] },
    ],
  },
  jannah: {
    groups: [['💧', 'الأنهار والعيون'], ['🍇', 'الطعام والشراب'], ['🏡', 'المساكن والأثاث'], ['👘', 'اللباس والزينة'], ['🌴', 'الظلال والجو'], ['🤝', 'الصحبة والسلام'], ['✨', 'أعلى النعيم'], ['🚪', 'السعة والخلود والأبواب']],
    items: [
      { g: 0, t: 'أنهار الجنة', note: 'فيها أنهار من ماء غير آسن، وأنهار من لبن لم يتغير طعمه، وأنهار من خمر لذة للشاربين، وأنهار من عسل مصفّى.', keys: ['47:15'] },
      { g: 0, t: 'عيون الجنة', note: 'عين يشرب بها عباد الله يفجّرونها تفجيراً، وعين تسمى سلسبيلاً، وفي الجنتين عينان تجريان.', keys: ['76:5', '76:6', '76:18', '55:50'] },
      { g: 1, t: 'الفاكهة', note: 'فيهما من كل فاكهة زوجان، وفاكهة ونخل ورمان، وفاكهة مما يتخيّرون، لا مقطوعة ولا ممنوعة.', keys: ['55:52', '55:68', '56:20', '56:32', '56:33'] },
      { g: 1, t: 'قطوفها دانية', note: 'جنة عالية قطوفها دانية، يُقال لأهلها: كلوا واشربوا هنيئاً بما أسلفتم في الأيام الخالية.', keys: ['69:22', '69:23', '69:24'] },
      { g: 1, t: 'الطعام واللحم', note: 'ولحم طير مما يشتهون، وأمدّهم الله بفاكهة ولحم مما يشتهون.', keys: ['56:21', '52:22'] },
      { g: 1, t: 'الشراب', note: 'يُطاف عليهم بآنية من فضة وأكواب، ويُسقون كأساً كان مزاجها زنجبيلاً، ويطوف عليهم ولدان مخلّدون.', keys: ['76:15', '76:17', '76:19'] },
      { g: 2, t: 'الغرف', note: 'للذين اتقوا ربهم غرف من فوقها غرف مبنية تجري من تحتها الأنهار، وعد الله لا يخلف الله الميعاد.', keys: ['39:20'] },
      { g: 2, t: 'الأرائك والسرر', note: 'متكئين فيها على الأرائك، وعلى سرر موضونة متكئين عليها متقابلين، وسرر مرفوعة وأكواب موضوعة ونمارق مصفوفة وزرابي مبثوثة.', keys: ['18:31', '56:15', '56:16', '88:13', '88:14', '88:15', '88:16'] },
      { g: 2, t: 'المساكن الطيبة', note: 'وعد الله المؤمنين جنات تجري من تحتها الأنهار خالدين فيها ومساكن طيبة في جنات عدن.', keys: ['9:72'] },
      { g: 3, t: 'الحلي والثياب', note: 'يحلّون فيها من أساور من ذهب ويلبسون ثياباً خضراً من سندس وإستبرق، ويحلّون أساور من فضة.', keys: ['18:31', '76:21', '22:23'] },
      { g: 4, t: 'الظلّ الظليل', note: 'وندخلهم ظلاً ظليلاً، ومتكئين فيها لا يرون فيها شمساً ولا زمهريراً، وظلّ ممدود.', keys: ['4:57', '76:13', '56:30'] },
      { g: 5, t: 'الأزواج المطهّرة', note: 'ولهم فيها أزواج مطهّرة وهم فيها خالدون، ويدخلها من صلح من آبائهم وأزواجهم وذرياتهم.', keys: ['2:25', '13:23'] },
      { g: 5, t: 'نزع الغلّ', note: 'ونزعنا ما في صدورهم من غلّ إخواناً على سرر متقابلين، لا يمسّهم فيها نصب وما هم منها بمخرجين.', keys: ['15:47', '15:48'] },
      { g: 5, t: 'السلام', note: 'لا يسمعون فيها لغواً ولا تأثيماً إلا قيلاً سلاماً سلاماً، وتحيتهم فيها سلام.', keys: ['56:25', '56:26', '10:10'] },
      { g: 6, t: 'رضوان الله', note: 'ورضوان من الله أكبر، ذلك هو الفوز العظيم؛ فأعلى من نعيم المساكن رضا الله عن أهل الجنة.', keys: ['9:72'] },
      { g: 6, t: 'النظر إلى وجه الله', note: 'وجوه يومئذ ناضرة إلى ربها ناظرة، وللذين أحسنوا الحسنى وزيادة، وقد فسّر العلماء «الزيادة» بالنظر إلى وجه الله الكريم.', keys: ['75:22', '75:23', '10:26'] },
      { g: 6, t: 'ما أُخفي لهم', note: 'فلا تعلم نفس ما أُخفي لهم من قرة أعين جزاءً بما كانوا يعملون؛ فنعيم الجنة أعظم مما يخطر على البال.', keys: ['32:17'] },
      { g: 7, t: 'سعة الجنة', note: 'وسارعوا إلى مغفرة من ربكم وجنة عرضها السماوات والأرض أُعدّت للمتقين.', keys: ['3:133', '57:21'] },
      { g: 7, t: 'الخلود', note: 'خالدين فيها لا يبغون عنها حولاً، أي لا يطلبون عنها تحوّلاً ولا يملّون من الإقامة فيها.', keys: ['18:108'] },
      { g: 7, t: 'أبواب الجنة', note: 'حتى إذا جاؤوها وفُتحت أبوابها وقال لهم خزنتها سلام عليكم طبتم فادخلوها خالدين، والملائكة يدخلون عليهم من كل باب.', keys: ['39:73', '13:23', '13:24'] },
    ],
  },
  management: {
    groups: [['👑', 'القيادة'], ['🗺️', 'التخطيط وإدارة الأزمات'], ['💰', 'الإدارة المالية'], ['⚖️', 'العدل والأمانة والجودة'], ['🤝', 'الشورى والعمل الجماعي'], ['⏱️', 'الوقت والإنجاز']],
    items: [
      { g: 0, t: 'لين القائد والشورى والتوكل', note: 'يبيّن الله لنبيه أن رحمته ولين جانبه جمعا الناس حوله، وأنه لو كان فظاً غليظ القلب لانفضّوا من حوله، فأُمر بالعفو والاستغفار لهم ومشاورتهم، ثم إذا عزم توكّل على الله. فالدرس: القيادة تجمع بين الرفق والمشورة وحسم القرار.', keys: ['3:159'] },
      { g: 0, t: 'القوي الأمين', note: 'قالت إحدى ابنتي صاحب مدين لأبيها عن موسى: «إن خير من استأجرت القوي الأمين». فمعيار الاختيار الكفاءة (القوة) والنزاهة (الأمانة) معاً.', keys: ['28:26'] },
      { g: 0, t: 'حفيظ عليم', note: 'طلب يوسف عليه السلام أن يتولّى خزائن الأرض معلّلاً بأنه «حفيظ عليم»، أي أمين على ما يتولّاه وذو علم بتدبيره: الأمانة والتخصص.', keys: ['12:55'] },
      { g: 0, t: 'تفقّد الجند', note: 'تفقّد سليمان الطير فقال: ما لي لا أرى الهدهد؟ ولم يتجاوز عن الغياب، لكنه سمع حجته وتحقق من نبئه. درس في المتابعة وسماع العذر.', keys: ['27:20', '27:21', '27:22'] },
      { g: 0, t: 'ذو القرنين والمشروع الجماعي', note: 'لما طلب القوم سدّاً ضدّ يأجوج ومأجوج لم يقبل مالهم وطلب أن يعينوه بقوة (جهد وعمل)، فأقام الردم. درس في قيادة المشاريع بمشاركة أصحاب المصلحة.', keys: ['18:94', '18:95'] },
      { g: 1, t: 'خطة يوسف للأزمة', note: 'خطّط يوسف عليه السلام لسنوات القحط: يزرعون سبع سنين دأباً، ويتركون ما حصدوا في سنبله إلا قليلاً مما يأكلون، ثم يأتي عام فيه يُغاث الناس. درس في التخزين والتخطيط المبكر وإدارة الموارد.', keys: ['12:47', '12:48', '12:49'] },
      { g: 1, t: 'الاستعداد', note: 'وأعدّوا لهم ما استطعتم من قوة: الأمر بالاستعداد وإعداد الأسباب قبل الحاجة.', keys: ['8:60'] },
      { g: 2, t: 'الاعتدال في الإنفاق', note: 'ولا تجعل يدك مغلولة إلى عنقك ولا تبسطها كل البسط، ومن صفات عباد الرحمن أنهم إذا أنفقوا لم يسرفوا ولم يقتروا وكان بين ذلك قواماً. درس في الموازنة المالية.', keys: ['17:29', '25:67'] },
      { g: 2, t: 'توثيق المعاملات', note: 'أطول آية في القرآن آية الدَّين: الأمر بكتابة الدين إلى أجل مسمى وبالعدل في الكتابة والإشهاد. أصل في التوثيق والعقود.', keys: ['2:282'] },
      { g: 3, t: 'أداء الأمانات والحكم بالعدل', note: 'إن الله يأمركم أن تؤدوا الأمانات إلى أهلها وإذا حكمتم بين الناس أن تحكموا بالعدل. وفيها وضع الإنسان المناسب في موضعه.', keys: ['4:58', '16:90'] },
      { g: 3, t: 'الوفاء بالعقود', note: 'يا أيها الذين آمنوا أوفوا بالعقود: أصل في احترام الاتفاقيات والالتزام بها.', keys: ['5:1'] },
      { g: 3, t: 'الميزان والكيل', note: 'وأقيموا الوزن بالقسط ولا تخسروا الميزان، وويل للمطففين الذين إذا اكتالوا على الناس يستوفون وإذا كالوهم أو وزنوهم يخسرون. درس في الجودة والنزاهة في التعامل.', keys: ['55:9', '83:1', '83:2', '83:3', '6:152'] },
      { g: 4, t: 'وأمرهم شورى بينهم', note: 'من صفات المؤمنين أن أمرهم شورى بينهم. والشورى منهج في اتخاذ القرار بالتشاور.', keys: ['42:38'] },
      { g: 4, t: 'الملكة والمشورة', note: 'قالت ملكة سبأ لقومها: ما كنت قاطعة أمراً حتى تشهدون. استشارت مجلسها قبل القرار في أمر مصيري.', keys: ['27:32'] },
      { g: 4, t: 'المعاون والتفويض', note: 'طلب موسى عليه السلام من ربه أن يجعل له وزيراً من أهله هارون، وقال: هو أفصح مني لساناً فأرسله معي ردءاً. درس في اختيار المعاون بحسب القدرة وتوزيع المهام.', keys: ['20:29', '20:30', '28:34'] },
      { g: 4, t: 'التعاون', note: 'وتعاونوا على البر والتقوى ولا تعاونوا على الإثم والعدوان: ضابط أخلاقي للعمل الجماعي.', keys: ['5:2'] },
      { g: 5, t: 'فإذا فرغت فانصب', note: 'فإذا فرغت من عمل فاجتهد في عمل آخر: لا تترك فراغاً بلا إنجاز، وفي الجمعة: فإذا قضيت الصلاة فانتشروا في الأرض وابتغوا من فضل الله.', keys: ['94:7', '94:8', '62:10'] },
      { g: 5, t: 'قيمة الوقت', note: 'والعصر إن الإنسان لفي خسر إلا الذين آمنوا وعملوا الصالحات: يُقسم الله بالزمن ويجعل الخسارة هي الأصل إلا لمن عمل وتواصى بالحق والصبر.', keys: ['103:1', '103:2', '103:3'] },
      { g: 5, t: 'إحسان العمل', note: 'الذي خلق الموت والحياة ليبلوكم أيكم أحسن عملاً، وقل اعملوا فسيرى الله عملكم ورسوله والمؤمنون: المعيار هو إحسان العمل لا كثرته فقط، مع المساءلة.', keys: ['67:2', '9:105'] },
    ],
  },
};

TOPICS.people = {
  groups: [['🕊️', 'الأنبياء والرسل المذكورون بأسمائهم'], ['🌿', 'صالحون وحكماء وملوك'], ['⚔️', 'طغاة وخصوم'], ['👼', 'الملائكة وإبليس'], ['🔎', 'أشخاص ذُكروا بلا أسماء']],
  items: [
    { g: 0, t: 'آدم', note: 'أول البشر، خلقه الله من تراب بلا أب ولا أم، ثم قال الملائكة: «فإذا سويته ونفخت فيه من روحي فقعوا له ساجدين». وعلّمه الله الأسماء كلها، وأمر الملائكة بالسجود له.', keys: ['15:29', '38:72', '32:9', '2:31', '2:34'] },
    { g: 0, t: 'إدريس', note: 'وصفه القرآن بأنه كان صدّيقاً نبياً، ورفعه الله مكاناً علياً.', keys: ['19:56', '19:57'] },
    { g: 0, t: 'نوح', note: 'أُرسل إلى قومه، ولبث فيهم ألف سنة إلا خمسين عاماً، وهو صاحب السفينة.', keys: ['71:1', '29:14'] },
    { g: 0, t: 'هود', note: 'أُرسل إلى قوم عاد، أخيهم هود، فدعاهم إلى عبادة الله وحده.', keys: ['11:50'] },
    { g: 0, t: 'صالح', note: 'أُرسل إلى ثمود، وآيته الناقة التي أمرهم ألا يمسّوها بسوء.', keys: ['7:73'] },
    { g: 0, t: 'إبراهيم', note: 'ابتلاه الله بكلمات فأتمّهن، وجعله للناس إماماً، وهو خليل الله.', keys: ['2:124', '4:125'] },
    { g: 0, t: 'لوط', note: 'أُرسل إلى قومه فنهاهم عن الفاحشة التي لم يسبقهم بها أحد من العالمين.', keys: ['7:80'] },
    { g: 0, t: 'إسماعيل', note: 'وصفه القرآن بأنه كان صادق الوعد رسولاً نبياً.', keys: ['19:54'] },
    { g: 0, t: 'إسحاق', note: 'بشّر الله به إبراهيم نبياً من الصالحين.', keys: ['37:112'] },
    { g: 0, t: 'يعقوب', note: 'وصّى بنيه بالإسلام مع إبراهيم، وهو أبو يوسف.', keys: ['2:132'] },
    { g: 0, t: 'يوسف', note: 'رأى رؤيا الأحد عشر كوكباً والشمس والقمر ساجدين له، ومرّ بابتلاءات كثيرة ثم مُكّن في الأرض.', keys: ['12:4', '12:56'] },
    { g: 0, t: 'أيوب', note: 'نادى ربه أنه مسّه الضر، فاستجاب الله له وكشف ما به من ضر.', keys: ['21:83', '21:84'] },
    { g: 0, t: 'شعيب', note: 'أُرسل إلى مدين فأمرهم بالوفاء بالكيل والميزان.', keys: ['7:85'] },
    { g: 0, t: 'موسى', note: 'أكثر الأنبياء ذكراً في القرآن؛ كلّمه الله تكليماً، وأرسله إلى فرعون وبني إسرائيل.', keys: ['20:9', '4:164'] },
    { g: 0, t: 'هارون', note: 'أخو موسى، طلب موسى من ربه أن يجعله وزيراً له.', keys: ['20:29', '20:30'] },
    { g: 0, t: 'داود', note: 'آتاه الله الزبور والملك، وسخّر معه الجبال تسبّح.', keys: ['38:17', '4:163'] },
    { g: 0, t: 'سليمان', note: 'ورث داود وعُلّم منطق الطير، وسُخّرت له الريح والجن.', keys: ['27:16', '38:35'] },
    { g: 0, t: 'إلياس', note: 'من المرسلين، دعا قومه إلى عبادة الله وترك عبادة بعل.', keys: ['37:123', '37:125'] },
    { g: 0, t: 'اليسع', note: 'ذكره القرآن في جملة الأنبياء الذين فضّلهم الله على العالمين.', keys: ['6:86', '38:48'] },
    { g: 0, t: 'يونس', note: 'ذهب مغاضباً فالتقمه الحوت، ثم نادى في الظلمات فنجّاه الله.', keys: ['37:139', '21:87'] },
    { g: 0, t: 'زكريا', note: 'نادى ربه نداءً خفياً أن يهب له ولياً، فبُشّر بيحيى.', keys: ['19:2', '19:3'] },
    { g: 0, t: 'يحيى', note: 'آتاه الله الحكم صبياً، وكان براً بوالديه.', keys: ['19:12', '19:14'] },
    { g: 0, t: 'عيسى', note: 'المسيح ابن مريم، ولد بكلمة من الله، وأيّده بالبينات وروح القدس.', keys: ['3:45', '2:87'] },
    { g: 0, t: 'ذو الكفل', note: 'ذُكر مع إسماعيل وإدريس في الصابرين. وفي كونه نبياً خلاف بين العلماء.', keys: ['21:85'] },
    { g: 0, t: 'محمد ﷺ', note: 'خاتم النبيين والمرسلين، ذُكر اسمه في القرآن أربع مرات، وذُكر باسم «أحمد» مرة في بشارة عيسى.', keys: ['3:144', '33:40', '48:29', '47:2', '61:6'] },
    { g: 1, t: 'لقمان', note: 'آتاه الله الحكمة وأمره بالشكر؛ وسُمّيت سورة باسمه، وفيها وصاياه لابنه. وفي نبوّته خلاف، والأكثر على أنه حكيم صالح.', keys: ['31:12', '31:13'] },
    { g: 1, t: 'ذو القرنين', note: 'ملك مكّنه الله في الأرض وآتاه من كل شيء سبباً، وبنى السدّ في وجه يأجوج ومأجوج.', keys: ['18:83', '18:84'] },
    { g: 1, t: 'مريم', note: 'المرأة الوحيدة المسمّاة في القرآن، وسُمّيت سورة باسمها، واصطفاها الله على نساء العالمين.', keys: ['19:16', '3:42'] },
    { g: 1, t: 'عمران', note: 'والد مريم عليها السلام؛ نذرت امرأته ما في بطنها محرّراً لله.', keys: ['3:35'] },
    { g: 1, t: 'طالوت', note: 'الملك الذي اختاره الله لبني إسرائيل وزاده بسطة في العلم والجسم.', keys: ['2:247'] },
    { g: 1, t: 'زيد بن حارثة', note: 'الصحابي الوحيد الذي ذُكر باسمه في القرآن.', keys: ['33:37'] },
    { g: 2, t: 'فرعون', note: 'الطاغية الذي علا في الأرض وجعل أهلها شيعاً يستضعف طائفة منهم.', keys: ['28:4', '79:24'] },
    { g: 2, t: 'هامان', note: 'وزير فرعون وعونه في الطغيان؛ أمره فرعون أن يبني له صرحاً.', keys: ['28:6', '40:36'] },
    { g: 2, t: 'قارون', note: 'من قوم موسى، آتاه الله من الكنوز ما إن مفاتحه لتنوء بالعصبة أولي القوة، فبغى فخُسف به وبداره الأرض.', keys: ['28:76', '28:81'] },
    { g: 2, t: 'السامري', note: 'الذي أضلّ قوم موسى فصنع لهم عجلاً جسداً له خوار.', keys: ['20:85', '20:87'] },
    { g: 2, t: 'آزر', note: 'ذُكر في قصة إبراهيم عليه السلام وهو يدعوه إلى ترك الأصنام.', keys: ['6:74'] },
    { g: 2, t: 'جالوت', note: 'قائد الجيش الذي هزمه طالوت وقتل داود جالوت.', keys: ['2:249', '2:251'] },
    { g: 2, t: 'أبو لهب', note: 'عمّ النبي ﷺ الذي عاداه، ونزلت فيه وفي امرأته سورة المسد.', keys: ['111:1'] },
    { g: 3, t: 'جبريل', note: 'الملك الذي نزل بالقرآن على قلب النبي ﷺ بإذن الله.', keys: ['2:97'] },
    { g: 3, t: 'ميكال', note: 'ملك ذُكر مع جبريل، ومن عادى الله وملائكته ورسله وجبريل وميكال فإن الله عدو للكافرين.', keys: ['2:98'] },
    { g: 3, t: 'هاروت وماروت', note: 'ملكان ببابل ذكرهما القرآن في سياق ما اتبعه قوم سليمان من السحر.', keys: ['2:102'] },
    { g: 3, t: 'مالك', note: 'خازن النار الذي ينادونه فيقولون: يا مالك ليقض علينا ربك.', keys: ['43:77'] },
    { g: 3, t: 'إبليس', note: 'أبى السجود لآدم واستكبر وكان من الكافرين، وهو عدو للإنسان.', keys: ['2:34', '18:50'] },
    { g: 4, t: 'العبد الصالح (الخضر)', note: 'عبد من عباد الله آتاه الله رحمة وعلماً، التقى به موسى. ولم يُسمَّ في القرآن، وتسميته بالخضر من الأخبار.', keys: ['18:65', '18:66'] },
    { g: 4, t: 'ملكة سبأ', note: 'امرأة تملك قوم سبأ، وأوتيت من كل شيء ولها عرش عظيم. ولم يُذكر اسمها في القرآن.', keys: ['27:23'] },
    { g: 4, t: 'امرأة فرعون', note: 'ضرب الله بها المثل للذين آمنوا إذ قالت: رب ابنِ لي عندك بيتاً في الجنة.', keys: ['66:11'] },
    { g: 4, t: 'امرأة العزيز', note: 'التي راودت يوسف عن نفسه ثم أقرّت: أنا راودته عن نفسه وإنه لمن الصادقين.', keys: ['12:30', '12:51'] },
    { g: 4, t: 'مؤمن آل فرعون', note: 'رجل مؤمن من آل فرعون يكتم إيمانه، قال: أتقتلون رجلاً أن يقول ربي الله.', keys: ['40:28'] },
    { g: 4, t: 'صاحب الجنتين', note: 'صاحب الجنتين الذي اغتر بماله ثم أُحيط بثمره، ضُرب به المثل مع صاحبه المؤمن.', keys: ['18:32', '18:34'] },
    { g: 4, t: 'أصحاب الكهف', note: 'فتية آمنوا بربهم وزادهم الله هدى، فآووا إلى الكهف ولبثوا فيه سنين.', keys: ['18:9', '18:13'] },
    { g: 4, t: 'أصحاب الأخدود', note: 'قوم حفروا الأخدود وأشعلوا فيه النار، والمؤمنون يشهدون عذابهم بإيمانهم.', keys: ['85:4', '85:8'] },
  ],
};
TOPICS.numbers = {
  groups: [['1️⃣', 'من الواحد إلى العشرة'], ['⏳', 'أعداد في الزمن والمدد'], ['📖', 'أعداد في القصص والأحداث'], ['⚖️', 'أعداد في الأحكام'], ['🌌', 'أعداد كبيرة']],
  items: [
    { g: 0, t: 'واحد', note: 'أصل التوحيد: الله أحد، وإلهكم إله واحد.', keys: ['112:1', '2:163'] },
    { g: 0, t: 'اثنين / شهرين', note: 'نهى الله عن اتخاذ إلهين اثنين، وذكر خلق الأزواج: ومن كل شيء خلقنا زوجين. وشهرين: في كفارة القتل الخطأ وكفارة الظهار: فصيام شهرين متتابعين.', keys: ['16:51', '51:49', '4:92', '58:4'] },
    { g: 0, t: 'ثلاثة / ثلاثة أشهر', note: 'من مواضعه: إمهال ثمود ثلاثة أيام، ولبث أهل الكهف ثلاثمائة سنين. وفي عدد أصحاب الكهف: سيقولون ثلاثة رابعهم كلبهم، أي ثلاثة رجال ورابعهم الكلب. وثلاثة أشهر: عدة المطلقات اللائي يئسن من المحيض واللائي لم يحضن: فعدتهن ثلاثة أشهر.', keys: ['11:65', '18:25', '18:22', '65:4'] },
    { g: 0, t: 'أربعة', note: 'من مواضعه: تربّص الذين يؤلون من نسائهم أربعة أشهر، وكون الأشهر الحرم أربعة. وفي أصحاب الكهف: ثلاثة رابعهم كلبهم، فيكون العدد أربعة بالكلب.', keys: ['2:226', '9:36', '18:22'] },
    { g: 0, t: 'خمسة', note: 'أمدّ الله المؤمنين بخمسة آلاف من الملائكة مسوّمين، وما يكون من نجوى ثلاثة إلا هو رابعهم ولا خمسة إلا هو سادسهم. وفي أصحاب الكهف: ويقولون خمسة سادسهم كلبهم، أي خمسة رجال.', keys: ['3:125', '18:22', '58:7'] },
    { g: 0, t: 'ستة', note: 'خلق الله السماوات والأرض في ستة أيام. وفي أصحاب الكهف: خمسة سادسهم كلبهم، فيكون العدد ستة بالكلب.', keys: ['7:54', '18:22'] },
    { g: 0, t: 'سبع وسبعة', note: 'أكثر الأعداد تكراراً: سبع سماوات، وسبع سنابل، وسبع بقرات، وسبعة أبحر، والسبع المثاني. وفي أصحاب الكهف: ويقولون سبعة وثامنهم كلبهم، أي سبعة رجال. وفي قصة يوسف: رؤيا ملك مصر: سبع بقرات سمان يأكلهن سبع عجاف، وسبع سنبلات خضر وأخر يابسات. ففسّرها يوسف عليه السلام: تزرعون سبع سنين دأباً فما حصدتم فذروه في سنبله إلا قليلاً مما تأكلون، ثم يأتي سبع شداد يأكلن ما قدّمتم لهن، ثم عام فيه يغاث الناس وفيه يعصرون.', keys: ['2:29', '2:261', '12:43', '31:27', '15:87', '18:22', '12:43', '12:47', '12:48', '12:49'] },
    { g: 0, t: 'ثمانية', note: 'ثمانية أزواج من الأنعام، وثمانية أيام حسوماً على عاد. وفي أصحاب الكهف: سبعة وثامنهم كلبهم، فيكون العدد ثمانية بالكلب.', keys: ['6:143', '69:7', '18:22'] },
    { g: 0, t: 'تسعة', note: 'تسع آيات بيّنات أوتيها موسى، وتسعة رهط يفسدون في الأرض.', keys: ['17:101', '27:48'] },
    { g: 0, t: 'عشرة', note: 'من مواضعه: صيام عشرة كاملة، والتحدي بعشر سور، وليالٍ عشر.', keys: ['2:196', '11:13', '89:2'] },
    { g: 1, t: 'اثنا عشر شهراً / اثنتا عشرة عيناً', note: 'إن عدة الشهور عند الله اثنا عشر شهراً في كتاب الله منها أربعة حرم. وفي قصة موسى: انفجرت من الحجر اثنتا عشرة عيناً لما استسقى موسى لقومه، وبعث الله منهم اثني عشر نقيباً.', keys: ['9:36', '2:60', '5:12'] },
    { g: 1, t: 'ثلاثمائة وتسع سنين', note: 'لبث أصحاب الكهف في كهفهم ثلاثمائة سنين وازدادوا تسعاً.', keys: ['18:25'] },
    { g: 1, t: 'ألف شهر / ألف سنة', note: 'ليلة القدر خير من ألف شهر. وإن يوماً عند ربك كألف سنة مما تعدّون، ومثله ألف سنة إلا خمسين عاماً لنوح في قومه.', keys: ['97:3', '22:47', '29:14'] },
    { g: 1, t: 'مائة عام / مائة حبة', note: 'قصة الذي مرّ على قرية فأماته الله مائة عام ثم بعثه. ومثل الذين ينفقون أموالهم في سبيل الله: كمثل حبة أنبتت سبع سنابل في كل سنبلة مائة حبة.', keys: ['2:259', '2:261'] },
    { g: 2, t: 'تسعة عشر', note: 'عليها تسعة عشر: عدد خزنة سقر.', keys: ['74:30'] },
    { g: 2, t: 'أربعون ليلة / أربعون سنة', note: 'ميقات ربه أربعين ليلة، وهي ثلاثون ليلة أُتمّت بعشر. وأربعون سنة: التيه أربعين سنة على بني إسرائيل، وبلوغ الإنسان أشدّه وأربعين سنة.', keys: ['7:142', '5:26', '46:15'] },
    { g: 2, t: 'تسع وتسعون نعجة', note: 'في قصة الخصمين اللذين تسوّرا المحراب على داود: إن هذا أخي له تسع وتسعون نعجة.', keys: ['38:23'] },
    { g: 2, t: 'بضع سنين (قصة يوسف)', note: 'قال لصاحبه الذي ظن أنه ناج: اذكرني عند ربك، فأنساه الشيطان ذكر ربه، فلبث في السجن بضع سنين. والبضع من ثلاث إلى تسع.', keys: ['12:42'] },
    { g: 2, t: 'أحد عشر كوكباً', note: 'رؤيا يوسف عليه السلام وهو صغير: إني رأيت أحد عشر كوكباً والشمس والقمر رأيتهم لي ساجدين.', keys: ['12:4'] },
    { g: 2, t: 'مائة ألف', note: 'وأرسلناه إلى مائة ألف أو يزيدون: في قصة يونس عليه السلام.', keys: ['37:147'] },
    { g: 3, t: 'ثمانون جلدة', note: 'حدّ القذف: فاجلدوهم ثمانين جلدة.', keys: ['24:4'] },
    { g: 3, t: 'ستون مسكيناً', note: 'من كفارة الظهار: فإطعام ستين مسكيناً.', keys: ['58:4'] },
    { g: 3, wide: true, t: 'أجزاء الميراث : النصف والثلث والربع والسدس والثمن', note: 'ذكر القرآن الأنصبة: النصف والثلث والربع والسدس والثمن في آيات المواريث.', keys: ['4:11', '4:12'] },
    { g: 3, t: 'عشرون', note: 'إن يكن منكم عشرون صابرون يغلبوا مائتين، تخفيفاً بعد ذلك وتقدير النسبة بحسب الصبر.', keys: ['8:65', '8:66'] },
    { g: 3, t: 'مائتان', note: 'إن يكن منكم عشرون صابرون يغلبوا مائتين، تخفيفاً بعد ذلك وتقدير النسبة بحسب الصبر.', keys: ['8:65', '8:66'] },
    { g: 3, t: 'ألف يغلبون ألفين', note: 'فإن يكن منكم مائة صابرة يغلبوا مائتين وإن يكن منكم ألف يغلبوا ألفين بإذن الله، والله مع الصابرين.', keys: ['8:66'] },
    { g: 4, t: 'سبعون :  مرة / ذراعاً/رجلاً', note: 'إن تستغفر لهم سبعين مرة فلن يغفر الله لهم: جاء في المنافقين. وفي صفة العذاب: في سلسلة ذرعها سبعون ذراعاً. وفي قصة موسى: اختار موسى من قومه سبعين رجلاً لميقاتنا.', keys: ['9:80', '69:32', '7:155'] },
    { g: 4, t: 'خُمس', note: 'واعلموا أنما غنمتم من شيء فأن لله خمسه وللرسول: خمس الغنيمة لله وللرسول ولذي القربى واليتامى والمساكين وابن السبيل.', keys: ['8:41'] },
    { g: 4, t: 'خمسون / خمسون ألف سنة', note: 'لبث نوح في قومه ألف سنة إلا خمسين عاماً. وفي يوم القيامة: تعرج الملائكة والروح إليه في يوم كان مقداره خمسين ألف سنة.', keys: ['29:14', '70:4'] },
  ],
};
// jannah: one flat list of boxes (no category column), still in category order
{ const J = TOPICS.jannah; J.items = J.items.map((m, i) => [m, i]).sort((a, b) => a[0].g - b[0].g || a[1] - b[1]).map(([m]) => ({ ...m, g: 0 }));
  const FIRST = ['أبواب الجنة', 'الخلود', 'النظر إلى وجه الله', 'رضوان الله', 'السلام', 'سعة الجنة', 'الظلّ الظليل', 'المساكن الطيبة', 'نزع الغلّ'];                  // shown first, in this order
  J.items = [...FIRST.map((t) => J.items.find((m) => m.t === t)), ...J.items.filter((m) => !FIRST.includes(m.t))];
  J.groups = [['', '']]; }
TOPICS.jannah2 = { groups: TOPICS.jannah.groups, items: [...TOPICS.jannah.items] };   // #jannah2: preview of the jannah page with five boxes per row
// يوم القيامة / فضل حافظ القرآن: one flat list of boxes each
TOPICS.qiyamah = { groups: [['', '']], items: [
    { g: 0, t: 'أسماء يوم القيامة', note: 'سمّى القرآن يوم القيامة بأسماء كثيرة تدل على أهواله، منها: القارعة، والحاقة، والطامة الكبرى، والصاخّة، والغاشية، ويوم الدين، ويوم التغابن.', keys: ['101:1', '69:1', '79:34', '80:33', '88:1', '1:4', '64:9'] },
    { g: 0, t: 'علم الساعة عند الله', note: 'يسألونك عن الساعة أيّان مرساها، قل إنما علمها عند ربي لا يجلّيها لوقتها إلا هو، وإن الله عنده علم الساعة.', keys: ['7:187', '31:34'] },
    { g: 0, t: 'أشراط الساعة', note: 'فقد جاء أشراطها، ومنها في القرآن: انشقاق القمر، وخروج يأجوج ومأجوج، وخروج دابة من الأرض تكلّم الناس.', keys: ['47:18', '54:1', '21:96', '27:82'] },
    { g: 0, t: 'النفخ في الصور', note: 'ونُفخ في الصور فصعق من في السماوات ومن في الأرض إلا من شاء الله، ثم نُفخ فيه أخرى فإذا هم قيام ينظرون.', keys: ['39:68', '36:51'] },
    { g: 0, t: 'زلزلة الأرض', note: 'إذا زُلزلت الأرض زلزالها وأخرجت الأرض أثقالها، إن زلزلة الساعة شيء عظيم تذهل فيه كل مرضعة عما أرضعت.', keys: ['99:1', '99:2', '22:1', '22:2'] },
    { g: 0, t: 'تغيّر الكون', note: 'إذا الشمس كُوّرت، وإذا النجوم انكدرت، وإذا السماء انفطرت، وإذا الكواكب انتثرت، وخسف القمر وجُمع الشمس والقمر.', keys: ['81:1', '81:2', '82:1', '82:2', '75:8', '75:9'] },
    { g: 0, t: 'نسف الجبال', note: 'ويسألونك عن الجبال فقل ينسفها ربي نسفاً، وتكون الجبال كالعهن المنفوش، وسُيّرت الجبال فكانت سراباً.', keys: ['20:105', '101:5', '78:20', '81:3'] },
    { g: 0, t: 'البعث من القبور', note: 'إذا بُعثر ما في القبور، يخرجون من الأجداث كأنهم جراد منتشر، فإذا هم من الأجداث إلى ربهم ينسلون.', keys: ['100:9', '54:7', '36:51'] },
    { g: 0, t: 'الحشر', note: 'وحشرناهم فلم نغادر منهم أحداً، يوم نحشر المتقين إلى الرحمن وفداً ونسوق المجرمين إلى جهنم ورداً.', keys: ['18:47', '19:85', '19:86', '20:102'] },
    { g: 0, t: 'طول ذلك اليوم', note: 'في يوم كان مقداره خمسين ألف سنة، تعرج الملائكة والروح إليه.', keys: ['70:4', '32:5'] },
    { g: 0, t: 'مجيء الرب والملائكة صفاً', note: 'وجاء ربك والملك صفاً صفاً، يوم يقوم الروح والملائكة صفاً لا يتكلمون إلا من أذن له الرحمن.', keys: ['89:21', '89:22', '78:38'] },
    { g: 0, t: 'يفرّ المرء من أخيه', note: 'يوم يفرّ المرء من أخيه وأمه وأبيه وصاحبته وبنيه، لكل امرئ منهم يومئذ شأن يغنيه، يوم لا ينفع مال ولا بنون إلا من أتى الله بقلب سليم.', keys: ['80:34', '80:35', '80:36', '80:37', '26:88', '26:89'] },
    { g: 0, t: 'لا تجزي نفس عن نفس', note: 'واتقوا يوماً لا تجزي نفس عن نفس شيئاً، يوم لا تملك نفس لنفس شيئاً والأمر يومئذ لله.', keys: ['2:48', '82:19'] },
    { g: 0, t: 'الشفاعة', note: 'من ذا الذي يشفع عنده إلا بإذنه، ولا تنفع الشفاعة إلا من أذن له الرحمن ورضي له قولاً.', keys: ['2:255', '20:109', '53:26'] },
    { g: 0, t: 'الكتاب وتطاير الصحف', note: 'ونُخرج له يوم القيامة كتاباً يلقاه منشوراً: اقرأ كتابك، فأما من أوتي كتابه بيمينه، وأما من أوتي كتابه بشماله أو وراء ظهره.', keys: ['17:13', '17:14', '69:19', '69:25', '84:7', '84:10'] },
    { g: 0, t: 'شهادة الجوارح', note: 'اليوم نختم على أفواههم وتكلّمنا أيديهم وتشهد أرجلهم، وشهد عليهم سمعهم وأبصارهم وجلودهم بما كانوا يعملون.', keys: ['36:65', '41:20', '24:24'] },
    { g: 0, t: 'الميزان', note: 'ونضع الموازين القسط ليوم القيامة فلا تُظلم نفس شيئاً، فأما من ثقلت موازينه فهو في عيشة راضية، وأما من خفّت موازينه فأمه هاوية.', keys: ['21:47', '101:6', '101:8'] },
    { g: 0, t: 'مثقال ذرة', note: 'فمن يعمل مثقال ذرة خيراً يره، ومن يعمل مثقال ذرة شراً يره، وإن الله لا يظلم مثقال ذرة.', keys: ['99:7', '99:8', '4:40'] },
    { g: 0, t: 'الورود على النار', note: 'وإن منكم إلا واردها كان على ربك حتماً مقضياً، ثم ننجّي الذين اتقوا ونذر الظالمين فيها جثياً.', keys: ['19:71', '19:72'] },
    { g: 0, t: 'وجوه يومئذ', note: 'يوم تبيضّ وجوه وتسودّ وجوه، وجوه يومئذ مسفرة ضاحكة مستبشرة، ووجوه يومئذ عليها غبرة ترهقها قترة.', keys: ['3:106', '80:38', '80:39', '80:40', '80:41'] },
    { g: 0, t: 'أصحاب الأعراف', note: 'وبينهما حجاب وعلى الأعراف رجال يعرفون كلاً بسيماهم، ونادوا أصحاب الجنة أن سلام عليكم.', keys: ['7:46'] },
    { g: 0, t: 'الحسرة والندم', note: 'يقول الكافر يا ليتني كنت تراباً، ويقول يا ليتني قدّمت لحياتي، ويوم يعضّ الظالم على يديه يقول يا ليتني اتخذت مع الرسول سبيلاً.', keys: ['78:40', '89:24', '25:27'] },
] };
TOPICS.hafiz = { groups: [['', '']], items: [
    { g: 0, t: 'حفظ الله للقرآن', note: 'إنا نحن نزّلنا الذكر وإنا له لحافظون؛ وحفّاظ القرآن من أسباب هذا الحفظ الذي تكفّل الله به.', keys: ['15:9'] },
    { g: 0, t: 'في صدور الذين أوتوا العلم', note: 'بل هو آيات بيّنات في صدور الذين أوتوا العلم؛ فوصف القرآن بأنه محفوظ في الصدور.', keys: ['29:49'] },
    { g: 0, t: 'تيسير القرآن للذكر', note: 'ولقد يسّرنا القرآن للذكر فهل من مدّكر؛ تكررت في سورة القمر أربع مرات، ومن معانيها تيسيره للحفظ والتلاوة.', keys: ['54:17', '54:22', '54:32', '54:40'] },
    { g: 0, t: 'سنقرئك فلا تنسى', note: 'وعد الله نبيه ﷺ بحفظ القرآن في صدره: سنقرئك فلا تنسى، إن علينا جمعه وقرآنه.', keys: ['87:6', '75:16', '75:17', '75:18'] },
    { g: 0, t: 'ورثة الكتاب', note: 'ثم أورثنا الكتاب الذين اصطفينا من عبادنا؛ فحملة القرآن ممن اصطفاهم الله لوراثة كتابه.', keys: ['35:32'] },
    { g: 0, t: 'تجارة لن تبور', note: 'إن الذين يتلون كتاب الله وأقاموا الصلاة وأنفقوا يرجون تجارة لن تبور، ليوفّيهم أجورهم ويزيدهم من فضله.', keys: ['35:29', '35:30'] },
    { g: 0, t: 'يتلونه حق تلاوته', note: 'الذين آتيناهم الكتاب يتلونه حق تلاوته أولئك يؤمنون به.', keys: ['2:121'] },
    { g: 0, t: 'ترتيل القرآن', note: 'ورتّل القرآن ترتيلاً، فاقرؤوا ما تيسّر من القرآن.', keys: ['73:4', '73:20'] },
    { g: 0, t: 'قيام الليل بالقرآن', note: 'من أهل الكتاب أمة قائمة يتلون آيات الله آناء الليل وهم يسجدون، وأُمر النبي ﷺ وأصحابه بقيام الليل وقراءة ما تيسر.', keys: ['3:113', '73:20'] },
    { g: 0, t: 'الخشوع وزيادة الإيمان', note: 'إذا تُليت عليهم آياته زادتهم إيماناً، ويخرّون للأذقان يبكون ويزيدهم خشوعاً، تقشعرّ منه جلود الذين يخشون ربهم.', keys: ['8:2', '17:107', '17:109', '39:23'] },
    { g: 0, t: 'التدبّر', note: 'كتاب أنزلناه إليك مبارك ليدّبّروا آياته وليتذكر أولو الألباب، أفلا يتدبرون القرآن.', keys: ['38:29', '47:24'] },
    { g: 0, t: 'شفاء ورحمة', note: 'وننزّل من القرآن ما هو شفاء ورحمة للمؤمنين، وشفاء لما في الصدور وهدى ورحمة.', keys: ['17:82', '10:57'] },
    { g: 0, t: 'الاستماع والإنصات', note: 'وإذا قُرئ القرآن فاستمعوا له وأنصتوا لعلكم تُرحمون.', keys: ['7:204'] },
    { g: 0, t: 'يهدي للتي هي أقوم', note: 'إن هذا القرآن يهدي للتي هي أقوم ويبشّر المؤمنين الذين يعملون الصالحات أن لهم أجراً كبيراً.', keys: ['17:9'] },
    { g: 0, t: 'رفعة أهل العلم', note: 'يرفع الله الذين آمنوا منكم والذين أوتوا العلم درجات؛ وأولى العلم علم كتاب الله.', keys: ['58:11'] },
    { g: 0, t: 'الماهر بالقرآن مع السفرة', note: 'حديث متفق عليه: «الماهر بالقرآن مع السفرة الكرام البررة، والذي يقرأ القرآن ويتتعتع فيه وهو عليه شاق له أجران». والسفرة الكرام البررة هم الملائكة المذكورون في سورة عبس.', keys: ['80:15', '80:16'] },
    { g: 0, t: 'خيركم من تعلّم القرآن وعلّمه', note: 'حديث رواه البخاري: «خيركم من تعلّم القرآن وعلّمه».', keys: [] },
    { g: 0, t: 'اقرأ وارتقِ', note: 'حديث رواه أبو داود والترمذي وصحّحه: «يُقال لصاحب القرآن: اقرأ وارتقِ ورتّل كما كنت ترتّل في الدنيا، فإن منزلتك عند آخر آية تقرؤها».', keys: [] },
    { g: 0, t: 'شفيعاً لأصحابه', note: 'حديث رواه مسلم: «اقرؤوا القرآن فإنه يأتي يوم القيامة شفيعاً لأصحابه».', keys: [] },
] };
// numbers: one flat list, smallest value to largest (the value each box stands for, in item order)
{ const V = [1,2,3,4,5,6,7,8,9,10,12,309,1000,100,19,40,99,7,11,100000,80,60,0.5,20,200,1000,70,0.75,50];
  const N = TOPICS.numbers; N.items.forEach((m, i) => { m.v = V[i]; m.g = 0; });
  N.items = N.items.map((m, i) => [m, i]).sort((a, b) => a[0].v - b[0].v || a[1] - b[1]).map(([m]) => m);
  N.groups = [['', '']]; }
TOPICS.names = {
  groups: [["🌟", "الذات والتنزيه"], ["💚", "الرحمة والمغفرة"], ["👑", "العظمة والقوة"], ["🧠", "العلم والحكمة والإحاطة"], ["🌍", "الخلق والتدبير والرزق"], ["🤲", "الولاية والإجابة والنصرة"]],
  items: [
    { g: 0, t: "الله", note: "الاسم الجامع لجميع الأسماء والصفات، المعبود بحق", keys: ['1:1'] },
    { g: 0, t: "القدوس", note: "المنزّه عن كل نقص وعيب", keys: ['59:23'] },
    { g: 0, t: "السلام", note: "السالم من كل عيب ونقص", keys: ['59:23'] },
    { g: 0, t: "الأحد", note: "المتفرّد الذي لا شريك له ولا نظير", keys: ['112:1'] },
    { g: 0, t: "الواحد", note: "الذي لا ثاني له في ذاته وصفاته", keys: ['13:16'] },
    { g: 0, t: "الصمد", note: "السيد الذي تُقصد إليه الحوائج ولا يحتاج إلى أحد", keys: ['112:2'] },
    { g: 0, t: "الحي", note: "كامل الحياة التي لا موت فيها", keys: ['2:255'] },
    { g: 0, t: "القيوم", note: "القائم بنفسه المقيم لغيره", keys: ['2:255'] },
    { g: 0, t: "الأول", note: "الذي ليس قبله شيء", keys: ['57:3'] },
    { g: 0, t: "الآخر", note: "الذي ليس بعده شيء", keys: ['57:3'] },
    { g: 0, t: "الظاهر", note: "الذي ليس فوقه شيء", keys: ['57:3'] },
    { g: 0, t: "الباطن", note: "الذي ليس دونه شيء", keys: ['57:3'] },
    { g: 0, t: "الحق", note: "الثابت الذي لا يتغير، ووعده الحق", keys: ['22:6'] },
    { g: 0, t: "الملك", note: "المالك لكل شيء المتصرف فيه", keys: ['59:23'] },
    { g: 0, t: "مالك الملك", note: "يؤتي الملك من يشاء وينزعه ممن يشاء", keys: ['3:26'] },
    { g: 0, t: "مالك يوم الدين", note: "المالك ليوم الجزاء والحساب", keys: ['1:4'] },
    { g: 1, t: "الرحمن", note: "ذو الرحمة الواسعة التي وسعت كل شيء", keys: ['1:3'] },
    { g: 1, t: "الرحيم", note: "الموصل رحمته إلى عباده المؤمنين", keys: ['1:3'] },
    { g: 1, t: "الغفور", note: "كثير المغفرة الذي يستر الذنوب ويتجاوز عنها", keys: ['2:173'] },
    { g: 1, t: "الغفار", note: "المبالغ في المغفرة لمن تاب", keys: ['20:82'] },
    { g: 1, t: "التواب", note: "الذي يقبل توبة عباده ويوفقهم إليها", keys: ['2:37'] },
    { g: 1, t: "العفو", note: "الذي يمحو الذنوب ويتجاوز عن العقوبة", keys: ['4:43'] },
    { g: 1, t: "الرؤوف", note: "شديد الرحمة والرفق بعباده", keys: ['2:207'] },
    { g: 1, t: "الودود", note: "المحب لأوليائه المحبوب عندهم", keys: ['85:14'] },
    { g: 1, t: "البر", note: "العطوف المحسن إلى عباده", keys: ['52:28'] },
    { g: 1, t: "الحليم", note: "الذي لا يعاجل بالعقوبة مع القدرة", keys: ['2:235'] },
    { g: 1, t: "الشكور", note: "يجازي على القليل من العمل بالكثير من الثواب", keys: ['35:30'] },
    { g: 1, t: "الكريم", note: "كثير الخير والعطاء", keys: ['82:6'] },
    { g: 1, t: "الأكرم", note: "الذي لا يبلغ كرمه كرم", keys: ['96:3'] },
    { g: 1, t: "أرحم الراحمين", note: "أعظم الراحمين رحمة", keys: ['12:64'] },
    { g: 1, t: "الغني", note: "المستغني عن خلقه وكل ما سواه محتاج إليه", keys: ['2:263'] },
    { g: 2, t: "العزيز", note: "الغالب الذي لا يُغلب", keys: ['59:23'] },
    { g: 2, t: "الجبار", note: "العظيم الذي يقهر ويجبر الكسر", keys: ['59:23'] },
    { g: 2, t: "المتكبر", note: "المتعالي عن صفات الخلق", keys: ['59:23'] },
    { g: 2, t: "القهار", note: "الذي قهر كل شيء وخضع له", keys: ['13:16'] },
    { g: 2, t: "القاهر", note: "الغالب فوق عباده", keys: ['6:18'] },
    { g: 2, t: "القوي", note: "كامل القوة", keys: ['22:40'] },
    { g: 2, t: "المتين", note: "شديد القوة الذي لا يلحقه ضعف", keys: ['51:58'] },
    { g: 2, t: "القادر", note: "الذي لا يعجزه شيء", keys: ['6:65'] },
    { g: 2, t: "المقتدر", note: "التام القدرة", keys: ['54:42'] },
    { g: 2, t: "القدير", note: "كامل القدرة على كل شيء", keys: ['2:20'] },
    { g: 2, t: "العظيم", note: "الذي له العظمة في ذاته وصفاته", keys: ['2:255'] },
    { g: 2, t: "العلي", note: "له العلو المطلق ذاتاً وقدراً وقهراً", keys: ['2:255'] },
    { g: 2, t: "الكبير", note: "الأعظم من كل شيء", keys: ['22:62'] },
    { g: 2, t: "المتعال", note: "المتنزّه عن صفات النقص والعالي على خلقه", keys: ['13:9'] },
    { g: 2, t: "المجيد", note: "ذو المجد والعظمة والكرم", keys: ['85:15'] },
    { g: 2, t: "الحميد", note: "المحمود في ذاته وصفاته وأفعاله", keys: ['14:1'] },
    { g: 2, t: "ذو الجلال والإكرام", note: "صاحب العظمة والجلال والإكرام لأوليائه", keys: ['55:27'] },
    { g: 2, t: "شديد العقاب", note: "شديد العقوبة لمن عصاه", keys: ['2:196'] },
    { g: 2, t: "سريع الحساب", note: "الذي لا يشغله حساب أحد عن حساب آخر", keys: ['2:202'] },
    { g: 2, t: "ذو انتقام", note: "ينتقم ممن عصاه وتجاوز حدوده", keys: ['3:4'] },
    { g: 2, t: "رفيع الدرجات", note: "رفيع الصفات ويرفع درجات عباده", keys: ['40:15'] },
    { g: 3, t: "العليم", note: "الذي أحاط علمه بكل شيء", keys: ['2:32'] },
    { g: 3, t: "الحكيم", note: "الذي يضع الأمور في مواضعها", keys: ['2:32'] },
    { g: 3, t: "الخبير", note: "العالم ببواطن الأمور", keys: ['6:18'] },
    { g: 3, t: "اللطيف", note: "الذي يدرك الدقائق ويرفق بعباده", keys: ['6:103'] },
    { g: 3, t: "السميع", note: "الذي يسمع كل صوت", keys: ['2:127'] },
    { g: 3, t: "البصير", note: "الذي يرى كل شيء", keys: ['17:1'] },
    { g: 3, t: "الشهيد", note: "المطلع على كل شيء", keys: ['22:17'] },
    { g: 3, t: "الرقيب", note: "الحافظ المراقب لأحوال خلقه", keys: ['33:52'] },
    { g: 3, t: "المحيط", note: "الذي أحاط بكل شيء علماً وقدرة", keys: ['41:54'] },
    { g: 3, t: "الواسع", note: "الذي وسع علمه ورحمته وفضله كل شيء", keys: ['2:115'] },
    { g: 3, t: "الحفيظ", note: "الذي يحفظ خلقه وأعمالهم", keys: ['11:57'] },
    { g: 3, t: "الحسيب", note: "الكافي الذي يحاسب عباده", keys: ['4:6'] },
    { g: 3, t: "المهيمن", note: "الرقيب الشاهد على كل شيء", keys: ['59:23'] },
    { g: 3, t: "أحكم الحاكمين", note: "أعدل الحاكمين وأعلمهم في حكمه", keys: ['95:8'] },
    { g: 4, t: "الخالق", note: "الموجد للأشياء من العدم", keys: ['59:24'] },
    { g: 4, t: "البارئ", note: "الذي برأ الخلق وميّز بعضه عن بعض", keys: ['59:24'] },
    { g: 4, t: "المصوّر", note: "الذي صوّر الخلق على ما أراد", keys: ['59:24'] },
    { g: 4, t: "الخلّاق", note: "كثير الخلق دائم الإبداع", keys: ['15:86'] },
    { g: 4, t: "البديع", note: "مبدع السماوات والأرض على غير مثال", keys: ['2:117'] },
    { g: 4, t: "الفاطر", note: "الذي فطر السماوات والأرض أي خلقها وابتدأها", keys: ['6:14'] },
    { g: 4, t: "الرب", note: "المالك المربّي المدبّر لشؤون خلقه", keys: ['1:2'] },
    { g: 4, t: "الرزّاق", note: "الذي يرزق جميع المخلوقات", keys: ['51:58'] },
    { g: 4, t: "الوهاب", note: "كثير الهبات والعطايا", keys: ['38:9'] },
    { g: 4, t: "الفتّاح", note: "الذي يفتح لعباده أبواب الرزق والرحمة والحكم", keys: ['34:26'] },
    { g: 4, t: "المقيت", note: "المقتدر الذي يعطي كل مخلوق قوته", keys: ['4:85'] },
    { g: 4, t: "الهادي", note: "الذي يهدي من يشاء إلى الحق", keys: ['25:31'] },
    { g: 4, t: "النور", note: "منوّر السماوات والأرض ومنوّر قلوب المؤمنين", keys: ['24:35'] },
    { g: 4, t: "الجامع", note: "الذي يجمع الناس ليوم الحساب", keys: ['3:9'] },
    { g: 4, t: "خير الرازقين", note: "أفضل من يرزق ويعطي", keys: ['5:114'] },
    { g: 4, t: "ذو الفضل العظيم", note: "صاحب الفضل الواسع على عباده", keys: ['3:74'] },
    { g: 5, t: "الولي", note: "المتولّي لأمور عباده المؤمنين بالنصرة والتأييد", keys: ['42:9'] },
    { g: 5, t: "المولى", note: "السيد والناصر والمتولي لعباده", keys: ['8:40'] },
    { g: 5, t: "النصير", note: "الذي ينصر أولياءه", keys: ['8:40'] },
    { g: 5, t: "الوكيل", note: "الذي يُفوَّض إليه الأمر ويكفي من توكل عليه", keys: ['3:173'] },
    { g: 5, t: "المجيب", note: "الذي يجيب دعاء من دعاه", keys: ['11:61'] },
    { g: 5, t: "القريب", note: "القريب من عباده بعلمه وإجابته", keys: ['2:186'] },
    { g: 5, t: "المؤمن", note: "الذي يؤمّن عباده من الظلم ويصدّق رسله", keys: ['59:23'] },
  ],
};

/* people screen split into prophets / others */
TOPICS.prophets = {
  groups: [['⭐', 'أولو العزم من الرسل'], ['🕊️', 'بقية الأنبياء والرسل المذكورين بأسمائهم عليهم السلام']],
  items: TOPICS.people.items.filter((i) => i.g === 0).map((i) => ({ ...i, g: ['نوح', 'إبراهيم', 'موسى', 'عيسى', 'محمد ﷺ'].includes(i.t) ? 0 : 1 })),
};
TOPICS.jesus = {
  groups: [['👶', 'ميلاد عيسى ورسالته'], ['✨', 'معجزاته ودعوته'], ['☁️', 'رفعه وما يُقال فيه'], ['🌺', 'مريم عليها السلام'], ['❤️', 'الإيمان بعيسى ومريم ومحبتهما']],
  items: [
    { g: 0, t: 'بشارة الملائكة بمولده', note: 'بشّرت الملائكة مريم بكلمة من الله اسمه المسيح عيسى ابن مريم، وجيهاً في الدنيا والآخرة ومن المقرّبين.', keys: ['3:45', '3:47', '19:21'] },
    { g: 0, t: 'كلامه في المهد', note: 'تكلّم عيسى عليه السلام وهو في المهد صبياً فقال: إني عبد الله آتاني الكتاب وجعلني نبياً، وجعلني مباركاً أينما كنت.', keys: ['19:29', '19:30', '19:31', '19:33', '3:46'] },
    { g: 0, t: 'مثله كمثل آدم', note: 'خلق الله عيسى بلا أب بكلمة «كن»، ومثله عند الله كمثل آدم خلقه من تراب بلا أب ولا أم، ثم نفخ فيه من روحه. وكذلك زوج آدم خُلقت من نفسه بلا أب ولا أم: «وخلق منها زوجها» (وهي حواء كما في السنّة، ولم يسمّها القرآن). ومثلهم في الآية ناقة صالح، آية من الله لقوم ثمود، وجاء في التفسير أنها خرجت من الصخرة بلا أب ولا أم.', keys: ['3:59', '15:29', '4:1', '7:73'] },
    { g: 0, t: 'عبد الله ورسوله', note: 'يبيّن القرآن أنه عبد أنعم الله عليه، ورسول قد خلت من قبله الرسل، وأن الله منزّه عن الولد.', keys: ['4:171', '43:59', '5:75', '19:34', '19:35'] },
    { g: 0, t: 'الإنجيل', note: 'آتاه الله الإنجيل فيه هدى ونور ومصدقاً لما بين يديه من التوراة، وجعل في قلوب الذين اتبعوه رأفة ورحمة.', keys: ['5:46', '57:27', '3:48'] },
    { g: 0, t: 'البشارة بأحمد', note: 'قال عيسى لبني إسرائيل: إني رسول الله إليكم مصدقاً لما بين يدي من التوراة ومبشراً برسول يأتي من بعدي اسمه أحمد.', keys: ['61:6'] },
    { g: 1, t: 'معجزاته', note: 'أيّده الله بالبينات وروح القدس: خلق من الطين كهيئة الطير بإذن الله، وأبرأ الأكمه والأبرص، وأحيا الموتى بإذن الله.', keys: ['3:49', '5:110', '2:87', '2:253'] },
    { g: 1, t: 'المائدة من السماء', note: 'سأل الحواريون عيسى أن ينزل الله عليهم مائدة من السماء، فدعا ربه أن تكون لهم عيداً لأولهم وآخرهم وآية منه.', keys: ['5:112', '5:114'] },
    { g: 1, t: 'الحواريون وأنصار الله', note: 'لما أحسّ عيسى منهم الكفر قال: من أنصاري إلى الله؟ قال الحواريون: نحن أنصار الله آمنا بالله واشهد بأنا مسلمون.', keys: ['3:52', '61:14'] },
    { g: 2, t: 'رفعه وعدم صلبه', note: 'ما قتلوه وما صلبوه ولكن شُبّه لهم، بل رفعه الله إليه، وقال الله له: إني متوفيك ورافعك إلي ومطهرك من الذين كفروا.', keys: ['4:157', '4:158', '3:55'] },
    { g: 2, t: 'ردّ القرآن على الغلو فيه', note: 'كفر الذين قالوا إن الله هو المسيح ابن مريم، وسيسأله الله يوم القيامة: أأنت قلت للناس اتخذوني وأمي إلهين من دون الله؟ فيتبرأ.', keys: ['5:72', '5:17', '5:116', '5:117', '9:30'] },
    { g: 2, t: 'علم للساعة', note: 'وإنه لعلم للساعة فلا تمترنّ بها واتبعون هذا صراط مستقيم. فسّر كثير من المفسرين الضمير في «وإنه» بعيسى عليه السلام، أي أن نزوله في آخر الزمان علامة على قرب الساعة، وفسّره آخرون بأنه عائد إلى القرآن.', keys: ['43:61'] },
    { g: 3, t: 'نذر أم مريم وولادتها', note: 'قالت امرأة عمران: رب إني نذرت لك ما في بطني محرراً، فلما وضعتها قالت: إني وضعتها أنثى وإني سميتها مريم وإني أعيذها بك وذريتها من الشيطان الرجيم.', keys: ['3:35', '3:36'] },
    { g: 3, t: 'كفالة زكريا ورزق مريم', note: 'تقبّلها ربها بقبول حسن وأنبتها نباتاً حسناً وكفلها زكريا، وكان يجد عندها رزقاً: أنّى لك هذا؟ قالت: هو من عند الله.', keys: ['3:37'] },
    { g: 3, t: 'اصطفاؤها على نساء العالمين', note: 'قالت الملائكة: يا مريم إن الله اصطفاك وطهرك واصطفاك على نساء العالمين، يا مريم اقنتي لربك واسجدي واركعي مع الراكعين.', keys: ['3:42', '3:43'] },
    { g: 3, t: 'البشارة والحمل', note: 'اعتزلت أهلها في مكان شرقي، فأرسل الله إليها روحه (جبريل) في صورة بشر سويّ، فبشّرها بغلام زكي، فحملته وانتبذت به مكاناً قصياً.', keys: ['19:16', '19:17', '19:22'] },
    { g: 3, t: 'الولادة وجذع النخلة', note: 'جاءها المخاض إلى جذع النخلة، فناداها من تحتها ألا تحزني قد جعل ربك تحتك سرياً، وهزي إليك بجذع النخلة تساقط عليك رطباً جنياً.', keys: ['19:23', '19:24', '19:25', '19:26'] },
    { g: 3, t: 'اتهامها وبراءتها', note: 'أتت به قومها تحمله فاتهموها، فأشارت إلى المولود فتكلّم، وبذلك ظهرت براءتها. وردّ القرآن على من رماها بالبهتان.', keys: ['19:27', '19:28', '19:29', '4:156'] },
    { g: 3, t: 'مثل المؤمنين وآية للعالمين', note: 'جعلها الله مثلاً للذين آمنوا: أحصنت فرجها وصدّقت بكلمات ربها وكتبه وكانت من القانتين، وجعلها وابنها آية للعالمين.', keys: ['66:12', '21:91', '23:50'] },
    { g: 4, t: 'إيمان المسلم بعيسى والرسل', note: 'المسلم يؤمن بعيسى وبجميع الأنبياء والرسل إيماناً لا يصحّ الإسلام بدونه، ولا يفرّق بين أحد منهم. ومن كفر برسل الله فقد ضلّ ضلالاً بعيداً.', keys: ['2:285', '2:136', '3:84', '4:136', '4:152'] },
    { g: 4, t: 'عيسى عبد الله ورسوله وكلمته', note: 'نحب عيسى ونوقّره ونصلّي ونسلّم عليه كما نفعل مع سائر الأنبياء؛ فهو عبد الله ورسوله وكلمته ألقاها إلى مريم وروح منه، وجيه في الدنيا والآخرة ومن المقرّبين، ومن الصالحين.', keys: ['4:171', '3:45', '3:46', '6:85'] },
    { g: 4, t: 'أنبياء إخوة', note: 'ورد في الحديث الصحيح (البخاري ومسلم) قول النبي ﷺ: «أنا أولى الناس بعيسى ابن مريم في الدنيا والآخرة، والأنبياء إخوة لعلّات، أمهاتهم شتى ودينهم واحد».', keys: [] },
    { g: 4, t: 'الشهادة التي تشمل عيسى', note: 'جاء في الصحيحين قوله ﷺ: «من شهد أن لا إله إلا الله وحده لا شريك له، وأن محمداً عبده ورسوله، وأن عيسى عبد الله ورسوله وكلمته ألقاها إلى مريم وروح منه، وأن الجنة حق والنار حق، أدخله الله الجنة على ما كان من العمل».', keys: [] },
    { g: 4, t: 'السلام على عيسى', note: 'قال عيسى عليه السلام: «والسلام عليّ يوم ولدت ويوم أموت ويوم أبعث حياً»، وهو مبارك أينما كان، وأوصاه الله بالصلاة والزكاة ما دام حياً.', keys: ['19:33', '19:31'] },
    { g: 4, t: 'مريم الطاهرة المصطفاة بلا ذنب', note: 'لا يقول المسلم في مريم إلا خيراً: اصطفاها الله وطهّرها على نساء العالمين، وهي الصدّيقة القانتة التي أحصنت فرجها وصدّقت بكلمات ربها وكتبه، وبرّأها الله ممّا رماها به قومها.', keys: ['3:42', '66:12', '5:75', '19:20'] },
    { g: 4, t: 'حفظ الله لمريم وابنها من الشيطان', note: 'دعت أم مريم: «وإني أعيذها بك وذريتها من الشيطان الرجيم»، وجاء في الصحيحين أن النبي ﷺ قال: «ما من مولود إلا مسّه الشيطان حين يولد... إلا مريم وابنها»، فاستجاب الله دعاءها.', keys: ['3:36'] },
  ],
};
TOPICS.jews = {
  groups: [['🌟', 'من هم، وفضل الله عليهم'], ['🌊', 'قصتهم مع موسى'], ['⚖️', 'ما عاتبهم عليه القرآن'], ['🤝', 'إنصاف القرآن لمن آمن وأحسن منهم'], ['🕊️', 'معاملة المسلمين لهم']],
  items: [
    { g: 0, t: 'من هم بنو إسرائيل؟', note: 'ذرية يعقوب عليه السلام، ومنهم أنبياء كثيرون. وسُمّي منهم «الذين هادوا»، وقيل إن أصل الكلمة من الرجوع والتوبة كما في قول موسى: «إنا هدنا إليك».', keys: ['2:40', '3:93', '7:156'] },
    { g: 0, t: 'فضل الله عليهم', note: 'ذكّرهم الله بنعمه: فضّلهم على عالمي زمانهم، وآتاهم الكتاب والحكم والنبوة، وجعل فيهم أنبياء وملوكاً، وأنجاهم من العذاب المهين.', keys: ['2:47', '2:122', '45:16', '5:20', '44:30', '44:32', '10:93'] },
    { g: 0, t: 'التوراة والأنبياء فيهم', note: 'أنزل الله التوراة فيها هدى ونور، يحكم بها النبيون الذين أسلموا للذين هادوا والربانيون والأحبار. ومن أنبيائهم: موسى وهارون وداود وسليمان ويعقوب ويوسف وزكريا ويحيى وعيسى (إلى بني إسرائيل).', keys: ['5:44', '2:246'] },
    { g: 1, t: 'النجاة من فرعون وشق البحر', note: 'نجّاهم الله من آل فرعون الذين كانوا يذبّحون أبناءهم ويستحيون نساءهم، وفرق بهم البحر فأنجاهم وأغرق فرعون وجنوده.', keys: ['2:49', '2:50'] },
    { g: 1, t: 'العجل والتوبة', note: 'بعد ذهاب موسى لميقات ربه اتخذ بعضهم العجل، فقال لهم: إنكم ظلمتم أنفسكم باتخاذكم العجل فتوبوا إلى بارئكم، وتاب الله عليهم.', keys: ['2:51', '2:54', '7:138'] },
    { g: 1, t: 'بقرة بني إسرائيل', note: 'أمرهم الله بذبح بقرة، فكثر سؤالهم وتشدّدوا فشدّد الله عليهم، ثم ذبحوها وما كادوا يفعلون.', keys: ['2:67'] },
    { g: 1, t: 'المنّ والسلوى والتيه', note: 'أنزل الله عليهم المنّ والسلوى فملّوا وطلبوا غيرهما. ولما أُمروا بدخول الأرض المقدسة تقاعسوا، فحرّمها الله عليهم أربعين سنة يتيهون في الأرض.', keys: ['2:61', '5:21', '5:26'] },
    { g: 2, t: 'نقض الميثاق وتحريف الكلم', note: 'ذكر القرآن أن فريقاً منهم كانوا يسمعون كلام الله ثم يحرّفونه من بعد ما عقلوه، ونقضوا الميثاق فلُعنوا وقست قلوبهم. وهذا وصف لفريق منهم لا لكلّ فرد.', keys: ['2:75', '5:13'] },
    { g: 2, t: 'قتل الأنبياء وتكذيب الآيات', note: 'عاب القرآن على من قتل الأنبياء بغير حق وكفر بآيات الله من بني إسرائيل في عهود قديمة، وهو عتاب لأفعال بعينها وقعت من فئات بعينها.', keys: ['4:155'] },
    { g: 2, t: 'ترك التناهي عن المنكر', note: 'لُعن الذين كفروا من بني إسرائيل على لسان داود وعيسى ابن مريم بسبب عصيانهم واعتدائهم، وأنهم كانوا لا يتناهون عن منكر فعلوه.', keys: ['5:78', '5:79'] },
    { g: 2, t: 'مثل من حمل التوراة ولم يعمل بها', note: 'ضرب الله مثلاً للذين حُمّلوا التوراة ثم لم يعملوا بها: كمثل الحمار يحمل أسفاراً. والتشبيه لمن حمل العلم ولم ينتفع به.', keys: ['62:5'] },
    { g: 3, t: 'ليسوا سواء', note: 'فصّل القرآن بإنصاف: من أهل الكتاب أمة قائمة يتلون آيات الله آناء الليل وهم يسجدون، ويؤمنون بالله واليوم الآخر، ويأمرون بالمعروف وينهون عن المنكر، وأولئك من الصالحين.', keys: ['3:113', '3:114', '7:159', '5:66'] },
    { g: 3, t: 'الأمانة منهم', note: 'ومن أهل الكتاب من إن تأمنه بقنطار يؤدّه إليك، ومنهم من إن تأمنه بدينار لا يؤدّه إليك: إنصاف يذكر الأمين والخائن.', keys: ['3:75'] },
    { g: 3, t: 'من آمن منهم له أجره', note: 'إن الذين آمنوا والذين هادوا والنصارى والصابئين من آمن بالله واليوم الآخر وعمل صالحاً فلهم أجرهم عند ربهم ولا خوف عليهم ولا هم يحزنون.', keys: ['2:62'] },
    { g: 3, t: 'الذين آمنوا بالقرآن من أهل الكتاب', note: 'الذين آتاهم الله الكتاب من قبله هم به يؤمنون، وإذا يُتلى عليهم قالوا: آمنا به إنه الحق من ربنا، إنا كنا من قبله مسلمين.', keys: ['28:52', '28:53'] },
    { g: 4, t: 'الجدال بالتي هي أحسن', note: 'أمر القرآن المسلمين بمحاورة أهل الكتاب بالتي هي أحسن، وأن يقولوا: آمنا بالذي أُنزل إلينا وأُنزل إليكم وإلهنا وإلهكم واحد ونحن له مسلمون.', keys: ['29:46'] },
    { g: 4, t: 'البرّ والقسط مع من لم يقاتل', note: 'لا ينهى الله المسلمين عن الذين لم يقاتلوهم في الدين ولم يخرجوهم من ديارهم أن يبرّوهم ويقسطوا إليهم، إن الله يحب المقسطين.', keys: ['60:8'] },
    { g: 4, t: 'طعام أهل الكتاب والمصاهرة', note: 'أحلّ الله للمسلمين طعام أهل الكتاب وأحلّ طعامهم لهم، وأحلّ نكاح المحصنات من الذين أوتوا الكتاب، وهذا من صور التعايش.', keys: ['5:5'] },
    { g: 4, t: 'ما نزل في زمن العداوة', note: 'في المدينة وقعت حروب وعداوات بين المسلمين وبعض يهود المدينة، فجاء قوله: «لتجدن أشد الناس عداوة للذين آمنوا اليهود والذين أشركوا». وهو وصف لجماعة في ذلك الزمان بسبب مواقفها، وليس حكماً على كل يهودي، والآية التالية تمدح من النصارى من آمن.', keys: ['5:82', '5:83'] },
  ],
};
TOPICS.others = { groups: TOPICS.people.groups.slice(1), items: TOPICS.people.items.filter((i) => i.g > 0).map((i) => ({ ...i, g: i.g - 1 })) };
delete TOPICS.people;
TOPICS.duasp = {
  groups: [['🌧️', 'التوبة والاستغفار'], ['🆘', 'الكرب والشدة والنصرة'], ['👨‍👩‍👧', 'الذرية والأهل والبلد'], ['📚', 'العلم والشكر والحكمة'], ['🕋', 'القبول والثبات والخاتمة']],
  items: [
    { g: 0, t: "آدم وحواء", note: "دعاء التوبة الأول بعد الخطيئة: ربنا ظلمنا أنفسنا وإن لم تغفر لنا وترحمنا لنكونن من الخاسرين.", keys: ['7:23'] },
    { g: 0, t: "موسى: ظلمتُ نفسي", note: "قال بعد أن قتل الرجل خطأً: رب إني ظلمت نفسي فاغفر لي، فغفر الله له.", keys: ['28:16'] },
    { g: 0, t: "موسى وهارون", note: "قال موسى: رب اغفر لي ولأخي وأدخلنا في رحمتك وأنت أرحم الراحمين.", keys: ['7:151'] },
    { g: 0, t: "سليمان: ملك لا ينبغي", note: "دعاء الاستغفار وسؤال الملك: رب اغفر لي وهب لي ملكاً لا ينبغي لأحد من بعدي.", keys: ['38:35'] },
    { g: 0, t: "نوح: لوالديه وللمؤمنين", note: "رب اغفر لي ولوالديّ ولمن دخل بيتي مؤمناً وللمؤمنين والمؤمنات.", keys: ['71:28'] },
    { g: 0, t: "إبراهيم: يوم الحساب", note: "ربنا اغفر لي ولوالديّ وللمؤمنين يوم يقوم الحساب.", keys: ['14:41'] },
    { g: 1, t: "يونس: دعوة ذي النون", note: "نادى في الظلمات: لا إله إلا أنت سبحانك إني كنت من الظالمين، فاستجاب الله له ونجّاه من الغم.", keys: ['21:87', '21:88'] },
    { g: 1, t: "أيوب: مسّني الضر", note: "نادى ربه: أني مسّني الضر وأنت أرحم الراحمين، فاستجاب له وكشف ما به من ضر.", keys: ['21:83', '21:84'] },
    { g: 1, t: "نوح: أني مغلوب", note: "دعا ربه: أني مغلوب فانتصر.", keys: ['54:10'] },
    { g: 1, t: "لوط: انصرني", note: "رب انصرني على القوم المفسدين، ورب نجّني وأهلي مما يعملون.", keys: ['29:30', '26:169'] },
    { g: 1, t: "يعقوب: أشكو بثي", note: "قال: إنما أشكو بثي وحزني إلى الله وأعلم من الله ما لا تعلمون.", keys: ['12:86'] },
    { g: 1, t: "موسى: إني لما أنزلت إليّ من خير فقير", note: "دعاء الحاجة بعد أن سقى للمرأتين: رب إني لما أنزلت إليّ من خير فقير.", keys: ['28:24'] },
    { g: 1, t: "يوسف: إِلَّا تَصْرِفْ عَنِّى كَيْدَهُنَّ", note: "رب السجن أحب إليّ مما يدعونني إليه وإلا تصرف عني كيدهن أصبُ إليهن.", keys: ['12:33'] },
    { g: 2, t: "إبراهيم: رب اجعلني مقيم الصلاة", note: "رب اجعلني مقيم الصلاة ومن ذريتي ربنا وتقبل دعاء.", keys: ['14:40'] },
    { g: 2, t: "إبراهيم: بلداً آمناً", note: "رب اجعل هذا البلد آمناً وارزق أهله من الثمرات من آمن منهم بالله واليوم الآخر.", keys: ['2:126'] },
    { g: 2, t: "إبراهيم: هب لي من الصالحين", note: "رب هب لي من الصالحين، فبشّره الله بغلام حليم.", keys: ['37:100'] },
    { g: 2, t: "زكريا: هب لي من لدنك ذرية", note: "رب هب لي من لدنك ذرية طيبة إنك سميع الدعاء.", keys: ['3:38'] },
    { g: 2, t: "زكريا: وهن العظم", note: "رب إني وهن العظم مني واشتعل الرأس شيباً ولم أكن بدعائك رب شقياً.", keys: ['19:4'] },
    { g: 2, t: "زكريا: لا تذرني فرداً", note: "رب لا تذرني فرداً وأنت خير الوارثين.", keys: ['21:89'] },
    { g: 3, t: "موسى: اشرح لي صدري", note: "رب اشرح لي صدري ويسّر لي أمري واحلل عقدة من لساني يفقهوا قولي.", keys: ['20:25', '20:26', '20:27', '20:28'] },
    { g: 3, t: "سليمان: أوزعني أن أشكر", note: "رب أوزعني أن أشكر نعمتك التي أنعمت عليّ وعلى والديّ وأن أعمل صالحاً ترضاه.", keys: ['27:19'] },
    { g: 3, t: "يوسف: توفّني مسلماً", note: "رب قد آتيتني من الملك وعلّمتني من تأويل الأحاديث، فاطر السماوات والأرض أنت وليي في الدنيا والآخرة توفّني مسلماً وألحقني بالصالحين.", keys: ['12:101'] },
    { g: 3, t: "إبراهيم: هب لي حكماً", note: "رب هب لي حكماً وألحقني بالصالحين، واجعل لي لسان صدق في الآخرين.", keys: ['26:83', '26:84'] },
    { g: 3, t: "محمد ﷺ: رب زدني علماً", note: "أُمر أن يقول: رب زدني علماً.", keys: ['20:114'] },
    { g: 3, t: "محمد ﷺ: مدخل صدق", note: "رب أدخلني مدخل صدق وأخرجني مخرج صدق واجعل لي من لدنك سلطاناً نصيراً.", keys: ['17:80'] },
    { g: 4, t: "إبراهيم وإسماعيل: تقبّل منا", note: "وهما يرفعان القواعد من البيت: ربنا تقبل منا إنك أنت السميع العليم، واجعلنا مسلمَين لك.", keys: ['2:127', '2:128'] },
    { g: 4, t: "نوح: منزلاً مباركاً", note: "رب أنزلني منزلاً مباركاً وأنت خير المنزلين.", keys: ['23:29'] },
    { g: 4, t: "شعيب: افتح بيننا", note: "ربنا افتح بيننا وبين قومنا بالحق وأنت خير الفاتحين.", keys: ['7:89'] },
    { g: 4, t: "عيسى: المائدة", note: "قال عيسى ابن مريم: اللهم ربنا أنزل علينا مائدة من السماء تكون لنا عيداً.", keys: ['5:114'] },
    { g: 4, t: "محمد ﷺ: من همزات الشياطين", note: "رب أعوذ بك من همزات الشياطين وأعوذ بك رب أن يحضرون.", keys: ['23:97', '23:98'] },
    { g: 4, t: "محمد ﷺ: اغفر وارحم", note: "وقل رب اغفر وارحم وأنت خير الراحمين.", keys: ['23:118'] },
    { g: 4, t: "محمد ﷺ: حسبي الله", note: "فإن تولوا فقل حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم.", keys: ['9:129'] },
  ],
};
TOPICS.duasb = {
  groups: [['🧭', 'الهداية والثبات'], ['💚', 'المغفرة والرحمة'], ['🔥', 'الدنيا والآخرة والنجاة من النار'], ['👪', 'الأهل والوالدان والذرية'], ['⛰️', 'الصبر والنصر'], ['✨', 'أدعية أخرى']],
  items: [
    { g: 0, t: "اهدنا الصراط المستقيم", note: "أعظم دعاء في الفاتحة، يقرؤه المسلم في كل ركعة: اهدنا الصراط المستقيم صراط الذين أنعمت عليهم.", keys: ['1:6', '1:7'] },
    { g: 0, t: "لا تُزغ قلوبنا", note: "ربنا لا تزغ قلوبنا بعد إذ هديتنا وهب لنا من لدنك رحمة إنك أنت الوهاب.", keys: ['3:8'] },
    { g: 0, t: "فاكتبنا مع الشاهدين", note: "ربنا آمنا بما أنزلت واتبعنا الرسول فاكتبنا مع الشاهدين، قالها الحواريون.", keys: ['3:53'] },
    { g: 0, t: "فتية الكهف: رحمة ورشداً", note: "ربنا آتنا من لدنك رحمة وهيئ لنا من أمرنا رشداً.", keys: ['18:10'] },
    { g: 1, t: "ربنا لا تؤاخذنا", note: "من خواتيم البقرة: ربنا لا تؤاخذنا إن نسينا أو أخطأنا، واعفُ عنا واغفر لنا وارحمنا أنت مولانا.", keys: ['2:286'] },
    { g: 1, t: "ربنا إننا آمنا", note: "ربنا إننا آمنا فاغفر لنا ذنوبنا وقنا عذاب النار.", keys: ['3:16'] },
    { g: 1, t: "اغفر لنا ذنوبنا وإسرافنا", note: "ربنا اغفر لنا ذنوبنا وإسرافنا في أمرنا وثبّت أقدامنا وانصرنا على القوم الكافرين.", keys: ['3:147'] },
    { g: 1, t: "ربنا آمنا فاغفر لنا", note: "ربنا آمنا فاغفر لنا وارحمنا وأنت خير الراحمين.", keys: ['23:109'] },
    { g: 1, t: "ولإخواننا الذين سبقونا", note: "ربنا اغفر لنا ولإخواننا الذين سبقونا بالإيمان ولا تجعل في قلوبنا غلاً للذين آمنوا.", keys: ['59:10'] },
    { g: 1, t: "أتمم لنا نورنا", note: "ربنا أتمم لنا نورنا واغفر لنا إنك على كل شيء قدير.", keys: ['66:8'] },
    { g: 2, t: "حسنة في الدنيا والآخرة", note: "ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار.", keys: ['2:201'] },
    { g: 2, t: "ربنا ما خلقت هذا باطلاً", note: "دعاء أولي الألباب بعد التفكر في خلق السماوات والأرض: فقنا عذاب النار.", keys: ['3:191', '3:192'] },
    { g: 2, t: "اصرف عنا عذاب جهنم", note: "من دعاء عباد الرحمن: ربنا اصرف عنا عذاب جهنم إن عذابها كان غراماً.", keys: ['25:65'] },
    { g: 3, t: "قرة أعين", note: "ربنا هب لنا من أزواجنا وذرياتنا قرة أعين واجعلنا للمتقين إماماً.", keys: ['25:74'] },
    { g: 3, t: "أوزعني أن أشكر", note: "رب أوزعني أن أشكر نعمتك التي أنعمت عليّ وعلى والديّ وأن أعمل صالحاً ترضاه وأصلح لي في ذريتي.", keys: ['46:15'] },
    { g: 3, t: "رب ارحمهما", note: "دعاء للوالدين: رب ارحمهما كما ربياني صغيراً.", keys: ['17:24'] },
    { g: 4, t: "أفرغ علينا صبراً", note: "قالها جنود طالوت: ربنا أفرغ علينا صبراً وثبّت أقدامنا وانصرنا على القوم الكافرين.", keys: ['2:250'] },
    { g: 4, t: "وتوفنا مسلمين", note: "دعاء السحرة المؤمنين: ربنا أفرغ علينا صبراً وتوفنا مسلمين.", keys: ['7:126'] },
    { g: 4, t: "لا تجعلنا فتنة", note: "ربنا لا تجعلنا فتنة للقوم الظالمين، ونجّنا برحمتك من القوم الكافرين.", keys: ['10:85', '10:86'] },
    { g: 4, t: "لا تجعلنا فتنة للذين كفروا", note: "ربنا لا تجعلنا فتنة للذين كفروا واغفر لنا ربنا إنك أنت العزيز الحكيم.", keys: ['60:5'] },
    { g: 5, t: "امرأة فرعون: بيتاً في الجنة", note: "ضرب الله مثلاً للذين آمنوا امرأة فرعون إذ قالت: رب ابنِ لي عندك بيتاً في الجنة ونجّني من فرعون وعمله.", keys: ['66:11'] },
    { g: 5, t: "اللهم مالك الملك", note: "من الثناء والدعاء الذي علّمه الله نبيه: قل اللهم مالك الملك تؤتي الملك من تشاء وتنزع الملك ممن تشاء.", keys: ['3:26'] },
  ],
};
TOPICS.names.groups.push(['📋', 'الأسماء المتداولة (٩٩) التي لم يرد لفظها اسماً في القرآن']);
TOPICS.names.items.push(
    { g: 6, t: "القابض", note: "لم يرد «القابض» اسماً في القرآن؛ ورد معناه فعلاً: «والله يقبض ويبسط وإليه ترجعون».", keys: ['2:245'] },
    { g: 6, t: "الباسط", note: "لم يرد «الباسط» اسماً؛ ورد معناه فعلاً في قوله: «والله يقبض ويبسط».", keys: ['2:245'] },
    { g: 6, t: "الخافض", note: "لم يرد اسماً لله؛ ورد وصف الواقعة (القيامة) بأنها «خافضة رافعة».", keys: ['56:3'] },
    { g: 6, t: "الرافع", note: "لم يرد «الرافع» اسماً؛ ورد قوله تعالى لعيسى: «إني متوفيك ورافعك إليّ».", keys: ['3:55'] },
    { g: 6, t: "المعز", note: "لم يرد اسماً؛ ورد فعلاً: «وتعز من تشاء وتذل من تشاء».", keys: ['3:26'] },
    { g: 6, t: "المذل", note: "لم يرد اسماً؛ ورد فعلاً: «وتعز من تشاء وتذل من تشاء».", keys: ['3:26'] },
    { g: 6, t: "الحَكَم", note: "لم يرد «الحَكَم» اسماً لله بلفظه؛ ورد قوله: «أفغير الله أبتغي حكماً».", keys: ['6:114'] },
    { g: 6, t: "العدل", note: "لم يرد «العدل» اسماً لله في القرآن؛ ورد أمره بالعدل: «إن الله يأمر بالعدل والإحسان».", keys: ['16:90'] },
    { g: 6, t: "الجليل", note: "لم يرد «الجليل» لفظاً؛ ورد «ذو الجلال والإكرام».", keys: ['55:27'] },
    { g: 6, t: "الباعث", note: "لم يرد «الباعث» اسماً؛ ورد فعلاً: «وأن الله يبعث من في القبور».", keys: ['22:7'] },
    { g: 6, t: "المحصي", note: "لم يرد «المحصي» اسماً؛ ورد فعلاً: «وأحصى كل شيء عدداً».", keys: ['72:28'] },
    { g: 6, t: "المبدئ", note: "لم يرد «المبدئ» اسماً؛ ورد فعلاً: «إنه هو يبدئ ويعيد».", keys: ['85:13'] },
    { g: 6, t: "المعيد", note: "لم يرد «المعيد» اسماً؛ ورد فعلاً: «إنه هو يبدئ ويعيد».", keys: ['85:13'] },
    { g: 6, t: "المحيي", note: "ورد مضافاً لا مفرداً: «إن ذلك لمحيي الموتى»؛ وكثيراً ما ورد فعلاً: «يحيي ويميت».", keys: ['30:50'] },
    { g: 6, t: "المميت", note: "لم يرد «المميت» اسماً؛ ورد فعلاً: «هو يحيي ويميت».", keys: ['40:68'] },
    { g: 6, t: "الواجد", note: "لم يرد «الواجد» اسماً لله؛ ورد الفعل «وجد» في قوله: «ووجدك ضالاً فهدى».", keys: ['93:7'] },
    { g: 6, t: "الماجد", note: "لم يرد «الماجد» لفظاً؛ الوارد «المجيد»، وهو في قائمة الأسماء الواردة أعلاه.", keys: ['85:15'] },
    { g: 6, t: "المقدِّم", note: "لم يرد في القرآن لفظاً. وورد في السنة في دعاء النبي ﷺ: «أنت المقدِّم وأنت المؤخِّر لا إله إلا أنت».", keys: [] },
    { g: 6, t: "المؤخِّر", note: "لم يرد في القرآن لفظاً. وورد في السنة في دعاء النبي ﷺ: «أنت المقدِّم وأنت المؤخِّر لا إله إلا أنت».", keys: [] },
    { g: 6, t: "الوالي", note: "لم يرد «الوالي» لله اسماً؛ ورد نفي «وال» عن غيره: «وما لهم من دونه من والٍ».", keys: ['13:11'] },
    { g: 6, t: "المنتقم", note: "لم يرد «المنتقم» مفرداً؛ ورد «ذو انتقام» (14:47) و«إنا من المجرمين منتقمون» (32:22).", keys: ['32:22'] },
    { g: 6, t: "المقسط", note: "لم يرد «المقسط» مفرداً اسماً لله؛ ورد أن الله «يحب المقسطين».", keys: ['5:42'] },
    { g: 6, t: "المغني", note: "لم يرد «المغني» اسماً؛ ورد فعلاً: «فسوف يغنيكم الله من فضله».", keys: ['9:28'] },
    { g: 6, t: "المانع", note: "لم يرد في القرآن لفظاً. وورد في السنة في ذكر دبر الصلاة: «اللهم لا مانع لما أعطيت ولا معطي لما منعت».", keys: [] },
    { g: 6, t: "الضار", note: "لم يرد «الضار» اسماً؛ ورد معناه: «وإن يمسسك الله بضر فلا كاشف له إلا هو».", keys: ['6:17'] },
    { g: 6, t: "النافع", note: "لم يرد «النافع» اسماً؛ ورد معناه: «وإن يمسسك بخير فهو على كل شيء قدير».", keys: ['6:17'] },
    { g: 6, t: "الباقي", note: "لم يرد «الباقي» اسماً؛ ورد معناه: «ويبقى وجه ربك ذو الجلال والإكرام».", keys: ['55:27'] },
    { g: 6, t: "الوارث", note: "لم يرد مفرداً لله؛ ورد بصيغة الجمع: «ونحن الوارثون» (وفي 21:89: «وأنت خير الوارثين»).", keys: ['15:23'] },
    { g: 6, t: "الرشيد", note: "لم يرد «الرشيد» وصفاً لله؛ ورد في الآية على لسان قوم شعيب وصفاً له: «إنك لأنت الحليم الرشيد».", keys: ['11:87'] },
    { g: 6, t: "الصبور", note: "لم يرد «الصبور» وصفاً لله في القرآن؛ ورد: «إن الله مع الصابرين».", keys: ['2:153'] },
);
/* numbers page: number words inside a verse are coloured */
const NUMW = /^(?:[وفبلك]|ال|لل|وال|فال|بال)?(?:واحد|وحد|احد|اثنت|اثن|ثنت|ثلث|ثلاث|اربع|خمس|ست|سبع|ثمني|ثمن|ثمان|تسع|عشر|مائت|مائ|ميه|مايه|الف|الاف|نصف|ربع|سدس|بضع|زوج|شهرين|شهران)(?:ه|ا|ي|ان|ين|ون|ات)?$/;
const hlNum = (t) => t.split(/\s+/).map((w) => {
  const n = w.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  return NUMW.test(n) ? `<span class="nw">${esc(w)}</span>` : esc(w);
}).join(' ');
/* an opened box stays in place (highlighted); its explanation opens as a full-width panel under its row */
function panelize(list) {
  const place = (d) => {
    const top = d.offsetTop; let last = d;
    for (let n = d.nextElementSibling; n; n = n.nextElementSibling) if (n.classList.contains('lesson') && n.offsetTop === top) last = n;
    last.after(d._p);
    const col = d.parentNode, wide = col.classList.contains('gcards') && col.closest('.ncols');   // a card in a narrow column: the panel spans all the columns
    if (wide) { const W = wide.getBoundingClientRect(), C = col.getBoundingClientRect(); d._p.style.width = W.width + 'px'; d._p.style.marginRight = (C.right - W.right) + 'px'; }
  };
  list.addEventListener('toggle', (e) => {
    const d = e.target; if (!d.classList || !d.classList.contains('lesson')) return;
    if (!d._p) { d._p = document.createElement('div'); d._p.className = 'npanel'; [...d.children].slice(1).forEach((c) => d._p.append(c)); }
    if (d.open) place(d); else d._p.remove();
  }, true);
  addEventListener('resize', () => list.querySelectorAll('.lesson[open]').forEach((d) => d._p && place(d)));
}
const PANEL_TOPICS = ['numbers', 'jannah', 'jannah2', 'jesus', 'qiyamah', 'hafiz', 'names'];      // topic pages whose boxes open as a full-width panel, verses as «سورة … — الآية …: text»
const topicInit = {};
async function initTopic(name) {
  if (topicInit[name]) return; topicInit[name] = true;
  const T = TOPICS[name], list = $('t-' + name);
  if (name === 'jannah' || name === 'jannah2') {           // researched items: approved ones, and pending ones (marked) until the admin decides
    try { const x = await (await fetch('/api/topic-extra?topic=jannah')).json(); if (Array.isArray(x)) for (const e of x) if (e.keys?.length) T.items.push({ g: 0, t: e.t, note: e.note, keys: e.keys, pending: e.pending }); } catch { /* the built-in items are enough */ }
    const AFTER = [['الحور العين', 'الأزواج المطهّرة'], ['الغرف', 'المساكن الطيبة'], ['الأرائك والسرر', 'الغرف'], ['أسماء الجنة', null], ['الفُرُش والرفرف والعبقري', 'الغرف']];    // [item, the item it follows (null: first)]
    for (const [t, prev] of AFTER) { const i = T.items.findIndex((m) => m.t === t); if (i < 0) continue; const [m] = T.items.splice(i, 1); const j = T.items.findIndex((x) => x.t === prev); T.items.splice(prev === null ? 0 : j < 0 ? T.items.length : j + 1, 0, m); }
    // final order: the promise and who enters it, then what its people see and enjoy, then food and drink last (anything not listed sits before the food)
    const PROMISE = ['من صفات الوارثين للفردوس', 'نهي النفس عن الهوى', 'السابقون وأصحاب اليمين', 'بشارة الملائكة ونُزُل الجنة', 'النور والبشرى', 'إزلاف الجنة', 'أبواب الجنة', 'ميراث الجنة ومعرفتها', 'رَوح وريحان', 'أسماء الجنة', 'سعة الجنة', 'درجات الجنة', 'الجنتان ومن دونهما جنتان', 'الخلود', 'لا موت فيها'];
    const ENJOY = ['النظر إلى وجه الله', 'رضوان الله', 'ما أُخفي لهم', 'لهم ما يشاؤون ولدينا مزيد', 'السلام', 'نزع الغلّ', 'الأمن في الجنة', 'لا نَصَب ولا لُغوب', 'نضرة النعيم', 'حمد أهل الجنة', 'شغل أهل الجنة', 'تساؤل أهل الجنة', 'المؤمن وقرينه', 'الوعد الحق', 'لحاق الذرية بالآباء', 'الأزواج المطهّرة', 'الحور العين', 'الولدان المخلّدون', 'المساكن الطيبة', 'الغرف', 'الفُرُش والرفرف والعبقري', 'الأرائك والسرر', 'الحلي والثياب', 'الظلّ الظليل', 'السدر المخضود والطلح المنضود', 'خير مستقرّ وأحسن مقيل', 'النعيم المقيم والملك الكبير'];
    const FOOD = ['أنهار الجنة', 'عيون الجنة', 'الفاكهة', 'ثمار متشابهة', 'قطوفها دانية', 'الطعام واللحم', 'الشراب', 'الرحيق المختوم والتسنيم', 'كأس لا لغو فيها'];
    const rank = (t) => { const k = [...PROMISE, ...ENJOY].indexOf(t); if (k >= 0) return k; const f = FOOD.indexOf(t); return f >= 0 ? 1000 + f : 999; };
    T.items = T.items.map((m, i) => [m, i]).sort(([a, i], [b, j]) => rank(a.t) - rank(b.t) || i - j).map(([m]) => m);
  }
  const NC = name === 'names' ? await loadNameCounts() : null;      // how many times each name's word occurs (see the statistics screen)
  list.innerHTML = T.groups.map((G, gi) => `<div class="mgroup"><h3><span>${G[0]}</span>${esc(G[1])} <small class="cnt">(${nA(T.items.filter((m) => m.g === gi).length)})</small></h3><div class="mgrid">` +
    T.items.map((m, i) => [m, i]).filter(([m]) => m.g === gi).sort(([a], [b]) => name === 'names' ? AMBIGUOUS.has(a.t) - AMBIGUOUS.has(b.t) : 0).map(([m, i]) => `<details class="lesson${m.wide ? ' wide' : ''}${m.pending ? ' pending' : ''}" data-i="${i}"><summary${name === 'names' && m.t.length > 11 ? ' class="fit"' : ''}>${name === 'prophets' ? `${esc(m.t.replace(' ﷺ', ''))}<span class="hon">${m.t.includes('ﷺ') ? 'ﷺ' : '﵇'}</span>` : esc(m.t)}${m.pending ? '<span class="pend">قيد المراجعة</span>' : ''}${NC && m.g < 6 && NC[m.t] ? `<span class="nc" title="عدد مرات ورود اللفظ في القرآن${AMBIGUOUS.has(m.t) ? ' (يرد اللفظ لغير الله أيضاً)' : ''}">${AMBIGUOUS.has(m.t) ? '<span class="warn">⚠</span>' : ''}${nA(NC[m.t].n)}</span>` : ''}</summary><div>${esc(m.note)}</div><div class="exs"><div class="tag">جارٍ تحميل الآيات…</div></div></details>`).join('') + '</div></div>').join('');
  if (name === 'names') {                                   // last group on top (collapsed); the six main groups become vertical, collapsible columns
    const groups = [...list.querySelectorAll('.mgroup')];
    const make = (g, cls, open) => {
      const d = document.createElement('details'), s = document.createElement('summary'), cards = g.querySelector('.mgrid');
      d.className = cls; d.open = open; s.innerHTML = g.querySelector('h3').innerHTML;
      cards.className = cls === 'ggroup' ? 'mgrid' : 'gcards'; d.append(s, cards); return d;
    };
    const extra = groups.pop(), cols = document.createElement('div');
    cols.className = 'ncols'; [0, 2, 4, 1, 3, 5].forEach((k) => groups[k] && cols.append(make(groups[k], 'gcol', true)));   // column order (right to left)
    const countsNote = document.getElementById('countsNote');            // order: note about the 99 names, THEN this collapsible group, THEN the note about the counts, then the columns
    const top = make(extra, 'ggroup', false), n99 = document.getElementById('n99Note');      // the note about the 99-name list goes inside this group, above its cards
    if (n99) top.querySelector('summary').after(n99);
    const inQ = document.createElement('details');                                // the names found in the Quran: one collapsible box with the note about the counts and the six columns
    inQ.className = 'ggroup qgroup'; inQ.open = true;
    inQ.innerHTML = `<summary><span>📖</span>الأسماء الواردة بلفظها في القرآن <small class="cnt">(${nA(T.items.filter((m) => m.g < 6).length)})</small></summary>`;
    if (countsNote) inQ.append(countsNote);
    inQ.append(cols);
    list.innerHTML = ''; list.append(top, inQ);
  }
  list.addEventListener('toggle', async (e) => {
    const d = e.target; if (!d.open || d.dataset.done || !d.dataset.i) return; d.dataset.done = 1;
    const m = T.items[+d.dataset.i], box = d.querySelector('.exs');
    try {
      if (!m.keys.length) { box.innerHTML = '<div class="tag">لا موضع قرآني لهذا اللفظ؛ مصدره السنة.</div>'; return; }
      let vs = [];
      for (let k = 0; k < m.keys.length; k += 8) vs = vs.concat(await (await fetch('/api/ayat?keys=' + m.keys.slice(k, k + 8).join(','))).json());
      box.innerHTML = vs.map((v) => PANEL_TOPICS.includes(name) ? `<div class="ex"><div class="vt"><span class="tag">سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)}:</span> ${name === 'numbers' ? hlNum(v.text) : esc(v.text)}</div></div>` : `<div class="ex"><div class="vt">${esc(v.text)}</div><div class="tag">سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)}</div></div>`).join('') || '<div class="tag">تعذّر تحميل الآيات.</div>';
    } catch { box.innerHTML = '<div class="tag">تعذّر تحميل الآيات.</div>'; }
  }, true);
  if (PANEL_TOPICS.includes(name)) panelize(list);
  if (['jannah', 'jannah2', 'qiyamah'].includes(name)) {  // a little space after every five rows of boxes
    const grid = list.querySelector('.mgrid');
    const gaps = () => {
      grid.querySelectorAll('.rgap').forEach((g) => g.remove());
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length, cards = [...grid.querySelectorAll(':scope > .lesson')];
      for (let k = cols * 5; k < cards.length; k += cols * 5) { const g = document.createElement('div'); g.className = 'rgap'; cards[k - 1].after(g); }
    };
    gaps(); addEventListener('resize', gaps);
  }
}
$('mgInfo').onclick = (e) => {
  const b = e.target.closest('.ig'); if (!b) return;
  const g = document.querySelectorAll('#t-management .mgroup')[+b.dataset.g]; if (!g) return;
  g.scrollIntoView({ behavior: 'smooth', block: 'start' }); g.classList.remove('flash'); void g.offsetWidth; g.classList.add('flash');
};
/* generic lazy loader for <details data-keys="s:a,s:a"> panels (verse texts straight from Quran.com) */
document.addEventListener('toggle', async (e) => {
  const d = e.target;
  if (!(d instanceof HTMLDetailsElement) || !d.dataset.keys || !d.open || d.dataset.done) return;
  d.dataset.done = 1; const box = d.querySelector('.exs'), keys = d.dataset.keys.split(',');
  try {
    let vs = []; for (let k = 0; k < keys.length; k += 8) vs = vs.concat(await (await fetch('/api/ayat?keys=' + keys.slice(k, k + 8).join(','))).json());
    box.innerHTML = vs.map((v) => `<div class="ex"><div class="vt">${esc(v.text)}</div><div class="tag">سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)}</div></div>`).join('') || '<div class="tag">تعذّر تحميل الآيات.</div>';
  } catch { box.innerHTML = '<div class="tag">تعذّر تحميل الآيات.</div>'; }
}, true);

/* ---------- عدد مرات ورود أسماء الله الحسنى (عنصر في شاشة الإحصاءات، وشارة على كل بطاقة اسم) ---------- */
const AMBIGUOUS = new Set(['الملك', 'الحق', 'الحي', 'الرب', 'الأول', 'الآخر', 'الظاهر', 'الباطن', 'المؤمن', 'الولي', 'المولى', 'البر', 'النور', 'السلام', 'الغني', 'الكبير', 'العزيز', 'الكريم', 'الأحد', 'الواحد', 'القوي', 'البصير', 'الشهيد', 'النصير', 'القريب', 'الهادي', 'الرحيم', 'الرؤوف', 'العليم', 'الحكيم', 'الحليم', 'الشكور', 'الخبير', 'الوكيل', 'الحسيب', 'الرقيب', 'المجيد', 'العلي', 'العظيم', 'الحفيظ', 'المهيمن', 'الجامع', 'الجبار']);
let ncData = null, ncSort = 'group';
async function loadNameCounts() {
  if (ncData) return ncData;
  try { ncData = await (await fetch('/names_counts.json')).json(); } catch { ncData = null; }
  return ncData;
}
async function renderNameCounts(box) {
  const data = await loadNameCounts();
  if (!data) { box.innerHTML = '<p class="hint">تعذّر تحميل الأعداد.</p>'; return; }
  const T = TOPICS.names;
  const all = T.items.filter((i) => i.g < 6 && data[i.t]).map((i, idx) => ({ t: i.t, g: i.g, idx, n: data[i.t].n, v: data[i.t].v }));
  const allah = all.find((r) => r.t === 'الله');                      // shown on its own above the table, not in the graph
  let rows = all.filter((r) => r.t !== 'الله');
  if (ncSort === 'most') rows.sort((a, b) => b.n - a.n); else if (ncSort === 'least') rows.sort((a, b) => a.n - b.n); else rows.sort((a, b) => a.g - b.g || a.idx - b.idx);
  const max = Math.max(...rows.map((r) => r.n));
  const flagged = all.filter((r) => AMBIGUOUS.has(r.t)).length;
  const disclaimer = `<div class="disc"><b>تنبيه — طريقة العدّ:</b> عُدّ اللفظ نفسه في نص القرآن، بالألف واللام أو بدونهما، ومع حروف «و، ف، ب، ل، ك» الملتصقة بأوله؛ فمثلاً تُعدّ «للرحمن» من «الرحمن». والأسماء المركّبة مثل «ذو الجلال والإكرام» تُعدّ عند ورود العبارة كاملة.<br><b>تحفّظ:</b> لا يستطيع العدّ أن يعرف هل يُراد باللفظ الله أم غيره، فبعض الأعداد أكبر من الحقيقة. وقد وُضعت علامة <span class="wsign">⚠︎</span> على هذه الألفاظ (${nA(flagged)} من ${nA(all.length)})، ومنها «الملك» و«الحق» و«المؤمن» و«العظيم»، وتوضّح اللوحة ذلك في أعلاها. وقائمة <span class="wsign">⚠︎</span> اجتهاد بعد مراجعة الاستعمال القرآني، فيُرجى عرضها على أحد أهل العلم قبل الاعتماد على الأرقام الدقيقة.</div>`;
  const sorters = [['group', 'حسب المجموعات'], ['most', 'الأكثر ورودًا'], ['least', 'الأقل ورودًا']];
  let lastG = -1;
  box.innerHTML = `${allah ? `<div class="allah"><span class="nm">الله</span><span class="num">${nA(allah.n)}</span></div>` : ''}
    <p class="how">العدد هو مرات ورود <b>لفظ</b> الاسم في نص القرآن (بالألف واللام أو بدونهما، ومع حروف «و، ف، ب، ل، ك» الملتصقة بأوله)، والأسماء المركّبة تُعدّ بورود العبارة كاملة. والعدّ لا يفرّق بين ما يُراد به الله وغيره، فعلامة <span class="wsign">⚠︎</span> على الأسماء التي ترد في القرآن لغير الله أيضاً (كالملك والحق والحي والمؤمن والعظيم)، فعددها يزيد عن عدد ورودها اسماً لله. وهذه العلامة من اجتهادي في مراجعة الاستعمال القرآني. وطول الشريط يتناسب مع العدد، ويُعرض لفظ الجلالة وحده فوق الجدول. ويظهر العدد نفسه على بطاقة كل اسم في شاشة «أسماء الله الحسنى».</p>
    <div class="nsort">${sorters.map(([k, n]) => `<button class="btn${ncSort === k ? ' on' : ''}" data-s="${k}">${n}</button>`).join('')}</div>
    <div class="key"><span class="wsign">⚠︎</span> = هذا اللفظ يرد في القرآن لغير الله أيضاً، فالعدد يشمل كل ورود اللفظ وليس وروده اسماً لله فقط.</div>
    <div class="cr head"><span>الاسم</span><span></span><span style="text-align:end">مرات الورود</span><span style="text-align:end">في آيات</span></div>` +
    rows.map((r) => {
      let sep = '';
      if (ncSort === 'group' && r.g !== lastG) { lastG = r.g; sep = `<div class="tag" style="margin:10px 0 2px;color:var(--accent);font-weight:700">${esc(T.groups[r.g][0] + ' ' + T.groups[r.g][1])}</div>`; }
      return sep + `<div class="cr"><span class="nm">${esc(r.t)}${AMBIGUOUS.has(r.t) ? '<span class="warn" title="يرد هذا اللفظ في القرآن لغير الله أيضاً">⚠</span>' : ''}</span><div class="ab"><i style="width:${(100 * r.n) / max}%"></i></div><span class="num">${nA(r.n)}</span><span class="vv">${nA(r.v)}</span></div>`;
    }).join('') + disclaimer;
  box.querySelector('.nsort').onclick = (e) => { const b = e.target.closest('button[data-s]'); if (b) { ncSort = b.dataset.s; renderNameCounts(box); } };
}
route();
