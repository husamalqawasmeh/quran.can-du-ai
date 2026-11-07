// sound helpers, the reciters list and favourites. One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
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
  saveFavs(); renderList(); fillSurahReaders(); fillDefReader(); if (mInit) fillEveryReader($('mReader')); if (lInit) fillEveryReader($('lReader'));
};
$('favonly').onclick = () => { favOnly = !favOnly; $('favonly').classList.toggle('on', favOnly); $('favonly').setAttribute('aria-pressed', favOnly); renderList(); };
saveFavs();
addEventListener('DOMContentLoaded', () => fetch('/api/reciters').then((r) => r.json()).then((r) => {   // after all the scripts: the callback uses surahs.js and ayah-audio.js
  reciters = r.sort((a, b) => arName(a).localeCompare(arName(b), 'ar'));
  $('cnt').textContent = '(' + nA(r.length) + ')';
  renderList(); fillSurahReaders(); fillDefReader();
}).catch(() => {}));
